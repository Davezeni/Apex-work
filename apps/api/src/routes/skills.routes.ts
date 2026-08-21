import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';

const router: Router = Router();

/**
 * GET /skills — public search / list.
 * Query: ?q=react&limit=20 — case-insensitive name prefix/contains match.
 * Cached by frontend; keep response small.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = req.query as { q?: string; limit?: string };
    const q = (query.q ?? '').trim().slice(0, 60);
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);

    const skills = await prisma.skill.findMany({
      where: q
        ? { name: { contains: q, mode: 'insensitive' } }
        : undefined,
      orderBy: [{ name: 'asc' }],
      take: limit,
      select: { id: true, name: true, slug: true, category: true },
    });

    return success(res, { items: skills });
  }),
);

export default router;
