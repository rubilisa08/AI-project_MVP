// Regenerates sample_data/financial_sample.xlsx used for manually testing the
// full pipeline. Run with: node scripts/generate-sample-excel.mjs
import * as XLSX from "xlsx";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rows = [
  ["구분", "2024", "2023"],
  ["매출액", 120000, 100000],
  ["영업이익", 15000, 8000],
  ["당기순이익", 9000, 4000],
  ["자산총계", 200000, 180000],
  ["부채총계", 140000, 130000],
  ["자본총계", 60000, 50000],
  ["유동자산", 80000, 70000],
  ["유동부채", 90000, 60000],
];

const sheet = XLSX.utils.aoa_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "재무제표");

const outPath = join(__dirname, "..", "sample_data", "financial_sample.xlsx");
XLSX.writeFile(workbook, outPath);
console.log(`샘플 재무제표 생성 완료: ${outPath}`);
