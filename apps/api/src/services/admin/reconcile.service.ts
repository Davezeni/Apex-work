/**
 * Admin wallet reconciliation — verifies that every user's stored wallet
 * balance equals the signed sum of their ledger transactions. Aggregation is
 * done with GROUP BY at the database (never loads whole tables), then folded
 * into a report by the pure `lib/reconcile.buildReconciliation`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildReconciliation, type ReconciliationSummary } from '../../lib/reconcile.js';

interface RawRow {
  userId: string;
  balanceEtb: bigint | number;
  ledgerEtb: bigint | number;
}

export async function reconcileWallets(): Promise<ReconciliationSummary> {
  // LEFT JOIN wallets to their summed transactions so wallets with zero (or
  // missing) ledger entries still appear and surface as drift.
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT w."userId" AS "userId",
           w."balanceEtb" AS "balanceEtb",
           COALESCE(SUM(t."amountEtb"), 0)::bigint AS "ledgerEtb"
    FROM "Wallet" w
    LEFT JOIN "Transaction" t ON t."userId" = w."userId"
    GROUP BY w."userId", w."balanceEtb"
    ORDER BY w."userId"`;

  return buildReconciliation(
    rows.map((r) => ({ userId: r.userId, balanceEtb: Number(r.balanceEtb) })),
    rows.map((r) => ({ userId: r.userId, ledgerEtb: Number(r.ledgerEtb) })),
  );
}

/** How many wallets are out of sync (for a quick admin badge). */
export async function driftCount(): Promise<{ drifted: number; netDriftEtb: number }> {
  const report = await reconcileWallets();
  return { drifted: report.drifted, netDriftEtb: report.netDriftEtb };
}
