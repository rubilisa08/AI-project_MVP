import { callClaudeJSON } from "@/lib/claude";
import { PublisherSchema } from "@/lib/types";
import type {
  ExcludedClaim,
  FinancialRatios,
  PublisherOutput,
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

/** MOCK_LLM=true fallback: turns the verified risks/ratios into briefing copy without an API call. */
function buildMockPublisherOutput(risks: VerifiedRisk[], ratios: FinancialRatios): PublisherOutput {
  const top = risks[0];

  return {
    headline: top
      ? `${top.title} 등 ${risks.length}건의 리스크 점검이 필요합니다`
      : "특이 리스크 없이 안정적인 재무 상태입니다",
    executiveSummary: [
      top
        ? `${top.title}: ${top.description}`
        : "제공된 자료에서 뚜렷한 리스크 신호는 발견되지 않았습니다.",
      ratios.debtRatio !== undefined || ratios.currentRatio !== undefined
        ? `부채비율 ${ratios.debtRatio ?? "N/A"}%, 유동비율 ${ratios.currentRatio ?? "N/A"}% 수준입니다.`
        : "이번 입력만으로는 계산 가능한 재무비율이 없습니다.",
      "이 요약은 MOCK_LLM 모드로 생성되었으며 실제 Claude 분석 결과가 아닙니다.",
    ],
    nextSteps: [
      "재무팀과 함께 유동성 확보 방안(단기 차입 한도, 매출채권 회수)을 점검하세요.",
      "주요 재무비율의 다음 분기 추이를 모니터링하세요.",
      "실제 서비스 사용 시 .env.local에 ANTHROPIC_API_KEY를 등록해 실제 Claude 분석으로 전환하세요.",
    ],
    glossary: [
      { term: "유동비율", definition: "1년 내 현금화 가능한 자산이 1년 내 갚아야 할 부채의 몇 배인지 나타내는 지표입니다." },
      { term: "부채비율", definition: "자기자본 대비 부채의 비율로, 낮을수록 재무적으로 안정적입니다." },
    ],
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
    mock: () => buildMockPublisherOutput(risks, ratios),
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
