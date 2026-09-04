import { Router } from 'express';
import {
  completePhoneVerificationSchema,
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  oauthProviderSchema,
  updateProfileSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import * as earnings from '../services/earnings.service.js';
import * as authService from '../services/auth.service.js';
import * as oauthAccounts from '../services/oauthAccounts.service.js';
import * as profileAnalytics from '../services/profileAnalytics.service.js';
import { dataExport } from '../services/data-export.service.js';
import { referralDashboard } from '../services/referrals.service.js';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        pinHash: true,
        avatarUrl: true,
        role: true,
        bio: true,
        title: true,
        city: true,
        hourlyRateEtb: true,
        isPhoneVerified: true,
        isEmailVerified: true,
        isIdVerified: true,
        isOnboarded: true,
        rating: true,
        ratingCount: true,
        completedOrders: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundError('User');

    return success(res, {
      ...user,
      // Never send the hash itself; the client only needs the boolean to
      // render Set PIN versus Change PIN accurately.
      pinHash: undefined,
      hasPin: !!user.pinHash,
      isVerified: user.isPhoneVerified && user.isIdVerified,
      createdAt: user.createdAt.toISOString(),
    });
  }),
);

/** GET /me/profile-analytics — aggregate views/downloads for the last 30 days. */
router.get(
  '/profile-analytics',
  asyncHandler(async (req, res) => {
    return success(res, await profileAnalytics.dashboard(req.user!.sub));
  }),
);

/** GET /me/referrals — referral stats + shareable link + referred list. */
router.get(
  '/referrals',
  asyncHandler(async (req, res) => {
    return success(res, await referralDashboard(req.user!.sub));
  }),
);

/** GET /me/data-export — GDPR-style bundle of everything the user owns. */
router.get(
  '/data-export',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="apex-work-data-export-${req.user!.sub.slice(0, 8)}.json"`);
    res.send(JSON.stringify(await dataExport(req.user!.sub), null, 2));
  }),
);

router.patch(
  '/',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').UpdateProfileInput;
    // Split out fields that may be null (avatar removal, email removal)
    // — Prisma treats undefined as "don't touch" and null as "set to null",
    // exactly what we want. Emit only the fields the caller sent.
    const data: Record<string, unknown> = {};
    for (const k of Object.keys(body) as (keyof typeof body)[]) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    try {
      const updated = await prisma.user.update({
        where: { id: req.user!.sub },
        data,
        select: {
          id: true,
          username: true,
          fullName: true,
          bio: true,
          city: true,
          title: true,
          hourlyRateEtb: true,
          avatarUrl: true,
          email: true,
        },
      });
      return success(res, updated);
    } catch (err) {
      // Unique email collision — surface a friendly message.
      const e = err as { code?: string; meta?: { target?: string[] } };
      if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
        const { ConflictError } = await import('../lib/errors.js');
        throw new ConflictError('That email is already in use');
      }
      throw err;
    }
  }),
);

/** GET /me/oauth-accounts — provider identities linked to this account. */
router.get(
  '/oauth-accounts',
  asyncHandler(async (req, res) => {
    return success(res, { items: await oauthAccounts.listMine(req.user!.sub) });
  }),
);

/** DELETE /me/oauth-accounts/:provider — unlink without exposing provider tokens. */
router.delete(
  '/oauth-accounts/:provider',
  asyncHandler(async (req, res) => {
    const provider = oauthProviderSchema.parse((req.params as { provider?: unknown }).provider);
    return success(res, await oauthAccounts.unlink(req.user!.sub, provider));
  }),
);

/** PATCH /me/phone — bind a newly verified phone to an OAuth account. */
router.patch(
  '/phone',
  validate(completePhoneVerificationSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CompletePhoneVerificationInput;
    const updated = await authService.completePhoneVerification(req.user!.sub, body);
    return success(res, updated);
  }),
);

/** GET /me/notification-preferences — account-level notification settings. */
router.get(
  '/notification-preferences',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { notificationPrefsJson: true },
    });
    if (!user) throw new NotFoundError('User');
    const parsed = notificationPreferencesSchema.safeParse(user.notificationPrefsJson ?? {});
    return success(res, parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFERENCES);
  }),
);

/** PATCH /me/notification-preferences — persist category toggles per account. */
router.patch(
  '/notification-preferences',
  validate(notificationPreferencesSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').NotificationPreferences;
    await prisma.user.update({
      where: { id: req.user!.sub },
      data: { notificationPrefsJson: body as never },
    });
    return success(res, body);
  }),
);

/** PATCH /me/availability — save the weekly schedule + timezone + vacation flag. */
import { availabilitySchema } from '@apex-work/shared';
router.patch(
  '/availability',
  validate(availabilitySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AvailabilityInput;
    const updated = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { availabilityJson: body as never },
      select: { availabilityJson: true },
    });
    return success(res, updated);
  }),
);

/** GET /me/earnings/statement?month=YYYY-MM — downloadable monthly earnings statement. */
router.get(
  '/earnings/statement',
  asyncHandler(async (req, res) => {
    const month = ((req.query as { month?: string }).month ?? '').trim();
    const { html, filename, summary } = await earnings.monthlyStatement(req.user!.sub, month);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(html);
  }),
);

/** GET /me/earnings/statement.json?month=YYYY-MM — machine-readable summary. */
router.get(
  '/earnings/statement.json',
  asyncHandler(async (req, res) => {
    const month = ((req.query as { month?: string }).month ?? '').trim();
    const { summary } = await earnings.monthlyStatement(req.user!.sub, month);
    return success(res, summary);
  }),
);

export default router;
