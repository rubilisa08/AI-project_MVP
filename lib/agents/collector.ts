import { parseExcel } from "@/lib/parsers/excel";
import { parseNewsUrl } from "@/lib/parsers/news";
import type { FinancialLineItem, ParsedSource } from "@/lib/types";

export interface UploadedFile {
  name: string;
  buffer: Buffer;
}

export interface CollectedInput {
  sources: ParsedSource[];
  lineItems: FinancialLineItem[];
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/**
 * Collector Agent: deterministic parsing only (no LLM call). Normalizes every
 * uploaded file / news URL into citation-friendly source chunks so downstream
 * agents can ground every claim in a specific chunk id.
 */
export async function collect(files: UploadedFile[], urls: string[]): Promise<CollectedInput> {
  const sources: ParsedSource[] = [];
  const lineItems: FinancialLineItem[] = [];
  let counter = 0;

  for (const file of files) {
    counter += 1;
    const sourceId = `s${counter}`;
    const ext = extensionOf(file.name);

    if (ext === "pdf") {
      // Loaded lazily: pdf-parse drags in pdfjs-dist, a large/fragile dependency
      // with its own worker-resolution quirks (see lib/parsers/pdf.ts). Keeping
      // it out of this module's top-level imports means an Excel-only request
      // never pays for (or risks breaking on) loading it.
      const [{ parsePdf }, { extractPdfFinancialLineItems }] = await Promise.all([
        import("@/lib/parsers/pdf"),
        import("@/lib/agents/pdfTableExtractor"),
      ]);
      const source = await parsePdf(sourceId, file.name, file.buffer);
      const extraction = await extractPdfFinancialLineItems(sourceId, file.name, file.buffer);
      if (extraction) {
        source.chunks.push(...extraction.extraChunks);
        lineItems.push(...extraction.lineItems);
      }
      sources.push(source);
    } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      const { source, lineItems: items } = parseExcel(sourceId, file.name, file.buffer);
      sources.push(source);
      lineItems.push(...items);
    } else {
      throw new Error(`지원하지 않는 파일 형식입니다: ${file.name} (PDF, Excel만 지원)`);
    }
  }

  for (const url of urls) {
    counter += 1;
    const sourceId = `s${counter}`;
    sources.push(await parseNewsUrl(sourceId, url));
  }

  const totalChunks = sources.reduce((sum, s) => sum + s.chunks.length, 0);
  if (totalChunks === 0) {
    throw new Error("업로드된 파일/URL에서 텍스트를 추출하지 못했습니다.");
  }

  return { sources, lineItems };
}
