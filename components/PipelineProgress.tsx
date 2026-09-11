import type { PipelineStage } from "@/lib/types";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "collector", label: "Collector" },
  { key: "financial_risk", label: "Financial & Risk" },
  { key: "fact_checker", label: "Fact-Checker" },
  { key: "publisher", label: "Publisher" },
];

export type StageStatus = "pending" | "active" | "done" | "error";

export function PipelineProgress({
  statuses,
  messages,
}: {
  statuses: Record<PipelineStage, StageStatus>;
  messages: Partial<Record<PipelineStage, string>>;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {STAGES.map((stage, idx) => {
        const status = statuses[stage.key];
        return (
          <li key={stage.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                status === "done"
                  ? "bg-emerald-500 text-white"
                  : status === "active"
                    ? "animate-pulse bg-indigo-500 text-white"
                    : status === "error"
                      ? "bg-red-500 text-white"
                      : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"
              }`}
            >
              {status === "done" ? "✓" : idx + 1}
            </span>
            <div>
              <p
                className={`text-sm font-medium ${
                  status === "pending" ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {stage.label}
              </p>
              {messages[stage.key] && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{messages[stage.key]}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
