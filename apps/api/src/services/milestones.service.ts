/**
 * Milestones — Upwork-style checkpoints on an Order.
 *
 * Business rules:
 *   • The client owns the milestone plan; freelancer marks each DELIVERED;
 *     client APPROVES to release that milestone's share of escrow.
 *   • Sum of milestone amounts must equal Order.amountEtb — enforced at
 *     write time (setMilestones()). We never let a plan drift.
 *   • Approving the LAST milestone auto-completes the order.
 */
import { prisma } from '../lib/prisma.js';
import type { MilestoneInput } from '@apex-work/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { splitPayout } from './financialIdempotency.js';
import { notify } from './notifications.service.js';
import { sendPush } from './push.service.js';

async function assertOrderParty(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      sellerId: true,
      status: true,
      amountEtb: true,
      sellerNetEtb: true,
      platformFeeEtb: true,
    },
  });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== userId && order.sellerId !== userId) throw new ForbiddenError();
  return order;
}

export async function listMilestones(orderId: string, userId: string) {
  await assertOrderParty(orderId, userId);
  return prisma.milestone.findMany({
    where: { orderId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Replace the milestone plan for an order. Client-only. The order must be
 * PENDING or ACTIVE and have no APPROVED milestones (once money starts
 * moving we don't let anyone repartition it).
 */
export async function setMilestones(orderId: string, userId: string, input: MilestoneInput[]) {
  const order = await assertOrderParty(orderId, userId);
  if (order.clientId !== userId) throw new ForbiddenError('Only the client can define milestones');
  if (order.status !== 'PENDING' && order.status !== 'ACTIVE') {
    throw new BadRequestError('Milestones can only be set on pending or active orders');
  }
  const sum = input.reduce((a, m) => a + m.amountEtb, 0);
  if (sum !== order.amountEtb) {
    throw new BadRequestError(`Milestone amounts must sum to ${order.amountEtb} ETB (got ${sum})`);
  }
  const anyApproved = await prisma.milestone.count({ where: { orderId, status: 'APPROVED' } });
  if (anyApproved > 0) throw new BadRequestError('Cannot re-plan after a milestone is approved');

  return prisma.$transaction(async (tx) => {
    await tx.milestone.deleteMany({
      where: { orderId, status: { in: ['PENDING', 'DELIVERED', 'DISPUTED'] } },
    });
    for (let i = 0; i < input.length; i++) {
      const m = input[i]!;
      await tx.milestone.create({
        data: {
          orderId,
          title: m.title,
          description: m.description ?? null,
          amountEtb: m.amountEtb,
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          position: i,
        },
      });
    }
    return tx.milestone.findMany({ where: { orderId }, orderBy: { position: 'asc' } });
  });
}

/** Freelancer marks a milestone delivered. Notifies the client. */
export async function markDelivered(milestoneId: string, userId: string) {
  const m = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { order: { select: { id: true, clientId: true, sellerId: true, title: true } } },
  });
  if (!m) throw new NotFoundError('Milestone');
  if (m.order.sellerId !== userId)
    throw new ForbiddenError('Only the freelancer can mark delivered');
  if (m.status !== 'PENDING' && m.status !== 'DISPUTED') {
    throw new BadRequestError(`Cannot deliver from status ${m.status}`);
  }
  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
  });
  await notify({
    userId: m.order.clientId,
    type: 'ORDER_UPDATE',
    title: 'Milestone delivered',
    body: `${m.title} for "${m.order.title}"`,
    payload: { orderId: m.order.id, milestoneId: m.id },
  });
  void sendPush(m.order.clientId, {
    title: 'Milestone delivered',
    body: m.title,
    url: `/orders/${m.order.id}`,
    tag: `ms-${m.id}`,
  });
  return updated;
}

/**
 * Client approves — releases this milestone's amount from escrow into the
 * seller's wallet balance. All in one transaction so a mid-flight crash
 * never partially applies.
 */
export async function approve(milestoneId: string, userId: string) {
  const m = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      order: {
        select: {
          id: true,
          clientId: true,
          sellerId: true,
          amountEtb: true,
          sellerNetEtb: true,
          platformFeeEtb: true,
          title: true,
          assignedToUserId: true,
          assigneeSharePct: true,
        },
      },
    },
  });
  if (!m) throw new NotFoundError('Milestone');
  if (m.order.clientId !== userId) throw new ForbiddenError('Only the client can approve');
  if (m.status !== 'DELIVERED') throw new BadRequestError('Milestone must be delivered first');
  return approveMilestoneCore(milestoneId, m);
}

/**
 * Shared payout core for milestone approval (client-approved OR cron
 * auto-release). Caller must have already verified permissions and the
 * DELIVERED status; the CAS inside makes the payout exactly-once.
 */
async function approveMilestoneCore(
  milestoneId: string,
  m: {
    id: string;
    order: {
      id: string;
      sellerId: string;
      amountEtb: number;
      sellerNetEtb: number;
      platformFeeEtb: number;
      assignedToUserId?: string | null;
      assigneeSharePct?: number | null;
    };
    amountEtb: number;
    title: string;
  },
) {
  // Pro-rated payout: this milestone's slice of sellerNetEtb.
  const ratio = m.amountEtb / m.order.amountEtb;
  const payout = Math.round(m.order.sellerNetEtb * ratio);
  const fee = Math.round(m.order.platformFeeEtb * ratio);
  const split = splitPayout(payout, m.order.assignedToUserId, m.order.assigneeSharePct);

  const result = await prisma.$transaction(async (tx) => {
    // Compare-and-set: only the DELIVERED → APPROVED transition may pay out.
    // A concurrent approval matches 0 rows and we abort, so a milestone can
    // never release funds twice.
    const claimed = await tx.milestone.updateMany({
      where: { id: milestoneId, status: 'DELIVERED' },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestError('Milestone must be delivered first');
    }
    const updated = await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    await tx.wallet.upsert({
      where: { userId: m.order.sellerId },
      create: { userId: m.order.sellerId, balanceEtb: split.sellerAmt, lifetimeEarnedEtb: split.sellerAmt },
      update: {
        balanceEtb: { increment: split.sellerAmt },
        lifetimeEarnedEtb: { increment: split.sellerAmt },
      },
    });
    await tx.transaction.create({
      data: {
        userId: m.order.sellerId,
        type: 'ORDER_PAYOUT',
        amountEtb: split.sellerAmt,
        description:
          split.assigneeAmt > 0
            ? `Milestone: ${m.title} (team keeps ${100 - split.sharePct}%)`
            : `Milestone: ${m.title}`,
        relatedId: m.order.id,
      },
    });
    if (split.assigneeId && split.assigneeAmt > 0) {
      await tx.wallet.upsert({
        where: { userId: split.assigneeId },
        create: {
          userId: split.assigneeId,
          balanceEtb: split.assigneeAmt,
          lifetimeEarnedEtb: split.assigneeAmt,
        },
        update: {
          balanceEtb: { increment: split.assigneeAmt },
          lifetimeEarnedEtb: { increment: split.assigneeAmt },
        },
      });
      await tx.transaction.create({
        data: {
          userId: split.assigneeId,
          type: 'ORDER_PAYOUT',
          amountEtb: split.assigneeAmt,
          description: `Milestone: ${m.title} (${split.sharePct}% team share)`,
          relatedId: m.order.id,
        },
      });
    }
    if (fee > 0) {
      await tx.transaction.create({
        data: {
          userId: m.order.sellerId,
          type: 'PLATFORM_FEE',
          amountEtb: -fee,
          description: `Platform fee (${Math.round(ratio * 100)}%)`,
          relatedId: m.order.id,
        },
      });
    }

    // If this was the last un-approved milestone, mark the order COMPLETED.
    const remaining = await tx.milestone.count({
      where: { orderId: m.order.id, status: { not: 'APPROVED' } },
    });
    if (remaining === 0) {
      await tx.order.update({
        where: { id: m.order.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.user.update({
        where: { id: m.order.sellerId },
        data: { completedOrders: { increment: 1 } },
      });
    }
    return updated;
  });

  await notify({
    userId: m.order.sellerId,
    type: 'PAYMENT',
    title: 'Milestone approved',
    body: `${m.title} — ${payout} ETB released to your wallet`,
    payload: { orderId: m.order.id, milestoneId: m.id, payout },
  });
  void sendPush(m.order.sellerId, {
    title: `+${payout.toLocaleString()} ETB released 💰`,
    body: m.title,
    url: `/orders/${m.order.id}`,
    tag: `pay-${m.id}`,
  });
  return result;
}

/** Client or freelancer can flag a milestone for dispute (admin resolves). */
export async function dispute(milestoneId: string, userId: string, reason?: string) {
  const m = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!m) throw new NotFoundError('Milestone');
  await assertOrderParty(m.orderId, userId);
  if (m.status === 'APPROVED') throw new BadRequestError('Already approved');
  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: 'DISPUTED' },
  });
  await prisma.order.update({ where: { id: m.orderId }, data: { status: 'DISPUTED' } });
  await notify({
    userId,
    type: 'ORDER_UPDATE',
    title: 'Milestone disputed',
    body: reason?.slice(0, 200) ?? m.title,
    payload: { orderId: m.orderId, milestoneId: m.id },
  });
  return updated;
}

/**
 * Milestone escrow automation (cron):
 *  1. Remind the client at 3 days after a milestone is delivered.
 *  2. Auto-approve at 5 days — same exactly-once payout core as a manual
 *     approval, so funds can never release twice. Mirrors the order-level
 *     escrow policy but per milestone, keeping money moving without the
 *     client having to click.
 */
export async function autoReleaseMilestones(): Promise<{ released: number; reminded: number }> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // 1. Reminders between day 3 and day 5 (one per milestone — the
  //    (userId,type,relatedId) ledger unique key is the idempotency marker).
  const remindCandidates = await prisma.milestone.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { lte: new Date(now - 3 * day), gt: new Date(now - 5 * day) },
    },
    include: { order: { select: { id: true, clientId: true, title: true } } },
  });
  let reminded = 0;
  for (const m of remindCandidates) {
    const already = await prisma.transaction.findFirst({
      where: { relatedId: m.id, description: { startsWith: 'Milestone reminder' } },
      select: { id: true },
    });
    if (already) continue;
    await notify({
      userId: m.order.clientId,
      type: 'ORDER_UPDATE',
      title: 'Review the delivered milestone',
      body: `"${m.title}" auto-releases in 2 days if you don't approve or dispute.`,
      payload: { orderId: m.order.id, milestoneId: m.id, autoReleaseIn: '2 days' },
    });
    await prisma.transaction
      .create({
        data: {
          userId: m.order.clientId,
          type: 'ESCROW_REMINDER',
          amountEtb: 0,
          description: `Milestone reminder for ${m.title}`,
          relatedId: m.id,
        },
      })
      .catch(() => undefined);
    reminded++;
  }

  // 2. Auto-approve past 5 days. Re-read status so a client approval that
  //    landed between query and payout is honoured (the core CAS re-checks).
  const due = await prisma.milestone.findMany({
    where: { status: 'DELIVERED', deliveredAt: { lte: new Date(now - 5 * day) } },
    include: {
      order: {
        select: {
          id: true,
          clientId: true,
          sellerId: true,
          amountEtb: true,
          sellerNetEtb: true,
          platformFeeEtb: true,
          title: true,
          assignedToUserId: true,
          assigneeSharePct: true,
        },
      },
    },
    take: 50,
  });
  let released = 0;
  for (const m of due) {
    try {
      await approveMilestoneCore(m.id, m);
      await notify({
        userId: m.order.clientId,
        type: 'ORDER_UPDATE',
        title: 'Milestone auto-released',
        body: `"${m.title}" was auto-approved after 5 days and the freelancer has been paid.`,
        payload: { orderId: m.order.id, milestoneId: m.id, auto: true },
      });
      released++;
    } catch (e) {
      // Already approved/disputed concurrently — safe to skip.
      if (!(e instanceof BadRequestError)) throw e;
    }
  }
  return { released, reminded };
}
