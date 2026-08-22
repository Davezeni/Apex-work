import { Router } from 'express';
import { z } from 'zod';
import { bulkMilestonesSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as m from '../services/milestones.service.js';

const router: Router = Router();
router.use(requireAuth);

/** GET /orders/:orderId/milestones */
router.get(
  '/orders/:orderId/milestones',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params as { orderId: string };
    return success(res, { items: await m.listMilestones(orderId, req.user!.sub) });
  }),
);

/** PUT /orders/:orderId/milestones — replace plan (client only). */
router.put(
  '/orders/:orderId/milestones',
  validate(bulkMilestonesSchema),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params as { orderId: string };
    const body = req.body as import('@apex-work/shared').BulkMilestonesInput;
    return success(res, { items: await m.setMilestones(orderId, req.user!.sub, body.milestones) });
  }),
);

/** POST /milestones/:id/deliver — freelancer */
router.post(
  '/milestones/:id/deliver',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await m.markDelivered(id, req.user!.sub));
  }),
);

/** POST /milestones/:id/approve — client releases funds */
router.post(
  '/milestones/:id/approve',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await m.approve(id, req.user!.sub));
  }),
);

const disputeSchema = z.object({ reason: z.string().trim().max(1000).optional() });
router.post(
  '/milestones/:id/dispute',
  validate(disputeSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof disputeSchema>;
    return success(res, await m.dispute(id, req.user!.sub, body.reason));
  }),
);

export default router;
