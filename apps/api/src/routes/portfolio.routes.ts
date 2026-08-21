import { Router } from 'express';
import { addPortfolioItemSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';

const router: Router = Router();

router.use(requireAuth);

/** GET /me/portfolio — my portfolio items, ordered. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.portfolioItem.findMany({
      where: { userId: req.user!.sub },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
    return success(res, { items });
  }),
);

/** POST /me/portfolio — add a new portfolio item. */
router.post(
  '/',
  validate(addPortfolioItemSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').AddPortfolioItemInput;
    const userId = req.user!.sub;

    // Freelancers only (clients don't need a portfolio).
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundError('User');
    if (user.role !== 'FREELANCER') {
      throw new ForbiddenError('Only freelancers can build a portfolio');
    }

    const count = await prisma.portfolioItem.count({ where: { userId } });
    if (count >= 24) throw new ConflictError('Portfolio limit reached (24 items).');

    const item = await prisma.portfolioItem.create({
      data: {
        userId,
        title: body.title,
        description: body.description ?? null,
        imageUrl: body.imageUrl,
        externalUrl: body.externalUrl ?? null,
        position: count, // append at end
      },
    });
    return success(res, item, 201);
  }),
);

/** DELETE /me/portfolio/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const item = await prisma.portfolioItem.findUnique({ where: { id }, select: { userId: true } });
    if (!item) throw new NotFoundError('Portfolio item');
    if (item.userId !== req.user!.sub) throw new ForbiddenError();
    await prisma.portfolioItem.delete({ where: { id } });
    return success(res, { ok: true });
  }),
);

export default router;
