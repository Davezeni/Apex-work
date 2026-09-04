/**
 * Admin top-performer leaderboard.
 *
 * `buildLeaderboard` is a pure, dependency-free fold over per-user performance
 * aggregates (revenue, completed orders, rating, active gigs). It ranks
 * freelancers and clients independently, highlights risers (users who gained
 * traction within a window), and is unit-testable without a DB.
 */

export type UserRole = 'FREELANCER' | 'CLIENT';

export interface PerfRow {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  revenueEtb: number;
  completedOrders: number;
  rating: number;
  activeGigs: number;
  /** revenue earned within the trailing window (for risers). */
  windowRevenueEtb: number;
  windowOrders: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  revenueEtb: number;
  completedOrders: number;
  rating: number;
  activeGigs: number;
}

export interface Leaderboard {
  freelancers: LeaderboardEntry[];
  clients: LeaderboardEntry[];
  /** top risers (window revenue) across all users. */
  risers: LeaderboardEntry[];
}

function rank(rows: PerfRow[], limit: number): LeaderboardEntry[] {
  return rows
    .sort((a, b) => b.revenueEtb - a.revenueEtb)
    .slice(0, limit)
    .map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      fullName: r.fullName,
      role: r.role,
      revenueEtb: r.revenueEtb,
      completedOrders: r.completedOrders,
      rating: r.rating,
      activeGigs: r.activeGigs,
    }));
}

/** Rank freelancers and clients, plus a risers list by trailing-window revenue. */
export function buildLeaderboard(rows: PerfRow[], limit = 10): Leaderboard {
  return {
    freelancers: rank(rows.filter((r) => r.role === 'FREELANCER'), limit),
    clients: rank(rows.filter((r) => r.role === 'CLIENT'), limit),
    risers: rows
      .filter((r) => r.windowRevenueEtb > 0)
      .sort((a, b) => b.windowRevenueEtb - a.windowRevenueEtb)
      .slice(0, limit)
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        fullName: r.fullName,
        role: r.role,
        revenueEtb: r.windowRevenueEtb,
        completedOrders: r.windowOrders,
        rating: r.rating,
        activeGigs: r.activeGigs,
      })),
  };
}
