/**
 * Admin freelancer win-rate & per-gig conversion insights.
 *
 * `buildConversionInsights` is a pure, dependency-free fold over per-gig
 * aggregates (views, orders, completed, revenue) grouped by freelancer. It
 * computes rate metrics (view→order conversion, order completion / "win" rate)
 * and ranks gigs and freelancers so an operator can see who converts well and
 * which gigs drive orders vs. just views. Unit-testable without a DB.
 *
 * Rates are deliberately conservative:
 *  - conversionRate (view→order) = orders / views  → 0 when a gig has no views.
 *  - winRate (order completion)  = completed / orders → 0 when a gig has no
 *    orders, so a high-view/low-order gig can never rank on completion alone.
 */

export interface GigRow {
  gigId: string;
  title: string;
  status: string;
  views: number;
  orders: number;
  completed: number;
  cancelled: number;
  revenueEtb: number;
  startingPriceEtb: number;
  rating: number;
  createdAt: Date | string | null;
}

export interface FreelancerRow {
  userId: string;
  username: string;
  fullName: string;
  rating: number;
  gigs: GigRow[];
}

export interface GigMetric extends GigRow {
  /** view→order conversion (0..1). */
  conversionRate: number;
  /** order completion / "win" rate (0..1). */
  winRate: number;
  /** orders per 1000 views, for human-readable display. */
  conversionPerMille: number;
  /** total orders completed across this gig (orders that finished). */
  completedOrders: number;
}

export interface FreelancerSummary {
  userId: string;
  username: string;
  fullName: string;
  rating: number;
  activeGigs: number;
  totalGigViews: number;
  totalOrders: number;
  totalCompleted: number;
  totalRevenueEtb: number;
  /** orders / views across all of the freelancer's gigs (0..1). */
  conversionRate: number;
  /** completed / orders — the "win" rate (fraction of accepted orders completed). */
  winRate: number;
  /** gig-level conversion per 1000 views. */
  conversionPerMille: number;
  percentileRank: number;
}

export interface ConversionInsights {
  funnel: { views: number; orders: number; completed: number };
  /** average order-completion rate across considered freelancers. */
  avgWinRate: number;
  freelancers: FreelancerSummary[];
  /** gigs with the most views (visibility leaders). */
  topByViews: GigMetric[];
  /** gigs ordered by view→order conversion (min orders enforced). */
  topByConversion: GigMetric[];
  /** gigs ordered by completed revenue. */
  topByRevenue: GigMetric[];
}

function convRate(views: number, orders: number): number {
  return views > 0 ? orders / views : 0;
}

function completionRate(completed: number, orders: number): number {
  return orders > 0 ? completed / orders : 0;
}

function perMille(rate: number): number {
  return Math.round(rate * 1000);
}

function asGigMetric(g: GigRow): GigMetric {
  const conversionRate = convRate(g.views, g.orders);
  return {
    ...g,
    conversionRate,
    winRate: completionRate(g.completed, g.orders),
    conversionPerMille: perMille(conversionRate),
    completedOrders: g.completed,
  };
}

/** Build conversion insights from per-freelancer gig aggregates. */
export function buildConversionInsights(
  rows: FreelancerRow[],
  limit = 10,
  minOrders = 3,
): ConversionInsights {
  const gigsAll = rows.flatMap((r) => r.gigs.map((g) => ({ freelancer: r, gig: g })));
  const gigMetrics = gigsAll.map(({ gig }) => asGigMetric(gig));

  const freelancers: FreelancerSummary[] = rows
    .filter((r) => r.gigs.length > 0)
    .map((r) => {
      const totalGigViews = r.gigs.reduce((s, g) => s + Math.max(0, g.views), 0);
      const totalOrders = r.gigs.reduce((s, g) => s + Math.max(0, g.orders), 0);
      const totalCompleted = r.gigs.reduce((s, g) => s + Math.max(0, g.completed), 0);
      const totalRevenueEtb = r.gigs.reduce((s, g) => s + Math.max(0, g.revenueEtb), 0);
      const activeGigs = r.gigs.filter((g) => g.status === 'ACTIVE').length;
      const conversionRate = convRate(totalGigViews, totalOrders);
      // Win rate = completed / orders across all gigs (order-completion).
      const winRate = completionRate(totalCompleted, totalOrders);
      return {
        userId: r.userId,
        username: r.username,
        fullName: r.fullName,
        rating: r.rating,
        activeGigs,
        totalGigViews,
        totalOrders,
        totalCompleted,
        totalRevenueEtb,
        conversionRate,
        winRate,
        conversionPerMille: perMille(conversionRate),
        percentileRank: 0, // computed after sorting
      };
    })
    // Rank by win-rate first (order completion), tiebreak conversion then revenue.
    .sort((a, b) => b.winRate - a.winRate || b.conversionRate - a.conversionRate || b.totalRevenueEtb - a.totalRevenueEtb)
    .map((f, i) => ({ ...f, percentileRank: Math.round(((i + 1) / Math.max(1, rows.filter((r) => r.gigs.length > 0).length)) * 100) }))
    .slice(0, limit);

  const totalViews = gigMetrics.reduce((s, g) => s + g.views, 0);
  const totalOrders = gigMetrics.reduce((s, g) => s + g.orders, 0);
  const totalCompleted = gigMetrics.reduce((s, g) => s + g.completed, 0);

  const topByViews = [...gigMetrics]
    .filter((g) => g.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);

  const topByConversion = [...gigMetrics]
    .filter((g) => g.orders >= minOrders)
    .sort((a, b) => b.conversionRate - a.conversionRate || b.revenueEtb - a.revenueEtb)
    .slice(0, limit);

  const topByRevenue = [...gigMetrics]
    .filter((g) => g.revenueEtb > 0)
    .sort((a, b) => b.revenueEtb - a.revenueEtb)
    .slice(0, limit);

  const avgWinRate = freelancers.length
    ? freelancers.reduce((s, f) => s + f.winRate, 0) / freelancers.length
    : 0;

  return {
    funnel: { views: totalViews, orders: totalOrders, completed: totalCompleted },
    avgWinRate,
    freelancers,
    topByViews,
    topByConversion,
    topByRevenue,
  };
}
