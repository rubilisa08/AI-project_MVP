export function NextSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, idx) => (
        <li
          key={idx}
          className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
            {idx + 1}
          </span>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{step}</p>
        </li>
      ))}
    </ol>
  );
}
