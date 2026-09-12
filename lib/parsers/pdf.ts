import { PDFParse } from "pdf-parse";
import type { ParsedSource, SourceChunk } from "@/lib/types";
import { splitIntoChunks } from "./chunk";

// pdfjs-dist normally locates its worker script relative to its own bundled
// file path, which breaks under Next.js/Turbopack ("Cannot find module
// .../pdf.worker.mjs"). Pointing it at the bare package specifier instead
// lets Node's own module resolution find the real file in node_modules,
// bypassing Turbopack's chunk-relative path entirely. (pdf-parse also ships a
// "pdf-parse/worker" helper for this, but it pulls in @napi-rs/canvas native
// bindings that aren't installed here — not worth it just for the worker src.)
PDFParse.setWorker("pdfjs-dist/legacy/build/pdf.worker.mjs");

export async function parsePdf(sourceId: string, label: string, buffer: Buffer): Promise<ParsedSource> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const chunks: SourceChunk[] = [];

    for (const page of result.pages) {
      const paragraphs = splitIntoChunks(page.text);
      paragraphs.forEach((text, idx) => {
        chunks.push({
          id: `${sourceId}-p${page.num}-c${idx + 1}`,
          sourceId,
          sourceLabel: label,
          sourceType: "pdf",
          location: `${page.num}페이지`,
          text,
        });
      });
    }

    return { id: sourceId, label, type: "pdf", chunks };
  } finally {
    await parser.destroy();
  }
}
