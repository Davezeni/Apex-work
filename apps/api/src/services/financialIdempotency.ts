import type { Prisma, TransactionType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Prisma error code for a uniqueness violation. */
const UNIQUE_VIOLATION = 'P2002';

export interface LedgerEntry {
  userId: string;
  /** One of the TransactionType enum values. */
  type: TransactionType;
  amountEtb: number;
  description: string;
  /** orderId / paymentId — the related business record (drives idempotency). */
  relatedId?: string | null;
}

export interface LedgerOnceResult {
  /** True when this call created a new ledger row (money actually moved). */
  applied: boolean;
}

/**
 * Record one ledger row and the accompanying wallet mutation, atomically.
 *
 * The DB-level unique index on `Transaction(userId, type, relatedId)` guarantees
 * a given financial event can be recorded at most once. If a concurrent or
 * retried request already wrote the same row, `transaction.create` throws a
 * P2002 violation; we swallow it and skip the wallet mutation entirely, so the
 * money change can never be applied twice.
 *
 * The wallet mutation and the ledger insert run inside the SAME transaction, so
 * there is no window where a wallet is credited without a matching ledger row.
 */
export async function ledgerOnce(
  tx: Tx,
  ledger: LedgerEntry,
  walletMutation?: (tx: Tx) => Promise<unknown>,
): Promise<LedgerOnceResult> {
  try {
    await tx.transaction.create({ data: ledger });
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      // Already recorded by a prior/duplicate request — do NOT re-apply money.
      return { applied: false };
    }
    throw err;
  }
  if (walletMutation) await walletMutation(tx);
  return { applied: true };
}

export interface PayoutSplit {
  /** Credited to the order's seller (agency owner) — remainder of the net. */
  sellerAmt: number;
  /** Credited to the assigned team member (0 when unassigned). */
  assigneeAmt: number;
  assigneeId: string | null;
  sharePct: number;
}

/**
 * Pure math: divide a net payout between the seller and an assigned team
 * member. Rounding remainder always stays with the seller, and the two
 * amounts always sum to `net`. No assignment / 0% share → 100% seller,
 * i.e. exactly the pre-agency behavior.
 */
export function splitPayout(
  net: number,
  assigneeId: string | null | undefined,
  sharePct: number | null | undefined,
): PayoutSplit {
  const pct =
    assigneeId && sharePct && sharePct > 0
      ? Math.min(100, Math.max(0, Math.round(sharePct)))
      : 0;
  if (!assigneeId || pct === 0) {
    return { sellerAmt: net, assigneeAmt: 0, assigneeId: null, sharePct: 0 };
  }
  const assigneeAmt = Math.round((net * pct) / 100);
  return {
    sellerAmt: net - assigneeAmt,
    assigneeAmt,
    assigneeId,
    sharePct: pct,
  };
}

/** True if `err` is a Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === UNIQUE_VIOLATION;
}
