import { Router, type Request } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { success } from '../lib/response.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';
import { checkAllSavedSearches } from '../services/savedSearches.service.js';
import { autoReleaseEscrow } from '../services/orders.service.js';
import { expireFeatured } from '../services/featured.service.js';
import { flushPending as flushEmails } from '../services/email.service.js';
import { syncProcessingWithdrawals } from '../services/withdrawals.service.js';
import { checkKpiThresholds } from '../services/kpiWatcher.service.js';

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

router.all('/escrow', asyncHandler(async (req, res) => {
  gate(req);
  return success(res, await autoReleaseEscrow());
}));

router.all('/featured-expire', asyncHandler(async (req, res) => {
  gate(req);
  return success(res, await expireFeatured());
}));

router.all('/emails', asyncHandler(async (req, res) => {
  gate(req);
  return success(res, await flushEmails());
}));

router.all('/withdrawals', asyncHandler(async (req, res) => {
  gate(req);
  return success(res, await syncProcessingWithdrawals());
}));

router.all('/kpi', asyncHandler(async (req, res) => {
  gate(req);
  return success(res, await checkKpiThresholds());
}));

/** Fan-out entrypoint: run every scheduled worker. Called by one cron. */
router.all('/tick', asyncHandler(async (req, res) => {
  gate(req);
  const [saved, escrow, featured, emails, withdrawals, kpi] = await Promise.all([
    checkAllSavedSearches().catch((e) => ({ error: (e as Error).message })),
    autoReleaseEscrow().catch((e) => ({ error: (e as Error).message })),
    expireFeatured().catch((e) => ({ error: (e as Error).message })),
    flushEmails().catch((e) => ({ error: (e as Error).message })),
    syncProcessingWithdrawals().catch((e) => ({ error: (e as Error).message })),
    checkKpiThresholds().catch((e) => ({ error: (e as Error).message })),
  ]);
  return success(res, { saved, escrow, featured, emails, withdrawals, kpi });
}));

export default router;
