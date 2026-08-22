import { Router, type Request } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';
import { checkAllSavedSearches } from '../services/savedSearches.service.js';

const router: Router = Router();

/**
 * GET/POST /cron/:job — cheap unauthenticated endpoint gated by a shared
 * secret in the Authorization header. Called by our GitHub Actions
 * warmup workflow every 15 minutes. Falls back to open if CRON_TOKEN
 * isn't set (dev convenience — Render always has it).
 */
function gate(req: Request<unknown, unknown, unknown, unknown>) {
  const token = env.CRON_TOKEN;
  if (!token) return; // open in dev
  const header = req.header('authorization') ?? '';
  if (header !== `Bearer ${token}`) throw new UnauthorizedError();
}

router.all(
  '/saved-searches',
  asyncHandler(async (req, res) => {
    gate(req);
    const result = await checkAllSavedSearches();
    return success(res, result);
  }),
);

export default router;
