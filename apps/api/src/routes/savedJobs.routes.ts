import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { BadRequestError } from '../lib/errors.js';
import * as savedJobs from '../services/savedJobs.service.js';

const router: Router = Router();
router.use(requireAuth);

function jobIdFrom(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 8 || value.trim().length > 64) {
    throw new BadRequestError('Invalid job id');
  }
  return value.trim();
}

/** GET /me/saved-jobs — saved job cards for the current account. */
router.get(
  '/',
  asyncHandler(async (req, res) =>
    success(res, { items: await savedJobs.listMine(req.user!.sub) }),
  ),
);

/** GET /me/saved-jobs/:jobId — status used by the job card bookmark. */
router.get(
  '/:jobId',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedJobs.status(req.user!.sub, jobIdFrom((req.params as { jobId?: unknown }).jobId)),
    ),
  ),
);

/** PUT /me/saved-jobs/:jobId — idempotent save. */
router.put(
  '/:jobId',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedJobs.save(req.user!.sub, jobIdFrom((req.params as { jobId?: unknown }).jobId)),
      201,
    ),
  ),
);

/** DELETE /me/saved-jobs/:jobId — idempotent unsave. */
router.delete(
  '/:jobId',
  asyncHandler(async (req, res) =>
    success(
      res,
      await savedJobs.remove(req.user!.sub, jobIdFrom((req.params as { jobId?: unknown }).jobId)),
    ),
  ),
);

export default router;
