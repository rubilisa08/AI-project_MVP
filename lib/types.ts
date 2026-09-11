import { z } from "zod";

export type SourceType = "pdf" | "excel" | "news";

export interface SourceChunk {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceType: SourceType;
  location: string;
  text: string;
}

export interface ParsedSource {
  id: string;
  label: string;
  type: SourceType;
  chunks: SourceChunk[];
}

export interface FinancialLineItem {
  key: string;
  label: string;
  period: string;
  value: number;
  sourceChunkId: string;
}

export interface RatioBasisEntry {
  label: string;
  sourceChunkId: string;
}

export interface FinancialRatios {
  period?: string;
  debtRatio?: number;
  currentRatio?: number;
  operatingMargin?: number;
  roe?: number;
  roa?: number;
  revenueGrowth?: number;
  basis: RatioBasisEntry[];
}

export const RISK_CATEGORIES = ["financial", "market", "operational"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_SEVERITIES = ["low", "medium", "high"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const FACT_CHECK_VERDICTS = [
  "supported",
  "partially_supported",
  "unsupported",
] as const;
export type FactCheckVerdict = (typeof FACT_CHECK_VERDICTS)[number];

export const RiskDraftSchema = z.object({
  risks: z
    .array(
      z.object({
        category: z.enum(RISK_CATEGORIES),
        title: z.string().min(1).max(80),
        description: z.string().min(1).max(400),
        severity: z.enum(RISK_SEVERITIES),
        sourceChunkIds: z.array(z.string()).min(1),
        metricRefs: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(8),
});
export type RiskDraft = z.infer<typeof RiskDraftSchema>;
export type RiskDraftItem = RiskDraft["risks"][number];

export interface RiskClaim extends RiskDraftItem {
  id: string;
}

export const FactCheckSchema = z.object({
  verdicts: z.array(
    z.object({
      claimId: z.string(),
      verdict: z.enum(FACT_CHECK_VERDICTS),
      note: z.string().min(1).max(300),
      correctedDescription: z.string().max(400).optional(),
    }),
  ),
});
export type FactCheckOutput = z.infer<typeof FactCheckSchema>;

export interface VerifiedRisk extends RiskClaim {
  verdict: FactCheckVerdict;
  verdictNote: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  sourceChunkId?: string;
}

const GlossaryTermSchema = z.object({
  term: z.string().min(1).max(40),
  definition: z.string().min(1).max(200),
  sourceChunkId: z.string().optional(),
});

export const PublisherSchema = z.object({
  headline: z.string().min(1).max(80),
  executiveSummary: z.array(z.string().min(1).max(200)).length(3),
  nextSteps: z.array(z.string().min(1).max(200)).length(3),
  glossary: z.array(GlossaryTermSchema).max(8),
});
export type PublisherOutput = z.infer<typeof PublisherSchema>;

export interface RiskRadarScores {
  financial: number;
  market: number;
  operational: number;
}

export interface ExcludedClaim {
  title: string;
  category: RiskCategory;
  reason: string;
}

export interface Report {
  headline: string;
  executiveSummary: string[];
  riskScores: RiskRadarScores;
  risks: VerifiedRisk[];
  nextSteps: string[];
  glossary: GlossaryTerm[];
  ratios: FinancialRatios;
  sources: { id: string; label: string; type: SourceType }[];
  chunks: SourceChunk[];
  excludedClaims: ExcludedClaim[];
}

export type PipelineStage =
  | "collector"
  | "financial_risk"
  | "fact_checker"
  | "publisher";

export type PipelineEvent =
  | { type: "stage"; stage: PipelineStage; status: "start" | "done"; message?: string }
  | { type: "result"; report: Report }
  | { type: "error"; stage?: PipelineStage; message: string };
