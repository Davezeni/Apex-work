import { describe, it, expect } from 'vitest';
import { buildProRoi, type ProSubscriberRow } from './proRoi.js';

const sub = (o: Partial<ProSubscriberRow>): ProSubscriberRow => ({
  userId: o.userId ?? 'u',
  username: o.username ?? 'u',
  fullName: o.fullName ?? 'User',
  role: o.role ?? 'FREELANCER',
  costEtb: o.costEtb ?? 0,
  valueEtb: o.valueEtb ?? 0,
  purchases: o.purchases ?? 1,
  lastStatus: o.lastStatus ?? 'ACTIVE',
});

describe('buildProRoi', () => {
  it('computes cohort ROI, net and average per-subscriber ROI', () => {
    const rows = [
      sub({ userId: 'a', costEtb: 500, valueEtb: 2000 }),
      sub({ userId: 'b', costEtb: 500, valueEtb: 300 }),
      sub({ userId: 'c', costEtb: 500, valueEtb: 500, purchases: 2 }),
    ];
    const roi = buildProRoi(rows);
    expect(roi.subscribers).toBe(3);
    expect(roi.totalCostEtb).toBe(1500);
    expect(roi.totalValueEtb).toBe(2800);
    expect(roi.netEtb).toBe(1300);
    expect(roi.roiMultiple).toBeCloseTo(2800 / 1500);
    expect(roi.avgRoi).toBeCloseTo((4 + 0.6 + 1) / 3);
    expect(roi.profitableCount).toBe(1); // only 'a' nets positive (c breaks even)
    expect(roi.profitablePct).toBeCloseTo(1 / 3);
    expect(roi.repurchaseRate).toBeCloseTo(1 / 3);
  });

  it('ranks top and worst ROI', () => {
    const rows = [
      sub({ userId: 'best', costEtb: 100, valueEtb: 5000 }),
      sub({ userId: 'mid', costEtb: 100, valueEtb: 100 }),
      sub({ userId: 'worst', costEtb: 100, valueEtb: 10 }),
    ];
    const roi = buildProRoi(rows, 2);
    expect(roi.topRoi[0]?.userId).toBe('best');
    expect(roi.topRoi[1]?.userId).toBe('mid'); // capped at limit 2
    expect(roi.worstRoi[0]?.userId).toBe('worst'); // lowest ROI first
  });

  it('handles rows with zero cost and an empty cohort', () => {
    expect(buildProRoi([]).roiMultiple).toBe(0);
    const zero = buildProRoi([sub({ costEtb: 0, valueEtb: 0 })]);
    expect(zero.subscribers).toBe(0); // filtered out (cost === 0)
    expect(zero.totalCostEtb).toBe(0);
  });

  it('ignores zero-cost users in top/worst and avgRoi', () => {
    const rows = [
      sub({ userId: 'free', costEtb: 0, valueEtb: 9999 }),
      sub({ userId: 'paid', costEtb: 100, valueEtb: 200 }),
    ];
    const roi = buildProRoi(rows);
    expect(roi.subscribers).toBe(1);
    expect(roi.topRoi.map((r) => r.userId)).toEqual(['paid']);
  });
});
