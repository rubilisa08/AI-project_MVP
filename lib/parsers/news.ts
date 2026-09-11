import * as cheerio from "cheerio";
import type { ParsedSource, SourceChunk } from "@/lib/types";
import { splitIntoChunks } from "./chunk";
import { assertSafeUrl } from "./url-guard";

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export async function parseNewsUrl(sourceId: string, rawUrl: string): Promise<ParsedSource> {
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "AI-Business-Briefing-Bot/0.1" },
    });
    if (!res.ok) {
      throw new Error(`뉴스 URL을 불러오지 못했습니다 (HTTP ${res.status}): ${rawUrl}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(`뉴스 페이지 크기가 너무 큽니다: ${rawUrl}`);
    }
    html = Buffer.from(buf).toString("utf-8");
  } finally {
    clearTimeout(timeout);
  }

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
