/**
 * Admin service — enforces admin-only reads/writes across reports and
 * withdrawals. Every function requires an admin userId; we check the
 * role at the boundary (routes) via `requireAdmin` middleware.
 */
import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';
import type { ReportStatus, WithdrawalStatus } from '@prisma/client';
import { markStatus as markWithdrawalStatus } from './withdrawals.service.js';

// ---------------- Dashboard summary ----------------
export async function dashboardSummary() {
  const [
    totalUsers,
    totalClients,
    totalFreelancers,
    totalGigs,
    totalActiveGigs,
    totalJobs,
    totalOpenJobs,
    totalOrders,
    completedOrders,
    activeOrders,
    pendingReports,
    pendingWithdrawals,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'FREELANCER' } }),
    prisma.gig.count(),
    prisma.gig.count({ where: { status: 'ACTIVE' } }),
    prisma.job.count(),
    prisma.job.count({ where: { isOpen: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.count({ where: { status: { in: ['ACTIVE', 'IN_REVIEW', 'DELIVERED'] } } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.withdrawal.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
  ]);

  // GMV = sum of all completed order amounts.
  const gmvAgg = await prisma.order.aggregate({
    _sum: { amountEtb: true, platformFeeEtb: true },
    where: { status: 'COMPLETED' },
  });

  return {
    users: { total: totalUsers, clients: totalClients, freelancers: totalFreelancers },
    gigs: { total: totalGigs, active: totalActiveGigs },
    jobs: { total: totalJobs, open: totalOpenJobs },
    orders: { total: totalOrders, completed: completedOrders, active: activeOrders },
    gmvEtb: gmvAgg._sum.amountEtb ?? 0,
    revenueEtb: gmvAgg._sum.platformFeeEtb ?? 0,
    pending: { reports: pendingReports, withdrawals: pendingWithdrawals },
  };
}

// ---------------- Reports ----------------
export async function listReports(status?: ReportStatus, limit = 50) {
  return prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reporter: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
}

/** Admin resolves a report. `ACTIONED` = took punitive action; `DISMISSED` = no violation. */
export async function resolveReport(id: string, action: 'REVIEWED' | 'DISMISSED' | 'ACTIONED') {
  return prisma.report.update({
    where: { id },
    data: {
      status: action,
      reviewedAt: new Date(),
    },
  });
}

// ---------------- Withdrawals ----------------
export async function listWithdrawals(status?: WithdrawalStatus, limit = 50) {
  return prisma.withdrawal.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, username: true, fullName: true, phone: true } },
    },
  });
}

export async function updateWithdrawalStatus(
  id: string,
  status: WithdrawalStatus,
  meta?: { providerRef?: string; failureReason?: string },
) {
  return markWithdrawalStatus(id, status, meta);
}

// ---------------- Users ----------------
export async function listUsers(q?: string, limit = 50) {
  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        }
      : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      fullName: true,
      phone: true,
      role: true,
      isPhoneVerified: true,
      isIdVerified: true,
      isActive: true,
      suspendedAt: true,
      rating: true,
      completedOrders: true,
      createdAt: true,
    },
  });
}

export async function suspendUser(userId: string, suspend: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isActive: !suspend,
      suspendedAt: suspend ? new Date() : null,
    },
    select: { id: true, isActive: true, suspendedAt: true },
  });
}

/**
 * Admin user deletion with data-integrity handling:
 *  - No financial history (orders/withdrawals) → hard delete. Prisma
 *    cascades sessions, devices, gigs, messages, etc.
 *  - Has financial history → the ledger must stay intact, so the account is
 *    anonymized instead: PII wiped, sessions/devices/push revoked, account
 *    deactivated. Admin-visible as "deleted user".
 * Admins can never be deleted through this path (use role management first).
 */
export async function deleteUser(userId: string, opts: { forbidAdmin?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, username: true },
  });
  if (!user) throw new NotFoundError('User');
  if (opts.forbidAdmin !== false && user.role === 'ADMIN') {
    throw new ConflictError('Admin accounts cannot be deleted — demote the account first');
  }

  const [orders, withdrawals] = await Promise.all([
    prisma.order.count({ where: { OR: [{ clientId: userId }, { sellerId: userId }] } }),
    prisma.withdrawal.count({ where: { userId } }),
  ]);

  if (orders === 0 && withdrawals === 0) {
    await prisma.user.delete({ where: { id: userId } });
    return { deleted: true, anonymized: false };
  }

  const suffix = Math.random().toString(36).slice(2, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        fullName: 'Deleted user',
        username: `deleted-${suffix}`,
        phone: null,
        email: null,
        avatarUrl: null,
        bio: null,
        title: null,
        city: null,
        hourlyRateEtb: null,
        isActive: false,
        suspendedAt: new Date(),
        isOnboarded: false,
      },
    }),
    // Revoke every way back in.
    prisma.session.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.trustedDevice.deleteMany({ where: { userId } }),
    prisma.passkey.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.oAuthAccount.deleteMany({ where: { userId } }),
    prisma.messageDraft.deleteMany({ where: { userId } }),
  ]);
  return { deleted: false, anonymized: true };
}
