import { Router } from 'express';
import {
  createBidSchema,
  createJobSchema,
  jobAgencyInviteSchema,
  jobListQuerySchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as jobs from '../services/jobs.service.js';
import { cache, bust } from '../middleware/cache.js';
import { prisma } from '../lib/prisma.js';

const router: Router = Router();

/** GET /jobs — public list. Only shows open jobs by default. */
router.get(
  '/',
  optionalAuth,
  cache({ ttlSeconds: 45, swrAfterSeconds: 15 }),
  validate(jobListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as import('@apex-work/shared').JobListQuery;
    const result = await jobs.listJobs({ ...q, onlyOpen: true });
    return success(res, result);
  }),
);

/**
 * GET /jobs/mine/open — the signed-in client's own open jobs (lightweight).
 * Used by the "invite a team to bid" picker. Must be registered before /:id.
 */
router.get(
  '/mine/open',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await prisma.job.findMany({
      where: { clientId: req.user!.sub, isOpen: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true },
    });
    return success(res, { items });
  }),
);

/**
 * GET /jobs/:id — public detail. Bid details are hidden unless viewer is client.
 *
 * `perUser` caches separately for the owning client (who sees bids) vs
 * anonymous viewers (who don't) so we never leak private bids.
 */
router.get(
  '/:id',
  optionalAuth,
  cache({ ttlSeconds: 30, swrAfterSeconds: 10, perUser: true }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const job = await jobs.getJob(id, req.user?.sub);
    return success(res, job);
  }),
);

/** POST /jobs — clients create a job. */
router.post(
  '/',
  requireAuth,
  validate(createJobSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateJobInput;
    const job = await jobs.createJob(req.user!.sub, {
      ...body,
      attachments: body.attachments,
    });
    void bust('/v1/jobs');
    return success(res, job, 201);
  }),
);

/** POST /jobs/:id/close — client closes a job (no more bids). */
router.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const job = await jobs.closeJob(id, req.user!.sub);
    void bust(`/v1/jobs`);
    return success(res, job);
  }),
);

// ---------------- Bids ----------------

/** POST /jobs/:id/bids — freelancer bids. Upserts existing bid. */
router.post(
  '/:id/bids',
  requireAuth,
  validate(createBidSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').CreateBidInput;
    const bid = await jobs.createBid(req.user!.sub, id, body);
    void bust(`/v1/jobs/${id}`);
    return success(res, bid, 201);
  }),
);

/** DELETE /jobs/:jobId/bids/:bidId — freelancer withdraws own bid. */
router.delete(
  '/:jobId/bids/:bidId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bidId } = req.params as { bidId: string };
    const bid = await jobs.withdrawBid(bidId, req.user!.sub);
    return success(res, bid);
  }),
);

/** POST /jobs/:jobId/bids/:bidId/accept — client accepts → creates order + checkout. */
router.post(
  '/:jobId/bids/:bidId/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bidId } = req.params as { bidId: string };
    const result = await jobs.acceptBid(bidId, req.user!.sub);
    return success(res, result);
  }),
);

/**
 * POST /jobs/:id/agency-invites — the job's client invites a team to bid.
 * Idempotent; notifies the team owner + managers.
 */
router.post(
  '/:id/agency-invites',
  requireAuth,
  validate(jobAgencyInviteSchema),
  asyncHandler(async (req, res) => {
    const params = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').JobAgencyInviteInput;
    return success(res, await jobs.inviteAgency(params.id, req.user!.sub, body), 201);
  }),
);

export default router;
