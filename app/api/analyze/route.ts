import { collect } from "@/lib/agents/collector";
import { runFactChecker } from "@/lib/agents/factChecker";
import { runFinancialRiskAgent } from "@/lib/agents/financialRisk";
import { runPublisher } from "@/lib/agents/publisher";
import type { PipelineEvent, PipelineStage } from "@/lib/types";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function ndjson(event: PipelineEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function parseUrls(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string" && u.trim() !== "");
  } catch {
    // fall through to comma-split
  }
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fileEntries = formData.getAll("files").filter((f): f is File => f instanceof File);
  const urls = parseUrls(formData.get("urls"));

  if (fileEntries.length === 0 && urls.length === 0) {
    return Response.json({ error: "파일 또는 URL을 1개 이상 입력하세요." }, { status: 400 });
  }

  for (const file of fileEntries) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `파일이 너무 큽니다 (최대 15MB): ${file.name}` }, { status: 413 });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: PipelineEvent) => controller.enqueue(encoder.encode(ndjson(event)));
      let currentStage: PipelineStage = "collector";

      try {
        currentStage = "collector";
        push({ type: "stage", stage: "collector", status: "start" });
        const files = await Promise.all(
          fileEntries.map(async (file) => ({
            name: file.name,
            buffer: Buffer.from(await file.arrayBuffer()),
          })),
        );
        const { sources, lineItems } = await collect(files, urls);
        const allChunks = sources.flatMap((s) => s.chunks);
        const chunkMap = new Map(allChunks.map((c) => [c.id, c]));
        push({
          type: "stage",
          stage: "collector",
          status: "done",
          message: `${sources.length}개 소스, ${allChunks.length}개 청크 수집 완료`,
        });

        currentStage = "financial_risk";
        push({ type: "stage", stage: "financial_risk", status: "start" });
        const { ratios, risks } = await runFinancialRiskAgent(allChunks, lineItems);
        push({
          type: "stage",
          stage: "financial_risk",
          status: "done",
          message: `리스크 후보 ${risks.length}건 도출`,
        });

        currentStage = "fact_checker";
        push({ type: "stage", stage: "fact_checker", status: "start" });
        const { verified, excluded } = await runFactChecker(risks, chunkMap);
        push({
          type: "stage",
          stage: "fact_checker",
          status: "done",
          message: `검증 통과 ${verified.length}건 / 제외 ${excluded.length}건`,
        });

        currentStage = "publisher";
        push({ type: "stage", stage: "publisher", status: "start" });
        const report = await runPublisher({
          risks: verified,
          excludedClaims: excluded,
          ratios,
          sources: sources.map((s) => ({ id: s.id, label: s.label, type: s.type })),
          chunks: allChunks,
        });
        push({ type: "stage", stage: "publisher", status: "done" });

        push({ type: "result", report });
      } catch (error) {
        push({
          type: "error",
          stage: currentStage,
          message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
