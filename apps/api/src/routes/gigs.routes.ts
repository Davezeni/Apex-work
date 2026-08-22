import { Router } from 'express';
import { createGigSchema, gigListQuerySchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { cache, bust } from '../middleware/cache.js';

const router: Router = Router();

/**
 * Turn a gig title into a URL-safe slug. Same rules as skills but keeps a
 * numeric suffix if we need to disambiguate against an existing gig.
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Given a base slug, return a unique variant (base, base-2, base-3, ...). */
async function ensureUniqueSlug(base: string): Promise<string> {
  const existing = await prisma.gig.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((g) => g.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** GET /gigs — public list, cursor-paginated */
router.get(
  '/',
  optionalAuth,
  // Public feed: cache 60s, SWR after 20s. Massive win for popular categories.
  cache({ ttlSeconds: 60, swrAfterSeconds: 20 }),
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

    // Featured gigs always float to the top of the feed within their sort.
    const secondary: Prisma.GigOrderByWithRelationInput =
      q.sort === 'rating'
        ? { rating: 'desc' }
        : q.sort === 'price_asc'
          ? { startingPriceEtb: 'asc' }
          : q.sort === 'price_desc'
            ? { startingPriceEtb: 'desc' }
            : { createdAt: 'desc' };
    const orderBy: Prisma.GigOrderByWithRelationInput[] = [
      { isFeatured: 'desc' },
      secondary,
    ];

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
  cache({ ttlSeconds: 120, swrAfterSeconds: 30 }),
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

/**
 * POST /gigs — freelancer creates a new gig.
 * Validates ownership role, generates a unique slug, and creates the gig
 * plus packages in a single transaction. Derives `startingPriceEtb` from
 * the cheapest package for cheap sort/filter queries.
 */
router.post(
  '/',
  requireAuth,
  validate(createGigSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateGigInput;
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isOnboarded: true },
    });
    if (!user) throw new NotFoundError('User');
    if (user.role !== 'FREELANCER') {
      throw new ForbiddenError('Only freelancers can post gigs');
    }
    if (!user.isOnboarded) {
      throw new BadRequestError('Please complete your profile before posting a gig');
    }

    // Enforce a soft cap so a single user can't spam gigs
    const existingCount = await prisma.gig.count({
      where: { ownerId: userId, status: { not: 'ARCHIVED' } },
    });
    if (existingCount >= 20) {
      throw new ConflictError('You have reached the maximum of 20 active gigs');
    }

    const base = slugifyTitle(body.title);
    if (base.length < 3) {
      throw new BadRequestError('Title must contain at least 3 slug-friendly characters');
    }
    const slug = await ensureUniqueSlug(base);

    const startingPrice = Math.min(...body.packages.map((p) => p.priceEtb));

    const gig = await prisma.gig.create({
      data: {
        ownerId: userId,
        title: body.title,
        slug,
        categoryId: body.categoryId,
        tags: body.tags.map((t) => t.toLowerCase()),
        description: body.description,
        coverImageUrl: body.coverImageUrl,
        galleryUrls: body.galleryUrls,
        status: 'ACTIVE',
        startingPriceEtb: startingPrice,
        packages: {
          create: body.packages.map((p) => ({
            tier: p.tier,
            title: p.title,
            description: p.description,
            priceEtb: p.priceEtb,
            deliveryDays: p.deliveryDays,
            revisions: p.revisions,
          })),
        },
      },
      include: {
        packages: { orderBy: { priceEtb: 'asc' } },
      },
    });

    return success(res, gig, 201);
  }),
);

/** GET /gigs/:slug/similar — up to N related gigs. Public + cached. */
router.get(
  '/:slug/similar',
  optionalAuth,
  cache({ ttlSeconds: 120, swrAfterSeconds: 30 }),
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const { similarGigs } = await import('../services/similar.service.js');
    const items = await similarGigs(slug, 6);
    return success(res, { items });
  }),
);

/** POST /gigs/:slug/event — record a gig event (VIEW/CONTACT/ORDER_START). */
import { z as zed } from 'zod';
const eventSchema = zed.object({ type: zed.enum(['VIEW', 'IMPRESSION', 'CONTACT', 'ORDER_START']) });
router.post(
  '/:slug/event',
  optionalAuth,
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as zed.infer<typeof eventSchema>;
    const gig = await prisma.gig.findUnique({ where: { slug }, select: { id: true } });
    if (!gig) throw new NotFoundError('Gig');
    const { recordEvent } = await import('../services/gigAnalytics.service.js');
    await recordEvent(gig.id, body.type, req.user?.sub);
    return success(res, { ok: true });
  }),
);

/** GET /gigs/:slug/analytics — owner-only dashboard. */
router.get(
  '/:slug/analytics',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const gig = await prisma.gig.findUnique({ where: { slug }, select: { id: true } });
    if (!gig) throw new NotFoundError('Gig');
    const { gigDashboard } = await import('../services/gigAnalytics.service.js');
    return success(res, await gigDashboard(gig.id, req.user!.sub));
  }),
);

/** POST /gigs/:slug/boost — pay from wallet to feature the gig. */
import { boostGigSchema } from '@apex-work/shared';
router.post(
  '/:slug/boost',
  requireAuth,
  validate(boostGigSchema),
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as import('@apex-work/shared').BoostGigInput;
    const { boostGig } = await import('../services/featured.service.js');
    const updated = await boostGig(req.user!.sub, slug, body.days);
    void bust('/v1/gigs');
    return success(res, updated);
  }),
);

/** GET /gigs/:slug/translation?locale=am — served straight from DB. */
router.get(
  '/:slug/translation',
  cache({ ttlSeconds: 300, swrAfterSeconds: 60 }),
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const locale = String((req.query as { locale?: string }).locale ?? 'en');
    if (!['en', 'am'].includes(locale)) return success(res, null);
    const gig = await prisma.gig.findUnique({ where: { slug }, select: { id: true } });
    if (!gig) throw new NotFoundError('Gig');
    const row = await prisma.gigTranslation.findUnique({
      where: { gigId_locale: { gigId: gig.id, locale } },
    });
    return success(res, row);
  }),
);

/** POST /gigs/:slug/translate — kick off AI translation. Anyone auth'd can request. */
router.post(
  '/:slug/translate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as { targetLocale?: string };
    const target = body.targetLocale === 'am' ? 'am' : 'en';
    const gig = await prisma.gig.findUnique({ where: { slug } });
    if (!gig) throw new NotFoundError('Gig');
    const { translateGig } = await import('../services/ai.service.js');
    const { title, description, source } = await translateGig(gig.title, gig.description, target);
    const row = await prisma.gigTranslation.upsert({
      where: { gigId_locale: { gigId: gig.id, locale: target } },
      create: { gigId: gig.id, locale: target, title, description },
      update: { title, description },
    });
    return success(res, { ...row, source });
  }),
);

export default router;
