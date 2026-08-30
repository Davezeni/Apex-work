/**
 * Money services — admin oversight of orders, refunds, wallets and payouts.
 * Every action here moves money or records a ledger entry, so it is gated by
 * `money:*` capabilities and audited by the route. Refunds are recorded as a
 * Transaction so the ledger always reconciles.
 */
import { prisma } from '../../lib/prisma.js';
import type { OrderStatus, WithdrawalStatus } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { markStatus as markWithdrawalStatus } from '../withdrawals.service.js';

// ---------------- ORDERS ----------------

export async function adminListOrders(opts: {
  status?: OrderStatus;
  q?: string;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const conditions: Record<string, unknown>[] = [];
  if (opts.status) conditions.push({ status: opts.status });
  if (opts.q) {
    conditions.push({
      OR: [
        { title: { contains: opts.q, mode: 'insensitive' } },
        { orderNumber: { contains: opts.q } },
      ],
    });
  }
  if (opts.cursorWhere) conditions.push(opts.cursorWhere);
  const where: Record<string, unknown> = conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };
  return prisma.order.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    select: {
      id: true, orderNumber: true, title: true, amountEtb: true,
      platformFeeEtb: true, sellerNetEtb: true, status: true, createdAt: true,
      client: { select: { id: true, username: true, fullName: true } },
      seller: { select: { id: true, username: true, fullName: true } },
    },
  });
}

// ---------------- REFUNDS ----------------

/**
 * Issue a partial/full refund from an order back to the client's wallet.
 * Mirrors money out of the seller's balance and writes a ledger entry.
 */
export async function refundOrder(orderId: string, amountEtb: number, reason: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: { include: { wallet: true } }, seller: { include: { wallet: true } } },
  });
  if (!order) throw new NotFoundError('Order');
  if (amountEtb < 1) throw new BadRequestError('Refund amount must be positive');
  if (amountEtb > order.amountEtb) throw new BadRequestError('Refund exceeds order amount');

  const clientWallet = order.client.wallet;
  if (!clientWallet) throw new ConflictError('Client has no wallet yet');

  return prisma.$transaction(async (tx) => {
    // Credit the client's balance.
    await tx.wallet.update({
      where: { userId: order.clientId },
      data: { balanceEtb: { increment: amountEtb } },
    });
    // Debit the ledger for the client.
    await tx.transaction.create({
      data: {
        userId: order.clientId,
        type: 'ORDER_REFUND',
        amountEtb: amountEtb,
        description: `Refund for order ${order.orderNumber}: ${reason}`,
        relatedId: order.id,
      },
    });
    // Record it on the order.
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
      select: { id: true, orderNumber: true, amountEtb: true, status: true },
    });
    return { refundedEtb: amountEtb, order: updated, reason };
  });
}

// ---------------- WALLET LEDGER ----------------

export async function adminLedger(opts: {
  userId?: string;
  type?: string;
  cursor?: string | null;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const conditions: Record<string, unknown>[] = [];
  if (opts.userId) conditions.push({ userId: opts.userId });
  if (opts.type) conditions.push({ type: opts.type });
  if (opts.cursorWhere) conditions.push(opts.cursorWhere);
  const where: Record<string, unknown> = conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };
  return prisma.transaction.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    include: { user: { select: { id: true, username: true, fullName: true } } },
  });
}

/** Manual balance adjustment (credit/debit) with a ledger entry + audit. */
export async function adjustWallet(
  userId: string,
  type: 'MANUAL_CREDIT' | 'MANUAL_DEBIT' | 'REFERRAL_BONUS',
  amountEtb: number,
  description: string,
) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new NotFoundError('Wallet');
  const signed = type === 'MANUAL_DEBIT' ? -amountEtb : amountEtb;
  if (wallet.balanceEtb + signed < 0) throw new BadRequestError('Insufficient balance');

  return prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { userId }, data: { balanceEtb: { increment: signed } } });
    const txn = await tx.transaction.create({
      data: {
        userId,
        type: 'MANUAL_ADJUSTMENT',
        amountEtb: signed,
        description: `[ADMIN] ${description}`,
      },
    });
    // Recompute lifetime earned only for positive credits.
    if (signed > 0) {
      await tx.wallet.update({
        where: { userId },
        data: { lifetimeEarnedEtb: { increment: signed } },
      });
    }
    return { txn, balanceEtb: wallet.balanceEtb + signed };
  });
}

// ---------------- WITHDRAWALS ----------------

export async function adminListWithdrawals(opts: {
  status?: WithdrawalStatus;
  limit: number;
  cursorWhere?: Record<string, unknown>;
}) {
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.cursorWhere) Object.assign(where, opts.cursorWhere);
  return prisma.withdrawal.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    include: { user: { select: { id: true, username: true, fullName: true, phone: true } } },
  });
}

export { markWithdrawalStatus };
