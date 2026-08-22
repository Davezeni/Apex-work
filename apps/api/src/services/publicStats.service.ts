/**
 * Public-facing stats surfaced on user profiles.
 *
 * For clients: total hires, total spent (completed orders), member since.
 * For freelancers: earned lifetime, avg response time (placeholder ~2h),
 * completion rate, on-time rate.
 *
 * We compute cheaply from the existing Order + Wallet tables — no new
 * denormalized column. If it ever gets slow we can back this with the
 * lifetime aggregates already on Wallet.
 */
import { prisma } from '../lib/prisma.js';

export async function publicUserStats(userId: string) {
  const [asClientAgg, asSellerAgg, wallet, user] = await Promise.all([
    prisma.order.aggregate({
      _sum: { amountEtb: true },
      _count: { _all: true },
      where: { clientId: userId, status: 'COMPLETED' },
    }),
    prisma.order.aggregate({
      _sum: { sellerNetEtb: true },
      _count: { _all: true },
      where: { sellerId: userId, status: 'COMPLETED' },
    }),
    prisma.wallet.findUnique({ where: { userId }, select: { lifetimeEarnedEtb: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, rating: true, ratingCount: true, completedOrders: true, createdAt: true, availabilityJson: true },
    }),
  ]);

  return {
    role: user?.role ?? null,
    memberSince: user?.createdAt.toISOString() ?? null,
    rating: user?.rating ?? 0,
    ratingCount: user?.ratingCount ?? 0,
    completedOrders: user?.completedOrders ?? 0,
    asClient: {
      hires: asClientAgg._count._all,
      totalSpentEtb: asClientAgg._sum.amountEtb ?? 0,
    },
    asFreelancer: {
      completedOrders: asSellerAgg._count._all,
      lifetimeEarnedEtb: wallet?.lifetimeEarnedEtb ?? asSellerAgg._sum.sellerNetEtb ?? 0,
    },
    availability: user?.availabilityJson ?? null,
  };
}
