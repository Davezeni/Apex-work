import { describe, it, expect } from 'vitest';
import { buildSubscriptionStats } from './subscriptionAnalytics.js';

const row = (plan: string, status: string, amountEtb: number, daysAgo: number, now: Date) => ({
  plan,
  status,
  amountEtb,
  createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
});

describe('buildSubscriptionStats', () => {
  it('returns zeros when no paid subscriptions exist', () => {
    const s = buildSubscriptionStats([]);
    expect(s.activeSubscribers).toBe(0);
    expect(s.totalRevenueEtb).toBe(0);
    expect(s.avgPriceEtb).toBe(0);
    expect(s.byPlan).toEqual([]);
    expect(s.topPlan).toBeNull();
  });

  it('counts active subscribers and sums active/total revenue', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const rows = [
      row('FREELANCER_PRO', 'ACTIVE', 500, 5, now),
      row('CLIENT_PRO', 'ACTIVE', 800, 10, now),
      row('FREELANCER_PRO', 'EXPIRED', 500, 60, now),
      row('CLIENT_PRO', 'PENDING', 800, 1, now), // pending excluded
    ];
    const s = buildSubscriptionStats(rows, 30, now);
    expect(s.activeSubscribers).toBe(2);
    expect(s.activeRevenueEtb).toBe(1300);
    expect(s.totalRevenueEtb).toBe(1800); // 500+800+500 (pending excluded)
    expect(s.lastWindowRevenueEtb).toBe(1300); // 500+800 within 30d
    expect(s.lastWindowPurchases).toBe(2);
    expect(s.avgPriceEtb).toBe(600); // 1800/3
  });

  it('breaks revenue down by plan and ranks top plan', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const rows = [
      row('FREELANCER_PRO', 'ACTIVE', 500, 5, now),
      row('FREELANCER_PRO', 'ACTIVE', 500, 6, now),
      row('CLIENT_PRO', 'ACTIVE', 800, 7, now),
    ];
    const s = buildSubscriptionStats(rows);
    expect(s.byPlan.map((p) => p.plan)).toEqual(['FREELANCER_PRO', 'CLIENT_PRO']);
    expect(s.byPlan[0]!.revenueEtb).toBe(1000);
    expect(s.byPlan[1]!.revenueEtb).toBe(800);
    expect(s.topPlan?.plan).toBe('FREELANCER_PRO');
    expect(s.byPlan.reduce((a, p) => a + p.sharePct, 0)).toBe(100);
  });

  it('ignores PENDING rows entirely', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const rows = [row('CLIENT_PRO', 'PENDING', 800, 1, now)];
    const s = buildSubscriptionStats(rows);
    expect(s.totalRevenueEtb).toBe(0);
    expect(s.byPlan).toEqual([]);
  });
});
