import { describe, it, expect } from 'vitest';
import { buildOrderHealth, classifyOrder, type OrderHealthCandidate, type OrderHealthOptions } from './orderHealth.js';

const DAY = 24 * 60 * 60 * 1000;

const cand = (o: Partial<OrderHealthCandidate> & { status: string }): OrderHealthCandidate => ({
  orderId: o.orderId ?? 'o',
  orderNumber: o.orderNumber ?? 'ORD-1',
  title: o.title ?? 'Task',
  status: o.status,
  amountEtb: o.amountEtb ?? 100,
  clientId: o.clientId ?? 'c1',
  clientName: o.clientName ?? 'Client',
  sellerId: o.sellerId ?? 's1',
  sellerName: o.sellerName ?? 'Seller',
  createdAt: o.createdAt ?? new Date(Date.now() - 10 * DAY),
  updatedAt: o.updatedAt ?? new Date(Date.now() - DAY),
  deadline: o.deadline ?? null,
  deliveredAt: o.deliveredAt ?? null,
  disputeStatus: o.disputeStatus ?? null,
  disputeCreatedAt: o.disputeCreatedAt ?? null,
});

describe('classifyOrder', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');
  const baseOpts: Required<OrderHealthOptions> = {
    now, staleReview: 3, staleDelivery: 5, staleDispute: 3, abandonedOrder: 2,
  };

  it('flags an ACTIVE order whose deadline has passed as high/overdue', () => {
    const item = classifyOrder(cand({ status: 'ACTIVE', deadline: new Date(now.getTime() - 2 * DAY) }), now, baseOpts);
    expect(item?.category).toBe('OVERDUE_DELIVERY');
    expect(item?.severity).toBe('high');
    expect(item?.ageDays).toBe(2);
  });

  it('does NOT flag an ACTIVE order with a future deadline', () => {
    const item = classifyOrder(cand({ status: 'ACTIVE', deadline: new Date(now.getTime() + DAY) }), now, baseOpts);
    expect(item).toBeNull();
  });

  it('flags an open dispute older than the threshold as high', () => {
    const item = classifyOrder(
      cand({ status: 'DISPUTED', disputeStatus: 'OPEN', disputeCreatedAt: new Date(now.getTime() - 6 * DAY) }),
      now, baseOpts,
    );
    expect(item?.category).toBe('STALE_DISPUTE');
    expect(item?.severity).toBe('high');
  });

  it('does not flag a resolved dispute', () => {
    const item = classifyOrder(
      cand({ status: 'DISPUTED', disputeStatus: 'RESOLVED_SPLIT', disputeCreatedAt: new Date(now.getTime() - 20 * DAY) }),
      now, baseOpts,
    );
    expect(item).toBeNull();
  });

  it('flags a stale review and a stale delivery as medium', () => {
    const rev = classifyOrder(cand({ status: 'IN_REVIEW', deliveredAt: new Date(now.getTime() - 4 * DAY) }), now, baseOpts);
    expect(rev?.category).toBe('STALE_REVIEW');
    expect(rev?.severity).toBe('medium');
    const un = classifyOrder(cand({ status: 'DELIVERED', deliveredAt: new Date(now.getTime() - 6 * DAY) }), now, baseOpts);
    expect(un?.category).toBe('UNRESOLVED_ORDER');
    expect(un?.severity).toBe('medium');
  });

  it('flags an abandoned PENDING order as low', () => {
    const item = classifyOrder(cand({ status: 'PENDING', createdAt: new Date(now.getTime() - 5 * DAY) }), now, baseOpts);
    expect(item?.category).toBe('ABANDONED_ORDER');
    expect(item?.severity).toBe('low');
  });
});

describe('buildOrderHealth', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('sorts the inbox by severity then age and returns counts', () => {
    const items = [
      cand({ orderId: 'a', status: 'ACTIVE', deadline: new Date(now.getTime() - DAY) }),
      cand({ orderId: 'b', status: 'PENDING', createdAt: new Date(now.getTime() - 3 * DAY) }),
      cand({ orderId: 'c', status: 'IN_REVIEW', deliveredAt: new Date(now.getTime() - 4 * DAY) }),
      cand({ orderId: 'd', status: 'COMPLETED' }),
    ];
    const s = buildOrderHealth(items, { now });
    expect(s.total).toBe(3);
    expect(s.high).toBe(1);
    expect(s.medium).toBe(1);
    expect(s.low).toBe(1);
    expect(s.inbox[0]?.orderId).toBe('a'); // high first
    expect(s.counts.OVERDUE_DELIVERY).toBe(1);
    expect(s.counts.ABANDONED_ORDER).toBe(1);
  });

  it('produces a digest mentioning the top high-priority item', () => {
    const items = [
      cand({ orderNumber: 'ORD-9', status: 'ACTIVE', deadline: new Date(now.getTime() - 2 * DAY) }),
    ];
    const s = buildOrderHealth(items, { now });
    expect(s.digest).toContain('ORD-9');
    expect(s.digest).toContain('Overdue');
    expect(s.digestHtml).toContain('<table>');
  });

  it('returns an empty summary when nothing needs attention', () => {
    const s = buildOrderHealth([cand({ status: 'COMPLETED' }), cand({ status: 'ACTIVE', deadline: new Date(now.getTime() + 99 * DAY) })], { now });
    expect(s.total).toBe(0);
    expect(s.inbox).toEqual([]);
    expect(s.digest).toContain('0 order(s)');
  });
});
