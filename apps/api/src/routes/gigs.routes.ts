import { Router } from 'express';
import { gigListQuerySchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

const router: Router = Router();

/** GET /gigs — public list, cursor-paginated */
router.get(
  '/',
  optionalAuth,
  validate(gigListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as import('@apex-work/shared').GigListQuery;

    const where: Prisma.GigWhereInput = {
      status: 'ACTIVE',
      ...(q.category ? { categoryId: q.category } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { tags: { has: q.q.toLowerCase() } },
            ],
          }
        : {}),
      ...(q.minPrice !== undefined || q.maxPrice !== undefined
        ? {
            startingPriceEtb: {
              ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
              ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.GigOrderByWithRelationInput =
      q.sort === 'rating'
        ? { rating: 'desc' }
        : q.sort === 'price_asc'
          ? { startingPriceEtb: 'asc' }
          : q.sort === 'price_desc'
            ? { startingPriceEtb: 'desc' }
            : { createdAt: 'desc' };

    const items = await prisma.gig.findMany({
      where,
      orderBy,
      take: q.limit + 1, // fetch one extra to know if there's more
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        coverImageUrl: true,
        categoryId: true,
        rating: true,
        ratingCount: true,
        startingPriceEtb: true,
        owner: {
          select: { id: true, username: true, fullName: true, avatarUrl: true, city: true },
        },
      },
    });

    const hasMore = items.length > q.limit;
    const trimmed = hasMore ? items.slice(0, q.limit) : items;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    return success(res, { items: trimmed, nextCursor, hasMore });
  }),
);

/** GET /gigs/:slug — public detail */
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const gig = await prisma.gig.findUnique({
      where: { slug },
      include: {
        packages: { orderBy: { priceEtb: 'asc' } },
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            city: true,
            bio: true,
            rating: true,
            ratingCount: true,
            completedOrders: true,
          },
        },
      },
    });
    if (!gig || gig.status !== 'ACTIVE') {
      const { NotFoundError } = await import('../lib/errors.js');
      throw new NotFoundError('Gig');
    }

    // Increment views (fire-and-forget)
    prisma.gig
      .update({ where: { id: gig.id }, data: { viewsCount: { increment: 1 } } })
      .catch(() => undefined);

    return success(res, gig);
  }),
);

export default router;
