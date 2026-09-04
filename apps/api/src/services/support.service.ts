/**
 * Support tickets. Users open a ticket → admins reply via SupportMessage.
 * Every message flips the ticket status so both sides know who's next
 * ("waiting user" vs "waiting staff").
 */
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { sendPush } from './push.service.js';

export async function createTicket(userId: string, input: { subject: string; category: string; body: string }) {
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: { userId, subject: input.subject, category: input.category, status: 'WAITING_STAFF' },
    });
    await tx.supportMessage.create({
      data: { ticketId: t.id, senderId: userId, body: input.body, isStaff: false },
    });
    return t;
  });
  return ticket;
}

export async function listMyTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}

export async function getTicket(ticketId: string, viewerId: string, isAdmin: boolean) {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!t) throw new NotFoundError('Ticket');
  if (!isAdmin && t.userId !== viewerId) throw new ForbiddenError();
  return t;
}

export async function addMessage(ticketId: string, senderId: string, body: string, isStaff: boolean) {
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { userId: true, subject: true, status: true } });
  if (!t) throw new NotFoundError('Ticket');
  if (!isStaff && t.userId !== senderId) throw new ForbiddenError();

  const nextStatus = isStaff ? 'WAITING_USER' : 'WAITING_STAFF';
  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.supportMessage.create({
      data: { ticketId, senderId, body, isStaff },
    });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: nextStatus, updatedAt: new Date() },
    });
    return m;
  });

  // Notify the OTHER side.
  const notifyUserId = isStaff ? t.userId : null; // (we don't notify admins yet — they'll get badge count from admin panel)
  if (notifyUserId) {
    await notify({
      userId: notifyUserId,
      type: 'SYSTEM',
      title: 'Support replied to your ticket',
      body: body.slice(0, 140),
      payload: { ticketId },
    });
    void sendPush(notifyUserId, {
      title: 'Support replied', body: t.subject,
      url: `/support/${ticketId}`,
      tag: `ticket-${ticketId}`,
    });
  }
  return msg;
}

export async function setStatus(ticketId: string, viewerId: string, isAdmin: boolean, status: 'RESOLVED' | 'CLOSED' | 'OPEN' | 'WAITING_USER' | 'WAITING_STAFF') {
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) throw new NotFoundError('Ticket');
  if (!isAdmin && t.userId !== viewerId) throw new ForbiddenError();
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
    },
  });
}

/**
 * CSAT — the ticket owner rates their support experience once a ticket is
 * resolved/closed. One-time (re-submitting returns a conflict). Persists and
 * the admin support panel surfaces the score via `adminList`.
 */
export async function submitCsat(ticketId: string, userId: string, rating: number, comment?: string) {
  if (rating < 1 || rating > 5) throw new BadRequestError('Rating must be between 1 and 5');
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { userId: true, status: true, csatRating: true } });
  if (!t) throw new NotFoundError('Ticket');
  if (t.userId !== userId) throw new ForbiddenError();
  if (t.csatRating !== null) throw new ConflictError('You already rated this ticket');
  if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') {
    throw new ConflictError('You can only rate a resolved ticket');
  }
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { csatRating: rating, csatComment: comment ?? null, csatScoredAt: new Date() },
    select: { id: true, csatRating: true, csatComment: true, csatScoredAt: true },
  });
}

// Admin-only list
export async function adminList(status?: string) {
  return prisma.supportTicket.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
}
