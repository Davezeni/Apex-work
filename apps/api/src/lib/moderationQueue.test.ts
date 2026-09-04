import { describe, it, expect } from 'vitest';
import { buildQueueSummary, canBulkResolve, type QueueItem } from './moderationQueue.js';

const item = (o: Partial<QueueItem>): QueueItem => ({
  id: o.id ?? 'x',
  title: o.title ?? 'Gig',
  flaggedReason: o.flaggedReason ?? null,
  status: o.status ?? 'QUEUED',
  assignee: o.assignee ?? null,
  createdAt: o.createdAt ?? new Date('2026-01-01'),
  updatedAt: o.updatedAt ?? new Date('2026-01-01'),
  viewsCount: o.viewsCount ?? 0,
  ordersCount: o.ordersCount ?? 0,
});

describe('buildQueueSummary', () => {
  it('counts each status bucket', () => {
    const s = buildQueueSummary([
      item({ status: 'QUEUED' }),
      item({ status: 'QUEUED' }),
      item({ status: 'IN_REVIEW' }),
      item({ status: 'RESOLVED' }),
      item({ status: 'DISMISSED' }),
    ]);
    expect(s.queued).toBe(2);
    expect(s.inReview).toBe(1);
    expect(s.resolved).toBe(1);
    expect(s.dismissed).toBe(1);
    expect(s.total).toBe(5);
  });

  it('returns empty summary for no items', () => {
    const s = buildQueueSummary([]);
    expect(s.total).toBe(0);
    expect(s.open).toEqual([]);
  });

  it('orders open items oldest-updated first', () => {
    const s = buildQueueSummary([
      item({ id: 'new', updatedAt: new Date('2026-03-01') }),
      item({ id: 'old', updatedAt: new Date('2026-01-01') }),
      item({ id: 'resolved', status: 'RESOLVED', updatedAt: new Date('2026-01-01') }),
    ]);
    expect(s.open.map((i) => i.id)).toEqual(['old', 'new']);
  });
});

describe('canBulkResolve', () => {
  it('allows bulk move only when all items are actionable', () => {
    expect(canBulkResolve([item({ status: 'QUEUED' }), item({ status: 'IN_REVIEW' })], 'RESOLVED')).toBe(true);
    expect(canBulkResolve([item({ status: 'QUEUED' })], 'DISMISSED')).toBe(true);
    expect(canBulkResolve([item({ status: 'QUEUED' }), item({ status: 'RESOLVED' })], 'RESOLVED')).toBe(false);
    expect(canBulkResolve([], 'RESOLVED')).toBe(false);
  });

  it('rejects empty and mixed sets even for valid targets', () => {
    expect(canBulkResolve([], 'RESOLVED')).toBe(false);
    expect(canBulkResolve([item({ status: 'RESOLVED' })], 'DISMISSED')).toBe(false);
    expect(canBulkResolve([item({ status: 'QUEUED' }), item({ status: 'RESOLVED' })], 'RESOLVED')).toBe(false);
  });
});
