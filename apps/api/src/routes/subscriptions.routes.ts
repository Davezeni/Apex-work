import { Router } from 'express';
import { subscriptionCheckoutSchema, subscriptionVerifySchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { NotFoundError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import * as subscriptions from '../services/subscriptions.service.js';

const router: Router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => success(res, await subscriptions.mine(req.user!.sub))),
);

router.post(
  '/checkout',
  validate(subscriptionCheckoutSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').SubscriptionCheckoutInput;
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        role: true,
        fullName: true,
        email: true,
        phone: true,
        isPhoneVerified: true,
      },
    });
    if (!actor) throw new NotFoundError('User');
    return success(res, await subscriptions.startPurchase(actor, body.plan));
  }),
);

router.post(
  '/verify',
  validate(subscriptionVerifySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').SubscriptionVerifyInput;
    const row = await prisma.subscription.findFirst({
      where: { id: body.purchaseId, userId: req.user!.sub },
      select: { plan: true },
    });
    if (!row) throw new NotFoundError('Pro purchase');
    return success(
      res,
      await subscriptions.confirmForUser(req.user!.sub, body.purchaseId, row.plan),
    );
  }),
);

export default router;
