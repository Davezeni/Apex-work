import { describe, it, expect } from 'vitest';
import { scoreWatchlistUser, rankWatchlist, type FraudAggregate } from './fraudWatch.js';

const u = (o: Partial<FraudAggregate>): FraudAggregate => ({
  userId: o.userId ?? 'u', username: o.username ?? 'u', fullName: o.fullName ?? 'User', role: o.role ?? 'FREELANCER',
  newOrders: o.newOrders ?? 0, completedOrders: o.completedOrders ?? 0, disputedOrders: o.disputedOrders ?? 0,
  cancelledOrders: o.cancelledOrders ?? 0, withdrawnAmountEtb: o.withdrawnAmountEtb ?? 0, withdrawalsCount: o.withdrawalsCount ?? 0,
  reviewsWritten: o.reviewsWritten ?? 0, accountAgeDays: o.accountAgeDays ?? 999,
});

describe('scoreWatchlistUser', () => {
  it('flags a young account with high order volume as high priority', () => {
    const w = scoreWatchlistUser(u({ accountAgeDays: 3, newOrders: 8 }));
    expect(w.priority).toBe('high');
    expect(w.reasons.join(' ')).toContain('New account');
  });

  it('flags high dispute rate as high', () => {
    const w = scoreWatchlistUser(u({ accountAgeDays: 60, newOrders: 10, disputedOrders: 4, completedOrders: 6 }));
    expect(w.priority).toBe('high');
    expect(w.reasons.join(' ')).toContain('dispute rate');
    expect(w.disputeRate).toBeCloseTo(4 / 10);
  });

  it('flags early withdrawals as medium and cancellation churn as low/medium', () => {
    const w = scoreWatchlistUser(u({ accountAgeDays: 20, withdrawalsCount: 3, withdrawnAmountEtb: 5000 }));
    expect(w.priority).toBe('medium');
  });

  it('clears a normal user', () => {
    const w = scoreWatchlistUser(u({ accountAgeDays: 400, newOrders: 3, completedOrders: 3 }));
    expect(w.priority).toBe('clear');
    expect(w.score).toBe(0);
  });
});

describe('rankWatchlist', () => {
  it('returns only non-clear users sorted by priority then score', () => {
    const rows = [
      u({ userId: 'a', accountAgeDays: 2, newOrders: 9 }),      // high
      u({ userId: 'b', accountAgeDays: 20, withdrawalsCount: 2, withdrawnAmountEtb: 3000 }), // medium
      u({ userId: 'c', accountAgeDays: 400, newOrders: 2, completedOrders: 2 }), // clear → excluded
    ];
    const ranked = rankWatchlist(rows);
    expect(ranked.map((r) => r.userId)).toEqual(['a', 'b']);
  });
});
