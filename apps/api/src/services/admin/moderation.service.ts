/**
 * Content moderation services — the admin's ability to review and act on gigs,
 * jobs and reviews. All mutations are audited by the caller (routes) and are
 * gated by the `moderation:content` capability.
 */
import { prisma } from '../../lib/prisma.js';
import type { GigStatus } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';

// ---------------- GIGS ----------------

export async function adminListGigs(opts: {
  status?: GigStatus;
  flagged?: boolean;
  featured?: boolean;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.flagged !== undefined) where.isFlagged = opts.flagged;
  if (opts.featured !== undefined) where.isFeatured = opts.featured;
  if (opts.cursorWhere) Object.assign(where, opts.cursorWhere);

  const items = await prisma.gig.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    select: {
      id: true, title: true, slug: true, status: true, isFeatured: true,
      isFlagged: true, flaggedReason: true, pinnedAt: true, featuredUntil: true,
      startingPriceEtb: true, ordersCount: true, rating: true, viewsCount: true,
      createdAt: true,
      owner: { select: { id: true, username: true, fullName: true } },
      packages: { select: { tier: true, priceEtb: true, deliveryDays: true } },
    },
  });
  return items;
}

/** Toggle / edit a gig's publication, moderation or sponsorship state. */
export async function moderateGig(
  gigId: string,
  input: {
    status?: GigStatus;
    isFlagged?: boolean;
    flaggedReason?: string | null;
    setFeaturedUntil?: string | null;
    pin?: boolean;
  },
) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new NotFoundError('Gig');

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.isFlagged !== undefined) {
    data.isFlagged = input.isFlagged;
    data.flaggedReason = input.isFlagged ? input.flaggedReason ?? gig.flaggedReason ?? null : null;
  } else if (input.flaggedReason !== undefined) {
    data.flaggedReason = input.flaggedReason;
  }
  if (input.setFeaturedUntil !== undefined) {
    data.featuredUntil = input.setFeaturedUntil ? new Date(input.setFeaturedUntil) : null;
    data.isFeatured = !!input.setFeaturedUntil;
  }
  if (input.pin !== undefined) data.pinnedAt = input.pin ? new Date() : null;

  const updated = await prisma.gig.update({
    where: { id: gigId },
    data,
    select: {
      id: true, title: true, status: true, isFeatured: true, isFlagged: true,
      flaggedReason: true, pinnedAt: true, featuredUntil: true,
    },
  });
  return { before: gig, ...updated };
}

// ---------------- JOBS ----------------

export async function adminListJobs(opts: {
  open?: boolean;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const where: Record<string, unknown> = {};
  if (opts.open !== undefined) where.isOpen = opts.open;
  if (opts.cursorWhere) Object.assign(where, opts.cursorWhere);

  return prisma.job.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    select: {
      id: true, title: true, isOpen: true, budgetMinEtb: true, budgetMaxEtb: true,
      isRemote: true, pinnedAt: true, createdAt: true,
      client: { select: { id: true, username: true, fullName: true } },
      _count: { select: { bids: true } },
    },
  });
}

export async function moderateJob(
  jobId: string,
  input: { isOpen?: boolean; pinned?: boolean },
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  const data: Record<string, unknown> = {};
  if (input.isOpen !== undefined) {
    data.isOpen = input.isOpen;
    data.closedAt = input.isOpen ? null : new Date();
  }
  if (input.pinned !== undefined) data.pinnedAt = input.pinned ? new Date() : null;
  const updated = await prisma.job.update({ where: { id: jobId }, data });
  return { before: { isOpen: job.isOpen, pinnedAt: job.pinnedAt }, ...updated };
}

// ---------------- REVIEWS ----------------

export async function adminListReviews(opts: {
  hidden?: boolean;
  subjectId?: string;
  limit: number;
  orderBy?: 'desc' | 'asc';
}) {
  const where: Record<string, unknown> = {};
  if (opts.hidden !== undefined) where.hiddenAt = opts.hidden ? { not: null } : null;
  if (opts.subjectId) where.subjectId = opts.subjectId;
  return prisma.review.findMany({
    where,
    orderBy: { createdAt: opts.orderBy ?? 'desc' },
    take: opts.limit,
    include: {
      author: { select: { id: true, username: true, fullName: true } },
      subject: { select: { id: true, username: true, fullName: true } },
      order: { select: { id: true, orderNumber: true, title: true } },
    },
  });
}

export async function moderateReview(
  reviewId: string,
  action: 'HIDE' | 'RESTORE',
  adminId: string,
  reason?: string,
) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new NotFoundError('Review');
  const data =
    action === 'HIDE'
      ? { hiddenAt: new Date(), hiddenById: adminId, hiddenReason: reason ?? null }
      : { hiddenAt: null, hiddenById: null, hiddenReason: null };
  return prisma.review.update({ where: { id: reviewId }, data });
}
