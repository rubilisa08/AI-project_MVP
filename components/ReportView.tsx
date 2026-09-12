"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { ExcludedClaims } from "./ExcludedClaims";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { FinancialSnapshot } from "./FinancialSnapshot";
import { NextSteps } from "./NextSteps";
import { ROIBanner } from "./ROIBanner";
import { RiskList } from "./RiskList";
import { RiskRadarChart } from "./RiskRadarChart";
import { SourcePanel } from "./SourcePanel";

export function ReportView({ report }: { report: Report }) {
  const [focusedChunkId, setFocusedChunkId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] print:block">
      <div className="flex flex-col gap-8">
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            인쇄 / PDF로 저장
          </button>
        </div>

        <ROIBanner processingTimeMs={report.processingTimeMs} />

        <section>
          <ExecutiveSummary
            headline={report.headline}
            summary={report.executiveSummary}
            glossary={report.glossary}
            onShowSource={setFocusedChunkId}
          />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            재무 현황 스냅샷
          </h3>
          <FinancialSnapshot ratios={report.ratios} />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Risk &amp; Opportunity Radar
          </h3>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <RiskRadarChart scores={report.riskScores} />
            <div className="flex-1">
              <RiskList risks={report.risks} onShowSource={setFocusedChunkId} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Actionable Next Steps
          </h3>
          <NextSteps steps={report.nextSteps} />
        </section>

        <ExcludedClaims claims={report.excludedClaims} />
      </div>

      <aside className="print:mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          <span className="hidden print:inline">부록: </span>원문 출처
        </h3>
        <SourcePanel chunks={report.chunks} focusedChunkId={focusedChunkId} />
      </aside>
    </div>
  );
}
