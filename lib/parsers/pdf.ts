import { PDFParse } from "pdf-parse";
import type { ParsedSource, SourceChunk } from "@/lib/types";
import { splitIntoChunks } from "./chunk";

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
