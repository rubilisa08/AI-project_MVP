import { MANUAL_BASELINE_HOURS, computeSavingsPercent, formatDuration } from "@/lib/roi";

export function ROIBanner({ processingTimeMs }: { processingTimeMs: number }) {
  const savingsPercent = computeSavingsPercent(processingTimeMs);
  const aiDuration = formatDuration(processingTimeMs);
  const baselineLabel = `${MANUAL_BASELINE_HOURS}시간`;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30 print:border-zinc-300 print:bg-transparent">
      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        이 브리핑은 <span className="font-bold">{aiDuration}</span> 만에 생성되었습니다 — 수작업 대비 약{" "}
        <span className="font-bold">{savingsPercent}%</span> 시간 절감 ({baselineLabel} → {aiDuration})
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">수작업</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full w-full rounded-full bg-zinc-400 dark:bg-zinc-600" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">AI 처리</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.max(1, 100 - savingsPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
