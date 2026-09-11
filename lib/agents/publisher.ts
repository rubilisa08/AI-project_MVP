import { callClaudeJSON } from "@/lib/claude";
import { PublisherSchema } from "@/lib/types";
import type {
  ExcludedClaim,
  FinancialRatios,
  Report,
  RiskCategory,
  RiskRadarScores,
  RiskSeverity,
  SourceChunk,
  SourceType,
  VerifiedRisk,
} from "@/lib/types";
import { formatRatiosForPrompt } from "./promptUtils";

const SYSTEM = `당신은 "Publisher Agent"입니다. Fact-Checker가 검증한 리스크 목록과 재무비율만 사용해
C-Level 임원을 위한 브리핑 문구를 작성하세요.

- 검증되지 않은 내용을 새로 추가하지 마세요. 주어진 리스크와 재무비율 범위 안에서만 서술하세요.
- executiveSummary는 정확히 3줄이며, 각 줄은 바쁜 임원이 5초 안에 읽을 수 있는 한 문장이어야 합니다.
- nextSteps는 실무자가 바로 실행할 수 있는 구체적 행동 3가지입니다.
- glossary는 요약/리스크 설명에 등장하는 회계·전문 용어를 최대 8개까지 쉬운 말로 설명합니다.
  해당 용어의 근거가 된 sourceChunkId가 있다면 함께 표기하세요.
- 한국어로 작성하세요.`;

const SEVERITY_SCORE: Record<RiskSeverity, number> = { low: 25, medium: 55, high: 85 };

function computeRadarScores(risks: VerifiedRisk[]): RiskRadarScores {
  const scoreFor = (category: RiskCategory): number => {
    const items = risks.filter((r) => r.category === category);
    if (items.length === 0) return 15;
    return Math.max(...items.map((r) => SEVERITY_SCORE[r.severity]));
  };

  return {
    financial: scoreFor("financial"),
    market: scoreFor("market"),
    operational: scoreFor("operational"),
  };
}

export async function runPublisher(params: {
  risks: VerifiedRisk[];
  excludedClaims: ExcludedClaim[];
  ratios: FinancialRatios;
  sources: { id: string; label: string; type: SourceType }[];
  chunks: SourceChunk[];
}): Promise<Report> {
  const { risks, excludedClaims, ratios, sources, chunks } = params;

  const riskSummary =
    risks.length > 0
      ? risks
          .map(
            (r) =>
              `- [${r.category}/${r.severity}] ${r.title}: ${r.description} (근거: ${r.sourceChunkIds.join(", ")})`,
          )
          .join("\n")
      : "검증을 통과한 리스크 없음";

  const prompt = `# 검증된 리스크\n${riskSummary}\n\n# 재무비율\n${formatRatiosForPrompt(
    ratios,
  )}\n\n위 내용만 근거로 브리핑을 작성해 submit_result 도구를 호출하세요.`;

  const output = await callClaudeJSON({
    system: SYSTEM,
    prompt,
    schema: PublisherSchema,
    maxTokens: 2000,
  });

  return {
    headline: output.headline,
    executiveSummary: output.executiveSummary,
    nextSteps: output.nextSteps,
    glossary: output.glossary,
    riskScores: computeRadarScores(risks),
    risks,
    ratios,
    sources,
    chunks,
    excludedClaims,
  };
}
