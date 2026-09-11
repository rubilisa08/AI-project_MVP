"use client";

import { useState } from "react";

export function TermTooltip({
  term,
  definition,
  onShowSource,
}: {
  term: string;
  definition: string;
  onShowSource?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="cursor-help font-medium text-indigo-700 underline decoration-dotted decoration-2 underline-offset-2 dark:text-indigo-300"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {term}
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <span className="block">{definition}</span>
          {onShowSource && (
            <button
              type="button"
              className="mt-2 block font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              onClick={onShowSource}
            >
              원문 출처 보기 →
            </button>
          )}
        </span>
      )}
    </span>
  );
}
