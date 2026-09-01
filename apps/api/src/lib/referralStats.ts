/**
 * Referral programme analytics.
 *
 * `buildReferralStats` is a pure, dependency-free mapper that turns a set of
 * referred users (with their order aggregates) into a friendly dashboard:
 * counts across four cohorts of signup → activation progress and the
 * commission the referrer has earned. Keeping it pure makes it trivial to
 * unit test and keeps the money math in one auditable place.
 */

export interface ReferredUserRow {
  userId: string;
  username: string;
  fullName: string;
  createdAt: Date;
  /** completed order count (the "verified/qualified" signal). */
  completedOrders: number;
  /** total spent on completed orders by this referred user. */
  spentEtb: number;
}

export interface ReferralStats {
  total: number;
  /** signed up, no completed order yet. */
  pending: number;
  /** has ≥1 completed order. */
  active: number;
  /** total GMV attributed to referred users. */
  attributedGmvEtb: number;
  /** commission the referrer has earned (REWARD_RATE × attributed GMV). */
  commissionEtb: number;
  topBySpend: { username: string; fullName: string; spentEtb: number } | null;
}

/** Commission share paid to the referrer on a referred user's completed GMV. */
export const REWARD_RATE = 0.05;

/**
 * Turn raw referred-user rows into a dashboard summary.
 * @param referred referred users, each with completed-order aggregates.
 * @param rewardRate commission share applied to attributed GMV (default 5%).
 */
export function buildReferralStats(
  referred: ReferredUserRow[],
  rewardRate: number = REWARD_RATE,
): ReferralStats {
  const total = referred.length;
  const active = referred.filter((r) => r.completedOrders > 0);
  const pending = total - active.length;
  const attributedGmvEtb = referred.reduce((sum, r) => sum + r.spentEtb, 0);

  let topBySpend: ReferralStats['topBySpend'] = null;
  for (const r of referred) {
    if (!topBySpend || r.spentEtb > topBySpend.spentEtb) {
      topBySpend = { username: r.username, fullName: r.fullName, spentEtb: r.spentEtb };
    }
  }
  if (topBySpend && topBySpend.spentEtb <= 0) topBySpend = null;

  return {
    total,
    pending,
    active: active.length,
    attributedGmvEtb,
    commissionEtb: Math.round(attributedGmvEtb * rewardRate),
    topBySpend,
  };
}
