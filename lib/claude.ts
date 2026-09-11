import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env.local에 키를 추가하세요.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

/**
 * Calls Claude with a single forced tool call so the response is guaranteed
 * to be a JSON object matching `schema`. Retries once with the validation
 * error appended if the model returns input that fails the zod schema.
 */
export async function callClaudeJSON<T extends z.ZodTypeAny>(params: {
  system: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { system, prompt, schema, maxTokens = 2000 } = params;
  const anthropic = getClient();
  const inputSchema = z.toJSONSchema(schema, { target: "draft-07" });

  const tool: Anthropic.Tool = {
    name: "submit_result",
    description: "Submit the structured analysis result.",
    input_schema: inputSchema as Anthropic.Tool.InputSchema,
  };

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? prompt
        : `${prompt}\n\n이전 응답이 스키마 검증에 실패했습니다: ${lastError}\n스키마를 정확히 지켜서 submit_result 도구를 다시 호출하세요.`;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
      tools: [tool],
      tool_choice: { type: "tool", name: "submit_result" },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      lastError = "모델이 tool_use 블록을 반환하지 않았습니다.";
      continue;
    }

    const parsed = schema.safeParse(toolUse.input);
    if (parsed.success) {
      return parsed.data;
    }
    lastError = parsed.error.message;
  }

  throw new Error(`Claude 구조화 출력 검증 실패: ${lastError}`);
}

export { DEFAULT_MODEL };
