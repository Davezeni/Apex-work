import { describe, it, expect } from 'vitest';
import { buildReconciliation } from './reconcile.js';

describe('buildReconciliation', () => {
  it('reports reconciled wallets when ledger equals balance', () => {
    const s = buildReconciliation(
      [{ userId: 'a', balanceEtb: 100 }],
      [{ userId: 'a', ledgerEtb: 100 }],
    );
    expect(s.wallets).toBe(1);
    expect(s.reconciled).toBe(1);
    expect(s.drifted).toBe(0);
    expect(s.netDriftEtb).toBe(0);
    expect(s.rows[0]!.matches).toBe(true);
    expect(s.rows[0]!.driftEtb).toBe(0);
  });

  it('flags a drift when ledger exceeds wallet', () => {
    const s = buildReconciliation(
      [{ userId: 'a', balanceEtb: 90 }],
      [{ userId: 'a', ledgerEtb: 110 }],
    );
    expect(s.drifted).toBe(1);
    expect(s.rows[0]!.driftEtb).toBe(20);
    expect(s.netDriftEtb).toBe(20);
  });

  it('treats a user present in only one side as drifted', () => {
    const s = buildReconciliation(
      [{ userId: 'a', balanceEtb: 50 }],  // no ledger rows
      [{ userId: 'b', ledgerEtb: 75 }],  // no wallet
    );
    expect(s.wallets).toBe(2);
    expect(s.drifted).toBe(2);
    expect(s.reconciled).toBe(0);
  });

  it('sorts worst drift first and sums net drift', () => {
    const s = buildReconciliation(
      [{ userId: 'a', balanceEtb: 100 }, { userId: 'b', balanceEtb: 50 }, { userId: 'c', balanceEtb: 20 }],
      [{ userId: 'a', ledgerEtb: 100 }, { userId: 'b', ledgerEtb: -50 }, { userId: 'c', ledgerEtb: 75 }],
    );
    expect(s.netDriftEtb).toBe(0 - 100 + 55); // a=0, b=-100, c=+55 => -45
    expect(s.netDriftEtb).toBe(-45);
    // biggest abs drift first: b(-100) then c(+55) then a(0)
    expect(s.rows.map((r) => r.userId)).toEqual(['b', 'c', 'a']);
  });

  it('returns zero summary for no input', () => {
    const s = buildReconciliation([], []);
    expect(s).toEqual({ wallets: 0, reconciled: 0, drifted: 0, netDriftEtb: 0, rows: [] });
  });
});
