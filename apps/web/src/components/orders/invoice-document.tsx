'use client';

import { dt } from '@/i18n/auto';
import type { OrderDetail } from '@/hooks/use-orders';
import { formatEtb } from '@/lib/utils';

/**
 * Ethiopian tax context (displayed on the document, informational):
 *  - VAT standard rate: 15%
 *  - Withholding on services: 2%
 * Rows are labelled "where applicable" — Apex-Work does not remit these on
 * behalf of users; the document gives both parties the figures they need for
 * their own filings.
 */
const VAT_RATE = 0.15;
const WHT_RATE = 0.02;

/** Deterministic, human-readable invoice number: APX-2026-<orderNumber>. */
export function invoiceNumber(orderNumber: string): string {
  const year = new Date().getFullYear();
  return `APX-${year}-${orderNumber
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-8)
    .toUpperCase()}`;
}

/** CSV export for accountants — same figures as the printed document. */
export function invoiceCsv(order: OrderDetail, isSeller: boolean): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ['Field', 'Value'],
    ['Invoice number', invoiceNumber(order.orderNumber)],
    ['Order', order.orderNumber],
    ['Title', order.title],
    ['Status', order.status],
    ['Issued', new Date(order.createdAt).toISOString().slice(0, 10)],
    ['Client', order.client.fullName],
    ['Freelancer', order.seller.fullName],
  ];
  const ms = order.milestones ?? [];
  if (ms.length > 1) {
    rows.push(['', '']);
    rows.push(['Milestones', 'Amount (ETB)']);
    for (const m of ms) rows.push([m.title, m.amountEtb]);
  }
  rows.push(['', '']);
  rows.push(['Order total (ETB)', order.amountEtb]);
  rows.push(['VAT 15% where applicable (ETB)', Math.round(order.amountEtb * VAT_RATE)]);
  rows.push(['Withholding 2% where applicable (ETB)', Math.round(order.amountEtb * WHT_RATE)]);
  if (isSeller) {
    rows.push(['Platform fee (ETB)', order.platformFeeEtb]);
    rows.push(['Seller net (ETB)', order.sellerNetEtb]);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function InvoiceDocument({ order, isSeller }: { order: OrderDetail; isSeller: boolean }) {
  const payment = order.payments[0];
  const ms = order.milestones ?? [];
  const multiMilestone = ms.length > 1;
  const vat = Math.round(order.amountEtb * VAT_RATE);
  const wht = Math.round(order.amountEtb * WHT_RATE);
  const isCompleted = order.status === 'COMPLETED' || order.status === 'DELIVERED';

  return (
    <article
      className="invoice-export-document bg-white p-10 font-sans text-black"
      style={{ width: '794px', minHeight: '1123px' }}
    >
      <header className="flex items-start justify-between border-b-2 border-violet-600 pb-6">
        <div>
          <div className="text-2xl font-black tracking-tight text-violet-700">
            {dt('APEX-WORK')}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {dt("Ethiopia's freelance marketplace")}
          </div>
          <div className="mt-3 text-[10px] text-neutral-400">TIN: __________________</div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-extrabold">
            {isSeller
              ? dt('Earnings invoice')
              : isCompleted
                ? dt('Payment invoice')
                : dt('Payment receipt')}
          </h1>
          <p className="mt-1 text-xs font-semibold text-neutral-600">
            {invoiceNumber(order.orderNumber)}
          </p>
          <p className="text-xs text-neutral-500">
            {dt('Order')} #{order.orderNumber}
          </p>
          <p className="text-xs text-neutral-500">
            {dt('Issued')}: {new Date(order.createdAt).toLocaleDateString()}
          </p>
          {(order.completedAt || order.deliveredAt) && (
            <p className="text-xs text-neutral-500">
              {dt('Completed')}:{' '}
              {new Date(order.completedAt ?? order.deliveredAt ?? '').toLocaleDateString()}
            </p>
          )}
        </div>
      </header>
      <section className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            {dt('Billed to (client)')}
          </div>
          <div className="mt-2 font-bold">{order.client.fullName}</div>
          <div className="text-xs text-neutral-500">@{order.client.username}</div>
          <div className="mt-2 text-[10px] text-neutral-400">TIN: __________________</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            {dt('Provided by (freelancer)')}
          </div>
          <div className="mt-2 font-bold">{order.seller.fullName}</div>
          <div className="text-xs text-neutral-500">@{order.seller.username}</div>
          <div className="mt-2 text-[10px] text-neutral-400">TIN: __________________</div>
        </div>
      </section>
      <section className="mt-8 flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2 text-xs">
        <span className="text-neutral-500">{dt('Status')}</span>
        <span className="font-bold text-emerald-600">{order.status}</span>
        <span className="text-neutral-500">
          {payment?.provider ?? dt('Apex-Work escrow')}
          {payment?.method ? ` · ${payment.method}` : ''}
        </span>
      </section>
      <section className="mt-10 overflow-hidden rounded-xl border border-neutral-200">
        <div className="grid grid-cols-[1fr_auto] border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase tracking-wide">
          <span>{dt('Description')}</span>
          <span>{dt('Amount')}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-5 text-sm">
          <div>
            <div className="font-bold">{order.title}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {dt('Apex-Work protected project payment')}
            </div>
          </div>
          <div className="font-bold">{formatEtb(order.amountEtb)}</div>
        </div>
        {multiMilestone && (
          <>
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {dt('Milestones')}
            </div>
            {ms.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-neutral-100 px-4 py-2.5 text-xs"
              >
                <span className="font-semibold">{m.title}</span>
                <span className="text-neutral-400">{m.status}</span>
                <span className="w-24 text-right font-semibold">{formatEtb(m.amountEtb)}</span>
              </div>
            ))}
          </>
        )}
      </section>
      <section className="ml-auto mt-6 w-80 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">{dt('Subtotal')}</span>
          <b>{formatEtb(order.amountEtb)}</b>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>{dt('VAT 15% (where applicable)')}</span>
          <span>{formatEtb(vat)}</span>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>{dt('Withholding 2% (where applicable)')}</span>
          <span>{formatEtb(wht)}</span>
        </div>
        {isSeller && (
          <>
            <div className="flex justify-between text-neutral-500">
              <span>{dt('Platform fee')}</span>
              <span>− {formatEtb(order.platformFeeEtb)}</span>
            </div>
            <div className="border-t border-neutral-300 pt-2">
              <div className="flex justify-between text-base">
                <b>{dt('Your net')}</b>
                <b className="text-emerald-600">{formatEtb(order.sellerNetEtb)}</b>
              </div>
            </div>
          </>
        )}
      </section>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[10px] leading-relaxed text-neutral-500">
        {dt(
          'Tax note: VAT and withholding are shown at Ethiopian statutory rates for your records; Apex-Work does not withhold or remit taxes on your behalf. Fill in your TINs and consult a licensed advisor for your filings.',
        )}
      </section>
      <footer className="mt-14 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>
          {dt(
            'Funds are handled through Apex-Work escrow and Chapa. Keep this document for your records.',
          )}
        </p>
        <p className="mt-1">
          {dt('Generated by Apex Resume & Work Studio')} · apex-work-gold.vercel.app
        </p>
      </footer>
    </article>
  );
}
