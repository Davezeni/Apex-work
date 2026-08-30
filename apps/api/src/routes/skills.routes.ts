import { Router } from 'express';
import { createSkillSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { cache } from '../middleware/cache.js';

const router: Router = Router();

/**
 * Turn a skill name into a URL-safe, deterministic slug.
 * Preserves alphanumerics, collapses everything else to a single hyphen.
 * Trims leading/trailing hyphens. Lowercase.
 *
 * Examples:
 *   'React'         → 'react'
 *   'C++'           → 'c'
 *   'Node.js'       → 'node-js'
 *   'AI / ML'       → 'ai-ml'
 *   'UI/UX Design'  → 'ui-ux-design'
 */
function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (ascii.length >= 2 && !/[^\x00-\x7f]/.test(input)) return ascii;

  // Keep Amharic/other Unicode skill names valid even though the public slug
  // is ASCII. Code-point tokens are deterministic and remain URL-safe.
  const unicodeSlug = [...input.trim()]
    .map((char) => char.codePointAt(0)?.toString(36) ?? '')
    .filter(Boolean)
    .join('-')
    .slice(0, 54);
  return `skill-${unicodeSlug}`.slice(0, 60);
}

/**
 * Canonicalize a skill name for display: trim + collapse whitespace.
 * We keep the user's casing to preserve intent (e.g. "iOS", "PostgreSQL").
 */
function canonicalizeName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * GET /skills — public search / list.
 * Query: ?q=react&limit=20 — case-insensitive substring match.
 * When q is present, we push exact/prefix matches to the top for a
 * responsive typeahead feel.
 */
router.get(
  '/',
  // Skills change rarely; cache aggressively for 5min.
  cache({ ttlSeconds: 300, swrAfterSeconds: 60 }),
  asyncHandler(async (req, res) => {
    const query = req.query as { q?: string; limit?: string };
    const q = (query.q ?? '').trim().slice(0, 60);
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);

    if (!q) {
      const skills = await prisma.skill.findMany({
        where: { isApproved: true },
        orderBy: { name: 'asc' },
        take: limit,
        select: { id: true, name: true, slug: true, category: true },
      });
      return success(res, { items: skills });
    }

    // Substring match, ordered by best fit:
    //   1) exact (case-insensitive) match first
    //   2) prefix matches next
    //   3) other substring matches
    // We fetch 2x limit then trim after sorting.
    const raw = await prisma.skill.findMany({
      where: { isApproved: true, name: { contains: q, mode: 'insensitive' } },
      take: limit * 2,
      select: { id: true, name: true, slug: true, category: true },
    });

    const qLower = q.toLowerCase();
    const rank = (n: string): number => {
      const nl = n.toLowerCase();
      if (nl === qLower) return 0;
      if (nl.startsWith(qLower)) return 1;
      return 2;
    };
    raw.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));

    return success(res, { items: raw.slice(0, limit) });
  }),
);

/**
 * POST /skills — user-contributed skill.
 * Requires auth (prevents anonymous spam). Dedupes case-insensitively:
 * if a skill with the same slug already exists, returns it (200) rather
 * than creating a duplicate or erroring — friendlier UX.
 */
router.post(
  '/',
  requireAuth,
  validate(createSkillSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as import('@apex-work/shared').CreateSkillInput;
    const canonical = canonicalizeName(name);
    const slug = slugify(canonical);
    if (slug.length < 2) {
      const { BadRequestError } = await import('../lib/errors.js');
      throw new BadRequestError('Skill name is too short or contains no valid characters');
    }

    // Case-insensitive dedupe via the deterministic slug.
    const existing = await prisma.skill.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, category: true, isApproved: true },
    });
    if (existing) {
      return success(res, { skill: existing, created: false });
    }

    const skill = await prisma.skill.create({
      data: { name: canonical, slug, isApproved: false, createdById: req.user!.sub },
      select: { id: true, name: true, slug: true, category: true, isApproved: true },
    });
    return success(res, { skill, created: true }, 201);
  }),
);

export default router;
