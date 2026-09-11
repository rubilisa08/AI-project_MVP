import type { VerifiedRisk } from "@/lib/types";

const CATEGORY_LABEL: Record<VerifiedRisk["category"], string> = {
  financial: "재무",
  market: "시장",
  operational: "운영",
};

const SEVERITY_STYLE: Record<VerifiedRisk["severity"], string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const SEVERITY_LABEL: Record<VerifiedRisk["severity"], string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export function RiskList({
  risks,
  onShowSource,
}: {
  risks: VerifiedRisk[];
  onShowSource: (chunkId: string) => void;
}) {
  if (risks.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Fact-Checker 검증을 통과한 리스크가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {risks.map((risk) => (
        <li key={risk.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {CATEGORY_LABEL[risk.category]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[risk.severity]}`}>
              심각도 {SEVERITY_LABEL[risk.severity]}
            </span>
            {risk.verdict === "partially_supported" && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                일부 검증됨
              </span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">{risk.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{risk.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {risk.sourceChunkIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onShowSource(id)}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                출처 {id} →
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
