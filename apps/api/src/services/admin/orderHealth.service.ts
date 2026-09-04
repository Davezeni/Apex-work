/**
 * Admin order-health "needs attention" inbox + daily digest.
 *
 * `orderHealth()` queries the orders currently in an attention-prone status
 * (with their client/seller names and newest dispute), hands them to the pure
 * `lib/orderHealth` to classify by SLA breach, and returns a priority-sorted
 * summary. `sendDigest()` builds the digest text and emails every staff user
 * via the durable EmailQueue, auditing the send. Never loads whole tables —
 * orders are selected by status and capped by recency.
 */
import { prisma } from '../../lib/prisma.js';
import { buildOrderHealth, type OrderHealthCandidate, type OrderHealthSummary } from '../../lib/orderHealth.js';
import { enqueue } from '../email.service.js';
import { adminAudit } from '../../lib/audit.js';

const ATTENTION_STATUSES = ['PENDING', 'ACTIVE', 'IN_REVIEW', 'DELIVERED', 'DISPUTED'] as const;
const MAX_ORDERS = 500;

export async function orderHealth(limit = 20): Promise<OrderHealthSummary> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...ATTENTION_STATUSES] } },
    select: {
      id: true, orderNumber: true, title: true, status: true, amountEtb: true,
      createdAt: true, updatedAt: true, deadline: true, deliveredAt: true,
      clientId: true, sellerId: true,
      client: { select: { username: true, fullName: true } },
      seller: { select: { username: true, fullName: true } },
      disputes: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_ORDERS,
  });

  const candidates: OrderHealthCandidate[] = orders.map((o) => {
    const dispute = o.disputes[0];
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      amountEtb: o.amountEtb,
      clientId: o.clientId,
      clientName: o.client.fullName || o.client.username,
      sellerId: o.sellerId,
      sellerName: o.seller.fullName || o.seller.username,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      deadline: o.deadline,
      deliveredAt: o.deliveredAt,
      disputeStatus: dispute?.status ?? null,
      disputeCreatedAt: dispute?.createdAt ?? null,
    };
  });

  const summary = buildOrderHealth(candidates);
  summary.inbox = summary.inbox.slice(0, Math.min(50, Math.max(1, limit)));
  return summary;
}

export async function sendDigest(actor: { adminId: string; adminName: string; adminRole: string }): Promise<{
  targeted: number;
  queued: number;
  recipients: string[];
}> {
  const summary = await orderHealth(50);
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE'] }, email: { not: null } },
    select: { email: true },
  });
  const recipients = [...new Set(staff.map((u) => u.email as string))];

  let queued = 0;
  for (const email of recipients) {
    try {
      await enqueue({
        to: email,
        subject: `Order health digest: ${summary.total} order(s) need attention`,
        html: summary.digestHtml,
      });
      queued += 1;
    } catch (e) {
      // keep going to the next recipient; audit log records the attempt.
    }
  }

  await adminAudit({
    adminId: actor.adminId,
    adminName: actor.adminName,
    adminRole: actor.adminRole,
    action: 'ORDER_HEALTH.DIGEST',
    resourceType: 'ORDER',
    meta: {
      total: summary.total,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      recipients: recipients.length,
      queued,
    },
  });

  return { targeted: recipients.length, queued, recipients };
}
