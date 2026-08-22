/**
 * Withdrawals.
 *
 * MVP flow: user requests a payout → we deduct from their wallet.balanceEtb
 * atomically, create a Withdrawal(PENDING) row, and add a Transaction
 * ledger entry. An operator (or a future Chapa B2C integration) then flips
 * status → SUCCESS.
 *
 * We DEBIT the wallet immediately on request so users don't double-spend
 * their balance while an operator is processing. If the withdrawal fails,
 * mark it FAILED and re-credit the wallet (see markStatus()).
 */
import type { WithdrawalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { MIN_WITHDRAWAL_ETB } from '@apex-work/shared';
import { notify } from './notifications.service.js';

const DESTINATION_TO_ENUM = {
  telebirr: 'TELEBIRR',
  cbebirr: 'CBEBIRR',
  cbe_bank: 'CBE_BANK',
  awash_bank: 'AWASH_BANK',
  dashen_bank: 'DASHEN_BANK',
  bank_of_abyssinia: 'BANK_OF_ABYSSINIA',
} as const;
type IncomingDestination = keyof typeof DESTINATION_TO_ENUM;

/** Small fixed fee to cover Chapa payout overhead. Tweak per rail later. */
function feeFor(_dest: IncomingDestination, _amount: number): number {
  return 0; // v1: eat the fee ourselves to reduce checkout friction
}

export async function requestWithdrawal(input: {
  userId: string;
  amountEtb: number;
  destination: IncomingDestination;
  accountNumber: string;
  accountName?: string;
}) {
  if (input.amountEtb < MIN_WITHDRAWAL_ETB) {
    throw new BadRequestError(`Minimum withdrawal is ${MIN_WITHDRAWAL_ETB} ETB`);
  }
  const fee = feeFor(input.destination, input.amountEtb);
  const net = input.amountEtb - fee;

  const wd = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new NotFoundError('Wallet');
    if (wallet.balanceEtb < input.amountEtb) {
      throw new ConflictError('Insufficient balance');
    }

    // Deduct upfront (see doc comment above).
    await tx.wallet.update({
      where: { userId: input.userId },
      data: { balanceEtb: { decrement: input.amountEtb } },
    });

    const withdrawal = await tx.withdrawal.create({
      data: {
        userId: input.userId,
        amountEtb: input.amountEtb,
        feeEtb: fee,
        netEtb: net,
        destination: DESTINATION_TO_ENUM[input.destination],
        accountNumber: input.accountNumber,
        accountName: input.accountName ?? null,
        status: 'PENDING',
      },
    });

    await tx.transaction.create({
      data: {
        userId: input.userId,
        type: 'WITHDRAWAL',
        amountEtb: -input.amountEtb,
        description: `Withdrawal requested to ${input.destination}`,
        relatedId: withdrawal.id,
      },
    });

    return withdrawal;
  });

  await notify({
    userId: input.userId,
    type: 'PAYMENT',
    title: 'Withdrawal received',
    body: 'We got your request. Funds usually arrive within 1–2 business days.',
    payload: { withdrawalId: wd.id },
  });

  return wd;
}

/** Operator-facing / webhook-facing state transitions. */
export async function markStatus(
  withdrawalId: string,
  next: WithdrawalStatus,
  meta?: { providerRef?: string; failureReason?: string },
) {
  return prisma.$transaction(async (tx) => {
    const wd = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!wd) throw new NotFoundError('Withdrawal');
    if (wd.status === next) return wd;

    // If we're marking FAILED or CANCELLED and funds were already deducted → refund.
    const shouldRefund =
      (next === 'FAILED' || next === 'CANCELLED') &&
      (wd.status === 'PENDING' || wd.status === 'PROCESSING');

    if (shouldRefund) {
      await tx.wallet.update({
        where: { userId: wd.userId },
        data: { balanceEtb: { increment: wd.amountEtb } },
      });
      await tx.transaction.create({
        data: {
          userId: wd.userId,
          type: 'ORDER_REFUND', // reuse the refund type; safer than adding an enum value
          amountEtb: wd.amountEtb,
          description: `Withdrawal refund (${next.toLowerCase()})`,
          relatedId: wd.id,
        },
      });
    }

    return tx.withdrawal.update({
      where: { id: wd.id },
      data: {
        status: next,
        providerRef: meta?.providerRef ?? wd.providerRef,
        failureReason: meta?.failureReason ?? wd.failureReason,
        processedAt:
          next === 'SUCCESS' || next === 'FAILED' || next === 'CANCELLED'
            ? new Date()
            : wd.processedAt,
      },
    });
  });
}

export async function cancelWithdrawal(userId: string, withdrawalId: string) {
  const wd = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!wd) throw new NotFoundError('Withdrawal');
  if (wd.userId !== userId) throw new ForbiddenError();
  if (wd.status !== 'PENDING') {
    throw new ConflictError('Only pending withdrawals can be cancelled');
  }
  return markStatus(withdrawalId, 'CANCELLED', { failureReason: 'User cancelled' });
}

export async function listMyWithdrawals(userId: string, limit = 30) {
  return prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
