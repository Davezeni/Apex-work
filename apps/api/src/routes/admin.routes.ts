import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';
import { success } from '../lib/response.js';
import * as admin from '../services/admin.service.js';

const router: Router = Router();
router.use(requireAuth, requireAdmin);

router.get('/summary', asyncHandler(async (_req, res) => {
  return success(res, await admin.dashboardSummary());
}));

// ---------------- reports ----------------
router.get('/reports', asyncHandler(async (req, res) => {
  const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
  const valid = ['OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED'];
  const s = valid.includes(status) ? (status as 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED') : undefined;
  return success(res, { items: await admin.listReports(s) });
}));

const resolveSchema = z.object({ action: z.enum(['REVIEWED', 'DISMISSED', 'ACTIONED']) });
router.post('/reports/:id/resolve', validate(resolveSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof resolveSchema>;
    return success(res, await admin.resolveReport(id, body.action));
  }),
);

// ---------------- withdrawals ----------------
router.get('/withdrawals', asyncHandler(async (req, res) => {
  const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
  const valid = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'];
  const s = valid.includes(status) ? (status as 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED') : undefined;
  return success(res, { items: await admin.listWithdrawals(s) });
}));

const withdrawStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED']),
  providerRef: z.string().max(200).optional(),
  failureReason: z.string().max(500).optional(),
});
router.post('/withdrawals/:id/status', validate(withdrawStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof withdrawStatusSchema>;
    return success(res, await admin.updateWithdrawalStatus(id, body.status, {
      providerRef: body.providerRef, failureReason: body.failureReason,
    }));
  }),
);

// ---------------- users ----------------
router.get('/users', asyncHandler(async (req, res) => {
  const q = String((req.query as { q?: string }).q ?? '').trim() || undefined;
  return success(res, { items: await admin.listUsers(q) });
}));

const suspendSchema = z.object({ suspend: z.boolean() });
router.post('/users/:id/suspend', validate(suspendSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof suspendSchema>;
    return success(res, await admin.suspendUser(id, body.suspend));
  }),
);

// ---------------- certifications ----------------
import { prisma } from '../lib/prisma.js';

router.get('/certifications', asyncHandler(async (req, res) => {
  const unverified = String((req.query as { unverified?: string }).unverified ?? '') === '1';
  const items = await prisma.certification.findMany({
    where: unverified ? { verifiedAt: null } : {},
    orderBy: { position: 'asc' },
    include: {
      resume: {
        select: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        },
      },
    },
    take: 100,
  });
  return success(res, { items });
}));

const verifySchema = z.object({ verify: z.boolean() });
router.post('/certifications/:id/verify', validate(verifySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof verifySchema>;
    const updated = await prisma.certification.update({
      where: { id },
      data: {
        verifiedAt: body.verify ? new Date() : null,
        verifiedById: body.verify ? req.user!.sub : null,
      },
    });
    return success(res, updated);
  }),
);

// ---------------- disputes ----------------
import { resolveDisputeSchema } from '@apex-work/shared';
import * as disputes from '../services/disputes.service.js';

router.get('/disputes', asyncHandler(async (req, res) => {
  const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
  const valid = ['OPEN', 'REVIEWING', 'RESOLVED_CLIENT', 'RESOLVED_SELLER', 'RESOLVED_SPLIT', 'WITHDRAWN'];
  const s = valid.includes(status) ? (status as 'OPEN') : undefined;
  return success(res, { items: await disputes.adminList(s) });
}));

router.post('/disputes/:id/resolve', validate(resolveDisputeSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').ResolveDisputeInput;
    return success(res, await disputes.adminResolve(id, body));
  }),
);

export default router;
