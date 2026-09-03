/**
 * Admin Pro-monetization analytics. Pulls subscription rows (bounded) and
 * folds them into a revenue summary via the pure `lib/subscriptionAnalytics`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildSubscriptionStats, type SubscriptionStats } from '../../lib/subscriptionAnalytics.js';

export async function subscriptionAnalytics(windowDays = 30): Promise<{ windowDays: number; stats: SubscriptionStats }> {
  const safeDays = Math.min(365, Math.max(1, Number(windowDays) || 30));

  // Pull all subscriptions (bounded) so "active/total" are accurate all-time,
  // while window revenue is computed by the pure fold using `safeDays`.
  const rows = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20000,
    select: { plan: true, status: true, amountEtb: true, createdAt: true },
  });

  return {
    windowDays: safeDays,
    stats: buildSubscriptionStats(
      rows.map((r) => ({ plan: r.plan, status: r.status, amountEtb: r.amountEtb, createdAt: r.createdAt })),
      safeDays,
    ),
  };
}
