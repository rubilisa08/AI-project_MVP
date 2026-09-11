"use client";

import { useEffect, useRef } from "react";
import type { SourceChunk } from "@/lib/types";

export function SourcePanel({
  chunks,
  focusedChunkId,
}: {
  chunks: SourceChunk[];
  focusedChunkId: string | null;
}) {
  const refs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (focusedChunkId && refs.current[focusedChunkId]) {
      refs.current[focusedChunkId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedChunkId]);

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {chunks.map((chunk) => (
          <li
            key={chunk.id}
            ref={(el) => {
              refs.current[chunk.id] = el;
            }}
            className={`px-4 py-3 text-sm transition-colors ${
              chunk.id === focusedChunkId
                ? "bg-indigo-50 dark:bg-indigo-950/40"
                : "bg-transparent"
            }`}
          >
            <p className="mb-1 text-xs font-medium text-zinc-400">
              {chunk.sourceLabel} · {chunk.location}
            </p>
            <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{chunk.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
