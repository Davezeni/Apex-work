import { describe, it, expect } from 'vitest';
import { buildConversionInsights, type FreelancerRow, type GigRow } from './conversionInsights.js';

const gig = (o: Partial<GigRow>): GigRow => ({
  gigId: o.gigId ?? 'g',
  title: o.title ?? 'Gig',
  status: o.status ?? 'ACTIVE',
  views: o.views ?? 0,
  orders: o.orders ?? 0,
  completed: o.completed ?? 0,
  cancelled: o.cancelled ?? 0,
  revenueEtb: o.revenueEtb ?? 0,
  startingPriceEtb: o.startingPriceEtb ?? 0,
  rating: o.rating ?? 0,
  createdAt: o.createdAt ?? null,
});

const fl = (o: Partial<FreelancerRow>): FreelancerRow => ({
  userId: o.userId ?? 'u',
  username: o.username ?? 'u',
  fullName: o.fullName ?? 'User',
  rating: o.rating ?? 0,
  gigs: o.gigs ?? [],
});

describe('buildConversionInsights', () => {
  it('computes view→order conversion and order-completion win rate', () => {
    const rows = [
      fl({ userId: 'f1', gigs: [gig({ gigId: 'g1', views: 100, orders: 10, completed: 8, revenueEtb: 800 })] }),
    ];
    const ins = buildConversionInsights(rows);
    expect(ins.freelancers[0]!.conversionRate).toBeCloseTo(0.1); // 10/100
    expect(ins.freelancers[0]!.winRate).toBeCloseTo(0.8); // 8/10
    expect(ins.freelancers[0]!.conversionPerMille).toBe(100);
    expect(ins.funnel).toEqual({ views: 100, orders: 10, completed: 8 });
  });

  it('is conservative when there are no views or no orders', () => {
    const rows = [
      fl({ userId: 'f1', gigs: [gig({ views: 0, orders: 5, completed: 3 })] }),
      fl({ userId: 'f2', gigs: [gig({ views: 100, orders: 0, completed: 0 })] }),
      fl({ userId: 'f3', gigs: [] }), // no gigs — filtered out
    ];
    const ins = buildConversionInsights(rows);
    expect(ins.freelancers.map((f) => f.userId)).toEqual(['f1', 'f2']);
    expect(ins.freelancers.find((f) => f.userId === 'f1')!.conversionRate).toBe(0);
    expect(ins.freelancers.find((f) => f.userId === 'f2')!.winRate).toBe(0);
  });

  it('ranks freelancers by win rate then conversion then revenue', () => {
    const rows = [
      fl({ userId: 'a', gigs: [gig({ views: 100, orders: 10, completed: 9, revenueEtb: 900 })] }), // 0.9 win
      fl({ userId: 'b', gigs: [gig({ views: 100, orders: 10, completed: 8, revenueEtb: 800 })] }), // 0.8 win
      fl({ userId: 'c', gigs: [gig({ views: 100, orders: 10, completed: 8, revenueEtb: 2000 })] }), // 0.8 win, more revenue
    ];
    const ins = buildConversionInsights(rows);
    expect(ins.freelancers.map((f) => f.userId)).toEqual(['a', 'c', 'b']);
    expect(ins.freelancers[0]!.percentileRank).toBe(33); // 1/3 → 33 (rounded)
  });

  it('caps gig lists at limit and enforces min orders on conversion ranking', () => {
    const gigs = Array.from({ length: 20 }, (_, i) => gig({ gigId: `g${i}`, views: 100, orders: i, completed: i, revenueEtb: i * 10 }));
    const rows = [fl({ gigs })];
    const ins = buildConversionInsights(rows, 5, 3);
    expect(ins.topByViews).toHaveLength(5);
    // Only gigs with orders >= minOrders(3) are ranked by conversion; all have equal conversion here.
    expect(ins.topByConversion).toHaveLength(5);
    // gig with the most orders (and revenue) tops revenue ranking
    expect(ins.topByRevenue[0]!.gigId).toBe('g19');
  });

  it('returns empty insights when no freelancers have gigs', () => {
    const ins = buildConversionInsights([]);
    expect(ins.freelancers).toEqual([]);
    expect(ins.funnel).toEqual({ views: 0, orders: 0, completed: 0 });
    expect(ins.avgWinRate).toBe(0);
  });
});
