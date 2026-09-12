import * as cheerio from "cheerio";
import type { FinancialLineItem, ParsedSource, SourceChunk } from "@/lib/types";
import { splitIntoChunks } from "./chunk";
import { assertSafeUrl } from "./url-guard";

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export interface UrlParseResult {
  source: ParsedSource;
  lineItems: FinancialLineItem[];
}

function filenameFromUrl(url: URL, contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  const lastSegment = url.pathname.split("/").filter(Boolean).pop();
  return lastSegment ? decodeURIComponent(lastSegment) : url.href;
}

/**
 * Fetches a user-supplied URL and normalizes it into a source. Most links are
 * news/article pages (HTML → text chunks), but a link can also point straight
 * at a PDF (e.g. dragging a DART report link in from another tab) — detected
 * via Content-Type, not the URL string, since disclosure sites rarely bother
 * with a ".pdf" extension. PDFs get the exact same treatment as an uploaded
 * PDF file: text chunks plus, when possible, table-extracted financial line
 * items (lib/agents/pdfTableExtractor.ts).
 */
export async function parseNewsUrl(sourceId: string, rawUrl: string): Promise<UrlParseResult> {
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let buf: ArrayBuffer;
  let contentType: string;
  let contentDisposition: string | null;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "AI-Business-Briefing-Bot/0.1" },
    });
    if (!res.ok) {
      throw new Error(`URL을 불러오지 못했습니다 (HTTP ${res.status}): ${rawUrl}`);
    }
    contentType = res.headers.get("content-type") ?? "";
    contentDisposition = res.headers.get("content-disposition");
    const isPdf = contentType.includes("application/pdf");
    buf = await res.arrayBuffer();
    const limit = isPdf ? MAX_PDF_BYTES : MAX_HTML_BYTES;
    if (buf.byteLength > limit) {
      throw new Error(`URL의 콘텐츠 크기가 너무 큽니다: ${rawUrl}`);
    }
  } finally {
    clearTimeout(timeout);
  }

  if (contentType.includes("application/pdf")) {
    return parsePdfBuffer(sourceId, filenameFromUrl(url, contentDisposition), Buffer.from(buf));
  }

  return { source: parseHtmlBuffer(sourceId, rawUrl, Buffer.from(buf)), lineItems: [] };
}

async function parsePdfBuffer(sourceId: string, label: string, buffer: Buffer): Promise<UrlParseResult> {
  const [{ parsePdf }, { extractPdfFinancialLineItems }] = await Promise.all([
    import("./pdf"),
    import("@/lib/agents/pdfTableExtractor"),
  ]);

  const source = await parsePdf(sourceId, label, buffer);
  const extraction = await extractPdfFinancialLineItems(sourceId, label, buffer);
  if (extraction) {
    source.chunks.push(...extraction.extraChunks);
    return { source, lineItems: extraction.lineItems };
  }
  return { source, lineItems: [] };
}

function parseHtmlBuffer(sourceId: string, rawUrl: string, buf: Buffer): ParsedSource {
  const html = buf.toString("utf-8");
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe, form").remove();

  const title = $("title").first().text().trim() || rawUrl;
  const articleText = $("article").text().trim();
  const bodyText = articleText.length > 200 ? articleText : $("body").text();
  const text = bodyText.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const chunks: SourceChunk[] = splitIntoChunks(text).map((chunkBody, idx) => ({
    id: `${sourceId}-c${idx + 1}`,
    sourceId,
    sourceLabel: title,
    sourceType: "news",
    location: `본문 ${idx + 1}문단`,
    text: chunkBody,
  }));

  return { id: sourceId, label: title, type: "news", chunks };
}
