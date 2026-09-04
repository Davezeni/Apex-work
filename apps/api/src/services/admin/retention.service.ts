/**
 * Admin retention & churn analytics.
 *
 * Aggregates at the DB: user signups in the window (bounded) plus first/last
 * order per user via `order.groupBy` on each role (seller + client). Folds
 * through the pure `lib/retention`. Never loads whole tables in one query.
 */
import { prisma } from '../../lib/prisma.js';
import { buildRetention, type RetentionSummary, type RetentionUserRow } from '../../lib/retention.js';

const DAY = 24 * 60 * 60 * 1000;

export async function retention(windowDays = 60): Promise<{ windowDays: number; stats: RetentionSummary }> {
  const safeDays = Math.min(365, Math.max(1, Number(windowDays) || 60));
  const windowStart = new Date(Date.now() - safeDays * DAY);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: windowStart } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  });
  const ids = users.map((u) => u.id);

  const [seller, client] = await Promise.all([
    ids.length
      ? prisma.order.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids } }, _min: { createdAt: true }, _max: { createdAt: true }, _count: { sellerId: true } })
      : [],
    ids.length
      ? prisma.order.groupBy({ by: ['clientId'], where: { clientId: { in: ids } }, _min: { createdAt: true }, _max: { createdAt: true }, _count: { clientId: true } })
      : [],
  ]);

  const byUser = new Map<string, { first: Date | null; last: Date | null; count: number }>();
  const merge = (key: string, min: Date | null, max: Date | null, count: number) => {
    const cur = byUser.get(key) ?? { first: null, last: null, count: 0 };
    if (min && (!cur.first || min < cur.first)) cur.first = min;
    if (max && (!cur.last || max > cur.last)) cur.last = max;
    cur.count += count;
    byUser.set(key, cur);
  };
  for (const r of seller) merge(r.sellerId, r._min.createdAt, r._max.createdAt, Number(r._count.sellerId ?? 0));
  for (const r of client) merge(r.clientId, r._min.createdAt, r._max.createdAt, Number(r._count.clientId ?? 0));

  const rows: RetentionUserRow[] = users.map((u) => {
    const agg = byUser.get(u.id);
    return {
      userId: u.id,
      signupAt: u.createdAt,
      firstOrderAt: agg?.first ?? null,
      lastOrderAt: agg?.last ?? null,
      orderCount: agg?.count ?? 0,
    };
  });

  return { windowDays: safeDays, stats: buildRetention(rows, { now: new Date(), windowDays: safeDays }) };
}
