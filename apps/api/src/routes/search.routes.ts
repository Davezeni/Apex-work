import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as search from '../services/search.service.js';
import { cache } from '../middleware/cache.js';

const router: Router = Router();

/** GET /search?q=… — top gigs/jobs/users. Public, cached 30s. */
router.get(
  '/',
  optionalAuth,
  cache({ ttlSeconds: 30, swrAfterSeconds: 10 }),
  asyncHandler(async (req, res) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    const limit = Math.min(Math.max(Number((req.query as { limit?: string }).limit ?? 5), 1), 20);
    const result = await search.globalSearch(q, limit);
    return success(res, result);
  }),
);

/** GET /search/suggest?q=… — typeahead. Very cheap, tiny cache. */
router.get(
  '/suggest',
  cache({ ttlSeconds: 20, swrAfterSeconds: 10 }),
  asyncHandler(async (req, res) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    const result = await search.suggest(q);
    return success(res, result);
  }),
);

export default router;
