import { describe, it, expect } from 'vitest';
import { buildHealthScore, type HealthInput } from './healthScore.js';

const base: HealthInput = {
  activationRate: 0.5, churnRate: 0.3, disputeRate: 0.05, overdueRate: 0.1,
  slaBreachRate: 0.2, activeLiquidity: 0.7, avgRating: 4.5,
};

describe('buildHealthScore', () => {
  it('returns a healthy score for a strong marketplace', () => {
    const h = buildHealthScore({ ...base, activationRate: 0.8, churnRate: 0.05, disputeRate: 0.01, overdueRate: 0.02, slaBreachRate: 0.05, avgRating: 4.8 });
    expect(h.score).toBeGreaterThanOrEqual(80);
    expect(h.status).toBe('healthy');
    expect(['A', 'B']).toContain(h.grade);
  });

  it('flags a critical score when everything is bad', () => {
    const h = buildHealthScore({ activationRate: 0.05, churnRate: 0.9, disputeRate: 0.6, overdueRate: 0.8, slaBreachRate: 0.9, activeLiquidity: 0.1, avgRating: 2.0 });
    expect(h.score).toBeLessThan(45);
    expect(h.status).toBe('critical');
  });

  it('clamps each component as a 0-100 score and sums by weight', () => {
    const h = buildHealthScore(base);
    expect(h.components).toHaveLength(7);
    for (const c of h.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
    // activationRate 0.5 → 50
    expect(h.components.find((c) => c.key === 'activationRate')!.score).toBe(50);
    // churn 0.3 → 100 - 24 = 76
    expect(h.components.find((c) => c.key === 'churnRate')!.score).toBe(76);
  });

  it('maps score to grade and status consistently', () => {
    expect(buildHealthScore({ ...base, avgRating: 5 }).grade).toBe('B');
    const good = buildHealthScore({ ...base, activationRate: 0.9, churnRate: 0.0, disputeRate: 0.0, overdueRate: 0.0, slaBreachRate: 0.0, activeLiquidity: 1.0, avgRating: 5 });
    expect(good.grade).toBe('A');
  });
});
