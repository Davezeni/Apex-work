/**
 * Support operations — admin view of the support ticket queue. Users open
 * tickets (or the AI bot escalates); staff reply via SupportMessage and set
 * status. Gated by `support:tickets`.
 */
import { prisma } from '../../lib/prisma.js';
import type { SupportTicketStatus } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';

export async function adminListTickets(opts: {
  status?: SupportTicketStatus;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.cursorWhere) where.AND = opts.cursorWhere;
  return prisma.supportTicket.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    include: {
      user: { select: { id: true, username: true, fullName: true, phone: true, email: true } },
      _count: { select: { messages: true } },
    },
  });
}

export async function getTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, username: true, fullName: true, phone: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) throw new NotFoundError('Ticket');
  return ticket;
}

/** Staff reply; supports bumping the ticket back to WAITING_USER. */
export async function replyToTicket(ticketId: string, staffId: string, body: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Ticket');
  return prisma.$transaction(async (tx) => {
    await tx.supportMessage.create({
      data: { ticketId, senderId: staffId, body, isStaff: true },
    });
    return tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'WAITING_USER' },
      include: { user: { select: { id: true, username: true, fullName: true } } },
    });
  });
}

export async function setTicketStatus(ticketId: string, status: SupportTicketStatus) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Ticket');
  const data: Record<string, unknown> = { status };
  if (status === 'RESOLVED' || status === 'CLOSED') data.resolvedAt = new Date();
  else data.resolvedAt = null;
  return prisma.supportTicket.update({ where: { id: ticketId }, data });
}
