import type { DataQuality, FinancialLineItem, FinancialRatios, RatioBasisEntry } from "@/lib/types";

/** Canonical financial statement line items this MVP knows how to compute ratios from. */
export const KNOWN_LINE_ITEMS: { key: string; aliases: string[] }[] = [
  { key: "revenue", aliases: ["매출액", "매출", "수익", "revenue", "sales"] },
  { key: "operatingIncome", aliases: ["영업이익", "operating income", "operating profit"] },
  { key: "netIncome", aliases: ["당기순이익", "순이익", "net income"] },
  { key: "totalAssets", aliases: ["자산총계", "총자산", "total assets"] },
  { key: "totalLiabilities", aliases: ["부채총계", "총부채", "total liabilities"] },
  { key: "totalEquity", aliases: ["자본총계", "총자본", "total equity", "shareholders equity"] },
  { key: "currentAssets", aliases: ["유동자산", "current assets"] },
  { key: "currentLiabilities", aliases: ["유동부채", "current liabilities"] },
  { key: "costOfGoodsSold", aliases: ["매출원가", "cost of goods sold", "cogs"] },
  { key: "inventory", aliases: ["재고자산", "inventory"] },
  { key: "interestExpense", aliases: ["이자비용", "interest expense"] },
];

export function normalizeLineItemKey(rawLabel: string): string | null {
  const normalized = rawLabel.trim().toLowerCase().replace(/\s+/g, "");
  for (const item of KNOWN_LINE_ITEMS) {
    if (item.aliases.some((alias) => normalized === alias.toLowerCase().replace(/\s+/g, ""))) {
      return item.key;
    }
  }
  return null;
}

function latestTwoPeriods(items: FinancialLineItem[], key: string): FinancialLineItem[] {
  return items
    .filter((item) => item.key === key)
    .sort((a, b) => b.period.localeCompare(a.period));
}

function pick(items: FinancialLineItem[], key: string): FinancialLineItem | undefined {
  return latestTwoPeriods(items, key)[0];
}

export function computeFinancialRatios(items: FinancialLineItem[]): FinancialRatios {
  const basis: RatioBasisEntry[] = [];
  const takeValue = (item: FinancialLineItem | undefined): number | undefined => {
    if (!item) return undefined;
    basis.push({ label: `${item.label} (${item.period})`, sourceChunkId: item.sourceChunkId });
    return item.value;
  };

  const revenue = pick(items, "revenue");
  const operatingIncome = pick(items, "operatingIncome");
  const netIncome = pick(items, "netIncome");
  const totalAssets = pick(items, "totalAssets");
  const totalLiabilities = pick(items, "totalLiabilities");
  const totalEquity = pick(items, "totalEquity");
  const currentAssets = pick(items, "currentAssets");
  const currentLiabilities = pick(items, "currentLiabilities");
  const costOfGoodsSold = pick(items, "costOfGoodsSold");
  const inventory = pick(items, "inventory");
  const interestExpense = pick(items, "interestExpense");

  const result: FinancialRatios = { basis, period: revenue?.period ?? operatingIncome?.period };

  const revenueVal = takeValue(revenue);
  const operatingIncomeVal = takeValue(operatingIncome);
  const netIncomeVal = takeValue(netIncome);
  const totalAssetsVal = takeValue(totalAssets);
  const totalLiabilitiesVal = takeValue(totalLiabilities);
  const totalEquityVal = takeValue(totalEquity);
  const currentAssetsVal = takeValue(currentAssets);
  const currentLiabilitiesVal = takeValue(currentLiabilities);
  const costOfGoodsSoldVal = takeValue(costOfGoodsSold);
  const inventoryVal = takeValue(inventory);
  const interestExpenseVal = takeValue(interestExpense);

  if (totalLiabilitiesVal !== undefined && totalEquityVal) {
    result.debtRatio = round2((totalLiabilitiesVal / totalEquityVal) * 100);
  }
  if (currentAssetsVal !== undefined && currentLiabilitiesVal) {
    result.currentRatio = round2((currentAssetsVal / currentLiabilitiesVal) * 100);
  }
  if (operatingIncomeVal !== undefined && revenueVal) {
    result.operatingMargin = round2((operatingIncomeVal / revenueVal) * 100);
  }
  if (netIncomeVal !== undefined && totalEquityVal) {
    result.roe = round2((netIncomeVal / totalEquityVal) * 100);
  }
  if (netIncomeVal !== undefined && totalAssetsVal) {
    result.roa = round2((netIncomeVal / totalAssetsVal) * 100);
  }
  if (costOfGoodsSoldVal !== undefined && revenueVal) {
    result.grossMargin = round2(((revenueVal - costOfGoodsSoldVal) / revenueVal) * 100);
  }
  if (currentAssetsVal !== undefined && inventoryVal !== undefined && currentLiabilitiesVal) {
    result.quickRatio = round2(((currentAssetsVal - inventoryVal) / currentLiabilitiesVal) * 100);
  }
  if (operatingIncomeVal !== undefined && interestExpenseVal) {
    result.interestCoverageRatio = round2(operatingIncomeVal / interestExpenseVal);
  }

  const revenueSeries = latestTwoPeriods(items, "revenue");
  if (revenueSeries.length >= 2 && revenueSeries[1].value !== 0) {
    const [latest, prev] = revenueSeries;
    result.revenueGrowth = round2(((latest.value - prev.value) / prev.value) * 100);
    basis.push({ label: `${latest.label} (${prev.period})`, sourceChunkId: prev.sourceChunkId });
  }

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const ANOMALY_THRESHOLD_PERCENT = 300;

/**
 * Deterministic data-quality checks the LLM never touches: does the balance
 * sheet actually balance (자산총계 = 부채총계 + 자본총계), and did any line
 * item swing implausibly period-over-period. Catches source-data/extraction
 * errors that a purely-correct ratio formula would otherwise mask.
 */
export function computeDataQuality(items: FinancialLineItem[]): DataQuality {
  const totalAssets = pick(items, "totalAssets");
  const totalLiabilities = pick(items, "totalLiabilities");
  const totalEquity = pick(items, "totalEquity");

  const dataQuality: DataQuality = { anomalies: [] };

  if (totalAssets && totalLiabilities && totalEquity) {
    const diffAmount = round2(totalAssets.value - (totalLiabilities.value + totalEquity.value));
    const tolerance = Math.max(1, Math.abs(totalAssets.value) * 0.01);
    dataQuality.balanceSheetCheck = { balanced: Math.abs(diffAmount) <= tolerance, diffAmount };
  }

  const keys = new Set(items.map((item) => item.key));
  for (const key of keys) {
    const series = latestTwoPeriods(items, key);
    if (series.length < 2 || series[1].value === 0) continue;
    const [latest, prev] = series;
    const changePercent = round2(((latest.value - prev.value) / Math.abs(prev.value)) * 100);
    if (Math.abs(changePercent) > ANOMALY_THRESHOLD_PERCENT) {
      dataQuality.anomalies.push(
        `${latest.label}이(가) 전기 대비 ${changePercent}% 변동했습니다 (이상치 의심)`,
      );
    }
  }

  return dataQuality;
}
