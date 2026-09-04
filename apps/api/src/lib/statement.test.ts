import { describe, it, expect } from 'vitest';
import { buildOrderReceipt, buildMonthlyStatement } from './statement.js';

describe('buildOrderReceipt', () => {
  it('produces a self-contained HTML receipt with amounts', () => {
    const { html, filename } = buildOrderReceipt({
      orderNumber: 'ORD-123',
      title: 'Logo design',
      createdAt: '2026-08-15T10:00:00.000Z',
      status: 'COMPLETED',
      clientName: 'Aster',
      sellerName: 'Dawit',
      amountEtb: 5000,
      platformFeeEtb: 500,
      sellerNetEtb: 4500,
      paymentMethod: 'telebirr',
      paymentStatus: 'SUCCESS',
      providerRef: 'txn-1',
    });
    expect(filename).toBe('apex-work-receipt-ORD-123.html');
    expect(html).toContain('Payment receipt');
    expect(html).toContain('ORD-123');
    expect(html).toContain('4,500 ETB');
    expect(html).toContain('txn-1');
    expect(html).toContain('<meta charset="utf-8">');
    // inline styles only — no external references
    expect(html).not.toContain('http');
  });

  it('escapes any HTML in user-supplied strings', () => {
    const { html } = buildOrderReceipt({
      orderNumber: 'O1', title: '<script>alert(1)</script>', createdAt: new Date(),
      status: 'X', clientName: '<b>a</b>', sellerName: 's', amountEtb: 1, platformFeeEtb: 0, sellerNetEtb: 1,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildMonthlyStatement', () => {
  const rows = [
    { date: '2026-08-01T00:00:00.000Z', orderNumber: 'A', clientName: 'C1', amountEtb: 1000, platformFeeEtb: 100, sellerNetEtb: 900 },
    { date: '2026-08-20T00:00:00.000Z', orderNumber: 'B', clientName: 'C2', amountEtb: 2000, platformFeeEtb: 200, sellerNetEtb: 1800 },
  ];

  it('sums gross, fees and net for the month', () => {
    const { summary, filename } = buildMonthlyStatement('2026-08', rows, 'Dawit');
    expect(filename).toBe('apex-work-earnings-2026-08.html');
    expect(summary).toEqual({ month: '2026-08', grossEtb: 3000, feesEtb: 300, netEtb: 2700, orders: 2 });
  });

  it('labels the month and lists each order in a table', () => {
    const { html } = buildMonthlyStatement('2026-08', rows, 'Dawit');
    expect(html).toContain('Monthly earnings statement');
    expect(html).toContain('August 2026');
    expect(html).toContain('2,700 ETB');
    expect(html).toContain('<table');
    expect(html).toContain('C1');
  });

  it('handles an empty month but still totals to zero', () => {
    const { summary, html } = buildMonthlyStatement('2026-08', [], 'Dawit');
    expect(summary).toEqual({ month: '2026-08', grossEtb: 0, feesEtb: 0, netEtb: 0, orders: 0 });
    expect(html).toContain('No completed orders this month');
  });
});
