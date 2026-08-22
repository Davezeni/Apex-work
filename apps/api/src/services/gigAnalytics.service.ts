/**
 * Gig owner analytics dashboard. Reads from the append-only GigEvent
 * table plus the Order table for the funnel step "ORDER placed" and
 * "ORDER completed".
 *
 * We compute a 30-day time series for views + a coarse funnel:
 *   VIEW → CONTACT → ORDER_START → paid order.
 *
 * All queries are indexed on (gigId, createdAt DESC).
 */
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

export async function gigDashboard(gigId: string, viewerId: string) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    select: { id: true, ownerId: true, title: true, slug: true },
  });
  if (!gig) throw new NotFoundError('Gig');
  if (gig.ownerId !== viewerId) throw new ForbiddenError('Owner only');

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const from = new Date(now - 30 * day);

  const [views, contacts, starts, orders, completed] = await Promise.all([
    prisma.gigEvent.count({ where: { gigId, type: 'VIEW', createdAt: { gte: from } } }),
    prisma.gigEvent.count({ where: { gigId, type: 'CONTACT', createdAt: { gte: from } } }),
    prisma.gigEvent.count({ where: { gigId, type: 'ORDER_START', createdAt: { gte: from } } }),
    prisma.order.count({ where: { gigId, createdAt: { gte: from } } }),
    prisma.order.count({ where: { gigId, status: 'COMPLETED', createdAt: { gte: from } } }),
  ]);

  // Compact 30-day views series bucketed by UTC day.
  const raw = await prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
    SELECT DATE_TRUNC('day', "createdAt") AS d, COUNT(*) AS c
    FROM "GigEvent"
    WHERE "gigId" = ${gigId} AND "type" = 'VIEW' AND "createdAt" >= ${from}
    GROUP BY 1 ORDER BY 1 ASC
  `;
  // Fill missing days with 0 so the sparkline is even.
  const series: { day: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    const hit = raw.find((r) => r.d.toISOString().slice(0, 10) === key);
    series.push({ day: key, views: Number(hit?.c ?? 0) });
  }

  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  return {
    gig: { id: gig.id, title: gig.title, slug: gig.slug },
    range: '30d',
    kpis: {
      views, contacts, starts, orders, completed,
      viewToContact: rate(contacts, views),
      contactToOrder: rate(orders, contacts),
      completionRate: rate(completed, orders),
    },
    series,
  };
}

export async function recordEvent(gigId: string, type: 'VIEW' | 'IMPRESSION' | 'CONTACT' | 'ORDER_START', userId?: string) {
  // Cheap fire-and-forget insert; never blocks the caller.
  try {
    await prisma.gigEvent.create({ data: { gigId, type, userId: userId ?? null } });
    // Also bump the denormalized viewsCount for the feed sort.
    if (type === 'VIEW') {
      await prisma.gig.update({ where: { id: gigId }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
    }
  } catch { /* ignore */ }
}
