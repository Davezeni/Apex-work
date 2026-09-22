/**
 * User-visible transparency: the signed-in user's own slice of the audit
 * trail. Extends the single audit store — no separate activity log to keep
 * in sync. Includes:
 *   - rows the user themself caused (delivered, approved, payout requested,
 *     device/PIN/phone changes …)
 *   - SYSTEM rows on their orders (escrow funded / auto-released / refunded)
 *     so automated money movement is visible to the people it affects.
 * Admin-only rows about their resources stay internal — staff proceedings
 * are not part of a user's activity feed.
 */
import { prisma } from '../lib/prisma.js';

export interface ActivityItem {
  id: string;
  at: Date;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorType: string; // USER | SYSTEM (ADMIN rows are excluded for non-staff)
  meta: unknown;
}

export async function listMyActivity(userId: string, limit = 30): Promise<ActivityItem[]> {
  // Orders where this user is the client OR the seller. Recent 50 is plenty —
  // the activity feed itself is capped well below that.
  const myOrders = await prisma.order.findMany({
    where: { OR: [{ clientId: userId }, { sellerId: userId }] },
    select: { id: true },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  });

  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { adminId: userId, actorType: { in: ['USER', 'ADMIN'] } },
        {
          actorType: 'SYSTEM',
          resourceType: 'ORDER',
          resourceId: { in: myOrders.map((o) => o.id) },
        },
      ],
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: limit,
    select: {
      id: true,
      createdAt: true,
      action: true,
      resourceType: true,
      resourceId: true,
      actorType: true,
      meta: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    actorType: r.actorType,
    meta: r.meta,
  }));
}
