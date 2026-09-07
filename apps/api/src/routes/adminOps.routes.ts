/**
 * Admin operations routes — the expanded admin-panel control surface.
 * Mounted at `/admin/ops`. Every endpoint requires staff auth + the relevant
 * RBAC capability; every mutation is audited via `adminAudit`.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireCapability } from '../middleware/adminOnly.js';
import { can } from '../lib/adminRbac.js';
import { success } from '../lib/response.js';
import { paginate } from '../lib/adminPage.js';
import { loadActor, adminAudit } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import {
  gigModerateSchema, jobModerateSchema, reviewModerateSchema, orderRefundSchema,
  walletAdjustSchema, featuredSchema, broadcastSchema, userRoleSchema,
  ticketReplySchema, ticketStatusSchema, settingUpsertSchema, type UserRole,
} from '@apex-work/shared';

import * as mod from '../services/admin/moderation.service.js';
import * as money from '../services/admin/money.service.js';
import * as community from '../services/admin/community.service.js';
import * as support from '../services/admin/support.service.js';
import * as ops from '../services/admin/ops.service.js';
import * as settings from '../services/admin/settings.service.js';
import * as categories from '../services/categories.service.js';
import * as kpi from '../services/kpiWatcher.service.js';
import * as analytics from '../services/admin/analytics.service.js';
import * as exporter from '../services/admin/export.service.js';
import * as reconcile from '../services/admin/reconcile.service.js';
import * as subscriptions from '../services/admin/subscriptions.service.js';
import * as supportStats from '../services/admin/supportAnalytics.service.js';
import * as leaderboard from '../services/admin/leaderboard.service.js';
import * as insights from '../services/admin/insights.service.js';
import * as orderHealth from '../services/admin/orderHealth.service.js';
import * as proRoi from '../services/admin/proRoi.service.js';
import * as retention from '../services/admin/retention.service.js';
import * as emailQueue from '../services/admin/emailQueue.service.js';
import * as opsHealth from '../services/admin/opsHealth.service.js';
import * as mediaReview from '../services/admin/mediaReview.service.js';
import * as userImport from '../services/admin/userImport.service.js';

const router: Router = Router();
router.use(requireAuth, requireAdmin);

// ================= DASHBOARD / ANALYTICS =================

router.get(
  '/analytics',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    return success(res, await ops.analyticsSummary(days));
  }),
);

router.get(
  '/analytics/series',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    return success(res, await analytics.analyticsSeries(days));
  }),
);

// ================= EXPORTS (CSV) =================

const exportCaps: Record<string, string> = {
  audit: 'audit:view',
  orders: 'money:orders',
  users: 'dashboard:view',
};

router.get(
  '/subscriptions/analytics',
  requireCapability('subscriptions:manage'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    return success(res, await subscriptions.subscriptionAnalytics(days));
  }),
);

router.get(
  '/leaderboard',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    const limit = Math.min(50, Math.max(1, Number((req.query as { limit?: string }).limit) || 10));
    return success(res, await leaderboard.leaderboard(days, limit));
  }),
);

router.get(
  '/insights/conversion',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    const limit = Math.min(50, Math.max(1, Number((req.query as { limit?: string }).limit) || 10));
    const minOrders = Math.min(50, Math.max(1, Number((req.query as { minOrders?: string }).minOrders) || 3));
    return success(res, await insights.conversionInsights(days, limit, minOrders));
  }),
);

// ================= ORDER HEALTH =================

router.get(
  '/order-health',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number((req.query as { limit?: string }).limit) || 20));
    return success(res, await orderHealth.orderHealth(limit));
  }),
);

router.post(
  '/order-health/digest',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const actor = await loadActor(req);
    return success(res, await orderHealth.sendDigest(actor));
  }),
);

// ================= PRO-SUBSCRIPTION ROI =================

router.get(
  '/subscriptions/roi',
  requireCapability('subscriptions:manage'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number((req.query as { limit?: string }).limit) || 10));
    return success(res, await proRoi.proRoi(limit));
  }),
);

// ================= RETENTION & CHURN =================

router.get(
  '/retention',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 60));
    return success(res, await retention.retention(days));
  }),
);

// ================= OPERATIONS HEALTH =================

router.get(
  '/health-score',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(120, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    return success(res, await opsHealth.healthScore(days));
  }),
);

router.get(
  '/fraud-watchlist',
  requireCapability('users:manage'),
  asyncHandler(async (req, res) => {
    const days = Math.min(120, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    const limit = Math.min(50, Math.max(1, Number((req.query as { limit?: string }).limit) || 25));
    return success(res, await opsHealth.fraudWatchlist(days, limit));
  }),
);

// ================= EMAIL QUEUE =================

router.get(
  '/email-queue',
  requireCapability('settings:manage'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number((req.query as { limit?: string }).limit) || 50));
    return success(res, await emailQueue.emailQueueStatus(limit));
  }),
);

router.post(
  '/email-queue/flush',
  requireCapability('settings:manage'),
  asyncHandler(async (req, res) => {
    const actor = await loadActor(req);
    const result = await emailQueue.flushQueue();
    await adminAudit({
      adminId: actor.adminId,
      adminName: actor.adminName,
      adminRole: actor.adminRole,
      action: 'EMAIL_QUEUE.FLUSH',
      resourceType: 'EMAIL_QUEUE',
      meta: result,
    });
    return success(res, result);
  }),
);

router.get(
  '/support/analytics',
  requireCapability('support:tickets'),
  asyncHandler(async (_req, res) => {
    return success(res, await supportStats.supportAnalytics());
  }),
);

router.get(
  '/reconcile',
  requireCapability('money:orders'),
  asyncHandler(async (req, res) => {
    const report = await reconcile.reconcileWallets();
    return success(res, report);
  }),
);

router.get(
  '/export/:kind',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const kind = (req.params as { kind: string }).kind;
    const cap = exportCaps[kind];
    if (!cap) {
      res.status(404).json({ ok: false, error: 'Unknown export kind' });
      return;
    }
    // Per-kind RBAC (broader than the route-wide dashboard:view guard).
    if (!req.userRole || !can(req.userRole as never, cap as never)) {
      res.status(403).json({ ok: false, error: 'Forbidden' });
      return;
    }

    const q = req.query as Record<string, string | undefined>;
    const result =
      kind === 'audit'
        ? await exporter.exportAudit({ adminId: q.adminId, resourceType: q.resourceType })
        : kind === 'orders'
          ? await exporter.exportOrders({ status: q.status, q: q.q })
          : await exporter.exportUsers({ role: q.role, q: q.q, suspended: q.suspended ? q.suspended === '1' : undefined });

    res.setHeader('Content-Type', `${result.mime}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  }),
);

// ================= MODERATION: GIGS =================

router.get(
  '/gigs',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const { status, flagged, featured } = req.query as Record<string, string | undefined>;
    const q = await paginate(req, {
      fetch: (p) =>
        mod.adminListGigs({
          status: status as never,
          flagged: flagged === undefined ? undefined : flagged === '1',
          featured: featured === undefined ? undefined : featured === '1',
          limit: p.limit,
          cursorWhere: p.cursorWhere,
        }),
    });
    return success(res, q);
  }),
);

router.post(
  '/moderation/scan',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const actor = await loadActor(req);
    const limit = Math.min(500, Math.max(1, Number((req.query as { limit?: string }).limit) || 50));
    const result = await mod.contentScan(limit);
    await adminAudit({
      ...actor, ip: req.ip, action: 'MODERATION.SCAN', resourceType: 'SYSTEM', resourceId: `scan-${Date.now()}`,
      after: { scanned: result.scanned, flagged: result.flagged },
    });
    return success(res, result);
  }),
);

// ================= MODERATION FLAG-QUEUE TRIAGE =================

router.get(
  '/flagged',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const status = String((req.query as { status?: string }).status ?? '');
    const valid = ['QUEUED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];
    const s = valid.includes(status) ? status : undefined;
    const limit = Math.min(200, Math.max(1, Number((req.query as { limit?: string }).limit) || 100));
    return success(res, { items: await mod.adminListFlagged({ moderationStatus: s, limit }) });
  }),
);

const triageSchema = z.object({
  status: z.enum(['QUEUED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  assignee: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
router.post(
  '/flagged/:id/triage',
  requireCapability('moderation:content'),
  validate(triageSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof triageSchema>;
    const actor = await loadActor(req);
    const result = await mod.triageGig(id, body, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'MODERATION.TRIAGE', resourceType: 'GIG', resourceId: id, after: { status: body.status, assignee: body.assignee, notes: body.notes } });
    return success(res, result);
  }),
);

const bulkTriageSchema = z.object({ ids: z.array(z.string()).min(1).max(200), status: z.enum(['RESOLVED', 'DISMISSED']) });
router.post(
  '/flagged/bulk',
  requireCapability('moderation:content'),
  validate(bulkTriageSchema),
  asyncHandler(async (req, res) => {
    const { ids, status } = req.body as z.infer<typeof bulkTriageSchema>;
    const actor = await loadActor(req);
    const result = await mod.bulkTriage(ids, status, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'MODERATION.BULK', resourceType: 'GIG', resourceId: `bulk-${ids[0]}`, after: { status, count: result.updated } });
    return success(res, result);
  }),
);

router.post(
  '/gigs/:id/moderate',
  requireCapability('moderation:content'),
  validate(gigModerateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof gigModerateSchema>;
    const actor = await loadActor(req);
    const result = await mod.moderateGig(id, body);
    await adminAudit({
      ...actor, ip: req.ip, action: 'GIG.MODERATE', resourceType: 'GIG', resourceId: id,
      before: result.before ? { status: result.before.status, isFlagged: result.before.isFlagged } : undefined,
      after: { status: result.status, isFlagged: result.isFlagged, isFeatured: result.isFeatured },
    });
    delete (result as { before?: unknown }).before;
    return success(res, result);
  }),
);

router.post(
  '/gigs/:id/feature',
  requireCapability('promotions:manage'),
  validate(featuredSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof featuredSchema>;
    const actor = await loadActor(req);
    const result = await ops.featureGig(id, body.days);
    await adminAudit({ ...actor, ip: req.ip, action: 'GIG.FEATURE', resourceType: 'GIG', resourceId: id, after: result });
    return success(res, result);
  }),
);

router.post(
  '/gigs/:id/unfeature',
  requireCapability('promotions:manage'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await ops.unfeatureGig(id);
    await adminAudit({ ...actor, ip: req.ip, action: 'GIG.UNFEATURE', resourceType: 'GIG', resourceId: id, after: result });
    return success(res, result);
  }),
);

// ================= MODERATION: JOBS =================

router.get(
  '/jobs',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const { open } = req.query as Record<string, string | undefined>;
    const q = await paginate(req, {
      fetch: (p) =>
        mod.adminListJobs({ open: open === undefined ? undefined : open === '1', limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, q);
  }),
);

router.post(
  '/jobs/:id/moderate',
  requireCapability('moderation:content'),
  validate(jobModerateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await mod.moderateJob(id, req.body as z.infer<typeof jobModerateSchema>);
    await adminAudit({ ...actor, ip: req.ip, action: 'JOB.MODERATE', resourceType: 'JOB', resourceId: id, after: { isOpen: result.isOpen, pinnedAt: result.pinnedAt } });
    return success(res, result);
  }),
);

// ================= MODERATION: REVIEWS =================

router.get(
  '/reviews',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const { hidden, subjectId } = req.query as Record<string, string | undefined>;
    return success(res, {
      items: await mod.adminListReviews({
        hidden: hidden === undefined ? undefined : hidden === '1',
        subjectId,
        limit: 100,
      }),
    });
  }),
);

router.post(
  '/reviews/:id/moderate',
  requireCapability('moderation:content'),
  validate(reviewModerateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof reviewModerateSchema>;
    const actor = await loadActor(req);
    const result = await mod.moderateReview(id, body.action, actor.adminId, body.reason);
    await adminAudit({ ...actor, ip: req.ip, action: 'REVIEW.MODERATE', resourceType: 'REVIEW', resourceId: id, after: { hiddenAt: result.hiddenAt, hiddenReason: result.hiddenReason } });
    return success(res, result);
  }),
);

// ================= MONEY: ORDERS / REFUNDS =================

router.get(
  '/orders',
  requireCapability('money:orders'),
  asyncHandler(async (req, res) => {
    const { status, q } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => money.adminListOrders({ status: status as never, q, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
  }),
);

router.post(
  '/orders/:id/refund',
  requireCapability('money:orders'),
  validate(orderRefundSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof orderRefundSchema>;
    const actor = await loadActor(req);
    const result = await money.refundOrder(id, body.amountEtb, body.reason);
    await adminAudit({ ...actor, ip: req.ip, action: 'ORDER.REFUND', resourceType: 'ORDER', resourceId: id, after: { refundedEtb: result.refundedEtb, reason: body.reason } });
    return success(res, result);
  }),
);

// ================= MONEY: LEDGER & ADJUSTMENTS =================

router.get(
  '/ledger',
  requireCapability('money:orders'),
  asyncHandler(async (req, res) => {
    const { userId, type } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => money.adminLedger({ userId, type, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
  }),
);

router.post(
  '/wallet/:userId/adjust',
  requireCapability('money:orders'),
  validate(walletAdjustSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.params as { userId: string };
    const body = req.body as z.infer<typeof walletAdjustSchema>;
    const actor = await loadActor(req);
    const result = await money.adjustWallet(userId, body.type, body.amountEtb, body.description);
    await adminAudit({ ...actor, ip: req.ip, action: 'WALLET.ADJUST', resourceType: 'WALLET', resourceId: userId, after: { type: body.type, amountEtb: body.amountEtb, description: body.description } });
    return success(res, result);
  }),
);

// ================= MONEY: WITHDRAWALS =================

router.get(
  '/withdrawals',
  requireCapability('money:withdrawals'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => money.adminListWithdrawals({ status: status as never, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
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
    const actor = await loadActor(req);
    const result = await money.markWithdrawalStatus(id, body.status, { providerRef: body.providerRef, failureReason: body.failureReason });
    await adminAudit({ ...actor, ip: req.ip, action: 'WITHDRAWAL.STATUS', resourceType: 'WITHDRAWAL', resourceId: id, after: { status: body.status, providerRef: body.providerRef } });
    return success(res, result);
  }),
);

// ================= COMMUNITY: USERS =================

router.get(
  '/users',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const { q, role, suspended, unverified } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) =>
        community.adminListUsers({
          q, role: role as never,
          suspended: suspended === undefined ? undefined : suspended === '1',
          unverified: unverified === '1',
          limit: p.limit, cursorWhere: p.cursorWhere,
        }),
    });
    return success(res, result);
  }),
);

router.get(
  '/users/:id',
  requireCapability('dashboard:view'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await community.getUserDetail(id));
  }),
);

router.post(
  '/users/:id/role',
  requireCapability('users:manage'),
  validate(userRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof userRoleSchema>;
    const actor = await loadActor(req);
    const result = await community.setUserRole(id, body.role);
    await adminAudit({ ...actor, ip: req.ip, action: 'USER.ROLE', resourceType: 'USER', resourceId: id, after: result });
    return success(res, result);
  }),
);

router.post(
  '/users/:id/suspend',
  requireCapability('users:suspend'),
  validate(z.object({ suspend: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as { suspend: boolean };
    const actor = await loadActor(req);
    const result = await community.suspendUser(id, body.suspend);
    await adminAudit({ ...actor, ip: req.ip, action: 'USER.SUSPEND', resourceType: 'USER', resourceId: id, after: result });
    return success(res, result);
  }),
);

router.post(
  '/users/:id/verify-id',
  requireCapability('users:verify'),
  validate(z.object({ verify: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as { verify: boolean };
    const actor = await loadActor(req);
    const result = await community.verifyIdentity(id, body.verify);
    await adminAudit({ ...actor, ip: req.ip, action: 'USER.VERIFY_ID', resourceType: 'USER', resourceId: id, after: result });
    return success(res, result);
  }),
);

// ================= COMMUNITY: ADMIN ROLES =================

router.get(
  '/admins',
  requireCapability('audit:view'),
  asyncHandler(async (_req, res) => {
    return success(res, { items: await ops.listAdminRoles() });
  }),
);

// ================= COMMUNITY: AGENCIES / SUBSCRIPTIONS =================

router.get(
  '/agencies',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number((req.query as { limit?: string }).limit) || 50);
    return success(res, { items: await community.adminListAgencies(limit) });
  }),
);

router.get(
  '/agencies/:id',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await community.adminGetAgency(id));
  }),
);

router.post(
  '/agencies/:id/members/:userId',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const body = (req.body ?? {}) as { role?: string };
    const actor = await loadActor(req);
    const member = await community.adminUpdateAgencyMember(id, userId, body.role ?? 'MEMBER');
    await adminAudit({
      adminId: actor.adminId,
      adminName: actor.adminName,
      adminRole: actor.adminRole,
      action: 'AGENCY.MEMBER_UPDATE',
      resourceType: 'AGENCY',
      resourceId: id,
      meta: { userId, role: member.role },
    });
    return success(res, member);
  }),
);

router.get(
  '/subscriptions',
  requireCapability('subscriptions:manage'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => ops.adminListSubscriptions({ status, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
  }),
);

// ================= SUPPORT =================

router.get(
  '/tickets',
  requireCapability('support:tickets'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => support.adminListTickets({ status: status as never, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
  }),
);

router.get(
  '/tickets/:id',
  requireCapability('support:tickets'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await support.getTicket(id));
  }),
);

router.post(
  '/tickets/:id/reply',
  requireCapability('support:tickets'),
  validate(ticketReplySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof ticketReplySchema>;
    const actor = await loadActor(req);
    const result = await support.replyToTicket(id, actor.adminId, body.body);
    await adminAudit({ ...actor, ip: req.ip, action: 'TICKET.REPLY', resourceType: 'TICKET', resourceId: id, after: { status: result.status } });
    return success(res, result);
  }),
);

router.post(
  '/tickets/:id/status',
  requireCapability('support:tickets'),
  validate(ticketStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof ticketStatusSchema>;
    const actor = await loadActor(req);
    const result = await support.setTicketStatus(id, body.status);
    await adminAudit({ ...actor, ip: req.ip, action: 'TICKET.STATUS', resourceType: 'TICKET', resourceId: id, after: { status: result.status } });
    return success(res, result);
  }),
);

// ================= PROMOTIONS / BROADCAST =================

router.post(
  '/broadcast',
  requireCapability('broadcast:send'),
  validate(broadcastSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof broadcastSchema>;
    const actor = await loadActor(req);
    const result = await ops.broadcast({ title: body.title, body: body.body, scope: body.scope });
    await adminAudit({ ...actor, ip: req.ip, action: 'BROADCAST.SEND', resourceType: 'SYSTEM', after: result });
    return success(res, result);
  }),
);

// ================= SETTINGS =================

router.get(
  '/settings',
  requireCapability('settings:manage'),
  asyncHandler(async (_req, res) => {
    return success(res, { items: await settings.listSettings() });
  }),
);

router.post(
  '/settings',
  requireCapability('settings:manage'),
  validate(settingUpsertSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof settingUpsertSchema>;
    const actor = await loadActor(req);
    const result = await settings.upsertSetting(body.key, body.value, actor.adminId, body.description);
    await adminAudit({ ...actor, ip: req.ip, action: 'SETTING.UPSERT', resourceType: 'SETTING', resourceId: body.key, after: result });
    return success(res, result);
  }),
);

// ================= CATEGORY FEES =================

router.get(
  '/categories',
  requireCapability('settings:manage'),
  asyncHandler(async (_req, res) => {
    return success(res, { items: await categories.listCategories() });
  }),
);

const categoryUpdateSchema = z.object({
  feePercent: z.number().int().min(0).max(50).nullable().optional(),
  label: z.string().trim().min(1).max(80).optional(),
  icon: z.string().trim().min(1).max(8).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
router.patch(
  '/categories/:id',
  requireCapability('settings:manage'),
  validate(categoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof categoryUpdateSchema>;
    const actor = await loadActor(req);
    const result = await categories.updateCategory(id, body, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'CATEGORY.UPDATE', resourceType: 'CATEGORY', resourceId: id, after: result });
    return success(res, result);
  }),
);

router.post(
  '/categories/:id/reset-fee',
  requireCapability('settings:manage'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await categories.resetCategoryFee(id, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'CATEGORY.RESET_FEE', resourceType: 'CATEGORY', resourceId: id, after: result });
    return success(res, result);
  }),
);

// ================= KPI WATCHER =================

router.get(
  '/kpi/thresholds',
  requireCapability('settings:manage'),
  asyncHandler(async (_req, res) => {
    return success(res, { items: await kpi.listKpiThresholds() });
  }),
);

const thresholdUpdateSchema = z.object({
  value: z.number().min(0).optional(),
  operator: z.enum(['lt', 'gt']).optional(),
  enabled: z.boolean().optional(),
  severity: z.enum(['info', 'warn', 'critical']).optional(),
});
router.put(
  '/kpi/thresholds/:id',
  requireCapability('settings:manage'),
  validate(thresholdUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof thresholdUpdateSchema>;
    const actor = await loadActor(req);
    const result = await kpi.updateKpiThreshold(id, body, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'KPI.THRESHOLD_UPDATE', resourceType: 'KPI', resourceId: id, after: result });
    return success(res, result);
  }),
);

router.get(
  '/kpi/alerts',
  requireCapability('settings:manage'),
  asyncHandler(async (req, res) => {
    const status = String((req.query as { status?: string }).status ?? '');
    const limit = Number((req.query as { limit?: string }).limit ?? 50);
    return success(res, { items: await kpi.listKpiAlerts(status, limit) });
  }),
);

router.post(
  '/kpi/alerts/:id/acknowledge',
  requireCapability('settings:manage'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await kpi.acknowledgeKpiAlert(id, actor.adminId);
    await adminAudit({ ...actor, ip: req.ip, action: 'KPI.ALERT_ACK', resourceType: 'KPI', resourceId: id, after: result });
    return success(res, result);
  }),
);

// ================= AUDIT LOG =================

router.get(
  '/audit',
  requireCapability('audit:view'),
  asyncHandler(async (req, res) => {
    const { adminId, resourceType } = req.query as Record<string, string | undefined>;
    const result = await paginate(req, {
      fetch: (p) => ops.listAudit({ adminId, resourceType, limit: p.limit, cursorWhere: p.cursorWhere }),
    });
    return success(res, result);
  }),
);

// ================= MEDIA REVIEW QUEUE =================

router.get(
  '/media',
  requireCapability('moderation:content'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(120, Math.max(1, Number((req.query as { limit?: string }).limit) || 40));
    return success(res, await mediaReview.listMediaQueue(limit));
  }),
);

const mediaTargetSchema = z.object({});
router.post(
  '/media/avatar/:id/remove',
  requireCapability('moderation:content'),
  validate(mediaTargetSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await mediaReview.removeAvatar(id);
    await adminAudit({ ...actor, ip: req.ip, action: 'MEDIA.REMOVE_AVATAR', resourceType: 'USER', resourceId: id });
    return success(res, result);
  }),
);

router.post(
  '/media/gig/:id/flag',
  requireCapability('moderation:content'),
  validate(mediaTargetSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const actor = await loadActor(req);
    const result = await mediaReview.flagGig(id);
    await adminAudit({ ...actor, ip: req.ip, action: 'MEDIA.FLAG_GIG', resourceType: 'GIG', resourceId: id });
    return success(res, result);
  }),
);

// ================= BULK USER IMPORT (CSV) =================

const importSchema = z.object({ rows: z.array(z.record(z.string(), z.any())).max(500) });
router.post(
  '/users/import',
  requireCapability('users:suspend'),
  validate(importSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { rows: Record<string, string>[] };
    const rows: userImport.ImportRow[] = body.rows.map((r) => ({
      fullName: String(r.fullName ?? r.name ?? ''),
      username: r.username ? String(r.username) : undefined,
      phone: r.phone ? String(r.phone) : undefined,
      email: r.email ? String(r.email) : undefined,
      role: r.role ? (String(r.role).toUpperCase() as UserRole) : undefined,
      password: r.password ? String(r.password) : undefined,
    }));
    const actor = await loadActor(req);
    const result = await userImport.importUsers(rows);
    await adminAudit({
      ...actor,
      ip: req.ip,
      action: 'USERS.BULK_IMPORT',
      resourceType: 'USER',
      resourceId: 'csv',
      meta: { created: result.created, skipped: result.skipped },
    });
    return success(res, result);
  }),
);

export default router;
