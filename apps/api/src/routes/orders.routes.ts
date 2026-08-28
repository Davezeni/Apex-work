import { Router } from 'express';
import { createOrderSchema, orderActionSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import * as orders from '../services/orders.service.js';

const router: Router = Router();

router.use(requireAuth);

/** POST /orders — create a PENDING order + start Chapa checkout. */
router.post(
  '/',
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateOrderInput;
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, phone: true, isPhoneVerified: true, fullName: true },
    });
    if (!actor) throw new NotFoundError('User');
    const result = await orders.createOrderAndInitiatePayment(
      actor.id,
      body.gigId,
      body.packageTier,
      body.requirements,
      actor,
    );
    return success(res, result, 201);
  }),
);

/** GET /orders?as=client|seller — my orders. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const as = (req.query as { as?: string }).as === 'seller' ? 'seller' : 'client';
    const items = await orders.listMyOrders(req.user!.sub, as);
    return success(res, { items });
  }),
);

/** GET /orders/:id — order detail with role check. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const order = await orders.getOrder(id, req.user!.sub);
    return success(res, order);
  }),
);

/** POST /orders/:id/actions — deliver / accept / revise / cancel. */
router.post(
  '/:id/actions',
  validate(orderActionSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').OrderActionInput;
    const userId = req.user!.sub;

    let updated;
    switch (body.action) {
      case 'deliver':
        updated = await orders.markDelivered(id, userId, {
          notes: body.notes,
          files: body.files,
        });
        break;
      case 'accept':
        updated = await orders.acceptDelivery(id, userId);
        break;
      case 'revise':
        updated = await orders.requestRevision(id, userId, body.notes);
        break;
      case 'cancel':
        updated = await orders.cancelOrder(id, userId, body.reason);
        break;
    }
    return success(res, updated);
  }),
);

/**
 * POST /orders/:id/verify — client returns from Chapa hosted checkout.
 * The return URL includes ?paid=1; the frontend calls this to force a
 * verification if the webhook hasn't landed yet.
 */
router.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    // Ensure caller is the order client
    const order = await orders.getOrder(id, req.user!.sub);
    const result = await orders.confirmPaymentByTxRef(`apex-${order.id}`);
    return success(res, result);
  }),
);

export default router;
