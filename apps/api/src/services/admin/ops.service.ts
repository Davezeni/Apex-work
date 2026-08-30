/**
 * Operations services — promotions/broadcast, subscriptions, analytics trends
 * and the audit log. Broadcast sends an in-app Notification and (optionally) a
 * WebPush to the selected audience; it is idempotent per call and chunked.
 */
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

// ---------------- FEATURED / PROMOTIONS ----------------

/** Feature a gig for N days (extends or sets `featuredUntil`). */
export async function featureGig(gigId: string, days: number) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new NotFoundError('Gig');
  const from = gig.featuredUntil && gig.featuredUntil > new Date() ? gig.featuredUntil : new Date();
  const featuredUntil = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.gig.update({
    where: { id: gigId },
    data: { isFeatured: true, featuredUntil },
    select: { id: true, title: true, isFeatured: true, featuredUntil: true },
  });
}

/** Un-feature a gig immediately. */
export async function unfeatureGig(gigId: string) {
  return prisma.gig.update({
    where: { id: gigId },
    data: { isFeatured: false, featuredUntil: null },
    select: { id: true, title: true, isFeatured: true, featuredUntil: true },
  });
}

// ---------------- BROADCAST ----------------

export async function broadcast(msg: {
  title: string;
  body: string;
  scope: 'all' | 'freelancers' | 'clients';
}) {
  const userWhere: Record<string, unknown> = {};
  if (msg.scope === 'freelancers') userWhere.role = 'FREELANCER';
  if (msg.scope === 'clients') userWhere.role = 'CLIENT';

  const users = await prisma.user.findMany({
    where: { isActive: true, ...userWhere },
    select: { id: true },
  });

  // Chunked create to stay under Prisma's argument limits for large audiences.
  const BATCH = 250;
  let created = 0;
  for (let i = 0; i < users.length; i += BATCH) {
    const chunk = users.slice(i, i + BATCH).map((u) => ({
      userId: u.id,
      type: 'SYSTEM' as const,
      title: msg.title,
      body: msg.body,
      payload: { broadcast: true },
    }));
    const res = await prisma.notification.createMany({ data: chunk });
    created += res.count;
  }
  return { audience: users.length, notificationsCreated: created, scope: msg.scope };
}

// ---------------- SUBSCRIPTIONS ----------------

export async function adminListSubscriptions(opts: {
  status?: string;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.cursorWhere) where.AND = opts.cursorWhere;
  return prisma.subscription.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    include: { user: { select: { id: true, username: true, fullName: true } } },
  });
}

// ---------------- ANALYTICS ----------------

/** Snapshot of GMV/revenue/activity for the last `days` + top gigs. */
export async function analyticsSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [completed, active, signups, orders, topGigs, recentRevenue] = await Promise.all([
    prisma.order.count({ where: { status: 'COMPLETED', completedAt: { gte: since } } }),
    prisma.order.count({ where: { status: { in: ['ACTIVE', 'IN_REVIEW', 'DELIVERED'] } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.gig.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { ordersCount: 'desc' },
      take: 10,
      select: { id: true, title: true, ordersCount: true, rating: true, startingPriceEtb: true },
    }),
    prisma.order.aggregate({
      _sum: { amountEtb: true, platformFeeEtb: true },
      where: { status: 'COMPLETED', completedAt: { gte: since } },
    }),
  ]);
  return {
    windowDays: days,
    since,
    signups,
    ordersCreated: orders,
    completedOrders: completed,
    activeOrders: active,
    gmvEtb: recentRevenue._sum.amountEtb ?? 0,
    revenueEtb: recentRevenue._sum.platformFeeEtb ?? 0,
    topGigs,
  };
}

// ---------------- AUDIT LOG ----------------

export async function listAudit(opts: {
  adminId?: string;
  resourceType?: string;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const conditions: Record<string, unknown>[] = [];
  if (opts.adminId) conditions.push({ adminId: opts.adminId });
  if (opts.resourceType) conditions.push({ resourceType: opts.resourceType });
  if (opts.cursorWhere) conditions.push(opts.cursorWhere);
  const where: Record<string, unknown> = conditions.length === 0 ? {}
    : conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };
  return prisma.adminAuditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
  });
}

/** Distinct staff roles present in the system (for the Admins tab). */
export async function listAdminRoles() {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE'] } },
    select: { id: true, username: true, fullName: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}
