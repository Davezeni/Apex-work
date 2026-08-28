import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError } from '../lib/errors.js';
import * as savedGigs from '../services/savedGigs.service.js';

const router: Router = Router();
router.use(requireAuth);

function slugFrom(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 120) {
    throw new BadRequestError('Invalid gig slug');
  }
  return value.trim();
}

/** GET /me/saved-gigs — saved gig cards for the current account. */
router.get(
  '/',
  asyncHandler(async (req, res) =>
    success(res, { items: await savedGigs.listMine(req.user!.sub) }),
  ),
);

/** GET /me/saved-gigs/:slug — status used by the gig detail heart button. */
router.get(
  '/:slug',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedGigs.status(req.user!.sub, slugFrom((req.params as { slug?: unknown }).slug)),
    ),
  ),
);

/** PUT /me/saved-gigs/:slug — idempotent save. */
router.put(
  '/:slug',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedGigs.save(req.user!.sub, slugFrom((req.params as { slug?: unknown }).slug)),
      201,
    ),
  ),
);

/** DELETE /me/saved-gigs/:slug — idempotent unsave. */
router.delete(
  '/:slug',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedGigs.remove(req.user!.sub, slugFrom((req.params as { slug?: unknown }).slug)),
    ),
  ),
);

export default router;
