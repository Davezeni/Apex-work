/**
 * Admin support SLA & team analytics. Gathers recent tickets with their staff
 * messages, derives first-reply timings, and folds them via the pure
 * `lib/supportAnalytics`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildSupportAnalytics, type SupportAnalytics } from '../../lib/supportAnalytics.js';

export async function supportAnalytics(): Promise<SupportAnalytics & { asOf: string }> {
  // Pull recent tickets (bounded) plus their first staff message time.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const tickets = await prisma.supportTicket.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      id: true, status: true, createdAt: true, resolvedAt: true,
      messages: {
        where: { isStaff: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true, senderId: true },
      },
    },
  });

  // Need the LAST staff message for per-admin attribution; re-query those cheaply.
  const staffMessages = await prisma.supportMessage.findMany({
    where: { ticketId: { in: tickets.map((t) => t.id) }, isStaff: true },
    orderBy: { createdAt: 'asc' },
    select: { ticketId: true, senderId: true, createdAt: true },
  });
  const lastByTicket = new Map<string, { senderId: string; createdAt: Date }>();
  for (const m of staffMessages) lastByTicket.set(m.ticketId, { senderId: m.senderId, createdAt: m.createdAt });

  const stats = buildSupportAnalytics(
    tickets.map((t) => {
      const first = t.messages[0];
      const last = lastByTicket.get(t.id);
      return {
        id: t.id,
        status: t.status,
        createdAt: t.createdAt,
        resolvedAt: t.resolvedAt,
        firstStaffReplyAt: first?.createdAt ?? null,
        lastStaffId: last?.senderId ?? null,
      };
    }),
  );

  return { ...stats, asOf: new Date().toISOString() };
}
