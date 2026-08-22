import { Router } from 'express';
import { z } from 'zod';
import { createReportSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as mod from '../services/moderation.service.js';

const router: Router = Router();

router.use(requireAuth);

router.post(
  '/reports',
  validate(createReportSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateReportInput;
    const report = await mod.createReport({ ...body, reporterId: req.user!.sub });
    return success(res, report, 201);
  }),
);

const blockSchema = z.object({
  userId: z.string().min(1).max(40),
  reason: z.string().trim().max(500).optional(),
});

router.post(
  '/blocks',
  validate(blockSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof blockSchema>;
    const block = await mod.blockUser(req.user!.sub, body.userId, body.reason);
    return success(res, block, 201);
  }),
);

router.delete(
  '/blocks/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params as { userId: string };
    await mod.unblockUser(req.user!.sub, userId);
    return success(res, { ok: true });
  }),
);

router.get(
  '/blocks',
  asyncHandler(async (req, res) => {
    const items = await mod.listBlockedByMe(req.user!.sub);
    return success(res, { items });
  }),
);

export default router;
