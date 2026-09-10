/**
 * Trust badges — quick, honest signals computed from public stats.
 *  - 'top'    → proven track record (high rating at volume)
 *  - 'rising' → newer account already earning great reviews
 *  - 'pro'    → active paid Pro subscription
 * Precedence: top > pro > rising (earned badges outrank purchased ones).
 */
export type SellerBadge = 'top' | 'pro' | 'rising';

export interface BadgeStats {
  rating: number;
  ratingCount: number;
  completedOrders: number;
}

const TOP = { minRating: 4.8, minReviews: 10, minOrders: 20 };
const RISING = { minRating: 4.5, minReviews: 3, minOrders: 5, maxAgeDays: 90 };

export function isTopRated(stats: BadgeStats): boolean {
  return (
    stats.rating >= TOP.minRating &&
    stats.ratingCount >= TOP.minReviews &&
    stats.completedOrders >= TOP.minOrders
  );
}

export function isRising(stats: BadgeStats, createdAt?: string | Date): boolean {
  if (
    stats.rating < RISING.minRating ||
    stats.ratingCount < RISING.minReviews ||
    stats.completedOrders < RISING.minOrders
  ) {
    return false;
  }
  if (!createdAt) return false;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return ageDays <= RISING.maxAgeDays;
}

/** Returns the single strongest badge to display, or null. */
export function sellerBadge(
  stats: BadgeStats,
  opts: { createdAt?: string | Date; isPro?: boolean } = {},
): SellerBadge | null {
  if (isTopRated(stats)) return 'top';
  if (opts.isPro) return 'pro';
  if (isRising(stats, opts.createdAt)) return 'rising';
  return null;
}
