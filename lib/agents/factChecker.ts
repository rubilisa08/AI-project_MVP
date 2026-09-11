import { callClaudeJSON } from "@/lib/claude";
import { FactCheckSchema } from "@/lib/types";
import type { ExcludedClaim, RiskClaim, SourceChunk, VerifiedRisk } from "@/lib/types";

const SYSTEM = `당신은 "Fact-Checker Agent"입니다. Financial & Risk Agent가 제시한 주장(claim)이
실제 원문 청크로 뒷받침되는지 대조 검증하세요.

- 각 claim에 대해 함께 제공된 원문 청크만 보고 판단하세요. 외부 지식을 사용하지 마세요.
- 원문에 명시적으로 나타나지 않는 수치나 사실을 주장하면 "unsupported"로 표시하세요.
- 원문과 방향은 같지만 과장되었거나 일부만 맞으면 "partially_supported"로 표시하고
  correctedDescription에 원문에 더 충실한 표현을 제안하세요.
- 원문과 정확히 일치하면 "supported"로 표시하세요.
- note에는 판단 근거를 한 문장으로 간단히 설명하세요.
- 입력으로 주어진 모든 claim id에 대해 반드시 하나씩 verdicts를 반환하세요.`;

export interface FactCheckedResult {
  verified: VerifiedRisk[];
  excluded: ExcludedClaim[];
}

/**
 * Two-layer verification: (1) deterministically drop claims whose cited chunk
 * ids don't actually exist (the model hallucinated a citation), then (2) ask
 * Claude to cross-check each remaining claim's text against its cited chunks.
 */
export async function runFactChecker(
  risks: RiskClaim[],
  chunkMap: Map<string, SourceChunk>,
): Promise<FactCheckedResult> {
  const verified: VerifiedRisk[] = [];
  const excluded: ExcludedClaim[] = [];
  const checkable: RiskClaim[] = [];

  for (const risk of risks) {
    const validIds = risk.sourceChunkIds.filter((id) => chunkMap.has(id));
    if (validIds.length === 0) {
      excluded.push({
        title: risk.title,
        category: risk.category,
        reason: "인용된 출처를 원문에서 찾을 수 없어 제외되었습니다.",
      });
      continue;
    }
    checkable.push({ ...risk, sourceChunkIds: validIds });
  }

  if (checkable.length === 0) {
    return { verified, excluded };
  }

  const claimsBlock = checkable
    .map((risk) => {
      const sourceText = risk.sourceChunkIds
        .map((id) => chunkMap.get(id))
        .filter((c): c is SourceChunk => Boolean(c))
        .map((c) => `[${c.id}] ${c.text}`)
        .join("\n");
      return `## claim id: ${risk.id}\n제목: ${risk.title}\n설명: ${risk.description}\n인용된 원문:\n${sourceText}`;
    })
    .join("\n\n");

  const result = await callClaudeJSON({
    system: SYSTEM,
    prompt: `다음 주장들을 각각 검증하고 모든 claim에 대한 verdicts를 submit_result로 제출하세요.\n\n${claimsBlock}`,
    schema: FactCheckSchema,
    maxTokens: 3000,
  });

  const verdictByClaimId = new Map(result.verdicts.map((v) => [v.claimId, v]));

  for (const risk of checkable) {
    const verdict = verdictByClaimId.get(risk.id);
    if (!verdict || verdict.verdict === "unsupported") {
      excluded.push({
        title: risk.title,
        category: risk.category,
        reason: verdict?.note ?? "Fact-Checker가 원문 근거를 확인하지 못했습니다.",
      });
      continue;
    }

    verified.push({
      ...risk,
      description: verdict.correctedDescription ?? risk.description,
      verdict: verdict.verdict,
      verdictNote: verdict.note,
    });
  }

  return { verified, excluded };
}
