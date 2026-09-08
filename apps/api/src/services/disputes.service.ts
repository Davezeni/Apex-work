/**
 * Disputes.
 *
 * Flow:
 *   1. Client OR seller opens a dispute on an order → order.status='DISPUTED'.
 *   2. Admin reviews via /v1/admin/disputes and picks a ruling:
 *        RESOLVED_CLIENT → full refund to client wallet
 *        RESOLVED_SELLER → release full seller net to seller wallet
 *        RESOLVED_SPLIT  → custom split (both amounts sum to order.amountEtb)
 *        WITHDRAWN       → parties resolved on their own, no money moves
 *   3. Ruling is atomic — wallets/transactions/order.status all move in one tx.
 */
import type { DisputeStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { sendPush } from './push.service.js';

export async function openDispute(userId: string, input: { orderId: string; reason: string }) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, clientId: true, sellerId: true, status: true, title: true },
  });
  if (!order) throw new NotFoundError('Order');
  if (order.clientId !== userId && order.sellerId !== userId) throw new ForbiddenError();
  if (['PENDING', 'CANCELLED', 'COMPLETED'].includes(order.status)) {
    throw new BadRequestError(`Cannot dispute an order in ${order.status} state`);
  }
  const existing = await prisma.dispute.findFirst({
    where: { orderId: input.orderId, status: { in: ['OPEN', 'REVIEWING'] } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('An open dispute already exists for this order');

  const dispute = await prisma.$transaction(async (tx) => {
    const d = await tx.dispute.create({
      data: { orderId: input.orderId, openedById: userId, reason: input.reason },
    });
    await tx.order.update({ where: { id: input.orderId }, data: { status: 'DISPUTED' } });
    return d;
  });

  const otherId = order.clientId === userId ? order.sellerId : order.clientId;
  await notify({
    userId: otherId,
    type: 'ORDER_UPDATE',
    title: 'A dispute was opened',
    body: `on "${order.title}"`,
    payload: { orderId: order.id, disputeId: dispute.id },
  });
  void sendPush(otherId, {
    title: 'Order dispute opened',
    body: order.title,
    url: `/orders/${order.id}`,
    tag: `dispute-${dispute.id}`,
  });
  return dispute;
}

export async function listMyDisputes(userId: string) {
  return prisma.dispute.findMany({
    where: {
      OR: [
        { openedById: userId },
        { order: { clientId: userId } },
        { order: { sellerId: userId } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      order: {
        select: {
          id: true, title: true, amountEtb: true, sellerNetEtb: true, platformFeeEtb: true,
          clientId: true, sellerId: true,
          client: { select: { username: true, fullName: true, avatarUrl: true } },
          seller: { select: { username: true, fullName: true, avatarUrl: true } },
        },
      },
      openedBy: { select: { username: true, fullName: true, avatarUrl: true } },
    },
  });
}

// -------- Admin --------
export async function adminList(status?: DisputeStatus, limit = 50) {
  return prisma.dispute.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      order: {
        select: {
          id: true, title: true, amountEtb: true, sellerNetEtb: true, platformFeeEtb: true,
          clientId: true, sellerId: true,
          client: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          seller: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        },
      },
      openedBy: { select: { username: true, fullName: true } },
    },
  });
}

/**
 * Resolve a dispute atomically (see the money transitions above).
 *
 * REFUND POLICY: dispute refunds credit the relevant wallet balance + write an
 * ORDER_REFUND ledger row. Provider-side (Chapa) refunds remain MANUAL — an
 * operator reconciles them via the Chapa dashboard using the order's
 * transaction reference; wallet-funded orders need no provider action.
 */
export async function adminResolve(
  disputeId: string,
  input: {
    ruling: 'RESOLVED_CLIENT' | 'RESOLVED_SELLER' | 'RESOLVED_SPLIT' | 'WITHDRAWN';
    clientPayoutEtb?: number;
    sellerPayoutEtb?: number;
    adminNotes?: string;
  },
) {
  const d = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      order: { select: {
        id: true, amountEtb: true, sellerNetEtb: true, platformFeeEtb: true,
        clientId: true, sellerId: true, title: true, status: true,
      } },
    },
  });
  if (!d) throw new NotFoundError('Dispute');
  if (d.status !== 'OPEN' && d.status !== 'REVIEWING') {
    throw new ConflictError('Already resolved');
  }

  const { order } = d;
  let clientRefund = 0;
  let sellerRelease = 0;

  if (input.ruling === 'RESOLVED_CLIENT') {
    clientRefund = order.amountEtb;
  } else if (input.ruling === 'RESOLVED_SELLER') {
    sellerRelease = order.sellerNetEtb;
  } else if (input.ruling === 'RESOLVED_SPLIT') {
    if (input.clientPayoutEtb == null || input.sellerPayoutEtb == null) {
      throw new BadRequestError('Both amounts required for a split');
    }
    if (input.clientPayoutEtb + input.sellerPayoutEtb !== order.amountEtb) {
      throw new BadRequestError('Payouts must sum to order.amountEtb');
    }
    clientRefund = input.clientPayoutEtb;
    // Seller gets their pro-rated slice minus platform fee's slice.
    const ratio = input.sellerPayoutEtb / order.amountEtb;
    sellerRelease = Math.round(order.sellerNetEtb * ratio);
  }

  const resolved = await prisma.$transaction(async (tx) => {
    // Claim the dispute atomically: only an OPEN/REVIEWING dispute may be
    // resolved. If a concurrent admin already ruled on it, this matches 0 rows
    // and we abort — so money can never move twice for one dispute.
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: { in: ['OPEN', 'REVIEWING'] } },
      data: {
        status: input.ruling,
        clientPayoutEtb: input.clientPayoutEtb ?? null,
        sellerPayoutEtb: input.sellerPayoutEtb ?? null,
        adminNotes: input.adminNotes ?? null,
        resolvedAt: new Date(),
      },
    });
    if (claimed.count === 0) throw new ConflictError('Already resolved');

    if (clientRefund > 0) {
      await tx.wallet.upsert({
        where: { userId: order.clientId },
        create: { userId: order.clientId, balanceEtb: clientRefund },
        update: { balanceEtb: { increment: clientRefund } },
      });
      await tx.transaction.create({
        data: {
          userId: order.clientId, type: 'ORDER_REFUND', amountEtb: clientRefund,
          description: `Dispute resolved — refund for "${order.title}"`, relatedId: order.id,
        },
      });
    }
    if (sellerRelease > 0) {
      await tx.wallet.upsert({
        where: { userId: order.sellerId },
        create: { userId: order.sellerId, balanceEtb: sellerRelease, lifetimeEarnedEtb: sellerRelease },
        update: { balanceEtb: { increment: sellerRelease }, lifetimeEarnedEtb: { increment: sellerRelease } },
      });
      await tx.transaction.create({
        data: {
          userId: order.sellerId, type: 'ORDER_PAYOUT', amountEtb: sellerRelease,
          description: `Dispute resolved — release for "${order.title}"`, relatedId: order.id,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: input.ruling === 'WITHDRAWN' ? 'ACTIVE' :
                clientRefund > 0 && sellerRelease === 0 ? 'CANCELLED' : 'COMPLETED',
        completedAt: input.ruling !== 'WITHDRAWN' && sellerRelease > 0 ? new Date() : undefined,
        cancelledAt: input.ruling === 'RESOLVED_CLIENT' ? new Date() : undefined,
      },
    });

    // Return the freshly-claimed dispute record.
    return tx.dispute.findUniqueOrThrow({ where: { id: disputeId } });
  });

  // Notify both parties.
  await Promise.all([
    notify({
      userId: order.clientId, type: 'ORDER_UPDATE',
      title: 'Dispute resolved', body: order.title,
      payload: { orderId: order.id, ruling: input.ruling, refund: clientRefund },
    }),
    notify({
      userId: order.sellerId, type: 'ORDER_UPDATE',
      title: 'Dispute resolved', body: order.title,
      payload: { orderId: order.id, ruling: input.ruling, release: sellerRelease },
    }),
  ]);
  void sendPush(order.clientId, { title: 'Dispute resolved', body: order.title, url: `/orders/${order.id}` });
  void sendPush(order.sellerId, { title: 'Dispute resolved', body: order.title, url: `/orders/${order.id}` });
  return resolved;
}
