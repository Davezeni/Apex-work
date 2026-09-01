/**
 * Admin analytics — time-series aggregation for the dashboard charts.
 *
 * Aggregation is done at the database (date_trunc on a per-day UTC bucket) so
 * we never pull full tables into Node; the raw rows are then folded into a
 * contiguous, gap-free series with `buildDailySeries` from `lib/series`.
 */
import { prisma } from '../../lib/prisma.js';
import { buildDailySeries, startDateForDays } from '../../lib/series.js';

export interface DayAggRow {
  day: Date;
  count: bigint | number;
  value?: bigint | number;
}

function toPair(row: DayAggRow): { day: string; count: number; value: number } {
  return {
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    count: Number(row.count),
    value: Number(row.value ?? 0),
  };
}

/**
 * Build the full daily series for a list of metrics over the trailing `days`
 * calendar days (inclusive of today), each metric as {key, buckets}.
 *
 * Metrics:
 * - signups          count of new users
 * - ordersCreated    count of orders placed
 * - ordersCompleted  count of orders completed
 * - gmvEtb           sum of completed order amountEtb
 * - revenueEtb       sum of completed order platformFeeEtb
 */
export async function analyticsSeries(days = 30) {
  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  const end = new Date();
  const start = startDateForDays(safeDays, end);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [signups, ordersCreated, ordersCompleted, gmv, revenue] = await Promise.all([
    prisma.$queryRaw<DayAggRow[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM "User" WHERE "createdAt" >= ${startIso}::timestamptz AND "createdAt" <= ${endIso}::timestamptz
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayAggRow[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM "Order" WHERE "createdAt" >= ${startIso}::timestamptz AND "createdAt" <= ${endIso}::timestamptz
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayAggRow[]>`
      SELECT date_trunc('day', "completedAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM "Order" WHERE "completedAt" IS NOT NULL AND "completedAt" >= ${startIso}::timestamptz AND "completedAt" <= ${endIso}::timestamptz
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayAggRow[]>`
      SELECT date_trunc('day', "completedAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count,
        COALESCE(SUM("amountEtb"), 0)::bigint AS value
      FROM "Order" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${startIso}::timestamptz AND "completedAt" <= ${endIso}::timestamptz
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayAggRow[]>`
      SELECT date_trunc('day', "completedAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count,
        COALESCE(SUM("platformFeeEtb"), 0)::bigint AS value
      FROM "Order" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${startIso}::timestamptz AND "completedAt" <= ${endIso}::timestamptz
      GROUP BY 1 ORDER BY 1`,
  ]);

  return {
    days: safeDays,
    start: startIso,
    end: endIso,
    metrics: {
      signups: buildDailySeries(start, end, signups.map(toPair)),
      ordersCreated: buildDailySeries(start, end, ordersCreated.map(toPair)),
      ordersCompleted: buildDailySeries(start, end, ordersCompleted.map(toPair)),
      gmvEtb: buildDailySeries(start, end, gmv.map(toPair)),
      revenueEtb: buildDailySeries(start, end, revenue.map(toPair)),
    },
  };
}

export type AnalyticsSeries = Awaited<ReturnType<typeof analyticsSeries>>;
