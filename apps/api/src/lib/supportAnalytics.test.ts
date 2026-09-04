import { describe, it, expect } from 'vitest';
import { buildSupportAnalytics, type SupportTicketInput } from './supportAnalytics.js';

const now = new Date('2026-09-04T00:00:00Z');
const h = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);

function t(partial: Partial<SupportTicketInput>): SupportTicketInput {
  return {
    id: partial.id ?? 't',
    status: partial.status ?? 'OPEN',
    createdAt: partial.createdAt ?? h(2),
    resolvedAt: partial.resolvedAt ?? null,
    firstStaffReplyAt: partial.firstStaffReplyAt ?? null,
    lastStaffId: partial.lastStaffId ?? null,
  };
}

describe('buildSupportAnalytics', () => {
  it('returns zeros for no tickets', () => {
    const s = buildSupportAnalytics([], { now });
    expect(s.openTickets).toBe(0);
    expect(s.breachedOpen).toBe(0);
    expect(s.byAdmin).toEqual([]);
  });

  it('counts open vs resolved and ageing/unattended', () => {
    const s = buildSupportAnalytics([
      t({ status: 'OPEN', createdAt: h(2) }),
      t({ status: 'PENDING', createdAt: h(40), firstStaffReplyAt: h(35) }), // breached (>24h since first reply)
      t({ status: 'OPEN', createdAt: h(5) }), // unattended (no staff reply)
      t({ status: 'RESOLVED', createdAt: h(30), resolvedAt: h(28) }),
    ], { now, slaHours: 24 });
    expect(s.openTickets).toBe(3); // OPEN + PENDING + OPEN
    expect(s.unattendedOpen).toBe(2); // tickets with no staff reply among open
    expect(s.breachedOpen).toBe(1); // the 40h one
  });

  it('computes average first-response time', () => {
    const s = buildSupportAnalytics([
      t({ status: 'RESOLVED', createdAt: h(10), firstStaffReplyAt: h(8) }), // 120 min
      t({ status: 'RESOLVED', createdAt: h(5), firstStaffReplyAt: h(4) }),   // 60 min
    ], { now });
    expect(s.avgTimeToFirstResponseMin).toBe(90);
  });

  it('ranks admins by handled tickets and their avg first-response', () => {
    const s = buildSupportAnalytics([
      t({ id: 'a', status: 'RESOLVED', createdAt: h(6), firstStaffReplyAt: h(4), lastStaffId: 'admin-1' }), // 120 min
      t({ id: 'b', status: 'RESOLVED', createdAt: h(5), firstStaffReplyAt: h(4), lastStaffId: 'admin-1' }), // 60 min
      t({ id: 'c', status: 'RESOLVED', createdAt: h(7), firstStaffReplyAt: h(2), lastStaffId: 'admin-2' }), // 300 min
    ], { now });
    expect(s.byAdmin.map((a) => a.adminId)).toEqual(['admin-1', 'admin-2']);
    expect(s.byAdmin[0]!.handled).toBe(2);
    expect(s.byAdmin[0]!.avgFirstResponseMin).toBe(90);
    expect(s.byAdmin[1]!.avgFirstResponseMin).toBe(300);
  });

  it('does not count PENDING-then-resolved tickets as open', () => {
    const s = buildSupportAnalytics([
      t({ status: 'RESOLVED', resolvedAt: h(1) }),
      t({ status: 'CLOSED', resolvedAt: h(1) }),
    ], { now });
    expect(s.openTickets).toBe(0);
  });
});
