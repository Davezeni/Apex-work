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

/** PATCH /me/portfolio/:id — edit title/description/externalUrl. */
router.patch(
  '/:id',
  validate(addPortfolioItemSchema.partial()),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const item = await prisma.portfolioItem.findUnique({ where: { id }, select: { userId: true } });
    if (!item) throw new NotFoundError('Portfolio item');
    if (item.userId !== req.user!.sub) throw new ForbiddenError();
    const body = req.body as Partial<import('@apex-work/shared').AddPortfolioItemInput>;
    const updated = await prisma.portfolioItem.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.externalUrl !== undefined ? { externalUrl: body.externalUrl ?? null } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      },
    });
    return success(res, updated);
  }),
);

/** POST /me/portfolio/reorder — accept an ordered array of ids. */
import { z } from 'zod';
const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(50) });
router.post(
  '/reorder',
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof reorderSchema>;
    const userId = req.user!.sub;
    // Verify every id belongs to this user in one query.
    const owned = await prisma.portfolioItem.findMany({
      where: { id: { in: body.ids }, userId },
      select: { id: true },
    });
    if (owned.length !== body.ids.length) throw new ForbiddenError();
    await prisma.$transaction(
      body.ids.map((id, i) => prisma.portfolioItem.update({ where: { id }, data: { position: i } })),
    );
    return success(res, { ok: true });
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
