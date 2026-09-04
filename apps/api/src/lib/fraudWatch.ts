/**
 * Admin velocity-based fraud/abuse watchlist.
 *
 * `scoreWatchlistUser` is a pure, dependency-free rule scorer over per-user
 * aggregates (order/dispute/withdrawal activity in a window). A handful of
 * transparent rules each contribute points; the sum maps to a watch priority.
 * No machine learning — just thresholds you can reason about and tune.
 */

export interface FraudAggregate {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  newOrders: number;             // orders placed in window
  completedOrders: number;       // completed in window
  disputedOrders: number;        // orders that were escalated to a dispute in window
  cancelledOrders: number;       // orders cancelled in window
  withdrawnAmountEtb: number;    // withdrawals requested in window
  withdrawalsCount: number;
  reviewsWritten: number;        // reviews this user authored in window (buyer side)
  accountAgeDays: number;
}

export type WatchPriority = 'high' | 'medium' | 'low' | 'clear';

export interface WatchUser extends FraudAggregate {
  score: number;
  priority: WatchPriority;
  reasons: string[];
  disputeRate: number;   // disputed / (disputed + completed)
}

const clamp = (n: number) => Math.max(0, n);

/**
 * Score one user against the rules. Returns score, priority and the human
 * reasons that triggered it. Pure — takes the aggregate directly.
 */
export function scoreWatchlistUser(a: FraudAggregate): WatchUser {
  const reasons: string[] = [];
  let score = 0;

  const disputeRate = (a.disputedOrders + a.completedOrders) > 0
    ? a.disputedOrders / (a.disputedOrders + a.completedOrders)
    : 0;

  // R1: young account + lots of new orders (possible fake demand/impulse).
  if (a.accountAgeDays <= 7 && a.newOrders >= 5) {
    score += 50;
    reasons.push(`New account (${a.accountAgeDays}d) placed ${a.newOrders} orders`);
  }
  // R2: high dispute-to-completed ratio on this user's orders.
  if (disputeRate >= 0.3 && a.disputedOrders >= 2) {
    score += 45;
    reasons.push(`High dispute rate (${(disputeRate * 100).toFixed(0)}%)`);
  }
  // R3: many cancellations relative to new orders.
  if (a.newOrders >= 3 && a.cancelledOrders / Math.max(1, a.newOrders) >= 0.6) {
    score += 25;
    reasons.push(`High cancellation ratio (${Math.round((a.cancelledOrders / Math.max(1, a.newOrders)) * 100)}%)`);
  }
  // R4: rapid withdrawals shortly after joining (potential money-out churn).
  if (a.accountAgeDays <= 30 && a.withdrawalsCount >= 2 && a.withdrawnAmountEtb > 0) {
    score += 20;
    reasons.push(`Early withdrawals (${a.withdrawalsCount}×, ${a.withdrawnAmountEtb} ETB)`);
  }
  // R5: review velocity — many reviews in a short window (review-gaming candidate).
  if (a.reviewsWritten >= 8) {
    score += 8;
    reasons.push(`High review output (${a.reviewsWritten})`);
  }

  let priority: WatchPriority;
  if (score >= 45) priority = 'high';
  else if (score >= 20) priority = 'medium';
  else if (score >= 8) priority = 'low';
  else priority = 'clear';

  return { ...a, score: clamp(score), priority, reasons, disputeRate };
}

/** Sort a set of scored users by priority then score. */
export function rankWatchlist(users: FraudAggregate[], limit = 25): WatchUser[] {
  const rank: Record<WatchPriority, number> = { high: 0, medium: 1, low: 2, clear: 3 };
  return users
    .map(scoreWatchlistUser)
    .filter((u) => u.priority !== 'clear')
    .sort((a, b) => rank[a.priority] - rank[b.priority] || b.score - a.score)
    .slice(0, limit);
}
