"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { ExcludedClaims } from "./ExcludedClaims";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { NextSteps } from "./NextSteps";
import { RiskList } from "./RiskList";
import { RiskRadarChart } from "./RiskRadarChart";
import { SourcePanel } from "./SourcePanel";

export function ReportView({ report }: { report: Report }) {
  const [focusedChunkId, setFocusedChunkId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-8">
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

      <aside>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">원문 출처</h3>
        <SourcePanel chunks={report.chunks} focusedChunkId={focusedChunkId} />
      </aside>
    </div>
  );
}
