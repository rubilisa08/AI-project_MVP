import { callClaudeJSON } from "@/lib/claude";
import { computeFinancialRatios } from "@/lib/finance/ratios";
import { RiskDraftSchema } from "@/lib/types";
import type { FinancialLineItem, FinancialRatios, RiskClaim, SourceChunk } from "@/lib/types";
import { formatChunksForPrompt, formatRatiosForPrompt } from "./promptUtils";

const SYSTEM = `당신은 B2B 기업 분석 플랫폼의 "Financial & Risk Agent"입니다.
제공된 소스 청크(원문 발췌)와 이미 계산된 재무비율만 근거로 리스크 요인을 식별하세요.

반드시 지켜야 할 규칙:
- 제공되지 않은 외부 지식이나 추측을 사용하지 마세요.
- 각 리스크는 반드시 근거가 된 소스 청크의 id를 sourceChunkIds에 포함해야 합니다. 목록에 없는 id를 지어내지 마세요.
- category는 financial(재무)/market(시장)/operational(운영) 중 하나입니다.
- 재무비율에서 도출한 리스크는 metricRefs에 비율 이름을 한글로 적으세요 (예: "부채비율").
- 근거가 빈약하면 무리해서 리스크를 만들지 말고 개수를 줄이세요.
- 한국어로 작성하세요.`;

export interface FinancialRiskResult {
  ratios: FinancialRatios;
  risks: RiskClaim[];
}

export async function runFinancialRiskAgent(
  chunks: SourceChunk[],
  lineItems: FinancialLineItem[],
): Promise<FinancialRiskResult> {
  const ratios = computeFinancialRatios(lineItems);

  const prompt = `# 계산된 재무비율\n${formatRatiosForPrompt(ratios)}\n\n# 소스 청크\n${formatChunksForPrompt(
    chunks,
  )}\n\n위 정보만 근거로 재무/시장/운영 리스크를 최대 8개까지 식별해 submit_result 도구를 호출하세요.`;

  const draft = await callClaudeJSON({
    system: SYSTEM,
    prompt,
    schema: RiskDraftSchema,
    maxTokens: 3000,
  });

  const risks: RiskClaim[] = draft.risks.map((risk, idx) => ({
    id: `r${idx + 1}`,
    ...risk,
  }));

  return { ratios, risks };
}
