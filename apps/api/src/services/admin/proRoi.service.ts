/**
 * Admin Pro-subscription ROI analytics.
 *
 * Pulls paid subscriptions grouped per user (cost + purchase count), joins
 * user roles, and aggregates completed-order value generated per subscriber
 * (freelancer earnings as seller, or client spend as buyer) via DB groupBy —
 * never loading whole tables. Folds everything through the pure
 * `lib/proRoi`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildProRoi, type ProRoiSummary, type ProSubscriberRow } from '../../lib/proRoi.js';

const PAID_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

export async function proRoi(limit = 10): Promise<ProRoiSummary> {
  // Subscription cost + purchase count per user.
  const groups = await prisma.subscription.groupBy({
    by: ['userId'],
    where: { status: { in: [...PAID_STATUSES] } },
    _sum: { amountEtb: true },
    _count: { userId: true },
  });

  const userIds = groups.map((g) => g.userId);
  if (!userIds.length) return buildProRoi([]);

  const [users, sellerAgg, clientAgg] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, fullName: true, role: true },
    }),
    prisma.order.groupBy({
      by: ['sellerId'],
      where: { status: 'COMPLETED', sellerId: { in: userIds } },
      _sum: { sellerNetEtb: true },
    }),
    prisma.order.groupBy({
      by: ['clientId'],
      where: { status: 'COMPLETED', clientId: { in: userIds } },
      _sum: { amountEtb: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const earningsBySeller = new Map(sellerAgg.map((a) => [a.sellerId, Number(a._sum.sellerNetEtb ?? 0)]));
  const spendByClient = new Map(clientAgg.map((a) => [a.clientId, Number(a._sum.amountEtb ?? 0)]));

  const rows: ProSubscriberRow[] = groups.map((g) => {
    const u = userById.get(g.userId);
    const role = u?.role ?? '';
    // Freelancer value = completed-order earnings; client value = completed-order spend.
    const valueEtb = (role === 'FREELANCER'
      ? (earningsBySeller.get(g.userId) ?? 0)
      : (spendByClient.get(g.userId) ?? 0));
    return {
      userId: g.userId,
      username: u?.username ?? '—',
      fullName: u?.fullName ?? '—',
      role,
      costEtb: Number(g._sum.amountEtb ?? 0),
      valueEtb,
      purchases: Number(g._count.userId ?? 0),
      lastStatus: 'ACTIVE', // overridden below from the latest subscription
    };
  });

  // Latest status per user (for a small enrich).
  const latest = await prisma.subscription.findMany({
    where: { userId: { in: userIds }, status: { in: [...PAID_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, status: true },
  });
  const latestByUser = new Map(latest.map((s) => [s.userId, s.status]));
  for (const r of rows) r.lastStatus = latestByUser.get(r.userId) ?? r.lastStatus;

  return buildProRoi(rows, limit);
}
