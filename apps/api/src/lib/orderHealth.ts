/**
 * Admin order-health "needs attention" inbox + daily digest.
 *
 * `buildOrderHealth` is a pure, dependency-free classifier over order
 * candidates. It flags orders that are stuck or breaching an SLA, assigns a
 * severity and a one-line reason, then returns a priority-sorted inbox plus
 * bucketed counts and a ready-to-send plain-text digest. Unit-testable without
 * a DB.
 *
 * Rules (default thresholds, all in days):
 *   OVERDUE_DELIVERY   ACTIVE, deadline passed                    → high
 *   STALE_DISPUTE      DISPUTED with an open dispute > staleDispute→ high
 *   STALE_REVIEW       IN_REVIEW, deliveredAt > staleReview       → medium
 *   UNRESOLVED_ORDER   DELIVERED, deliveredAt > staleDelivery     → medium
 *   ABANDONED_ORDER    PENDING, created > abandonedOrder          → low
 */

export type AlertCategory =
  | 'OVERDUE_DELIVERY'
  | 'STALE_DISPUTE'
  | 'STALE_REVIEW'
  | 'UNRESOLVED_ORDER'
  | 'ABANDONED_ORDER';

export type Severity = 'high' | 'medium' | 'low';

interface DateLike {
  valueOf(): number;
}

export interface OrderHealthCandidate {
  orderId: string;
  orderNumber: string;
  title: string;
  status: string;
  amountEtb: number;
  clientId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  createdAt: DateLike;
  updatedAt: DateLike;
  deadline?: DateLike | null;
  deliveredAt?: DateLike | null;
  disputeStatus?: string | null;
  disputeCreatedAt?: DateLike | null;
}

export interface OrderHealthItem extends OrderHealthCandidate {
  category: AlertCategory;
  severity: Severity;
  /** How long ago the triggering milestone happened, in days. */
  ageDays: number;
  /** Whose clock we measured — the relevant reference timestamp (ISO). */
  refAt: string;
  note: string;
}

export interface OrderHealthSummary {
  inbox: OrderHealthItem[];
  counts: Record<AlertCategory, number>;
  total: number;
  high: number;
  medium: number;
  low: number;
  /** Plain-text one-paragraph digest body (daily summary). */
  digest: string;
  digestHtml: string;
}

export interface OrderHealthOptions {
  now?: Date;
  staleReview?: number;
  staleDelivery?: number;
  staleDispute?: number;
  abandonedOrder?: number;
}

const DAY = 24 * 60 * 60 * 1000;

function daysSince(ref: DateLike, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(ref.valueOf()).getTime()) / DAY));
}

/** Classify a single candidate, or null if it's healthy. */
export function classifyOrder(c: OrderHealthCandidate, now: Date, o: Required<OrderHealthOptions>): OrderHealthItem | null {
  const deadline = c.deadline ? new Date(c.deadline.valueOf()) : null;

  // OVERDUE_DELIVERY — active order whose delivery deadline has passed.
  if (c.status === 'ACTIVE' && deadline && deadline.getTime() < now.getTime()) {
    const ageDays = daysSince(deadline, now);
    return {
      ...c,
      category: 'OVERDUE_DELIVERY',
      severity: 'high',
      ageDays,
      refAt: deadline.toISOString(),
      note: `Delivery overdue by ${ageDays}d`,
    };
  }

  // STALE_DISPUTE — an open dispute has stayed unresolved too long.
  if (c.status === 'DISPUTED' && c.disputeCreatedAt && c.disputeStatus && c.disputeStatus !== 'RESOLVED_CLIENT' && c.disputeStatus !== 'RESOLVED_SELLER' && c.disputeStatus !== 'RESOLVED_SPLIT' && c.disputeStatus !== 'WITHDRAWN') {
    const ageDays = daysSince(c.disputeCreatedAt, now);
    if (ageDays >= o.staleDispute) {
      return {
        ...c,
        category: 'STALE_DISPUTE',
        severity: 'high',
        ageDays,
        refAt: c.disputeCreatedAt.valueOf().toString(),
        note: `Dispute open for ${ageDays}d`,
      };
    }
  }

  // STALE_REVIEW — delivered but sitting in review too long.
  if (c.status === 'IN_REVIEW' && c.deliveredAt) {
    const ageDays = daysSince(c.deliveredAt, now);
    if (ageDays >= o.staleReview) {
      return {
        ...c,
        category: 'STALE_REVIEW',
        severity: 'medium',
        ageDays,
        refAt: c.deliveredAt.valueOf().toString(),
        note: `Awaiting client review for ${ageDays}d`,
      };
    }
  }

  // UNRESOLVED_ORDER — approved (DELIVERED) but funds not released.
  if (c.status === 'DELIVERED' && c.deliveredAt) {
    const ageDays = daysSince(c.deliveredAt, now);
    if (ageDays >= o.staleDelivery) {
      return {
        ...c,
        category: 'UNRESOLVED_ORDER',
        severity: 'medium',
        ageDays,
        refAt: c.deliveredAt.valueOf().toString(),
        note: `Approved but not completed for ${ageDays}d`,
      };
    }
  }

  // ABANDONED_ORDER — never paid and left in PENDING too long.
  if (c.status === 'PENDING') {
    const ageDays = daysSince(c.createdAt, now);
    if (ageDays >= o.abandonedOrder) {
      return {
        ...c,
        category: 'ABANDONED_ORDER',
        severity: 'low',
        ageDays,
        refAt: c.createdAt.valueOf().toString(),
        note: `Unpaid for ${ageDays}d`,
      };
    }
  }

  return null;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Build a priority inbox + counts + a daily digest from candidates. */
export function buildOrderHealth(
  candidates: OrderHealthCandidate[],
  opts: OrderHealthOptions = {},
): OrderHealthSummary {
  const now = opts.now ?? new Date();
  const o: Required<OrderHealthOptions> = {
    now,
    staleReview: opts.staleReview ?? 3,
    staleDelivery: opts.staleDelivery ?? 5,
    staleDispute: opts.staleDispute ?? 3,
    abandonedOrder: opts.abandonedOrder ?? 2,
  };

  const items: OrderHealthItem[] = [];
  for (const c of candidates) {
    const item = classifyOrder(c, now, o);
    if (item) items.push(item);
  }

  items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.ageDays - a.ageDays);

  const counts: Record<AlertCategory, number> = {
    OVERDUE_DELIVERY: 0,
    STALE_DISPUTE: 0,
    STALE_REVIEW: 0,
    UNRESOLVED_ORDER: 0,
    ABANDONED_ORDER: 0,
  };
  for (const i of items) counts[i.category] += 1;

  const high = items.filter((i) => i.severity === 'high').length;
  const medium = items.filter((i) => i.severity === 'medium').length;
  const low = items.filter((i) => i.severity === 'low').length;

  const digest = [
    `Order health digest: ${items.length} order(s) need attention ` +
      `(${high} high, ${medium} medium, ${low} low).`,
    `- Overdue delivery: ${counts.OVERDUE_DELIVERY}, Stale dispute: ${counts.STALE_DISPUTE}, ` +
      `Stale review: ${counts.STALE_REVIEW}, Unresolved: ${counts.UNRESOLVED_ORDER}, Abandoned: ${counts.ABANDONED_ORDER}.`,
    ...items.slice(0, 5).map((i) => `- [${i.severity.toUpperCase()}] ${i.orderNumber} ${i.title}: ${i.note}`),
  ].join('\n');

  const digestHtml = [
    `<h2>Order health digest</h2>`,
    `<p><strong>${items.length}</strong> order(s) need attention (<strong>${high}</strong> high, <strong>${medium}</strong> medium, <strong>${low}</strong> low).</p>`,
    `<ul>`,
    `<li>Overdue delivery: ${counts.OVERDUE_DELIVERY}</li>`,
    `<li>Stale dispute: ${counts.STALE_DISPUTE}</li>`,
    `<li>Stale review: ${counts.STALE_REVIEW}</li>`,
    `<li>Unresolved: ${counts.UNRESOLVED_ORDER}</li>`,
    `<li>Abandoned: ${counts.ABANDONED_ORDER}</li>`,
    `</ul>`,
    `<h3>Top items</h3><table><thead><tr><th>Order</th><th>Reason</th><th>Severity</th></tr></thead><tbody>`,
    ...items.slice(0, 10).map((i) => `<tr><td>${i.orderNumber}</td><td>${i.note}</td><td>${i.severity}</td></tr>`),
    `</tbody></table>`,
  ].join('');

  return { inbox: items, counts, total: items.length, high, medium, low, digest, digestHtml };
}
