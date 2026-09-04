/**
 * Referral programme analytics — the dashboard behind the share-your-link
 * page. Gathers the referrer's link/code plus each referred user's completed
 * order aggregates, and folds them into a stat summary via the pure
 * `lib/referralStats` mapper.
 */
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { buildReferralStats, type ReferralStats } from '../lib/referralStats.js';

export interface ReferralDashboard {
  referralCode: string;
  shareUrl: string;
  /** Total tracked link clicks for this referrer. */
  linkClicks: number;
  /** a social short link (single source of truth lives in web). */
  stats: ReferralStats;
  referred: {
    userId: string;
    username: string;
    fullName: string;
    joinedAt: string;
    completedOrders: number;
    spentEtb: number;
  }[];
}

export async function referralDashboard(userId: string): Promise<ReferralDashboard> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, referralCode: true },
  });
  if (!user) throw new NotFoundError('User');

  const [clicks, referredUsers, attributed] = await Promise.all([
    prisma.referralClick.count({ where: { referrerId: userId } }),
    prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, username: true, fullName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.order.groupBy({
      by: ['clientId'],
      where: { client: { referredById: userId }, status: 'COMPLETED' },
      _count: { clientId: true },
      _sum: { amountEtb: true },
    }),
  ]);

  const aggByClient = new Map(attributed.map((a) => [a.clientId, a]));
  const referred = referredUsers.map((r) => {
    const agg = aggByClient.get(r.id);
    return {
      userId: r.id,
      username: r.username,
      fullName: r.fullName,
      joinedAt: r.createdAt.toISOString(),
      completedOrders: agg?._count.clientId ?? 0,
      spentEtb: agg?._sum.amountEtb ?? 0,
    };
  });

  const stats = buildReferralStats(
    referred.map((r) => ({
      userId: r.userId,
      username: r.username,
      fullName: r.fullName,
      createdAt: new Date(r.joinedAt),
      completedOrders: r.completedOrders,
      spentEtb: r.spentEtb,
    })),
  );

  return {
    referralCode: user.referralCode,
    shareUrl: `https://apex-work-gold.vercel.app/signup?ref=${user.referralCode}`,
    linkClicks: clicks,
    stats,
    referred,
  };
}

/**
 * Record a referral-link click (public). Optionally resolves the referrer so
 * the click rolls up into their dashboard. Always succeeds — if the ref code
 * is unknown, the click is still logged with null referrer so nothing breaks
 * the redirect flow.
 */
export async function trackReferralClick(input: { refCode: string; source: string }) {
  const referrer = await prisma.user.findUnique({
    where: { referralCode: input.refCode },
    select: { id: true },
  });
  await prisma.referralClick.create({
    data: {
      refCode: input.refCode,
      source: input.source,
      referrerId: referrer?.id ?? null,
    },
  });
  return { ok: true };
}
