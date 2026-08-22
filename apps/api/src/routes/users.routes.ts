import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { cache } from '../middleware/cache.js';

const router: Router = Router();

/**
 * GET /users/:username — public profile.
 * Returns everything a visitor needs to decide whether to hire the person:
 * bio + city + rating aggregates + skills + latest gigs.
 * Never includes phone / email / private fields.
 */
router.get(
  '/:username',
  optionalAuth,
  cache({ ttlSeconds: 90, swrAfterSeconds: 30 }),
  asyncHandler(async (req, res) => {
    const { username } = req.params as { username: string };

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        title: true,
        bio: true,
        city: true,
        country: true,
        hourlyRateEtb: true,
        languages: true,
        isPhoneVerified: true,
        isIdVerified: true,
        rating: true,
        ratingCount: true,
        completedOrders: true,
        createdAt: true,
        skills: {
          include: { skill: { select: { id: true, name: true, slug: true } } },
        },
        gigs: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
            categoryId: true,
            rating: true,
            ratingCount: true,
            startingPriceEtb: true,
          },
        },
        portfolio: {
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          take: 12,
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            externalUrl: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    const { isPhoneVerified, isIdVerified, skills, ...rest } = user;
    return success(res, {
      ...rest,
      isVerified: isPhoneVerified && isIdVerified,
      skills: skills.map((s) => s.skill),
      createdAt: user.createdAt.toISOString(),
    });
  }),
);

export default router;
