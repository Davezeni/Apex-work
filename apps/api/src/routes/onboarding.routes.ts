import { Router } from 'express';
import { freelancerOnboardingSchema, clientOnboardingSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * POST /onboarding/freelancer
 * Complete freelancer setup: title, bio, city, hourly rate, and skills.
 * Idempotent: safe to call multiple times; overwrites the previous values.
 */
router.post(
  '/freelancer',
  validate(freelancerOnboardingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').FreelancerOnboardingInput;
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundError('User');
    if (user.role !== 'FREELANCER') {
      throw new ForbiddenError('Only freelancers can complete this onboarding');
    }

    // Verify all skill IDs exist (prevents dangling references + gives a clear error).
    const validSkills = await prisma.skill.findMany({
      where: { id: { in: body.skillIds } },
      select: { id: true },
    });
    if (validSkills.length !== body.skillIds.length) {
      throw new BadRequestError('One or more selected skills are invalid');
    }

    // Transactional update: profile fields + skills replacement.
    // Delete-then-create is safe because UserSkill has no dependents.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.userSkill.deleteMany({ where: { userId } });
      await tx.userSkill.createMany({
        data: body.skillIds.map((skillId) => ({ userId, skillId })),
      });
      return tx.user.update({
        where: { id: userId },
        data: {
          title: body.title,
          bio: body.bio,
          city: body.city,
          hourlyRateEtb: body.hourlyRateEtb,
          isOnboarded: true,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          title: true,
          bio: true,
          city: true,
          hourlyRateEtb: true,
          isOnboarded: true,
          skills: {
            include: { skill: { select: { id: true, name: true } } },
          },
        },
      });
    });

    return success(res, updated);
  }),
);

/** POST /onboarding/client — client setup (minimal). */
router.post(
  '/client',
  validate(clientOnboardingSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundError('User');
    if (user.role !== 'CLIENT') throw new ForbiddenError('Only clients can complete this onboarding');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
      select: { id: true, isOnboarded: true },
    });
    return success(res, updated);
  }),
);

export default router;
