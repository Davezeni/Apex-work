/**
 * Admin Pro-subscription ROI analytics.
 *
 * Pro passes on Apex-Work are one-time 30-day passes, so ROI asks: does going
 * Pro pay for itself? For each Pro subscriber we compare the subscription
 * spend (cost) against the value they generated — for a freelancer that's the
 * completed-order revenue they earned; for a client it's the value of the
 * orders they placed. `buildProRoi` is a pure, dependency-free fold so the
 * money math is auditable and unit-testable without a DB.
 */

export interface ProSubscriberRow {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  costEtb: number;
  valueEtb: number;
  purchases: number;
  lastStatus: string;
}

export interface ProRoiRow extends ProSubscriberRow {
  /** value − cost (positive = profitable). */
  netEtb: number;
  /** value / cost (0 when there's no cost). */
  roiMultiple: number;
  profitable: boolean;
}

export interface ProRoiSummary {
  subscribers: number;
  totalCostEtb: number;
  totalValueEtb: number;
  netEtb: number;
  /** whole-cohort ROI multiple (totalValue / totalCost; 0 if no cost). */
  roiMultiple: number;
  /** share of subscribers who bought more than one Pro pass (0..1). */
  repurchaseRate: number;
  profitableCount: number;
  profitablePct: number;
  /** average per-subscriber ROI multiple (excluding zero-cost rows). */
  avgRoi: number;
  topRoi: ProRoiRow[];
  worstRoi: ProRoiRow[];
}

function roiRow(r: ProSubscriberRow): ProRoiRow {
  const netEtb = r.valueEtb - r.costEtb;
  const roiMultiple = r.costEtb > 0 ? r.valueEtb / r.costEtb : 0;
  return { ...r, netEtb, roiMultiple, profitable: netEtb > 0 };
}

export function buildProRoi(rows: ProSubscriberRow[], limit = 10): ProRoiSummary {
  const subs = rows.filter((r) => r.costEtb > 0);
  const totalCostEtb = subs.reduce((s, r) => s + r.costEtb, 0);
  const totalValueEtb = subs.reduce((s, r) => s + r.valueEtb, 0);
  const netEtb = totalValueEtb - totalCostEtb;
  const roiMultiple = totalCostEtb > 0 ? totalValueEtb / totalCostEtb : 0;
  const repurchaseRate = subs.length ? subs.filter((r) => r.purchases > 1).length / subs.length : 0;
  const profitableCount = subs.filter((r) => r.valueEtb - r.costEtb > 0).length;
  const profitablePct = subs.length ? profitableCount / subs.length : 0;
  const costPositive = subs.filter((r) => r.costEtb > 0);
  const avgRoi = costPositive.length ? costPositive.reduce((s, r) => s + r.valueEtb / r.costEtb, 0) / costPositive.length : 0;

  const ranked = subs.map(roiRow).sort((a, b) => b.roiMultiple - a.roiMultiple);
  return {
    subscribers: subs.length,
    totalCostEtb,
    totalValueEtb,
    netEtb,
    roiMultiple,
    repurchaseRate,
    profitableCount,
    profitablePct,
    avgRoi,
    topRoi: ranked.slice(0, limit),
    worstRoi: ranked.slice(-limit).reverse(),
  };
}
