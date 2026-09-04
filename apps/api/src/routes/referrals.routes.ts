import { Router } from 'express';
import { trackReferralClickSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { success } from '../lib/response.js';
import { trackReferralClick } from '../services/referrals.service.js';

const router: Router = Router();

/** POST /referrals/track — public click tracker for shared referral links. */
router.post(
  '/track',
  validate(trackReferralClickSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').TrackReferralClickInput;
    return success(res, await trackReferralClick({ refCode: body.refCode, source: body.source }));
  }),
);

export default router;
