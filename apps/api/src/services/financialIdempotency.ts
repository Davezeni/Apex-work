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

/** True if `err` is a Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === UNIQUE_VIOLATION;
}
