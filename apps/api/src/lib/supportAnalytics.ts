/**
 * Support SLA & team analytics.
 *
 * `buildSupportAnalytics` is a pure, dependency-free fold over support tickets
 * and their messages. It computes the operational signals staff care about:
 * open/aging queue, average first-response time, and per-admin throughput.
 * Kept pure so the SLA math is unit-testable in one auditable place.
 */

export interface SupportTicketInput {
  id: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | string;
  createdAt: Date;
  resolvedAt: Date | null;
  /** first *staff* message on the ticket (for first-response SLA). */
  firstStaffReplyAt: Date | null;
  /** last staff message (the assignee/responder). */
  lastStaffId: string | null;
}

export interface PerAdminRow {
  adminId: string;
  /** count of tickets the admin last responded to. */
  handled: number;
  /** average first-response time in minutes across those tickets. */
  avgFirstResponseMin: number;
}

export interface SupportAnalytics {
  /** currently open/in-progress tickets. */
  openTickets: number;
  /** open tickets untouched by staff for > SLA (default 24h). */
  breachedOpen: number;
  /** open tickets with no staff reply at all. */
  unattendedOpen: number;
  /** oldest open ticket age in minutes (0 if none). */
  oldestOpenMin: number;
  /** tickets resolved in the trailing window. */
  resolvedWindow: number;
  /** average minutes from open → staff first reply (resolved tickets). */
  avgTimeToFirstResponseMin: number;
  byAdmin: PerAdminRow[];
}

const DEFAULT_SLA_HOURS = 24;

/** Tickets in a terminal state (RESOLVED or CLOSED) are no longer open. */
const CLOSED_STATUSES = new Set(['RESOLVED', 'CLOSED']);
function isOpen(status: string): boolean {
  return !CLOSED_STATUSES.has(status);
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

export function buildSupportAnalytics(
  tickets: SupportTicketInput[],
  opts: { slaHours?: number; windowDays?: number; now?: Date } = {},
): SupportAnalytics {
  const slaHs = Math.min(168, Math.max(1, opts.slaHours ?? DEFAULT_SLA_HOURS));
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - (opts.windowDays ?? 7) * 24 * 60 * 60 * 1000);

  const open = tickets.filter((t) => isOpen(t.status));
  const breachedOpen = open.filter((t) => {
    const lastActivity = t.firstStaffReplyAt ?? t.createdAt;
    return (now.getTime() - lastActivity.getTime()) > slaHs * 60 * 60 * 1000;
  }).length;
  const unattendedOpen = open.filter((t) => !t.firstStaffReplyAt).length;

  let oldestOpenMin = 0;
  for (const t of open) {
    const age = minutesBetween(t.createdAt, now);
    if (age > oldestOpenMin) oldestOpenMin = age;
  }

  const resolved = tickets.filter((t) => t.status === 'RESOLVED');
  const resolvedWindow = resolved.filter((t) => (t.resolvedAt ?? t.createdAt) >= windowStart).length;

  // First-response SLA across tickets that have a staff reply.
  const withReplies = tickets.filter((t) => t.firstStaffReplyAt);
  const avgTimeToFirstResponseMin =
    withReplies.length > 0
      ? Math.round(withReplies.reduce((s, t) => s + minutesBetween(t.createdAt, t.firstStaffReplyAt!), 0) / withReplies.length)
      : 0;

  // Per-admin throughput (by ticket's last staff responder).
  const byAdminMap = new Map<string, { handled: number; frMin: number }>();
  for (const t of withReplies) {
    if (!t.lastStaffId) continue;
    const cur = byAdminMap.get(t.lastStaffId) ?? { handled: 0, frMin: 0 };
    cur.handled += 1;
    cur.frMin += minutesBetween(t.createdAt, t.firstStaffReplyAt!);
    byAdminMap.set(t.lastStaffId, cur);
  }
  const byAdmin: PerAdminRow[] = [...byAdminMap.entries()]
    .map(([adminId, v]) => ({
      adminId,
      handled: v.handled,
      avgFirstResponseMin: v.handled > 0 ? Math.round(v.frMin / v.handled) : 0,
    }))
    .sort((a, b) => b.handled - a.handled);

  return {
    openTickets: open.length,
    breachedOpen,
    unattendedOpen,
    oldestOpenMin,
    resolvedWindow,
    avgTimeToFirstResponseMin,
    byAdmin,
  };
}
