import type { FinancialRatios, SourceChunk } from "@/lib/types";

const MAX_CHUNKS = 60;
const MAX_CHARS = 14000;

export function formatChunksForPrompt(chunks: SourceChunk[]): string {
  const limited = chunks.slice(0, MAX_CHUNKS);
  let charBudget = MAX_CHARS;
  const lines: string[] = [];

  for (const chunk of limited) {
    const line = `[${chunk.id}] (${chunk.sourceLabel} · ${chunk.location})\n${chunk.text}`;
    if (line.length > charBudget) break;
    lines.push(line);
    charBudget -= line.length;
  }

  return lines.length > 0 ? lines.join("\n---\n") : "(제공된 소스 청크 없음)";
}

export function formatRatiosForPrompt(ratios: FinancialRatios): string {
  const parts: string[] = [];
  if (ratios.debtRatio !== undefined) parts.push(`부채비율: ${ratios.debtRatio}%`);
  if (ratios.currentRatio !== undefined) parts.push(`유동비율: ${ratios.currentRatio}%`);
  if (ratios.operatingMargin !== undefined) parts.push(`영업이익률: ${ratios.operatingMargin}%`);
  if (ratios.roe !== undefined) parts.push(`ROE: ${ratios.roe}%`);
  if (ratios.roa !== undefined) parts.push(`ROA: ${ratios.roa}%`);
  if (ratios.revenueGrowth !== undefined) parts.push(`매출성장률: ${ratios.revenueGrowth}%`);
  if (ratios.grossMargin !== undefined) parts.push(`매출총이익률: ${ratios.grossMargin}%`);
  if (ratios.quickRatio !== undefined) parts.push(`당좌비율: ${ratios.quickRatio}%`);
  if (ratios.interestCoverageRatio !== undefined) parts.push(`이자보상배율: ${ratios.interestCoverageRatio}배`);

  return parts.length > 0
    ? parts.join(", ")
    : "계산 가능한 재무비율 없음 (엑셀 재무제표가 제공되지 않았거나 인식 가능한 항목이 없음)";
}
