import { describe, it, expect } from 'vitest';
import { buildLeaderboard, type PerfRow } from './leaderboard.js';

const row = (o: Partial<PerfRow>): PerfRow => ({
  userId: o.userId ?? 'u',
  username: o.username ?? 'u',
  fullName: o.fullName ?? 'User',
  role: o.role ?? 'FREELANCER',
  revenueEtb: o.revenueEtb ?? 0,
  completedOrders: o.completedOrders ?? 0,
  rating: o.rating ?? 0,
  activeGigs: o.activeGigs ?? 0,
  windowRevenueEtb: o.windowRevenueEtb ?? 0,
  windowOrders: o.windowOrders ?? 0,
});

describe('buildLeaderboard', () => {
  it('ranks freelancers and clients independently by revenue', () => {
    const rows = [
      row({ userId: 'f1', role: 'FREELANCER', revenueEtb: 9000 }),
      row({ userId: 'f2', role: 'FREELANCER', revenueEtb: 5000 }),
      row({ userId: 'c1', role: 'CLIENT', revenueEtb: 8000 }),
      row({ userId: 'c2', role: 'CLIENT', revenueEtb: 12000 }),
    ];
    const lb = buildLeaderboard(rows);
    expect(lb.freelancers.map((e) => e.userId)).toEqual(['f1', 'f2']);
    expect(lb.freelancers[0]!.rank).toBe(1);
    expect(lb.clients.map((e) => e.userId)).toEqual(['c2', 'c1']);
  });

  it('caps the list at the limit and sorts by revenue descending', () => {
    const rows = Array.from({ length: 15 }, (_, i) => row({ userId: `f${i}`, role: 'FREELANCER', revenueEtb: i * 100 }));
    const lb = buildLeaderboard(rows, 10);
    expect(lb.freelancers).toHaveLength(10);
    expect(lb.freelancers[0]!.revenueEtb).toBe(1400); // highest revenue
    expect(lb.freelancers[9]!.revenueEtb).toBe(500); // 10th highest
  });

  it('puts a user in risers only if they earned in the window', () => {
    const rows = [
      row({ userId: 'a', revenueEtb: 1000, windowRevenueEtb: 100, windowOrders: 2 }),
      row({ userId: 'b', revenueEtb: 1000, windowRevenueEtb: 0 }), // no window activity
    ];
    const lb = buildLeaderboard(rows);
    expect(lb.risers.map((r) => r.userId)).toEqual(['a']);
    expect(lb.risers[0]!.revenueEtb).toBe(100);
  });

  it('sorts risers by window revenue descending with rank', () => {
    const rows = [
      row({ userId: 'a', windowRevenueEtb: 300, windowOrders: 3 }),
      row({ userId: 'b', windowRevenueEtb: 600, windowOrders: 5 }),
      row({ userId: 'c', windowRevenueEtb: 100, windowOrders: 1 }),
    ];
    const lb = buildLeaderboard(rows);
    expect(lb.risers.map((r) => r.userId)).toEqual(['b', 'a', 'c']);
    expect(lb.risers[0]!.rank).toBe(1);
    expect(lb.risers[0]!.completedOrders).toBe(5);
  });
});
