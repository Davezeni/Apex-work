import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { cache } from '../middleware/cache.js';
import * as trust from '../services/trust.service.js';
import * as profileAnalytics from '../services/profileAnalytics.service.js';

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
        agencyMemberships: {
          take: 1,
          select: { agency: { select: { name: true, slug: true } } },
        },
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
          orderBy: [{ featured: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }],
          take: 12,
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            externalUrl: true,
            role: true,
            tools: true,
            outcome: true,
            tags: true,
            featured: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    // Active Pro subscription → 'pro' trust badge candidate.
    const proSub = await prisma.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      select: { id: true },
    });

    void profileAnalytics.recordEvent({
      subjectUserId: user.id,
      type: 'PROFILE_VIEW',
      viewerId: req.user?.sub,
    });

    const { isPhoneVerified, isIdVerified, skills, ...rest } = user;
    return success(res, {
      ...rest,
      isVerified: isPhoneVerified && isIdVerified,
      isPro: !!proSub,
      skills: skills.map((s) => s.skill),
      createdAt: user.createdAt.toISOString(),
    });
  }),
);

/** GET /users/:username/resume — public read of the built CV. */
router.get(
  '/:username/resume',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundError('User');
    const { getPublicResume } = await import('../services/resume.service.js');
    const r = await getPublicResume(user.id);
    if (r)
      void profileAnalytics.recordEvent({
        subjectUserId: user.id,
        type: 'CV_VIEW',
        viewerId: req.user?.sub,
      });
    return success(res, r);
  }),
);

/** GET /users/:username/trust — explainable public trust signals. */
router.get(
  '/:username/trust',
  cache({ ttlSeconds: 120, swrAfterSeconds: 60 }),
  asyncHandler(async (req, res) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundError('User');
    return success(res, await trust.profile(user.id));
  }),
);

/** GET /users/:username/portfolio/:id — a single portfolio item (for /work/[id] page). */
router.get(
  '/:username/portfolio/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { username, id } = req.params as { username: string; id: string };
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, fullName: true, avatarUrl: true, title: true },
    });
    if (!user) throw new NotFoundError('User');
    const item = await prisma.portfolioItem.findFirst({
      where: { id, userId: user.id },
    });
    if (!item) throw new NotFoundError('Portfolio item');
    void profileAnalytics.recordEvent({
      subjectUserId: user.id,
      type: 'PORTFOLIO_VIEW',
      viewerId: req.user?.sub,
      targetId: item.id,
    });
    return success(res, { ...item, owner: user });
  }),
);

/** GET /users/:username/stats — public hire/spend/earn stats + availability. */
router.get(
  '/:username/stats',
  asyncHandler(async (req, res) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundError('User');
    const { publicUserStats } = await import('../services/publicStats.service.js');
    return success(res, await publicUserStats(user.id));
  }),
);

/**
 * GET /users/:username/availability.ics — public iCalendar feed.
 * Users copy the URL into Google Calendar → Add via URL.
 * We set text/calendar and a 1h cache so calendar clients don't hammer.
 */
router.get(
  '/:username/availability.ics',
  asyncHandler(async (req, res) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, fullName: true, availabilityJson: true },
    });
    if (!user) throw new NotFoundError('User');
    const { buildAvailabilityIcs } = await import('../services/calendar.service.js');
    const ics = buildAvailabilityIcs(
      { username: user.username, fullName: user.fullName },
      user.availabilityJson as never,
    );
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${user.username}-availability.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=3600');
    res.send(ics);
  }),
);

export default router;
