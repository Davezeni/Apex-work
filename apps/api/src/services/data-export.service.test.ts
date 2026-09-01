import { describe, it, expect } from 'vitest';
import { buildExportPayload } from './data-export.service.js';

const base = {
  user: { id: 'u1', username: 'dev', fullName: 'Dev D', email: 'd@x.com', phone: '2519', role: 'FREELANCER', createdAt: new Date('2026-01-01') },
  gigs: [],
  jobs: [],
  orders: [],
  reviewsGiven: [],
  reviewsReceived: [],
  conversationCount: 0,
};

describe('buildExportPayload', () => {
  it('renders the user block and ISO dates', () => {
    const p = buildExportPayload(base);
    expect(p.user.username).toBe('dev');
    expect(p.user.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.counts).toEqual({ gigs: 0, jobs: 0, orders: 0, reviews: 0, conversations: 0 });
  });

  it('counts and flattens gigs, jobs and both review directions', () => {
    const p = buildExportPayload({
      ...base,
      gigs: [{ id: 'g1', title: 'Logo', status: 'ACTIVE', priceEtb: 1000, createdAt: new Date('2026-02-01') }],
      jobs: [{ id: 'j1', title: 'Build site', isOpen: true, budgetEtb: 5000, createdAt: new Date('2026-03-01') }],
      reviewsGiven: [{ id: 'r1', rating: 5, comment: 'great', createdAt: new Date('2026-04-01') }],
      reviewsReceived: [{ id: 'r2', rating: 4, comment: 'ok', createdAt: new Date('2026-04-02') }],
    });
    expect(p.counts.gigs).toBe(1);
    expect(p.counts.jobs).toBe(1);
    expect(p.counts.reviews).toBe(2);
    expect(p.reviews.some((r) => r.direction === 'given' && r.id === 'r1')).toBe(true);
    expect(p.reviews.some((r) => r.direction === 'received' && r.id === 'r2')).toBe(true);
  });

  it('maps client vs seller orders with the other party', () => {
    const other = { id: 'x', username: 'other', fullName: 'Other' };
    const p = buildExportPayload({
      ...base,
      orders: [
        { id: 'o1', title: 'Design', status: 'COMPLETED', amountEtb: 2000, createdAt: new Date('2026-05-01'), otherParty: other, role: 'client' },
        { id: 'o2', title: 'Code', status: 'ACTIVE', amountEtb: 3000, createdAt: new Date('2026-05-02'), otherParty: other, role: 'seller' },
      ],
    });
    expect(p.counts.orders).toBe(2);
    expect(p.orders[0]!.role).toBe('client');
    expect(p.orders[1]!.role).toBe('seller');
    expect(p.orders[0]!.otherParty?.username).toBe('other');
  });

  it('never leaks internal fields into the export', () => {
    const p = buildExportPayload(base);
    expect('passwordHash' in p.user).toBe(false);
    expect(Object.keys(p.user).sort()).toEqual(['createdAt', 'email', 'fullName', 'id', 'phone', 'role', 'username']);
  });
});
