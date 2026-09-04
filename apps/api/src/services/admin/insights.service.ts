/**
 * Admin freelancer win-rate & per-gig conversion insights.
 *
 * Aggregates at the DB (groupBy + sum/count), never loading whole tables:
 *  - candidate gigs: freelancer-owned gigs that have been seen (views>0) OR
 *    ordered at least once, ranked by order volume and capped.
 *  - per-gig completed/cancelled order counts + completed revenue via
 *    `order.groupBy([gigId])` scoped to those gig ids.
 *  - freelancer rows joined from the users behind those gigs.
 * Folds everything through the pure `lib/conversionInsights`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildConversionInsights, type ConversionInsights, type FreelancerRow, type GigRow } from '../../lib/conversionInsights.js';

const MAX_GIGS = 500;

export async function conversionInsights(days = 30, limit = 10, minOrders = 3): Promise<ConversionInsights> {
  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  // Candidate gigs: freelancer-owned, seen or ordered, ranked by order volume.
  const gigs = await prisma.gig.findMany({
    where: {
      owner: { role: 'FREELANCER' },
      OR: [{ viewsCount: { gt: 0 } }, { ordersCount: { gt: 0 } }],
    },
    select: {
      id: true, ownerId: true, title: true, status: true,
      viewsCount: true, ordersCount: true, startingPriceEtb: true, rating: true, createdAt: true,
    },
    orderBy: { ordersCount: 'desc' },
    take: MAX_GIGS,
  });

  const gigIds = gigs.map((g) => g.id);
  // Per-gig order outcomes + completed revenue in the window.
  const orderAgg = gigIds.length
    ? await prisma.order.groupBy({
        by: ['gigId', 'status'],
        where: { gigId: { in: gigIds }, status: { in: ['COMPLETED', 'CANCELLED'] }, updatedAt: { gte: since } },
        _sum: { amountEtb: true },
        _count: { gigId: true },
      })
    : [];

  const byGig = new Map<string, { completed: number; cancelled: number; revenueEtb: number }>();
  for (const o of orderAgg) {
    if (!o.gigId) continue; // gigId is optional on Order — skip orphaned orders
    const cur = byGig.get(o.gigId) ?? { completed: 0, cancelled: 0, revenueEtb: 0 };
    if (o.status === 'COMPLETED') cur.completed += Number(o._count.gigId ?? 0);
    if (o.status === 'CANCELLED') cur.cancelled += Number(o._count.gigId ?? 0);
    if (o.status === 'COMPLETED') cur.revenueEtb += Number(o._sum.amountEtb ?? 0);
    byGig.set(o.gigId, cur);
  }

  // Users behind the selected gigs.
  const ownerIds = [...new Set(gigs.map((g) => g.ownerId))];
  const users = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, username: true, fullName: true, rating: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const gigByOwner = new Map<string, GigRow[]>();
  for (const g of gigs) {
    const agg = byGig.get(g.id);
    const row: GigRow = {
      gigId: g.id,
      title: g.title,
      status: g.status,
      views: g.viewsCount,
      orders: g.ordersCount,
      completed: agg?.completed ?? 0,
      cancelled: agg?.cancelled ?? 0,
      revenueEtb: agg?.revenueEtb ?? 0,
      startingPriceEtb: g.startingPriceEtb,
      rating: g.rating,
      createdAt: g.createdAt,
    };
    const list = gigByOwner.get(g.ownerId) ?? [];
    list.push(row);
    gigByOwner.set(g.ownerId, list);
  }

  const freelancers: FreelancerRow[] = ownerIds
    .map((id) => {
      const u = userById.get(id);
      return {
        userId: id,
        username: u?.username ?? '—',
        fullName: u?.fullName ?? '—',
        rating: u?.rating ?? 0,
        gigs: gigByOwner.get(id) ?? [],
      };
    })
    .filter((f) => f.gigs.length > 0);

  return buildConversionInsights(freelancers, limit, minOrders);
}
