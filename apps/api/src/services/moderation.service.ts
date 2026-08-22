/**
 * Moderation: reports + user blocks.
 *
 * Blocks are one-directional: A blocks B → B can't send A messages OR
 * start new conversations with A. Existing conversations stay visible in
 * both inboxes; new messages just fail with a soft error.
 */
import type { ReportReason, ReportTargetType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors.js';

const REASON_MAP: Record<string, ReportReason> = {
  SPAM: 'SPAM',
  HARASSMENT: 'HARASSMENT',
  SCAM: 'SCAM',
  INAPPROPRIATE: 'INAPPROPRIATE',
  IMPERSONATION: 'IMPERSONATION',
  OTHER: 'OTHER',
};
const TARGET_MAP: Record<string, ReportTargetType> = {
  USER: 'USER',
  GIG: 'GIG',
  MESSAGE: 'MESSAGE',
  CONVERSATION: 'CONVERSATION',
};

export async function createReport(input: {
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
}) {
  const targetType = TARGET_MAP[input.targetType];
  const reason = REASON_MAP[input.reason];
  if (!targetType) throw new BadRequestError('Invalid target type');
  if (!reason) throw new BadRequestError('Invalid reason');

  // Verify the target actually exists (guards against typo'd IDs / probing).
  if (targetType === 'USER') {
    const exists = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError('User');
  } else if (targetType === 'GIG') {
    const exists = await prisma.gig.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError('Gig');
  } else if (targetType === 'MESSAGE') {
    const exists = await prisma.message.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError('Message');
  }

  // Cheap dedupe: one report per (reporter, target, reason) per 24h.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dup = await prisma.report.findFirst({
    where: {
      reporterId: input.reporterId,
      targetType,
      targetId: input.targetId,
      reason,
      createdAt: { gt: dayAgo },
    },
    select: { id: true },
  });
  if (dup) throw new ConflictError('You already reported this recently');

  return prisma.report.create({
    data: {
      reporterId: input.reporterId,
      targetType,
      targetId: input.targetId,
      reason,
      details: input.details ?? null,
    },
  });
}

export async function blockUser(blockerId: string, blockedId: string, reason?: string) {
  if (blockerId === blockedId) throw new BadRequestError("You can't block yourself");
  return prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId, reason: reason ?? null },
    update: { reason: reason ?? null },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function listBlockedByMe(userId: string) {
  return prisma.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      blocked: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
}

/** True if A blocks B in EITHER direction. Used to gate new conversations. */
export async function isBlocked(a: string, b: string): Promise<boolean> {
  const count = await prisma.userBlock.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return count > 0;
}
