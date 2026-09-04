/**
 * Admin retention & churn analytics.
 *
 * `buildRetention` is a pure, dependency-free fold over per-user activity rows
 * (signup date + first/last order dates). It computes activation (the share of
 * new users who place their first order within a window), D7/D14/D30 activation
 * without needing cohort-matrix joins, a churn rate for existing users, and a
 * per-week activation cohort series. Unit-testable without a DB.
 */

export interface RetentionUserRow {
  userId?: string;
  signupAt: Date;
  firstOrderAt?: Date | null;
  lastOrderAt?: Date | null;
  orderCount?: number;
}

export interface WeekCohort {
  /** ISO week label (yyyy-Www). */
  week: string;
  signups: number;
  activated: number;
  activationRate: number;
}

export interface RetentionSummary {
  totalNewUsers: number;
  activated: number;
  activationRate: number;
  /** share activated within 7 / 14 / 30 days of signup. */
  d7: number;
  d14: number;
  d30: number;
  /** users with at least one order who have ordered within the window. */
  activeUsers: number;
  inactiveUsers: number;
  churnRate: number;
  weeklyCohorts: WeekCohort[];
  /** average orders per activated user. */
  avgOrders: number;
}

const DAY = 24 * 60 * 60 * 1000;

function firstOrderWithinDays(r: RetentionUserRow, days: number, now: Date): boolean {
  if (!r.firstOrderAt) return false;
  const first = new Date(r.firstOrderAt.valueOf());
  const signup = new Date(r.signupAt.valueOf());
  return first.getTime() >= signup.getTime() && first.getTime() - signup.getTime() <= days * DAY;
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const ffDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ffDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function buildRetention(rows: RetentionUserRow[], opts: { now?: Date; windowDays?: number } = {}): RetentionSummary {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 60;

  // Only consider users who signed up within the window.
  const windowStart = now.getTime() - windowDays * DAY;
  const cohort = rows.filter((r) => new Date(r.signupAt.valueOf()).getTime() >= windowStart);

  const totalNewUsers = cohort.length;
  const activated = cohort.filter((r) => r.firstOrderAt).length;
  const activationRate = totalNewUsers ? activated / totalNewUsers : 0;
  const d7 = totalNewUsers ? cohort.filter((r) => firstOrderWithinDays(r, 7, now)).length / totalNewUsers : 0;
  const d14 = totalNewUsers ? cohort.filter((r) => firstOrderWithinDays(r, 14, now)).length / totalNewUsers : 0;
  const d30 = totalNewUsers ? cohort.filter((r) => firstOrderWithinDays(r, 30, now)).length / totalNewUsers : 0;

  // Users with at least one order: active if they ordered within the window.
  const ordered = rows.filter((r) => r.orderCount && r.orderCount > 0);
  const activeUsers = ordered.filter((r) => {
    if (!r.lastOrderAt) return false;
    return now.getTime() - new Date(r.lastOrderAt.valueOf()).getTime() <= windowDays * DAY;
  }).length;
  const inactiveUsers = ordered.length - activeUsers;
  const churnRate = ordered.length ? inactiveUsers / ordered.length : 0;

  // Weekly activation cohorts (activation within 7 days of signup).
  const byWeek = new Map<string, { signups: number; activated: number }>();
  for (const r of cohort) {
    const week = isoWeek(new Date(r.signupAt));
    const cur = byWeek.get(week) ?? { signups: 0, activated: 0 };
    cur.signups += 1;
    if (r.firstOrderAt) cur.activated += 1;
    byWeek.set(week, cur);
  }
  const weeklyCohorts: WeekCohort[] = [...byWeek.entries()]
    .map(([week, v]) => ({
      week,
      signups: v.signups,
      activated: v.activated,
      activationRate: v.signups ? v.activated / v.signups : 0,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const totalOrders = rows.reduce((s, r) => s + (r.orderCount ?? 0), 0);
  const avgOrders = activated ? totalOrders / activated : 0;

  return {
    totalNewUsers,
    activated,
    activationRate,
    d7,
    d14,
    d30,
    activeUsers,
    inactiveUsers,
    churnRate,
    weeklyCohorts,
    avgOrders,
  };
}
