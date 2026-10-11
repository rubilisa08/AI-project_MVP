import { inflateRawSync } from "node:zlib";
import { dartFetch, dartStatusError } from "./client";

export interface DartCorp {
  corpCode: string;
  corpName: string;
  /** Empty for unlisted companies. */
  stockCode: string;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cache: { loadedAt: number; corps: DartCorp[] } | null = null;

/** Reads the first entry of a zip archive (the corpCode download is a zip holding a single XML). */
function readFirstZipEntry(zip: Buffer): Buffer {
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("DART 고유번호 파일(zip) 형식을 읽을 수 없습니다.");

  const centralDirOffset = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(centralDirOffset) !== 0x02014b50) {
    throw new Error("DART 고유번호 파일(zip) 구조가 올바르지 않습니다.");
  }
  const method = zip.readUInt16LE(centralDirOffset + 10);
  const compressedSize = zip.readUInt32LE(centralDirOffset + 20);
  const localHeaderOffset = zip.readUInt32LE(centralDirOffset + 42);

  const nameLength = zip.readUInt16LE(localHeaderOffset + 26);
  const extraLength = zip.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const data = zip.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`지원하지 않는 zip 압축 방식입니다 (${method}).`);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const BLOCK_RE = /<list>([\s\S]*?)<\/list>/g;
const CODE_RE = /<corp_code>([\s\S]*?)<\/corp_code>/;
const NAME_RE = /<corp_name>([\s\S]*?)<\/corp_name>/;
const STOCK_RE = /<stock_code>([\s\S]*?)<\/stock_code>/;

function parseCorpXml(xml: string): DartCorp[] {
  const corps: DartCorp[] = [];
  for (const block of xml.matchAll(BLOCK_RE)) {
    const corpCode = CODE_RE.exec(block[1])?.[1]?.trim();
    const corpName = NAME_RE.exec(block[1])?.[1];
    if (!corpCode || !corpName) continue;
    corps.push({
      corpCode,
      corpName: decodeXml(corpName).trim(),
      stockCode: STOCK_RE.exec(block[1])?.[1]?.trim() ?? "",
    });
  }
  return corps;
}

async function loadCorps(): Promise<DartCorp[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.corps;

  const body = await dartFetch("corpCode.xml");
  const isZip = body.length > 4 && body[0] === 0x50 && body[1] === 0x4b;
  if (!isZip) {
    // Errors (bad key, rate limit...) come back as a small XML document instead of the zip.
    const text = body.toString("utf-8");
    const status = /<status>(.*?)<\/status>/.exec(text)?.[1] ?? "?";
    const message = /<message>(.*?)<\/message>/.exec(text)?.[1] ?? "알 수 없는 응답";
    throw dartStatusError(status, message);
  }

  const corps = parseCorpXml(readFirstZipEntry(body).toString("utf-8"));
  if (corps.length === 0) throw new Error("DART 고유번호 파일에서 회사 목록을 찾지 못했습니다.");
  cache = { loadedAt: Date.now(), corps };
  return corps;
}

/**
 * Resolves what the user typed — a company name, an 8-digit corp_code, or a
 * 6-digit stock code — to one DART company. Names prefer exact matches among
 * listed companies and refuse to guess when several candidates remain.
 */
export async function resolveCorp(query: string): Promise<DartCorp> {
  const q = query.trim();
  const corps = await loadCorps();

  if (/^\d{8}$/.test(q)) {
    const byCode = corps.find((c) => c.corpCode === q);
    if (byCode) return byCode;
  }
  if (/^\d{6}$/.test(q)) {
    const byStock = corps.find((c) => c.stockCode === q);
    if (byStock) return byStock;
  }

  const exact = corps.filter((c) => c.corpName === q);
  const exactListed = exact.filter((c) => c.stockCode);
  if (exactListed.length >= 1) return exactListed[0];
  if (exact.length === 1) return exact[0];

  const partialListed = corps.filter((c) => c.stockCode && c.corpName.includes(q));
  if (partialListed.length === 1) return partialListed[0];
  if (partialListed.length > 1) {
    const names = partialListed.slice(0, 5).map((c) => c.corpName).join(", ");
    throw new Error(`'${q}'와 일치하는 상장사가 여러 곳입니다 (${names} 등). 정확한 회사명을 입력하세요.`);
  }
  throw new Error(`DART에서 '${q}' 회사를 찾지 못했습니다. 정확한 회사명(또는 종목코드)을 입력하세요.`);
}
