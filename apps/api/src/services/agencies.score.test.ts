import { describe, expect, it } from 'vitest';
import { computeAgencyScore, type ScoreOrderRow, type ScoreReviewRow } from './agencies.service.js';

const order = (over: Partial<ScoreOrderRow> = {}): ScoreOrderRow => ({
  status: 'COMPLETED',
  deadline: new Date('2026-01-10'),
  deliveredAt: new Date('2026-01-08'),
  clientId: 'c1',
  ...over,
});
const review = (rating: number): ScoreReviewRow => ({ rating, hiddenAt: null });

describe('computeAgencyScore', () => {
  it('is honest when there is no history', () => {
    const score = computeAgencyScore([], []);
    expect(score.completedOrders).toBe(0);
    expect(score.avgRating).toBe(0);
    expect(score.badge).toBe('NONE');
  });

  it('computes on-time %, rating, repeat clients', () => {
    const orders = [
      order({ clientId: 'c1' }),
      order({ clientId: 'c1' }),
      order({ clientId: 'c2', deliveredAt: new Date('2026-02-20') }), // late (deadline 10th)
    ];
    const score = computeAgencyScore(orders, [
      review(5),
      review(4),
      { rating: 1, hiddenAt: new Date() },
    ]);
    expect(score.completedOrders).toBe(3);
    expect(score.onTimePct).toBe(67); // 2 of 3 on time
    expect(score.avgRating).toBe(4.5); // hidden review ignored
    expect(score.repeatClientPct).toBe(50); // c1 ordered twice of 2 clients
    expect(score.badge).toBe('RISING'); // <10 completed, rating >= 4.5
  });

  it('awards TOP only with volume + quality + reliability', () => {
    const orders = Array.from({ length: 12 }, (_, i) =>
      order({ clientId: `c${i}`, deliveredAt: new Date('2026-01-05') }),
    );
    const score = computeAgencyScore(
      orders,
      Array.from({ length: 12 }, () => review(5)),
    );
    expect(score.badge).toBe('TOP');
  });

  it('withholds TOP when delivery is unreliable', () => {
    const orders = Array.from(
      { length: 12 },
      (_, i) => order({ clientId: `c${i}`, deliveredAt: new Date('2026-03-01') }), // all late
    );
    const score = computeAgencyScore(
      orders,
      Array.from({ length: 12 }, () => review(5)),
    );
    expect(score.onTimePct).toBe(0);
    expect(score.badge).toBe('NONE');
  });
});
