import type { FinancialRatios } from "@/lib/types";
import { RatioVerificationBadge } from "./RatioVerificationBadge";

type Judgement = "good" | "warn" | "bad";

const JUDGEMENT_STYLE: Record<Judgement, string> = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const JUDGEMENT_LABEL: Record<Judgement, string> = { good: "양호", warn: "주의", bad: "위험" };

interface Metric {
  key: keyof FinancialRatios;
  label: string;
  unit: string;
  /** Higher-is-better metrics vs lower-is-better metrics need different threshold direction. */
  judge: (value: number) => Judgement;
}

const METRICS: Metric[] = [
  { key: "debtRatio", label: "부채비율", unit: "%", judge: (v) => (v <= 100 ? "good" : v <= 200 ? "warn" : "bad") },
  { key: "currentRatio", label: "유동비율", unit: "%", judge: (v) => (v >= 150 ? "good" : v >= 100 ? "warn" : "bad") },
  { key: "quickRatio", label: "당좌비율", unit: "%", judge: (v) => (v >= 100 ? "good" : v >= 70 ? "warn" : "bad") },
  {
    key: "operatingMargin",
    label: "영업이익률",
    unit: "%",
    judge: (v) => (v >= 10 ? "good" : v >= 5 ? "warn" : "bad"),
  },
  { key: "grossMargin", label: "매출총이익률", unit: "%", judge: (v) => (v >= 30 ? "good" : v >= 15 ? "warn" : "bad") },
  { key: "roe", label: "ROE", unit: "%", judge: (v) => (v >= 10 ? "good" : v >= 5 ? "warn" : "bad") },
  { key: "roa", label: "ROA", unit: "%", judge: (v) => (v >= 5 ? "good" : v >= 2 ? "warn" : "bad") },
  {
    key: "interestCoverageRatio",
    label: "이자보상배율",
    unit: "배",
    judge: (v) => (v >= 3 ? "good" : v >= 1 ? "warn" : "bad"),
  },
  {
    key: "revenueGrowth",
    label: "매출성장률",
    unit: "%",
    judge: (v) => (v >= 5 ? "good" : v >= 0 ? "warn" : "bad"),
  },
];

export function FinancialSnapshot({ ratios }: { ratios: FinancialRatios }) {
  const available = METRICS.filter((m) => typeof ratios[m.key] === "number");

  if (available.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        재무제표(Excel)가 제공되지 않아 계산된 재무비율이 없습니다.
      </p>
    );
  }

  const dataQuality = ratios.dataQuality;
  const balanceSheetIssue = dataQuality?.balanceSheetCheck && !dataQuality.balanceSheetCheck.balanced;
  const hasAnomalies = (dataQuality?.anomalies.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      {(balanceSheetIssue || hasAnomalies) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {balanceSheetIssue && dataQuality?.balanceSheetCheck && (
            <p className="font-medium">
              ⚠ 재무제표 정합성 오류: 자산총계가 부채총계+자본총계와{" "}
              {Math.abs(dataQuality.balanceSheetCheck.diffAmount).toLocaleString("ko-KR")}만큼 불일치합니다.
            </p>
          )}
          {hasAnomalies && (
            <ul className="mt-1 list-disc pl-4">
              {dataQuality?.anomalies.map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}
        </div>
      )}
      {ratios.period && (
        <p className="text-xs font-medium text-zinc-400">기준 기간: {ratios.period}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {available.map((metric) => {
          const value = ratios[metric.key] as number;
          const judgement = metric.judge(value);
          return (
            <div key={metric.key} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{metric.label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {value}
                {metric.unit}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${JUDGEMENT_STYLE[judgement]}`}
              >
                {JUDGEMENT_LABEL[judgement]}
              </span>
            </div>
          );
        })}
      </div>
      <RatioVerificationBadge verification={ratios.verification} />
    </div>
  );
}
