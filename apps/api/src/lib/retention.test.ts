import { describe, it, expect } from 'vitest';
import { buildRetention, type RetentionUserRow } from './retention.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-04T00:00:00.000Z');
const user = (o: Partial<RetentionUserRow>): RetentionUserRow => ({
  signupAt: o.signupAt ?? new Date(NOW),
  firstOrderAt: o.firstOrderAt ?? null,
  lastOrderAt: o.lastOrderAt ?? null,
  orderCount: o.orderCount ?? 0,
});

describe('buildRetention', () => {
  it('computes D7/D14/D30 activation from first-order timing', () => {
    const rows = [
      user({ signupAt: new Date(NOW - 20 * DAY), firstOrderAt: new Date(NOW - 18 * DAY) }), // 2d → d7
      user({ signupAt: new Date(NOW - 20 * DAY), firstOrderAt: new Date(NOW - 9 * DAY) }),   // 11d → d14, not d7
      user({ signupAt: new Date(NOW - 20 * DAY), firstOrderAt: new Date(NOW - 0 * DAY) }),   // 20d → d30
      user({ signupAt: new Date(NOW - 20 * DAY), firstOrderAt: null }),                       // not activated
    ];
    const s = buildRetention(rows, { now: new Date(NOW), windowDays: 60 });
    expect(s.totalNewUsers).toBe(4);
    expect(s.activated).toBe(3);
    expect(s.activationRate).toBeCloseTo(0.75);
    expect(s.d7).toBeCloseTo(1 / 4);
    expect(s.d14).toBeCloseTo(2 / 4);
    expect(s.d30).toBeCloseTo(3 / 4);
  });

  it('computes churn from last order recency among users with orders', () => {
    const rows = [
      user({ firstOrderAt: new Date(NOW - 3 * DAY), lastOrderAt: new Date(NOW - 3 * DAY), orderCount: 2 }), // active
      user({ firstOrderAt: new Date(NOW - 60 * DAY), lastOrderAt: new Date(NOW - 40 * DAY), orderCount: 1 }), // inactive
    ];
    const s = buildRetention(rows, { now: new Date(NOW), windowDays: 30 });
    expect(s.activeUsers).toBe(1);
    expect(s.inactiveUsers).toBe(1);
    expect(s.churnRate).toBeCloseTo(0.5);
  });

  it('only counts cohorts that signed up inside the window', () => {
    const rows = [
      user({ signupAt: new Date(NOW - 5 * DAY), firstOrderAt: new Date(NOW - 4 * DAY) }),
      user({ signupAt: new Date(NOW - 100 * DAY), firstOrderAt: new Date(NOW - 90 * DAY) }), // outside window
    ];
    const s = buildRetention(rows, { now: new Date(NOW), windowDays: 30 });
    expect(s.totalNewUsers).toBe(1);
  });

  it('reports weekly activation cohorts sorted by week', () => {
    const rows = [
      user({ signupAt: new Date(NOW - 5 * DAY), firstOrderAt: new Date(NOW - 4 * DAY) }),
      user({ signupAt: new Date(NOW - 12 * DAY), firstOrderAt: new Date(NOW - 11 * DAY) }),
      user({ signupAt: new Date(NOW - 12 * DAY), firstOrderAt: null }),
    ];
    const s = buildRetention(rows, { now: new Date(NOW), windowDays: 30 });
    expect(s.weeklyCohorts.length).toBeGreaterThanOrEqual(2);
    expect(s.weeklyCohorts[0]!.week <= s.weeklyCohorts[s.weeklyCohorts.length - 1]!.week).toBe(true);
  });
});
