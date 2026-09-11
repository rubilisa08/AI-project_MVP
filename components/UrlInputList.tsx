"use client";

export function UrlInputList({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const update = (idx: number, value: string) => {
    const next = [...urls];
    next[idx] = value;
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(urls.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-2">
      {urls.map((url, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => update(idx, e.target.value)}
            placeholder="https://news.example.com/article/123"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => removeAt(idx)}
            className="shrink-0 text-zinc-400 hover:text-red-500"
            aria-label="URL 제거"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...urls, ""])}
        className="self-start text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        + 뉴스 URL 추가
      </button>
    </div>
  );
}
