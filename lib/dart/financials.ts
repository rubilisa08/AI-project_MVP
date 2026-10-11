import { z } from "zod";
import { normalizeLineItemKey } from "@/lib/finance/ratios";
import type { FinancialLineItem, ParsedSource, SourceChunk } from "@/lib/types";
import { dartFetch, dartStatusError } from "./client";
import { resolveCorp } from "./corpCode";

const REPORT_CODES = {
  q1: { code: "11013", name: "1분기보고서", short: "1분기" },
  half: { code: "11012", name: "반기보고서", short: "반기" },
  q3: { code: "11014", name: "3분기보고서", short: "3분기" },
  annual: { code: "11011", name: "사업보고서", short: "" },
} as const;

export const DartRequestSchema = z.object({
  company: z.string().trim().min(1).max(100),
  year: z.number().int().min(2015).max(new Date().getFullYear()),
  report: z.enum(["q1", "half", "q3", "annual"]),
  fsDiv: z.enum(["CFS", "OFS"]).default("CFS"),
});
export type DartRequest = z.infer<typeof DartRequestSchema>;

interface DartAccountRow {
  rcept_no?: string;
  sj_div?: string;
  sj_nm?: string;
  fs_div?: string;
  fs_nm?: string;
  account_nm?: string;
  thstrm_amount?: string;
  thstrm_add_amount?: string;
  frmtrm_amount?: string;
  frmtrm_add_amount?: string;
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** DART labels like "당기순이익(손실)" or "수익(매출액)" carry a parenthetical the alias table doesn't know. */
function stripParenthetical(label: string): string {
  return label.replace(/\(.*?\)/g, "").trim();
}

/**
 * Turns DART's account rows into the same line items/chunks an uploaded Excel
 * file produces, so ratios, risks and citations work unchanged downstream.
 * Balance-sheet rows are point-in-time; income-statement rows in quarterly
 * reports use the cumulative column when DART provides one.
 */
export function mapDartAccounts(
  rows: DartAccountRow[],
  ctx: { sourceId: string; sourceLabel: string; year: number; report: DartRequest["report"] },
): { chunks: SourceChunk[]; lineItems: FinancialLineItem[] } {
  const { sourceId, sourceLabel, year, report } = ctx;
  const kind = REPORT_CODES[report].short;
  const periodLabel = (y: number, isBalanceSheet: boolean) => {
    if (!kind) return String(y);
    if (isBalanceSheet) return y === year ? `${y} ${kind}말` : `${y} 기말`;
    return `${y} ${kind}`;
  };

  const chunks: SourceChunk[] = [];
  const lineItems: FinancialLineItem[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (!row.account_nm) continue;
    const key = normalizeLineItemKey(stripParenthetical(row.account_nm));
    if (!key || seenKeys.has(key)) continue;

    const isBalanceSheet = row.sj_div === "BS";
    const useCumulative = !isBalanceSheet && report !== "annual";
    const current = parseAmount(useCumulative ? row.thstrm_add_amount || row.thstrm_amount : row.thstrm_amount);
    const previous = parseAmount(useCumulative ? row.frmtrm_add_amount || row.frmtrm_amount : row.frmtrm_amount);
    if (current === null && previous === null) continue;

    seenKeys.add(key);
    const chunkId = `${sourceId}-dart-${chunks.length + 1}`;
    const periods: { period: string; value: number }[] = [];
    if (current !== null) periods.push({ period: periodLabel(year, isBalanceSheet), value: current });
    if (previous !== null) periods.push({ period: periodLabel(year - 1, isBalanceSheet), value: previous });

    const suffix = useCumulative ? " [누적]" : "";
    chunks.push({
      id: chunkId,
      sourceId,
      sourceLabel,
      sourceType: "dart",
      location: `DART ${row.sj_nm ?? ""}(${row.fs_nm ?? ""}) · 접수번호 ${row.rcept_no ?? "-"}`,
      text: `${row.account_nm}: ${periods.map((p) => `${p.period}=${p.value.toLocaleString("ko-KR")}원`).join(", ")}${suffix}`,
    });
    for (const p of periods) {
      lineItems.push({ key, label: row.account_nm, period: p.period, value: p.value, sourceChunkId: chunkId });
    }
  }

  return { chunks, lineItems };
}

/** Collector path for "company name + year + report type": fetches DART's key accounts instead of a file. */
export async function collectFromDart(
  sourceId: string,
  request: DartRequest,
): Promise<{ source: ParsedSource; lineItems: FinancialLineItem[] }> {
  const corp = await resolveCorp(request.company);
  const report = REPORT_CODES[request.report];

  const body = await dartFetch("fnlttSinglAcnt.json", {
    corp_code: corp.corpCode,
    bsns_year: String(request.year),
    reprt_code: report.code,
  });

  let payload: { status?: string; message?: string; list?: DartAccountRow[] };
  try {
    payload = JSON.parse(body.toString("utf-8"));
  } catch {
    throw new Error("DART 응답을 해석하지 못했습니다.");
  }
  if (payload.status !== "000") throw dartStatusError(payload.status ?? "?", payload.message ?? "");

  const all = payload.list ?? [];
  // Companies without consolidated statements only report standalone (OFS) — fall back instead of failing.
  const preferred = all.filter((row) => row.fs_div === request.fsDiv);
  const usedDiv = preferred.length > 0 ? request.fsDiv : request.fsDiv === "CFS" ? "OFS" : "CFS";
  const rows = preferred.length > 0 ? preferred : all.filter((row) => row.fs_div === usedDiv);
  const fsLabel = usedDiv === "CFS" ? "연결" : "별도";

  const label = `${corp.corpName} ${request.year}년 ${report.name} (OpenDART·${fsLabel})`;
  const { chunks, lineItems } = mapDartAccounts(rows, {
    sourceId,
    sourceLabel: label,
    year: request.year,
    report: request.report,
  });
  if (chunks.length === 0) {
    throw new Error("DART 주요계정에서 분석 가능한 항목(매출액·자산총계 등)을 찾지 못했습니다.");
  }

  return { source: { id: sourceId, label, type: "dart", chunks }, lineItems };
}
