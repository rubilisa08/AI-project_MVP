import type { ReactNode } from "react";
import { TermTooltip } from "@/components/TermTooltip";
import type { GlossaryTerm } from "@/lib/types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps every occurrence of a glossary term in `text` with a hoverable TermTooltip. */
export function renderWithGlossary(
  text: string,
  glossary: GlossaryTerm[],
  keyPrefix: string,
  onShowSource: (chunkId: string) => void,
): ReactNode[] {
  if (glossary.length === 0) return [text];

  const terms = [...glossary].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`(${terms.map((t) => escapeRegExp(t.term)).join("|")})`, "g");
  const parts = text.split(pattern);

  return parts
    .filter((part) => part !== "")
    .map((part, idx) => {
      const term = terms.find((t) => t.term === part);
      if (!term) return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
      return (
        <TermTooltip
          key={`${keyPrefix}-${idx}`}
          term={term.term}
          definition={term.definition}
          onShowSource={term.sourceChunkId ? () => onShowSource(term.sourceChunkId as string) : undefined}
        />
      );
    });
}
