/**
 * Subscription / Pro-monetization analytics.
 *
 * Pro plans on Apex-Work are one-time 30-day passes, so instead of recurring
 * MRR we report: how many users are Pro right now, how much we've taken in,
 * the by-plan mix, and the trailing-window revenue. `buildSubscriptionStats`
 * is a pure, dependency-free fold over subscription rows so the money math is
 * unit-testable in one auditable place.
 */

export interface SubscriptionRow {
  plan: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | string;
  amountEtb: number;
  createdAt: Date;
}

export interface PlanStat {
  plan: string;
  /** total paid instances (any non-pending status). */
  count: number;
  /** currently active instances. */
  active: number;
  revenueEtb: number;
  /** share of revenue, 0..100. */
  sharePct: number;
}

export interface SubscriptionStats {
  /** count currently ACTIVE. */
  activeSubscribers: number;
  /** sum of amountEtb for currently ACTIVE subscriptions. */
  activeRevenueEtb: number;
  /** sum of amountEtb across all non-pending subscriptions. */
  totalRevenueEtb: number;
  /** revenue from subscriptions created in the trailing window. */
  lastWindowRevenueEtb: number;
  /** count of subscriptions created in the trailing window. */
  lastWindowPurchases: number;
  /** average price per subscription (non-pending). */
  avgPriceEtb: number;
  byPlan: PlanStat[];
  /** biggest revenue plan (or null if none). */
  topPlan: PlanStat | null;
}

const PAID_STATUSES = new Set(['ACTIVE', 'EXPIRED', 'CANCELLED']);

/** Fold subscription rows into a monetization summary. */
export function buildSubscriptionStats(
  rows: SubscriptionRow[],
  windowDays = 30,
  now: Date = new Date(),
): SubscriptionStats {
  const paid = rows.filter((r) => PAID_STATUSES.has(r.status));
  const active = paid.filter((r) => r.status === 'ACTIVE');
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const totalRevenueEtb = paid.reduce((s, r) => s + r.amountEtb, 0);
  const activeRevenueEtb = active.reduce((s, r) => s + r.amountEtb, 0);
  const avgPriceEtb = paid.length ? Math.round(totalRevenueEtb / paid.length) : 0;

  const byPlanMap = new Map<string, { count: number; active: number; revenueEtb: number }>();
  for (const r of paid) {
    const cur = byPlanMap.get(r.plan) ?? { count: 0, active: 0, revenueEtb: 0 };
    cur.count += 1;
    cur.revenueEtb += r.amountEtb;
    if (r.status === 'ACTIVE') cur.active += 1;
    byPlanMap.set(r.plan, cur);
  }
  const byPlan: PlanStat[] = [...byPlanMap.entries()].map(([plan, v]) => ({
    plan,
    count: v.count,
    active: v.active,
    revenueEtb: v.revenueEtb,
    sharePct: totalRevenueEtb > 0 ? Math.round((v.revenueEtb / totalRevenueEtb) * 100) : 0,
  })).sort((a, b) => b.revenueEtb - a.revenueEtb);

  let lastWindowRevenueEtb = 0;
  let lastWindowPurchases = 0;
  for (const r of paid) {
    if (r.createdAt >= windowStart) {
      lastWindowRevenueEtb += r.amountEtb;
      lastWindowPurchases += 1;
    }
  }

  return {
    activeSubscribers: active.length,
    activeRevenueEtb,
    totalRevenueEtb,
    lastWindowRevenueEtb,
    lastWindowPurchases,
    avgPriceEtb,
    byPlan,
    topPlan: byPlan[0] ?? null,
  };
}
