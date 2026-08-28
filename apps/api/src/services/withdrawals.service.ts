/**
 * Withdrawals.
 *
 * User requests a payout → we deduct from their wallet.balanceEtb atomically,
 * create a Withdrawal(PENDING) row, and add a Transaction ledger entry.
 * Admin review remains the safe default; an explicit CHAPA_TRANSFERS_ENABLED
 * flag can hand eligible destinations to Chapa Transfers, then the cron
 * reconciler moves PROCESSING rows to SUCCESS/FAILED.
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
import { chapa } from './chapa.service.js';
import { logger } from '../config/logger.js';

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
function feeFor(): number {
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
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true, isPhoneVerified: true },
  });
  if (!user || !user.phone || !user.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before requesting a withdrawal');
  }
  const fee = feeFor();
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

  // Automated transfers are explicitly opt-in. Until the feature flag is
  // enabled, the existing admin review flow remains the safe default.
  if (chapa.transfersEnabled()) {
    await tryAutomatedPayout(wd.id, input);
  }

  return wd;
}

async function tryAutomatedPayout(
  withdrawalId: string,
  input: {
    userId: string;
    amountEtb: number;
    destination: IncomingDestination;
    accountNumber: string;
    accountName?: string;
  },
): Promise<void> {
  const bankCode = await chapa.findBankCode(input.destination);
  if (!bankCode) {
    logger.warn({ withdrawalId, destination: input.destination }, 'No Chapa bank code found; leaving payout for admin review');
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { failureReason: 'Automatic payout could not resolve this destination; admin review required.' },
    });
    return;
  }

  const reference = `apx-wd-${withdrawalId}`;
  const transfer = await chapa.initiateTransfer({
    amountEtb: input.amountEtb,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    bankCode,
    reference,
  });

  if (transfer.status === 'failed') {
    await markStatus(withdrawalId, 'FAILED', {
      providerRef: transfer.reference ?? reference,
      failureReason: transfer.error ?? 'Chapa rejected the transfer',
    });
    await notify({
      userId: input.userId,
      type: 'PAYMENT',
      title: 'Withdrawal failed',
      body: transfer.error ?? 'Chapa rejected the payout. Your balance has been restored.',
      payload: { withdrawalId },
    }).catch(() => undefined);
    return;
  }

  if (transfer.status === 'pending' && transfer.reference) {
    await markStatus(withdrawalId, 'PROCESSING', { providerRef: transfer.reference });
    await notify({
      userId: input.userId,
      type: 'PAYMENT',
      title: 'Withdrawal processing',
      body: 'Chapa accepted your payout request. We are checking the transfer status.',
      payload: { withdrawalId },
    }).catch(() => undefined);
    return;
  }

  // A network/unknown response is not safe to retry automatically: the
  // provider may have accepted the transfer even if our request timed out.
  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { failureReason: 'Chapa transfer status is unknown; admin review required before retrying.' },
  });
}

/** Reconcile Chapa transfers that were accepted but are not final yet. */
export async function syncProcessingWithdrawals(limit = 25) {
  if (!chapa.transfersEnabled()) return { enabled: false, checked: 0, succeeded: 0, failed: 0 };
  const items = await prisma.withdrawal.findMany({
    where: { status: 'PROCESSING', providerRef: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    if (!item.providerRef) continue;
    const result = await chapa.verifyTransfer(item.providerRef);
    if (result.ok) {
      await markStatus(item.id, 'SUCCESS', { providerRef: item.providerRef });
      await notify({
        userId: item.userId,
        type: 'PAYMENT',
        title: 'Withdrawal completed',
        body: `Your ${item.amountEtb.toLocaleString()} ETB payout has been completed.`,
        payload: { withdrawalId: item.id },
      }).catch(() => undefined);
      succeeded++;
    } else if (result.status === 'failed') {
      await markStatus(item.id, 'FAILED', {
        providerRef: item.providerRef,
        failureReason: result.error ?? 'Chapa transfer failed',
      });
      await notify({
        userId: item.userId,
        type: 'PAYMENT',
        title: 'Withdrawal failed',
        body: result.error ?? 'Your payout failed and the balance was restored.',
        payload: { withdrawalId: item.id },
      }).catch(() => undefined);
      failed++;
    }
  }
  return { enabled: true, checked: items.length, succeeded, failed };
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
