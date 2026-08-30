import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

export interface TrustCheck {
  key: string;
  label: string;
  complete: boolean;
  weight: number;
  detail: string;
}

/**
 * Compute an explainable trust profile from signals already present in the
 * marketplace. This is deliberately not a hidden ranking algorithm: every
 * point is shown to the freelancer and public profile visitor.
 */
export async function profile(userId: string) {
  const [user, sellerOrders, portfolioCount, verifiedCertifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isPhoneVerified: true,
        isIdVerified: true,
        rating: true,
        ratingCount: true,
        completedOrders: true,
      },
    }),
    prisma.order.findMany({
      where: { sellerId: userId },
      select: { status: true, deadline: true, deliveredAt: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.portfolioItem.count({ where: { userId } }),
    prisma.certification.count({ where: { resume: { userId }, verifiedAt: { not: null } } }),
  ]);
  if (!user) throw new NotFoundError('User');

  const completed = sellerOrders.filter((order) => order.status === 'COMPLETED').length;
  const delivered = sellerOrders.filter((order) => order.deliveredAt);
  const onTime = delivered.filter(
    (order) => !order.deadline || order.deliveredAt! <= order.deadline,
  ).length;
  const onTimeRate = delivered.length > 0 ? Math.round((onTime / delivered.length) * 100) : null;

  const checks: TrustCheck[] = [
    {
      key: 'phone',
      label: 'Phone verified',
      complete: user.isPhoneVerified,
      weight: 15,
      detail: user.isPhoneVerified
        ? 'Secure phone verification complete'
        : 'Verify your Ethiopian phone number',
    },
    {
      key: 'identity',
      label: 'Identity verified',
      complete: user.isIdVerified,
      weight: 20,
      detail: user.isIdVerified
        ? 'Identity check approved'
        : 'Complete identity verification to earn trust',
    },
    {
      key: 'reviews',
      label: 'Reviewed work',
      complete: user.ratingCount >= 3,
      weight: 20,
      detail:
        user.ratingCount > 0
          ? `${user.rating.toFixed(1)} rating from ${user.ratingCount} review${user.ratingCount === 1 ? '' : 's'}`
          : 'Complete work and request client reviews',
    },
    {
      key: 'delivery',
      label: 'Completed orders',
      complete: completed >= 3,
      weight: 20,
      detail:
        completed > 0
          ? `${completed} completed order${completed === 1 ? '' : 's'}`
          : 'Complete your first order',
    },
    {
      key: 'reliability',
      label: 'Delivery reliability',
      complete: onTimeRate !== null && onTimeRate >= 80,
      weight: 15,
      detail:
        onTimeRate === null
          ? 'Delivery data appears after your first delivery'
          : `${onTimeRate}% delivered on or before the deadline`,
    },
    {
      key: 'portfolio',
      label: 'Portfolio proof',
      complete: portfolioCount >= 2,
      weight: 5,
      detail:
        portfolioCount > 0
          ? `${portfolioCount} portfolio project${portfolioCount === 1 ? '' : 's'}`
          : 'Add at least two projects',
    },
    {
      key: 'certifications',
      label: 'Verified credentials',
      complete: verifiedCertifications > 0,
      weight: 5,
      detail:
        verifiedCertifications > 0
          ? `${verifiedCertifications} credential${verifiedCertifications === 1 ? '' : 's'} verified by Apex-Work`
          : 'Add a certification for admin verification',
    },
  ];

  const score = checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0);
  const level = score >= 85 ? 'Elite' : score >= 70 ? 'Strong' : score >= 45 ? 'Growing' : 'New';
  return {
    score,
    level,
    checks,
    signals: {
      completedOrders: completed,
      rating: user.rating,
      ratingCount: user.ratingCount,
      onTimeRate,
      portfolioCount,
      verifiedCertifications,
    },
  };
}
