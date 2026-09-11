import * as XLSX from "xlsx";
import type { FinancialLineItem, ParsedSource, SourceChunk } from "@/lib/types";
import { normalizeLineItemKey } from "@/lib/finance/ratios";

export interface ExcelParseResult {
  source: ParsedSource;
  lineItems: FinancialLineItem[];
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const negativeParens = /^\((.*)\)$/.exec(trimmed);
    const unwrapped = negativeParens ? `-${negativeParens[1]}` : trimmed;
    const cleaned = unwrapped.replace(/[,\s]/g, "");
    if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function parseExcel(sourceId: string, label: string, buffer: Buffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const chunks: SourceChunk[] = [];
  const lineItems: FinancialLineItem[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });
    if (rows.length === 0) continue;

    const header = (rows[0] ?? []).map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim()));

    rows.slice(1).forEach((row, idx) => {
      const rawLabel = row[0];
      if (rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === "") return;

      const rowLabel = String(rawLabel).trim();
      const rowNumber = idx + 2; // +1 for header row, +1 for 1-based indexing
      const chunkId = `${sourceId}-${sheetName}-r${rowNumber}`;
      const location = `${sheetName} 시트 ${rowNumber}행`;

      const periodValues: { period: string; value: number }[] = [];
      for (let col = 1; col < row.length; col++) {
        const period = header[col] || `열${col + 1}`;
        const num = parseNumeric(row[col]);
        if (num !== null) periodValues.push({ period, value: num });
      }

      const rowText =
        periodValues.length > 0
          ? `${rowLabel}: ${periodValues.map((p) => `${p.period}=${p.value.toLocaleString("ko-KR")}`).join(", ")}`
          : `${rowLabel}: ${row
              .slice(1)
              .filter((c) => c !== null && c !== undefined && String(c).trim() !== "")
              .join(" / ")}`;

      chunks.push({
        id: chunkId,
        sourceId,
        sourceLabel: label,
        sourceType: "excel",
        location,
        text: rowText,
      });

      const key = normalizeLineItemKey(rowLabel);
      if (key) {
        for (const pv of periodValues) {
          lineItems.push({
            key,
            label: rowLabel,
            period: pv.period,
            value: pv.value,
            sourceChunkId: chunkId,
          });
        }
      }
    });
  }

  return { source: { id: sourceId, label, type: "excel", chunks }, lineItems };
}
