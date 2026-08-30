import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as recommendations from '../services/recommendations.service.js';

const router: Router = Router();
router.use(requireAuth);

/** GET /recommendations — personalized, explainable marketplace matches. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    return success(res, await recommendations.forUser(req.user!.sub));
  }),
);

export default router;
