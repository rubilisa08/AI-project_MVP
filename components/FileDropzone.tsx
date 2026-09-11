"use client";

import { useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".xlsx", ".xls", ".csv"];

function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileDropzone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(isAccepted);
    if (accepted.length === 0) return;
    onChange([...files, ...accepted]);
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-zinc-300 hover:border-indigo-400 dark:border-zinc-700"
        }`}
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          PDF·Excel 파일을 드래그하거나 클릭해서 업로드
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          공시자료, 계약서, 재무제표 등 (.pdf, .xlsx, .xls, .csv / 최대 15MB)
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800"
            >
              <span className="truncate">
                {file.name} <span className="text-zinc-400">· {formatBytes(file.size)}</span>
              </span>
              <button
                type="button"
                className="ml-2 shrink-0 text-zinc-400 hover:text-red-500"
                onClick={() => removeAt(idx)}
                aria-label={`${file.name} 제거`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
