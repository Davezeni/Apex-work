/**
 * Wallet reconciliation helpers — detect any slot where a user's stored
 * `Wallet.balanceEtb` does not equal the signed sum of their `Transaction`
 * rows. A platform should have zero drift between what the ledger says and
 * what a wallet holds, so these pure helpers turn raw row-sums + balances
 * into a report we can act on. Kept dependency-free and unit-testable.
 */

export interface WalletBalanceRow {
  userId: string;
  balanceEtb: number;
}

export interface LedgerSumRow {
  userId: string;
  ledgerEtb: number;
}

export interface ReconciliationRow {
  userId: string;
  walletBalanceEtb: number;
  ledgerEtb: number;
  /** signed difference: ledger - wallet (positive = ledger credits wallet). */
  driftEtb: number;
  /** 0 when perfectly reconciled, else 1. */
  matches: boolean;
}

export interface ReconciliationSummary {
  wallets: number;
  reconciled: number;
  drifted: number;
  netDriftEtb: number;
  rows: ReconciliationRow[];
}

/**
 * Combine wallet balances and per-user ledger sums (an inner join on userId)
 * and emit a reconciliation row per user. Users present in only one side are
 * treated as drifted (their missing side is 0).
 */
export function buildReconciliation(
  balances: WalletBalanceRow[],
  ledgerSums: LedgerSumRow[],
): ReconciliationSummary {
  const byUser = new Map<string, { balance?: number; ledger?: number }>();
  for (const b of balances) byUser.set(b.userId, { balance: b.balanceEtb });
  for (const l of ledgerSums) {
    const cur = byUser.get(l.userId) ?? {};
    cur.ledger = l.ledgerEtb;
    byUser.set(l.userId, cur);
  }

  const rows: ReconciliationRow[] = [];
  let reconciled = 0;
  let netDrift = 0;
  for (const [userId, v] of byUser) {
    const wallet = v.balance ?? 0;
    const ledger = v.ledger ?? 0;
    const drift = ledger - wallet;
    const matches = drift === 0;
    if (matches) reconciled += 1;
    netDrift += drift;
    rows.push({ userId, walletBalanceEtb: wallet, ledgerEtb: ledger, driftEtb: drift, matches });
  }

  // Sort by absolute drift, biggest first, so the worst offenders surface.
  rows.sort((a, b) => Math.abs(b.driftEtb) - Math.abs(a.driftEtb));

  return {
    wallets: byUser.size,
    reconciled,
    drifted: rows.length - reconciled,
    netDriftEtb: netDrift,
    rows,
  };
}
