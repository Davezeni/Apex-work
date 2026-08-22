import { Router } from 'express';
import { requestWithdrawalSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import * as withdrawals from '../services/withdrawals.service.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * GET /me/wallet — balance + last 50 transactions.
 * Small enough to fit in one request; we'll paginate transactions if it grows.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const [wallet, transactions] = await Promise.all([
      prisma.wallet.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return success(res, { wallet, transactions });
  }),
);

/** GET /me/wallet/withdrawals — list past withdrawal requests. */
router.get(
  '/withdrawals',
  asyncHandler(async (req, res) => {
    const items = await withdrawals.listMyWithdrawals(req.user!.sub);
    return success(res, { items });
  }),
);

/** POST /me/wallet/withdrawals — request a withdrawal. */
router.post(
  '/withdrawals',
  validate(requestWithdrawalSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').RequestWithdrawalInput;
    const wd = await withdrawals.requestWithdrawal({
      userId: req.user!.sub,
      amountEtb: body.amountEtb,
      destination: body.destination,
      accountNumber: body.accountNumber,
      accountName: body.accountName,
    });
    return success(res, wd, 201);
  }),
);

/** POST /me/wallet/withdrawals/:id/cancel — user cancels their own pending payout. */
router.post(
  '/withdrawals/:id/cancel',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const wd = await withdrawals.cancelWithdrawal(req.user!.sub, id);
    return success(res, wd);
  }),
);

export default router;
