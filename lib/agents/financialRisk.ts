import { callClaudeJSON } from "@/lib/claude";
import { computeDataQuality, computeFinancialRatios } from "@/lib/finance/ratios";
import { computeRatiosViaPython, mergeRatioVerification } from "@/lib/agents/pythonRatioEngine";
import { RiskDraftSchema } from "@/lib/types";
import type {
  FinancialLineItem,
  FinancialRatios,
  RiskCategory,
  RiskClaim,
  RiskDraft,
  RiskDraftItem,
  RiskSeverity,
  SourceChunk,
} from "@/lib/types";
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

/** MOCK_LLM=true fallback: derives plausible risks from the ratio thresholds so the
 *  pipeline can be exercised end-to-end without spending on the real API. */
function buildMockRiskDraft(ratios: FinancialRatios, chunks: SourceChunk[]): RiskDraft {
  const fallbackChunkId = chunks[0]?.id;
  const basisFor = (labelPrefix: string): string | undefined =>
    ratios.basis.find((b) => b.label.startsWith(labelPrefix))?.sourceChunkId;

  const risks: RiskDraftItem[] = [];
  const add = (item: {
    category: RiskCategory;
    title: string;
    description: string;
    severity: RiskSeverity;
    sourceChunkIds: (string | undefined)[];
    metricRefs?: string[];
  }) => {
    const ids = item.sourceChunkIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0 && fallbackChunkId) ids.push(fallbackChunkId);
    if (ids.length === 0) return;
    risks.push({ ...item, sourceChunkIds: ids });
  };

  if (ratios.currentRatio !== undefined && ratios.currentRatio < 100) {
    add({
      category: "financial",
      title: "단기 유동성 부족",
      description: `유동비율이 ${ratios.currentRatio}%로 100%를 밑돌아, 1년 내 갚아야 할 부채가 단기간에 현금화 가능한 자산보다 많습니다.`,
      severity: ratios.currentRatio < 80 ? "high" : "medium",
      sourceChunkIds: [basisFor("유동자산"), basisFor("유동부채")],
      metricRefs: ["유동비율"],
    });
  }
  if (ratios.debtRatio !== undefined && ratios.debtRatio > 150) {
    add({
      category: "financial",
      title: "높은 부채비율",
      description: `부채비율이 ${ratios.debtRatio}%로 자기자본 대비 부채 부담이 큽니다.`,
      severity: ratios.debtRatio > 200 ? "high" : "medium",
      sourceChunkIds: [basisFor("부채총계"), basisFor("자본총계")],
      metricRefs: ["부채비율"],
    });
  }
  if (ratios.operatingMargin !== undefined && ratios.operatingMargin < 5) {
    add({
      category: "operational",
      title: "낮은 영업이익률",
      description: `영업이익률이 ${ratios.operatingMargin}%로 낮아 본업 수익성 개선이 필요합니다.`,
      severity: "medium",
      sourceChunkIds: [basisFor("영업이익"), basisFor("매출액")],
      metricRefs: ["영업이익률"],
    });
  }
  if (risks.length === 0 && fallbackChunkId) {
    risks.push({
      category: "operational",
      title: "제공된 자료 범위가 제한적",
      description: "업로드된 자료만으로는 뚜렷한 리스크 신호가 발견되지 않았습니다.",
      severity: "low",
      sourceChunkIds: [fallbackChunkId],
    });
  }

  return { risks: risks.slice(0, 8) };
}

export async function runFinancialRiskAgent(
  chunks: SourceChunk[],
  lineItems: FinancialLineItem[],
): Promise<FinancialRiskResult> {
  const tsRatios = computeFinancialRatios(lineItems);
  const pythonResult = await computeRatiosViaPython(lineItems);
  const ratios = mergeRatioVerification(tsRatios, pythonResult);

  const tsDataQuality = computeDataQuality(lineItems);
  const tsCheck = tsDataQuality.balanceSheetCheck;
  const pyCheck = pythonResult?.balanceSheetCheck;

  let balanceSheetCheck = tsCheck;
  let balanceSheetVerified: boolean | undefined;

  if (tsCheck && pyCheck) {
    const tolerance = Math.max(1, Math.abs(tsCheck.diffAmount) * 0.05);
    balanceSheetVerified =
      pyCheck.balanced === tsCheck.balanced && Math.abs(pyCheck.diffAmount - tsCheck.diffAmount) <= tolerance;
    if (!balanceSheetVerified) {
      // TS and Python disagree on whether the balance sheet actually balances. Never silently
      // trust either side's "balanced: true" here — default to the flagged (false) state so a
      // real discrepancy can't be masked by picking the wrong engine's answer.
      balanceSheetCheck = {
        balanced: false,
        diffAmount: Math.abs(pyCheck.diffAmount) >= Math.abs(tsCheck.diffAmount) ? pyCheck.diffAmount : tsCheck.diffAmount,
      };
    }
  } else if (pyCheck && !tsCheck) {
    balanceSheetCheck = pyCheck;
  }

  ratios.dataQuality = {
    anomalies: tsDataQuality.anomalies,
    balanceSheetCheck,
    balanceSheetVerified,
  };

  const prompt = `# 계산된 재무비율\n${formatRatiosForPrompt(ratios)}\n\n# 소스 청크\n${formatChunksForPrompt(
    chunks,
  )}\n\n위 정보만 근거로 재무/시장/운영 리스크를 최대 8개까지 식별해 submit_result 도구를 호출하세요.`;

  const draft = await callClaudeJSON({
    system: SYSTEM,
    prompt,
    schema: RiskDraftSchema,
    maxTokens: 3000,
    mock: () => buildMockRiskDraft(ratios, chunks),
  });

  const risks: RiskClaim[] = draft.risks.map((risk, idx) => ({
    id: `r${idx + 1}`,
    ...risk,
  }));

  return { ratios, risks };
}
