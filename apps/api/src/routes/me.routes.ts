import { Router } from 'express';
import { updateProfileSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

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
      isVerified: user.isPhoneVerified && user.isIdVerified,
      createdAt: user.createdAt.toISOString(),
    });
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

export default router;
