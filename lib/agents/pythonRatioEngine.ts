import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { isMockMode } from "@/lib/claude";
import { computeFinancialRatios } from "@/lib/finance/ratios";
import type { FinancialLineItem, FinancialRatios, RatioVerification } from "@/lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const CODE_EXECUTION_TOOL = { type: "code_execution_20250825", name: "code_execution" };

const RATIO_KEYS = [
  "debtRatio",
  "currentRatio",
  "operatingMargin",
  "roe",
  "roa",
  "grossMargin",
  "quickRatio",
  "interestCoverageRatio",
  "revenueGrowth",
] as const;

const PythonRatioSchema = z.object({
  period: z.string().nullable().optional(),
  debtRatio: z.number().nullable().optional(),
  currentRatio: z.number().nullable().optional(),
  operatingMargin: z.number().nullable().optional(),
  roe: z.number().nullable().optional(),
  roa: z.number().nullable().optional(),
  grossMargin: z.number().nullable().optional(),
  quickRatio: z.number().nullable().optional(),
  interestCoverageRatio: z.number().nullable().optional(),
  revenueGrowth: z.number().nullable().optional(),
});

type PythonRatioOutput = z.infer<typeof PythonRatioSchema>;

export interface PythonRatioResult {
  ratios: Partial<Record<(typeof RATIO_KEYS)[number], number>>;
  period?: string;
  pythonCode: string;
  pythonStdout: string;
}

const SYSTEM = `당신은 "Financial & Risk Agent"의 계산 담당입니다.
반드시 code_execution 도구로 Python(pandas)을 사용해 아래 공식대로 재무비율을 계산하세요. 직접 암산하거나 도구 없이 답하지 마세요.

공식 (값이 없으면 해당 지표는 null):
- debtRatio = totalLiabilities / totalEquity * 100
- currentRatio = currentAssets / currentLiabilities * 100
- operatingMargin = operatingIncome / revenue * 100
- roe = netIncome / totalEquity * 100
- roa = netIncome / totalAssets * 100
- grossMargin = (revenue - costOfGoodsSold) / revenue * 100
- quickRatio = (currentAssets - inventory) / currentLiabilities * 100
- interestCoverageRatio = operatingIncome / interestExpense
- revenueGrowth = (최신 period의 revenue - 그 다음 최신 period의 revenue) / 그 다음 최신 period의 revenue * 100 (revenue가 2개 period 미만이면 null)

각 key에 여러 period가 있으면 문자열 내림차순으로 가장 큰(최신) period 값을 사용하세요. 모든 숫자는 소수점 둘째 자리로 반올림하세요.

계산이 끝나면 마지막 bash 명령에서 다음 형식의 JSON 객체 하나만 표준출력(stdout)에 출력하세요. 다른 설명, 마크다운, 텍스트는 stdout에 절대 포함하지 마세요:
{"period": "...", "debtRatio": ..., "currentRatio": ..., "operatingMargin": ..., "roe": ..., "roa": ..., "grossMargin": ..., "quickRatio": ..., "interestCoverageRatio": ..., "revenueGrowth": ...}`;

interface ServerToolUseBlock {
  type: "server_tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface BashResultOk {
  type: "bash_code_execution_result";
  stdout: string;
  stderr: string;
  return_code: number;
}

interface BashToolResultBlock {
  type: "bash_code_execution_tool_result";
  tool_use_id: string;
  content: BashResultOk | { type: string; error_code?: string };
}

function isServerToolUse(block: unknown): block is ServerToolUseBlock {
  return !!block && typeof block === "object" && (block as { type?: string }).type === "server_tool_use";
}

function isBashToolResult(block: unknown): block is BashToolResultBlock {
  return (
    !!block &&
    typeof block === "object" &&
    (block as { type?: string }).type === "bash_code_execution_tool_result"
  );
}

/** Extracts the pandas source Claude wrote (via text_editor_code_execution "create"), for display in the UI. */
function extractPythonCode(content: unknown[]): string {
  let code = "";
  for (const block of content) {
    if (isServerToolUse(block) && block.name === "text_editor_code_execution" && block.input?.command === "create") {
      const fileText = block.input.file_text;
      if (typeof fileText === "string") code = fileText;
    }
  }
  if (code) return code;

  for (const block of content) {
    if (isServerToolUse(block) && block.name === "bash_code_execution" && typeof block.input?.command === "string") {
      code = block.input.command as string;
    }
  }
  return code || "(실행된 코드를 추출하지 못했습니다)";
}

/** Extracts the last successful bash stdout, since Claude may run intermediate/debug commands first. */
function extractLastStdout(content: unknown[]): string | null {
  let last: string | null = null;
  for (const block of content) {
    if (isBashToolResult(block) && block.content.type === "bash_code_execution_result") {
      const result = block.content as BashResultOk;
      if (result.return_code === 0 && result.stdout.trim()) {
        last = result.stdout.trim();
      }
    }
  }
  return last;
}

function buildLineItemsPayload(items: FinancialLineItem[]) {
  return items.map((item) => ({ key: item.key, label: item.label, period: item.period, value: item.value }));
}

function toRatiosPartial(output: PythonRatioOutput): PythonRatioResult["ratios"] {
  const ratios: PythonRatioResult["ratios"] = {};
  for (const key of RATIO_KEYS) {
    const value = output[key];
    if (typeof value === "number") ratios[key] = value;
  }
  return ratios;
}

/**
 * Independently recomputes financial ratios by having Claude write and run real
 * pandas code via the Code Execution tool, instead of trusting the model's own
 * arithmetic. Returns null on any failure so callers can silently fall back to
 * the TypeScript calculation in lib/finance/ratios.ts.
 */
export async function computeRatiosViaPython(items: FinancialLineItem[]): Promise<PythonRatioResult | null> {
  if (items.length === 0) return null;

  if (isMockMode()) {
    return buildMockPythonResult(items);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const payload = buildLineItemsPayload(items);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `# 원본 라인아이템\n${JSON.stringify(payload)}\n\n위 데이터로 재무비율을 계산하세요.`,
        },
      ],
      tools: [CODE_EXECUTION_TOOL],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const content = (response as Anthropic.Message).content as unknown[];
    const stdout = extractLastStdout(content);
    if (!stdout) return null;

    const parsed = PythonRatioSchema.safeParse(JSON.parse(stdout));
    if (!parsed.success) return null;

    return {
      ratios: toRatiosPartial(parsed.data),
      period: parsed.data.period ?? undefined,
      pythonCode: extractPythonCode(content),
      pythonStdout: stdout,
    };
  } catch {
    return null;
  }
}

/** MOCK_LLM=true fallback: fabricates a plausible pandas script + stdout matching the TS-computed ratios, so the pipeline demonstrates the verification UI without spending on the real API. */
function buildMockPythonResult(items: FinancialLineItem[]): PythonRatioResult {
  const ts = computeFinancialRatios(items);
  const ratios: PythonRatioResult["ratios"] = {};
  for (const key of RATIO_KEYS) {
    const value = ts[key as keyof FinancialRatios];
    if (typeof value === "number") ratios[key] = value;
  }

  const stdout = JSON.stringify({ period: ts.period ?? null, ...ratios });
  const pythonCode = `import json
import pandas as pd

# [MOCK_LLM] 실제 Code Execution 호출 없이 생성된 예시 코드입니다
line_items = ${JSON.stringify(buildLineItemsPayload(items))}
df = pd.DataFrame(line_items)
latest = df.sort_values("period").groupby("key").last()["value"]

result = {
    "period": "${ts.period ?? ""}",
    "debtRatio": latest.get("totalLiabilities", pd.NA) / latest.get("totalEquity", pd.NA) * 100,
    "currentRatio": latest.get("currentAssets", pd.NA) / latest.get("currentLiabilities", pd.NA) * 100,
    "operatingMargin": latest.get("operatingIncome", pd.NA) / latest.get("revenue", pd.NA) * 100,
    "roe": latest.get("netIncome", pd.NA) / latest.get("totalEquity", pd.NA) * 100,
    "roa": latest.get("netIncome", pd.NA) / latest.get("totalAssets", pd.NA) * 100,
}
print(json.dumps(result))`;

  return { ratios, period: ts.period, pythonCode, pythonStdout: stdout };
}

/** Merges the Python cross-check into TS-computed ratios: numeric fields are overridden by the
 *  Python result when available, `basis` (citation tracking) always stays TS-derived. */
export function mergeRatioVerification(
  tsRatios: FinancialRatios,
  python: PythonRatioResult | null,
): FinancialRatios {
  if (!python) return tsRatios;

  const TOLERANCE = 0.05;
  let matched = true;
  for (const key of RATIO_KEYS) {
    const tsValue = tsRatios[key as keyof FinancialRatios];
    const pyValue = python.ratios[key];
    if (typeof tsValue === "number" && typeof pyValue === "number" && Math.abs(tsValue - pyValue) > TOLERANCE) {
      matched = false;
    }
  }

  const verification: RatioVerification = {
    matched,
    pythonCode: python.pythonCode,
    pythonStdout: python.pythonStdout,
  };

  return {
    ...tsRatios,
    ...python.ratios,
    verification,
  };
}
