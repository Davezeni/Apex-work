/**
 * Admin top-performer leaderboard. Aggregates orders at the DB (groupBy +
 * sum/count) plus user/gig counts, then folds them via the pure
 * `lib/leaderboard`. Never loads whole tables.
 */
import { prisma } from '../../lib/prisma.js';
import { buildLeaderboard, type Leaderboard, type PerfRow, type UserRole } from '../../lib/leaderboard.js';

interface AggRow {
  userId: string;
  revenueEtb: bigint | number;
  count: bigint | number;
}

export async function leaderboard(windowDays = 30, limit = 10): Promise<Leaderboard> {
  const safeDays = Math.min(365, Math.max(1, Number(windowDays) || 30));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const [allTime, window, users, gigCounts] = await Promise.all([
    prisma.order.groupBy({
      by: ['sellerId'],
      where: { status: 'COMPLETED' },
      _sum: { amountEtb: true },
      _count: { sellerId: true },
    }),
    prisma.order.groupBy({
      by: ['sellerId'],
      where: { status: 'COMPLETED', completedAt: { gte: since } },
      _sum: { amountEtb: true },
      _count: { sellerId: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ['FREELANCER', 'CLIENT'] } },
      select: { id: true, username: true, fullName: true, role: true, rating: true },
    }),
    prisma.gig.groupBy({ by: ['ownerId'], where: { status: 'ACTIVE' }, _count: { ownerId: true } }),
  ]);

  const gigCountByOwner = new Map(gigCounts.map((g) => [g.ownerId, g._count.ownerId]));
  const winBySeller = new Map(window.map((w) => [w.sellerId, { revenueEtb: Number(w._sum.amountEtb ?? 0), orders: Number(w._count.sellerId ?? 0) }]));

  const perf: PerfRow[] = users.map((u) => {
    const agg = allTime.find((a) => a.sellerId === u.id);
    const win = winBySeller.get(u.id);
    const revenueEtb = Number(agg?._sum.amountEtb ?? 0);
    const completedOrders = Number(agg?._count.sellerId ?? 0);
    return {
      userId: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role as UserRole,
      revenueEtb,
      completedOrders,
      rating: u.rating,
      activeGigs: gigCountByOwner.get(u.id) ?? 0,
      windowRevenueEtb: win?.revenueEtb ?? 0,
      windowOrders: win?.orders ?? 0,
    };
  });

  return buildLeaderboard(perf, limit);
}
