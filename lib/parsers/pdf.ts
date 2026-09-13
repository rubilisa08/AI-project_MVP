import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { PDFParse } from "pdf-parse";
import type { ParsedSource, SourceChunk } from "@/lib/types";
import { splitIntoChunks } from "./chunk";

// pdfjs-dist normally locates its worker script relative to its own bundled
// file path, which breaks under Next.js/Turbopack ("Cannot find module
// .../pdf.worker.mjs"). Pointing it at the bare package specifier instead
// lets Node's own module resolution find the real file in node_modules,
// bypassing Turbopack's chunk-relative path entirely.
PDFParse.setWorker("pdfjs-dist/legacy/build/pdf.worker.mjs");

// pdfjs builds glyph outlines (embedded/Type3 fonts) using the Canvas 2D
// DOMMatrix/Path2D/ImageData globals even during plain text extraction, not
// just rendering. Those only exist in browsers, so real-world PDFs with such
// fonts crash with "DOMMatrix is not defined" under Node. pdf-parse's own
// "pdf-parse/worker" helper works around this the same way, but that module
// also wires up worker-thread message handling meant for pdfjs's internal
// worker — not safe to import wholesale here, so we replicate just the
// polyfill assignment.
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as unknown as { DOMMatrix: typeof DOMMatrix }).DOMMatrix = DOMMatrix;
}
if (typeof globalThis.Path2D === "undefined") {
  (globalThis as unknown as { Path2D: typeof Path2D }).Path2D = Path2D;
}
if (typeof globalThis.ImageData === "undefined") {
  (globalThis as unknown as { ImageData: typeof ImageData }).ImageData = ImageData;
}

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
