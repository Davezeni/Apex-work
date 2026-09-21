import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { NotFoundError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import * as agencies from '../services/agencies.service.js';

const router: Router = Router();

/** GET /agencies/:slug — public agency storefront (members, gigs, stats). */
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const agency = await prisma.agency.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        bio: true,
        logoUrl: true,
        website: true,
        createdAt: true,
        verifiedAt: true,
        members: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                title: true,
                city: true,
                rating: true,
                ratingCount: true,
                completedOrders: true,
                isPhoneVerified: true,
                isIdVerified: true,
              },
            },
          },
        },
      },
    });
    if (!agency) throw new NotFoundError('Agency');

    const ids = agency.members.map((m) => m.user.id);
    const [gigs, gigCount, agg] = await Promise.all([
      prisma.gig.findMany({
        where: { ownerId: { in: ids }, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          categoryId: true,
          rating: true,
          ratingCount: true,
          startingPriceEtb: true,
          owner: { select: { fullName: true, username: true } },
        },
      }),
      prisma.gig.count({ where: { ownerId: { in: ids }, status: 'ACTIVE' } }),
      prisma.user.aggregate({
        where: { id: { in: ids } },
        _avg: { rating: true },
        _sum: { completedOrders: true },
      }),
    ]);

    const [teamScore, portfolio, reviews] = await Promise.all([
      agencies.agencyStats(agency.id),
      prisma.agencyProject.findMany({
        where: { agencyId: agency.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, title: true, description: true, url: true, imageUrl: true },
      }),
      agencies.agencyReviews(agency.id, 5),
    ]);

    return success(res, {
      agency,
      gigs,
      portfolio,
      reviews,
      stats: {
        members: ids.length,
        gigs: gigCount,
        avgRating: agg._avg.rating ?? 0,
        completedOrders: agg._sum.completedOrders ?? 0,
      },
      teamScore,
    });
  }),
);

export default router;
