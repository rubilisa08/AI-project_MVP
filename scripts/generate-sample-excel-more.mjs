// Generates a few additional, more complex sample financial statements for
// manual testing (beyond the original financial_sample.xlsx): 3 fiscal
// periods, all 11 known line items (so every one of the 9 ratios has data),
// and three different risk profiles. Run with:
//   node scripts/generate-sample-excel-more.mjs
import * as XLSX from "xlsx";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "sample_data");

function writeSample(filename, rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "재무제표");
  const outPath = join(outDir, filename);
  XLSX.writeFile(workbook, outPath);
  console.log(`샘플 재무제표 생성 완료: ${outPath}`);
}

// 1) 우량기업: 낮은 부채비율, 넉넉한 유동성, 꾸준한 성장 — 리스크가 거의 안 뜨는 케이스.
writeSample("financial_sample_healthy.xlsx", [
  ["구분", "2025", "2024", "2023"],
  ["매출액", 185000, 162000, 140000],
  ["영업이익", 33000, 27000, 21000],
  ["당기순이익", 24000, 19500, 15000],
  ["자산총계", 420000, 380000, 340000],
  ["부채총계", 120000, 115000, 110000],
  ["자본총계", 300000, 265000, 230000],
  ["유동자산", 210000, 190000, 170000],
  ["유동부채", 95000, 90000, 85000],
  ["매출원가", 110000, 98000, 86000],
  ["재고자산", 40000, 36000, 32000],
  ["이자비용", 2200, 2100, 2000],
]);

// 2) 고위험기업: 3개년 연속 매출 감소, 부채비율 과다, 단기 유동성 부족, 이자보상배율 1 미만.
writeSample("financial_sample_highrisk.xlsx", [
  ["구분", "2025", "2024", "2023"],
  ["매출액", 88000, 102000, 118000],
  ["영업이익", 1800, 4200, 9500],
  ["당기순이익", -3200, 900, 5200],
  ["자산총계", 205000, 198000, 190000],
  ["부채총계", 168000, 152000, 132000],
  ["자본총계", 37000, 46000, 58000],
  ["유동자산", 39000, 47000, 55000],
  ["유동부채", 61000, 54000, 48000],
  ["매출원가", 71000, 78000, 84000],
  ["재고자산", 21000, 17000, 14000],
  ["이자비용", 4300, 3600, 2800],
]);

// 3) 이상치 케이스: 회계 항등식(자산=부채+자본)이 어긋나고, 재고자산이 전기 대비
//    폭증(+300% 초과) — computeDataQuality의 경고 배너를 확인하기 위한 샘플.
//    2024 자산총계(150000) ≠ 부채총계(90000)+자본총계(50000)=140000 → 1% 허용오차 초과.
writeSample("financial_sample_anomaly.xlsx", [
  ["구분", "2024", "2023"],
  ["매출액", 130000, 125000],
  ["영업이익", 12000, 11500],
  ["당기순이익", 7000, 6800],
  ["자산총계", 150000, 132000],
  ["부채총계", 90000, 82000],
  ["자본총계", 50000, 50000],
  ["유동자산", 60000, 58000],
  ["유동부채", 55000, 53000],
  ["매출원가", 80000, 78000],
  ["재고자산", 26000, 6000],
  ["이자비용", 1500, 1400],
]);
