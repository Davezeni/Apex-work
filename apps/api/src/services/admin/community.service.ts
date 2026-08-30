/**
 * Community & trust services — user management, identity verification, roles,
 * agencies and subscriptions. Role changes and ID verification are
 * high-privilege (gated by `users:manage` / `users:verify`) and audited.
 */
import { prisma } from '../../lib/prisma.js';
import type { UserRole } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

// ---------------- USERS ----------------

export async function adminListUsers(opts: {
  q?: string;
  role?: UserRole;
  suspended?: boolean;
  unverified?: boolean;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const conditions: Record<string, unknown>[] = [];
  if (opts.q) {
    conditions.push({
      OR: [
        { username: { contains: opts.q, mode: 'insensitive' } },
        { fullName: { contains: opts.q, mode: 'insensitive' } },
        { phone: { contains: opts.q } },
        { email: { contains: opts.q, mode: 'insensitive' } },
      ],
    });
  }
  if (opts.role) conditions.push({ role: opts.role });
  if (opts.suspended !== undefined) conditions.push({ suspendedAt: opts.suspended ? { not: null } : null });
  if (opts.unverified) conditions.push({ isIdVerified: false });
  if (opts.cursorWhere) conditions.push(opts.cursorWhere);
  const where: Record<string, unknown> = conditions.length === 0 ? {}
    : conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };

  return prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    select: {
      id: true, username: true, fullName: true, phone: true, email: true, role: true,
      isPhoneVerified: true, isIdVerified: true, isActive: true, suspendedAt: true,
      rating: true, ratingCount: true, completedOrders: true, createdAt: true,
      gigs: { select: { _count: { select: { orders: true } } } },
    },
  });
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: true,
      _count: {
        select: { gigs: true, ordersAsClient: true, ordersAsSeller: true, reviewsAbout: true },
      },
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function setUserRole(userId: string, role: UserRole) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  return prisma.user.update({ where: { id: userId }, data: { role }, select: { id: true, role: true } });
}

/** Approve/reject an ID verification. */
export async function verifyIdentity(userId: string, approve: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  return prisma.user.update({
    where: { id: userId },
    data: { isIdVerified: approve },
    select: { id: true, isIdVerified: true },
  });
}

export async function suspendUser(userId: string, suspend: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: !suspend, suspendedAt: suspend ? new Date() : null },
    select: { id: true, isActive: true, suspendedAt: true },
  });
}

// ---------------- AGENCIES ----------------

export async function adminListAgencies(limit = 50) {
  return prisma.agency.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      owner: { select: { id: true, username: true, fullName: true } },
      _count: { select: { members: true } },
    },
  });
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
