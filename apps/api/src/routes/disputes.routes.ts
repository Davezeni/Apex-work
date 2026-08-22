import { Router } from 'express';
import { openDisputeSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as d from '../services/disputes.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    return success(res, { items: await d.listMyDisputes(req.user!.sub) });
  }),
);

router.post(
  '/',
  validate(openDisputeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').OpenDisputeInput;
    return success(res, await d.openDispute(req.user!.sub, body), 201);
  }),
);

export default router;
