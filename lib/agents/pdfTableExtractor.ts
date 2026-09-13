import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { isMockMode } from "@/lib/claude";
import { KNOWN_LINE_ITEMS } from "@/lib/finance/ratios";
import type { FinancialLineItem, SourceChunk } from "@/lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const CODE_EXECUTION_TOOL = { type: "code_execution_20250825", name: "code_execution" };
const KNOWN_KEYS = new Set(KNOWN_LINE_ITEMS.map((item) => item.key));

const ExtractedLineItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  period: z.string(),
  value: z.number(),
  page: z.number(),
});

const ExtractionSchema = z.array(ExtractedLineItemSchema);

function buildSystemPrompt(): string {
  const keyList = KNOWN_LINE_ITEMS.map((item) => `${item.key}(${item.aliases[0]})`).join(", ");
  return `당신은 "Collector Agent"의 PDF 재무제표 표 추출 담당입니다.
반드시 code_execution 도구로 pdfplumber를 사용해 업로드된 PDF를 여세요(먼저 bash로 ls를 실행해 파일 경로를 확인하세요).

- PDF 안에서 재무상태표(대차대조표) 또는 손익계산서 표를 찾으세요.
- 찾은 표에서 다음 키에 해당하는 항목만 추출하세요: ${keyList}. 그 외 항목은 무시하세요.
- 각 항목은 표에 나온 모든 기간(period, 예: "2024", "2023")에 대해 각각 별도로 추출하세요.
- 각 항목이 몇 페이지(1부터 시작하는 정수)에서 나왔는지 반드시 기록하세요.
- 재무제표 표를 찾지 못하면 빈 배열만 출력하세요. 추측하거나 지어내지 마세요.
- 마지막 bash 명령의 표준출력(stdout)에 다음 형식의 JSON 배열 하나만 출력하세요. 다른 텍스트는 절대 포함하지 마세요:
[{"key": "revenue", "label": "매출액", "period": "2024", "value": 120000, "page": 3}, ...]`;
}

interface BashResultOk {
  type: "bash_code_execution_result";
  stdout: string;
  return_code: number;
}

interface BashToolResultBlock {
  type: "bash_code_execution_tool_result";
  content: BashResultOk | { type: string };
}

function isBashToolResult(block: unknown): block is BashToolResultBlock {
  return (
    !!block &&
    typeof block === "object" &&
    (block as { type?: string }).type === "bash_code_execution_tool_result"
  );
}

function extractLastStdout(content: unknown[]): string | null {
  let last: string | null = null;
  for (const block of content) {
    if (isBashToolResult(block) && block.content.type === "bash_code_execution_result") {
      const result = block.content as BashResultOk;
      if (result.return_code === 0 && result.stdout.trim()) last = result.stdout.trim();
    }
  }
  return last;
}

export interface PdfExtractionResult {
  lineItems: FinancialLineItem[];
  extraChunks: SourceChunk[];
}

/**
 * Has Claude open the uploaded PDF with pdfplumber (pre-installed in the Code
 * Execution sandbox) and pull financial-statement line items out of its tables,
 * with a page number per value. This is the only way this MVP gets financial
 * ratios out of a PDF-only upload (Excel already has its own deterministic
 * parser in lib/parsers/excel.ts).
 *
 * Returns null whenever the real path can't run (mock mode, no API key, upload
 * or parsing failure) so the caller just keeps the plain-text PDF chunks it
 * already had — this feature is purely additive.
 */
export async function extractPdfFinancialLineItems(
  sourceId: string,
  label: string,
  buffer: Buffer,
): Promise<PdfExtractionResult | null> {
  if (isMockMode()) return buildMockPdfExtraction(sourceId, label);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileObject = await (client as any).files.upload({
      file: new File([new Uint8Array(buffer)], label, { type: "application/pdf" }),
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "이 PDF에서 재무제표 표를 찾아 라인아이템을 추출하세요." },
            { type: "container_upload", file_id: fileObject.id },
          ],
        },
      ],
      tools: [CODE_EXECUTION_TOOL],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const content = (response as Anthropic.Message).content as unknown[];
    const stdout = extractLastStdout(content);
    if (!stdout) return null;

    const parsed = ExtractionSchema.safeParse(JSON.parse(stdout));
    if (!parsed.success) return null;

    const lineItems: FinancialLineItem[] = [];
    const extraChunks: SourceChunk[] = [];

    parsed.data
      .filter((item) => KNOWN_KEYS.has(item.key))
      .forEach((item, idx) => {
        const chunkId = `${sourceId}-pdftable-${idx + 1}`;
        extraChunks.push({
          id: chunkId,
          sourceId,
          sourceLabel: label,
          sourceType: "pdf",
          location: `${item.page}페이지 (표)`,
          text: `${item.label}: ${item.period}=${item.value.toLocaleString("ko-KR")}`,
        });
        lineItems.push({
          key: item.key,
          label: item.label,
          period: item.period,
          value: item.value,
          sourceChunkId: chunkId,
        });
      });

    return { lineItems, extraChunks };
  } catch {
    return null;
  }
}

/** MOCK_LLM=true fallback: fabricates a plausible extracted line-item set (a
 *  distressed-company profile — low liquidity, high leverage — mirroring
 *  sample_data/financial_sample.xlsx) so a PDF-only upload can exercise the
 *  full pipeline (ratios, risk detection, fact-checking) without an API key.
 *  A real extraction never runs in mock mode, so these numbers never reflect
 *  the actual uploaded PDF. */
function buildMockPdfExtraction(sourceId: string, label: string): PdfExtractionResult {
  const MOCK_ITEMS: { key: string; label: string; period: string; value: number; page: number }[] = [
    { key: "revenue", label: "매출액", period: "2024", value: 95000, page: 4 },
    { key: "revenue", label: "매출액", period: "2023", value: 110000, page: 4 },
    { key: "operatingIncome", label: "영업이익", period: "2024", value: 3800, page: 4 },
    { key: "operatingIncome", label: "영업이익", period: "2023", value: 9500, page: 4 },
    { key: "netIncome", label: "당기순이익", period: "2024", value: 1200, page: 4 },
    { key: "netIncome", label: "당기순이익", period: "2023", value: 6000, page: 4 },
    { key: "totalAssets", label: "자산총계", period: "2024", value: 210000, page: 5 },
    { key: "totalAssets", label: "자산총계", period: "2023", value: 195000, page: 5 },
    { key: "totalLiabilities", label: "부채총계", period: "2024", value: 155000, page: 5 },
    { key: "totalLiabilities", label: "부채총계", period: "2023", value: 135000, page: 5 },
    { key: "totalEquity", label: "자본총계", period: "2024", value: 55000, page: 5 },
    { key: "totalEquity", label: "자본총계", period: "2023", value: 60000, page: 5 },
    { key: "currentAssets", label: "유동자산", period: "2024", value: 42000, page: 5 },
    { key: "currentAssets", label: "유동자산", period: "2023", value: 50000, page: 5 },
    { key: "currentLiabilities", label: "유동부채", period: "2024", value: 58000, page: 5 },
    { key: "currentLiabilities", label: "유동부채", period: "2023", value: 45000, page: 5 },
    { key: "costOfGoodsSold", label: "매출원가", period: "2024", value: 70000, page: 4 },
    { key: "costOfGoodsSold", label: "매출원가", period: "2023", value: 75000, page: 4 },
    { key: "inventory", label: "재고자산", period: "2024", value: 15000, page: 5 },
    { key: "inventory", label: "재고자산", period: "2023", value: 12000, page: 5 },
    { key: "interestExpense", label: "이자비용", period: "2024", value: 2500, page: 6 },
    { key: "interestExpense", label: "이자비용", period: "2023", value: 2000, page: 6 },
  ];

  const lineItems: FinancialLineItem[] = [];
  const extraChunks: SourceChunk[] = [];

  MOCK_ITEMS.forEach((item, idx) => {
    const chunkId = `${sourceId}-pdftable-${idx + 1}`;
    extraChunks.push({
      id: chunkId,
      sourceId,
      sourceLabel: label,
      sourceType: "pdf",
      location: `${item.page}페이지 (표)`,
      text: `${item.label}: ${item.period}=${item.value.toLocaleString("ko-KR")}`,
    });
    lineItems.push({
      key: item.key,
      label: item.label,
      period: item.period,
      value: item.value,
      sourceChunkId: chunkId,
    });
  });

  return { lineItems, extraChunks };
}
