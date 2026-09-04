import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireCapability } from '../middleware/adminOnly.js';
import { success } from '../lib/response.js';
import * as admin from '../services/admin.service.js';
import * as resumeTemplates from '../services/resumeTemplates.service.js';

const router: Router = Router();
router.use(requireAuth, requireAdmin);

router.get(
  '/summary',
  requireCapability('dashboard:view'),
  asyncHandler(async (_req, res) => {
    return success(res, await admin.dashboardSummary());
  }),
);

const resumeTemplateAdminSchema = z.object({
  priceEtb: z.number().int().min(0).max(100_000),
  isAvailable: z.boolean(),
});
router.get(
  '/resume-templates',
  requireCapability('settings:manage'),
  asyncHandler(async (_req, res) => {
    return success(res, { items: await resumeTemplates.adminList() });
  }),
);
router.patch(
  '/resume-templates/:templateId',
  requireCapability('settings:manage'),
  validate(resumeTemplateAdminSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof resumeTemplateAdminSchema>;
    const { templateId } = req.params as { templateId: string };
    return success(res, await resumeTemplates.adminUpdate(templateId, body));
  }),
);

// ---------------- reports ----------------
router.get(
  '/reports',
  requireCapability('moderation:reports'),
  asyncHandler(async (req, res) => {
    const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
    const valid = ['OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED'];
    const s = valid.includes(status)
      ? (status as 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED')
      : undefined;
    return success(res, { items: await admin.listReports(s) });
  }),
);

const resolveSchema = z.object({ action: z.enum(['REVIEWED', 'DISMISSED', 'ACTIONED']) });
router.post(
  '/reports/:id/resolve',
  requireCapability('moderation:reports'),
  validate(resolveSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof resolveSchema>;
    return success(res, await admin.resolveReport(id, body.action));
  }),
);

// ---------------- withdrawals ----------------
router.get(
  '/withdrawals',
  requireCapability('money:withdrawals'),
  asyncHandler(async (req, res) => {
    const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
    const valid = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'];
    const s = valid.includes(status)
      ? (status as 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED')
      : undefined;
    return success(res, { items: await admin.listWithdrawals(s) });
  }),
);

const withdrawStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED']),
  providerRef: z.string().max(200).optional(),
  failureReason: z.string().max(500).optional(),
});
router.post(
  '/withdrawals/:id/status',
  requireCapability('money:withdrawals'),
  validate(withdrawStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof withdrawStatusSchema>;
    return success(
      res,
      await admin.updateWithdrawalStatus(id, body.status, {
        providerRef: body.providerRef,
        failureReason: body.failureReason,
      }),
    );
  }),
);

// ---------------- users ----------------
router.get(
  '/users',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const q = String((req.query as { q?: string }).q ?? '').trim() || undefined;
    return success(res, { items: await admin.listUsers(q) });
  }),
);

const suspendSchema = z.object({ suspend: z.boolean() });
router.post(
  '/users/:id/suspend',
  requireCapability('users:suspend'),
  validate(suspendSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof suspendSchema>;
    return success(res, await admin.suspendUser(id, body.suspend));
  }),
);

// ---------------- skill moderation ----------------
import { prisma } from '../lib/prisma.js';

router.get(
  '/skills',
  requireCapability('moderation:skills'),
  asyncHandler(async (req, res) => {
    const pending = String((req.query as { pending?: string }).pending ?? '') === '1';
    const items = await prisma.skill.findMany({
      where: pending ? { isApproved: false } : {},
      orderBy: [{ isApproved: 'asc' }, { name: 'asc' }],
      take: 200,
      include: { createdBy: { select: { id: true, username: true, fullName: true } } },
    });
    return success(res, { items });
  }),
);

const moderateSkillSchema = z.object({ approved: z.boolean() });
router.post(
  '/skills/:id/moderate',
  requireCapability('moderation:skills'),
  validate(moderateSkillSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof moderateSkillSchema>;
    const skill = await prisma.skill.update({ where: { id }, data: { isApproved: body.approved } });
    return success(res, skill);
  }),
);

// ---------------- certifications ----------------

router.get(
  '/certifications',
  requireCapability('moderation:certs'),
  asyncHandler(async (req, res) => {
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
  }),
);

const verifySchema = z.object({ verify: z.boolean() });
router.post(
  '/certifications/:id/verify',
  requireCapability('moderation:certs'),
  validate(verifySchema),
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

// ---------------- diagnostics ----------------
// Small admin-only surface for verifying external integrations from the UI.
// Everything here is read-only or sends a single test artifact.

router.get(
  '/diagnostics',
  requireCapability('artifacts:view'),
  asyncHandler(async (_req, res) => {
    const { turnDebug } = await import('../services/turn.service.js');
    const { isEmailConfigured, emailDebug } = await import('../services/email.service.js');
    const { isPushConfigured } = await import('../services/push.service.js');
    const { env } = await import('../config/env.js');
    return success(res, {
      services: {
        supabase: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        chapa: !!env.CHAPA_SECRET_KEY,
        groq: !!env.GROQ_API_KEY,
        resend: isEmailConfigured(),
        email: emailDebug(),
        vapidPush: isPushConfigured(),
        turn: turnDebug(),
        cronToken: !!env.CRON_TOKEN,
        afromessage: !!env.AFROMESSAGE_API_KEY,
        sentry: !!env.SENTRY_DSN,
      },
      ts: new Date().toISOString(),
    });
  }),
);

router.post(
  '/turn/refresh',
  requireCapability('artifacts:view'),
  asyncHandler(async (_req, res) => {
    const { invalidateTurnCache, getIceServers, turnDebug } =
      await import('../services/turn.service.js');
    invalidateTurnCache();
    const servers = await getIceServers();
    return success(res, { servers, debug: turnDebug() });
  }),
);

const testEmailSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().max(200).default('Apex-Work test email'),
});
router.post(
  '/email/test',
  requireCapability('artifacts:view'),
  validate(testEmailSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof testEmailSchema>;
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { email: true, fullName: true },
    });
    const to = body.to ?? admin?.email;
    if (!to)
      throw new (await import('../lib/errors.js')).BadRequestError(
        'No target email — pass ?to= or set your own email in Settings',
      );
    const { enqueue } = await import('../services/email.service.js');
    const row = await enqueue({
      to,
      subject: body.subject,
      html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">✅ Email is working</h2>
        <p style="color:#555;margin:0 0 16px">This is a test email from Apex-Work sent to <b>${to}</b> at ${new Date().toISOString()}.</p>
        <p style="color:#888;font-size:12px">If you see this, Resend is wired correctly.</p>
      </div>
    `,
    });
    return success(res, { id: row.id, to, delivered: row.delivered, error: row.error ?? null });
  }),
);

// ---------------- disputes ----------------
import { resolveDisputeSchema } from '@apex-work/shared';
import * as disputes from '../services/disputes.service.js';

router.get(
  '/disputes',
  requireCapability('moderation:reports'),
  asyncHandler(async (req, res) => {
    const status = String((req.query as { status?: string }).status ?? '').toUpperCase();
    const valid = [
      'OPEN',
      'REVIEWING',
      'RESOLVED_CLIENT',
      'RESOLVED_SELLER',
      'RESOLVED_SPLIT',
      'WITHDRAWN',
    ];
    const s = valid.includes(status) ? (status as 'OPEN') : undefined;
    return success(res, { items: await disputes.adminList(s) });
  }),
);

router.post(
  '/disputes/:id/resolve',
  requireCapability('moderation:reports'),
  validate(resolveDisputeSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').ResolveDisputeInput;
    return success(res, await disputes.adminResolve(id, body));
  }),
);

export default router;
