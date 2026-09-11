"use client";

import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { PipelineProgress, type StageStatus } from "@/components/PipelineProgress";
import { ReportView } from "@/components/ReportView";
import { UrlInputList } from "@/components/UrlInputList";
import type { PipelineEvent, PipelineStage, Report } from "@/lib/types";

const STAGE_KEYS: PipelineStage[] = ["collector", "financial_risk", "fact_checker", "publisher"];

function initialStatuses(): Record<PipelineStage, StageStatus> {
  return STAGE_KEYS.reduce(
    (acc, key) => {
      acc[key] = "pending";
      return acc;
    },
    {} as Record<PipelineStage, StageStatus>,
  );
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<PipelineStage, StageStatus>>(initialStatuses());
  const [messages, setMessages] = useState<Partial<Record<PipelineStage, string>>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !isRunning && (files.length > 0 || urls.some((u) => u.trim() !== ""));

  const applyEvent = (event: PipelineEvent) => {
    if (event.type === "stage") {
      setStatuses((prev) => ({
        ...prev,
        [event.stage]: event.status === "start" ? "active" : "done",
      }));
      if (event.message) {
        setMessages((prev) => ({ ...prev, [event.stage]: event.message }));
      }
    } else if (event.type === "result") {
      setReport(event.report);
    } else if (event.type === "error") {
      setError(event.message);
      if (event.stage) {
        setStatuses((prev) => ({ ...prev, [event.stage as PipelineStage]: "error" }));
      }
    }
  };

  const handleSubmit = async () => {
    setIsRunning(true);
    setReport(null);
    setError(null);
    setStatuses(initialStatuses());
    setMessages({});

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
    formData.append("urls", JSON.stringify(cleanUrls));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `요청이 실패했습니다 (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) applyEvent(JSON.parse(line) as PipelineEvent);
        }
      }
      if (buffer.trim()) applyEvent(JSON.parse(buffer) as PipelineEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          AI Business Briefing &amp; Intelligence Publisher
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          5분 만에 끝나는 C-Level 브리핑
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          공시자료·계약서(PDF), 재무제표(Excel), 관련 뉴스 URL을 업로드하면 Collector → Financial&amp;Risk →
          Fact-Checker → Publisher 4단계 Multi-Agent 파이프라인이 원문 근거 기반 브리핑을 생성합니다.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">파일 업로드</h2>
          <FileDropzone files={files} onChange={setFiles} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">뉴스 URL</h2>
          <UrlInputList urls={urls} onChange={setUrls} />
        </div>
        <div className="md:col-span-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            {isRunning ? "분석 중..." : "브리핑 생성하기"}
          </button>
        </div>
      </section>

      {(isRunning || report || error) && (
        <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">파이프라인 진행 상황</h2>
          <PipelineProgress statuses={statuses} messages={messages} />
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
        </section>
      )}

      {report && (
        <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <ReportView report={report} />
        </section>
      )}
    </div>
  );
}
