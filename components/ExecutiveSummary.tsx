import { renderWithGlossary } from "@/lib/highlight";
import type { GlossaryTerm } from "@/lib/types";

export function ExecutiveSummary({
  headline,
  summary,
  glossary,
  onShowSource,
}: {
  headline: string;
  summary: string[];
  glossary: GlossaryTerm[];
  onShowSource: (chunkId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{headline}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {summary.map((line, idx) => (
          <li key={idx} className="flex gap-2 text-base leading-relaxed text-zinc-700 dark:text-zinc-200">
            <span className="font-semibold text-indigo-500">{idx + 1}</span>
            <p>{renderWithGlossary(line, glossary, `summary-${idx}`, onShowSource)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
