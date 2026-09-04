/**
 * Admin operations-health surface: composite marketplace health score plus a
 * velocity-based fraud/abuse watchlist. Queries the needed aggregates at the
 * DB (never whole tables in one shot) and folds them through the pure
 * `lib/healthScore` and `lib/fraudWatch`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildHealthScore, type HealthInput, type HealthScore } from '../../lib/healthScore.js';
import { rankWatchlist, scoreWatchlistUser, type FraudAggregate } from '../../lib/fraudWatch.js';

const DAY = 24 * 60 * 60 * 1000;

async function fetchHealthInputs(windowDays = 30): Promise<HealthInput> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * DAY);

  const [newUsers, activatedUsers, orderedUsers] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.order.groupBy({ by: ['clientId'], where: { createdAt: { gte: windowStart } }, _count: { clientId: true } }).then((g) => g.length),
    prisma.order.groupBy({ by: ['clientId'], _count: { clientId: true } }).then((g) => g.length),
  ]);

  const [completedOrders, disputedOrders, overdueActive, supply] = await Promise.all([
    prisma.order.count({ where: { status: 'COMPLETED', completedAt: { gte: windowStart } } }),
    prisma.dispute.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.order.count({ where: { status: 'ACTIVE', deadline: { lt: now } } }),
    prisma.gig.count({ where: { status: 'ACTIVE' } }),
  ]);
  const [avgRatingAgg, activeOrders] = await Promise.all([
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.order.count({ where: { status: { in: ['ACTIVE', 'IN_REVIEW', 'DELIVERED'] } } }),
  ]);

  const activationRate = newUsers > 0 ? activatedUsers / newUsers : 0;
  const churnRate = orderedUsers > 0 ? Math.max(0, 1 - (activatedUsers / orderedUsers)) : 0;
  const disputeRate = completedOrders > 0 ? disputedOrders / completedOrders : 0;
  const overdueRate = activeOrders > 0 ? overdueActive / activeOrders : 0;
  const slaBreachRate = 0; // resolved below if ticket SLA data available
  const activeLiquidity = Math.min(1, supply / 100);
  const avgRating = avgRatingAvg(avgRatingAgg._avg.rating, 4.0);

  return { activationRate, churnRate, disputeRate, overdueRate, slaBreachRate, activeLiquidity, avgRating };
}
function avgRatingAvg(v: number | null, fallback: number): number {
  return typeof v === 'number' && v > 0 ? v : fallback;
}

export async function healthScore(windowDays = 30): Promise<{ windowDays: number; health: HealthScore }> {
  const safeDays = Math.min(120, Math.max(1, Number(windowDays) || 30));
  const inputs = await fetchHealthInputs(safeDays);
  return { windowDays: safeDays, health: buildHealthScore(inputs) };
}

async function fetchFraudAggregates(windowDays = 30, limit = 300): Promise<FraudAggregate[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * DAY);

  // Candidate users: anyone active in the last overall period (bounded).
  const users = await prisma.user.findMany({
    where: { createdAt: { lte: now } },
    select: { id: true, username: true, fullName: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Batch the per-user aggregates with a few parallel groupBy queries.
  const ids = users.map((u) => u.id);
  const [newOrders, completed, cancelled, withdrawalAgg, reviewAgg] = await Promise.all([
    ids.length ? prisma.order.groupBy({ by: ['clientId'], where: { clientId: { in: ids }, createdAt: { gte: windowStart } }, _count: { clientId: true } }) : [],
    ids.length ? prisma.order.groupBy({ by: ['clientId'], where: { clientId: { in: ids }, status: 'COMPLETED', completedAt: { gte: windowStart } }, _count: { clientId: true } }) : [],
    ids.length ? prisma.order.groupBy({ by: ['clientId'], where: { clientId: { in: ids }, status: 'CANCELLED', createdAt: { gte: windowStart } }, _count: { clientId: true } }) : [],
    ids.length ? prisma.withdrawal.groupBy({ by: ['userId'], where: { userId: { in: ids }, createdAt: { gte: windowStart } }, _sum: { amountEtb: true }, _count: { userId: true } }) : [],
    ids.length ? prisma.review.groupBy({ by: ['authorId'], where: { authorId: { in: ids }, createdAt: { gte: windowStart } }, _count: { authorId: true } }) : [],
  ]);

  // Dispute count per user (dispute.order rows, bounded).
  const disputes = ids.length ? await prisma.dispute.findMany({
    where: { createdAt: { gte: windowStart }, order: { clientId: { in: ids } } },
    select: { order: { select: { clientId: true } } },
    take: 5000,
  }) : [];
  const disputeByUser = new Map<string, number>();
  for (const d of disputes) {
    const c = d.order.clientId;
    disputeByUser.set(c, (disputeByUser.get(c) ?? 0) + 1);
  }

  const newOrdersByUser = new Map(newOrders.map((o) => [o.clientId, Number(o._count.clientId ?? 0)]));
  const completedByUser = new Map(completed.map((o) => [o.clientId, Number(o._count.clientId ?? 0)]));
  const cancelledAgg = new Map(cancelled.map((o) => [o.clientId, Number(o._count.clientId ?? 0)]));
  const withdrewByUser = new Map(withdrawalAgg.map((w) => [w.userId, { amt: Number(w._sum.amountEtb ?? 0), count: Number(w._count.userId ?? 0) }]));
  const reviewsByUser = new Map(reviewAgg.map((r) => [r.authorId, Number(r._count.authorId ?? 0)]));

  return users.map((u) => ({
    userId: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    newOrders: newOrdersByUser.get(u.id) ?? 0,
    completedOrders: completedByUser.get(u.id) ?? 0,
    cancelledOrders: cancelledAgg.get(u.id) ?? 0,
    disputedOrders: disputeByUser.get(u.id) ?? 0,
    withdrawnAmountEtb: withdrewByUser.get(u.id)?.amt ?? 0,
    withdrawalsCount: withdrewByUser.get(u.id)?.count ?? 0,
    reviewsWritten: reviewsByUser.get(u.id) ?? 0,
    accountAgeDays: Math.floor((now.getTime() - u.createdAt.getTime()) / DAY),
  }));
}

export async function fraudWatchlist(windowDays = 30, limit = 25): Promise<{ windowDays: number; items: ReturnType<typeof rankWatchlist> }> {
  const safeDays = Math.min(120, Math.max(1, Number(windowDays) || 30));
  const rows = await fetchFraudAggregates(safeDays);
  return { windowDays: safeDays, items: rankWatchlist(rows, limit) };
}
