import { describe, it, expect } from 'vitest';
import { buildReferralStats, REWARD_RATE } from './referralStats.js';

const row = (o: Partial<{ userId: string; completedOrders: number; spentEtb: number }>) => ({
  userId: o.userId ?? 'u',
  username: 'u',
  fullName: 'User',
  createdAt: new Date('2026-01-01'),
  completedOrders: o.completedOrders ?? 0,
  spentEtb: o.spentEtb ?? 0,
});

describe('buildReferralStats', () => {
  it('returns an empty summary for no referrals', () => {
    const s = buildReferralStats([]);
    expect(s.total).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.active).toBe(0);
    expect(s.commissionEtb).toBe(0);
    expect(s.topBySpend).toBeNull();
  });

  it('classifies pending vs active and sums attributed GMV', () => {
    const s = buildReferralStats([
      row({ completedOrders: 2, spentEtb: 3000 }),
      row({ completedOrders: 0, spentEtb: 0 }),
      row({ completedOrders: 1, spentEtb: 7000 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.pending).toBe(1);
    expect(s.attributedGmvEtb).toBe(10000);
    expect(s.commissionEtb).toBe(Math.round(10000 * REWARD_RATE));
  });

  it('computes commission from the configured reward rate', () => {
    const s = buildReferralStats([row({ completedOrders: 1, spentEtb: 4000 })], 0.10);
    expect(s.commissionEtb).toBe(400);
  });

  it('picks the highest-spending referral (null when none spent)', () => {
    const s = buildReferralStats([
      row({ completedOrders: 1, spentEtb: 2000 }),
      row({ completedOrders: 2, spentEtb: 9000 }),
    ]);
    expect(s.topBySpend?.spentEtb).toBe(9000);
    expect(s.topBySpend?.username).toBe('u');

    const none = buildReferralStats([row({ completedOrders: 0, spentEtb: 0 })]);
    expect(none.topBySpend).toBeNull();
  });
});
