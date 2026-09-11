import type { ExcludedClaim } from "@/lib/types";

const CATEGORY_LABEL: Record<ExcludedClaim["category"], string> = {
  financial: "재무",
  market: "시장",
  operational: "운영",
};

export function ExcludedClaims({ claims }: { claims: ExcludedClaim[] }) {
  if (claims.length === 0) return null;

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
      <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">
        Fact-Checker가 제외한 주장 {claims.length}건 (원문 근거 불충분)
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {claims.map((claim, idx) => (
          <li key={idx} className="text-zinc-500 dark:text-zinc-400">
            <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
              {CATEGORY_LABEL[claim.category]}
            </span>
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{claim.title}</span>
            {" — "}
            {claim.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}
