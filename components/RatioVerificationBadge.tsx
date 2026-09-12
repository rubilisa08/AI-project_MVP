import type { RatioVerification } from "@/lib/types";

export function RatioVerificationBadge({ verification }: { verification?: RatioVerification }) {
  if (!verification) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Python 교차검증 없이 TypeScript 계산값만 사용되었습니다 (MOCK_LLM 또는 API 오류 시 자동 폴백).
      </p>
    );
  }

  return (
    <details className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700 print:border-solid">
      <summary className="cursor-pointer font-medium">
        {verification.matched ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            ✓ TypeScript ↔ Python(pandas) 이중 계산 검증 완료
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-400">
            ⚠ TypeScript와 Python 계산 결과가 일치하지 않습니다 — 확인이 필요합니다
          </span>
        )}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            실행된 Python(pandas) 코드
          </p>
          <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
            <code>{verification.pythonCode}</code>
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            실행 결과 (stdout)
          </p>
          <pre className="max-h-32 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
            <code>{verification.pythonStdout}</code>
          </pre>
        </div>
      </div>
    </details>
  );
}
