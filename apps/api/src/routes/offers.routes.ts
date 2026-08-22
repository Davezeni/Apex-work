import { Router } from 'express';
import { z } from 'zod';
import { createOfferSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as offers from '../services/offers.service.js';

const router: Router = Router();

router.use(requireAuth);

router.post(
  '/',
  validate(createOfferSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateOfferInput;
    const offer = await offers.createOffer(req.user!.sub, body);
    return success(res, offer, 201);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const offer = await offers.getOffer(id, req.user!.sub);
    return success(res, offer);
  }),
);

const respondSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel']),
});

router.post(
  '/:id/respond',
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof respondSchema>;
    const result = await offers.respondToOffer(id, req.user!.sub, body.action);
    return success(res, result);
  }),
);

export default router;
