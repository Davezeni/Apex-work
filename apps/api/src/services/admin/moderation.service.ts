/**
 * Content moderation services — the admin's ability to review and act on gigs,
 * jobs and reviews. All mutations are audited by the caller (routes) and are
 * gated by the `moderation:content` capability.
 */
import { prisma } from '../../lib/prisma.js';
import type { GigStatus } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { analyzeContent, summarizeFlags } from '../../lib/moderationRules.js';

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

// ---------------- FLAG-QUEUE TRIAGE ----------------

export interface TriageItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isFlagged: boolean;
  flaggedReason: string | null;
  moderationStatus: string;
  moderationAssignee: string | null;
  moderatorNotes: string | null;
  viewsCount: number;
  ordersCount: number;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; username: string; fullName: string };
}

/** List flagged gigs for the flag queue (optionally filtered by workflow status). */
export async function adminListFlagged(opts: { moderationStatus?: string; limit: number }) {
  const where: Record<string, unknown> = {};
  if (opts.moderationStatus) where.moderationStatus = opts.moderationStatus;
  return prisma.gig.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: opts.limit,
    select: {
      id: true, title: true, slug: true, status: true, isFlagged: true, flaggedReason: true,
      moderationStatus: true, moderationAssignee: true, moderatorNotes: true,
      viewsCount: true, ordersCount: true, createdAt: true, updatedAt: true,
      owner: { select: { id: true, username: true, fullName: true } },
    },
  });
}

/** Set a gig's moderation triage status, assignee and/or notes. */
export async function triageGig(
  gigId: string,
  input: { status?: string; assignee?: string | null; notes?: string | null },
  adminId: string,
) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new NotFoundError('Gig');
  const data: Record<string, unknown> = { moderatedAt: new Date(), moderationAssignee: adminId };
  if (input.status) data.moderationStatus = input.status;
  if (input.assignee !== undefined) data.moderationAssignee = input.assignee;
  if (input.notes !== undefined) data.moderatorNotes = input.notes;
  return prisma.gig.update({ where: { id: gigId }, data });
}

/** Bulk-move a set of flagged gigs to a terminal status (e.g. resolve all). */
export async function bulkTriage(ids: string[], status: string, adminId: string) {
  const result = await prisma.gig.updateMany({
    where: { id: { in: ids } },
    data: { moderationStatus: status as never, moderatorNotes: `Bulk ${status}`, moderationAssignee: adminId, moderatedAt: new Date() },
  });
  return { updated: result.count };
}

// ---------------- PROACTIVE SCAN ----------------

export interface ScanItem {
  id: string;
  kind: 'GIG' | 'JOB' | 'REVIEW';
  title: string;
  matches: { category: string; ruleId: string; matched: string; severity: string }[];
  summary?: string;
}

export interface ScanSummary {
  scanned: number;
  flagged: number;
  items: ScanItem[];
}

/**
 * Run the moderation rules engine over the most recent N items of each kind,
 * auto-flagging content via the existing `isFlagged`/`flaggedReason` fields.
 * Returns a summary (plus the flagged items) so the UI shows what was hit.
 */
export async function contentScan(limit = 50): Promise<ScanSummary> {
  if (limit < 1 || limit > 500) throw new BadRequestError('limit must be 1..500');

  const [gigs, jobs, reviews] = await Promise.all([
    prisma.gig.findMany({ where: { isFlagged: false }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, title: true, description: true } }),
    prisma.job.findMany({ where: { isOpen: true }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, title: true, description: true } }),
    prisma.review.findMany({ where: { hiddenAt: null }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, comment: true } }),
  ]);

  const items: ScanItem[] = [];
  let flagged = 0;

  for (const g of gigs) {
    const flags = analyzeContent(`${g.title} ${g.description ?? ''}`);
    if (flags.length) {
      flagged += 1;
      await prisma.gig.update({ where: { id: g.id }, data: { isFlagged: true, flaggedReason: summarizeFlags(flags) } });
      items.push({ id: g.id, kind: 'GIG', title: g.title, matches: flags.map((f) => ({ category: f.category, ruleId: f.ruleId, matched: f.matched, severity: f.severity })), summary: summarizeFlags(flags) });
    }
  }

  for (const j of jobs) {
    const flags = analyzeContent(`${j.title} ${j.description ?? ''}`);
    if (flags.length) {
      // Jobs have no flag column; surface via the review route summary only.
      items.push({ id: j.id, kind: 'JOB', title: j.title, matches: flags.map((f) => ({ category: f.category, ruleId: f.ruleId, matched: f.matched, severity: f.severity })), summary: summarizeFlags(flags) });
    }
  }

  for (const r of reviews) {
    const flags = analyzeContent(r.comment ?? '');
    if (flags.length) {
      items.push({ id: r.id, kind: 'REVIEW', title: r.comment ?? '', matches: flags.map((f) => ({ category: f.category, ruleId: f.ruleId, matched: f.matched, severity: f.severity })), summary: summarizeFlags(flags) });
    }
  }

  return { scanned: gigs.length + jobs.length + reviews.length, flagged, items };
}
