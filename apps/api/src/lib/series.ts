/**
 * Time-series helpers for admin analytics.
 *
 * `buildDailySeries` fills a contiguous array of day buckets (UTC midnight)
 * from a start date to `end`, mapping optional per-day aggregates onto each
 * bucket. Kept as a pure function (no DB) so it's trivial to unit test and
 * guarantees we never emit a missing-day hole in a chart.
 */

export interface DayBucket {
  /** ISO date string (yyyy-mm-dd) of the bucket's UTC midnight. */
  day: string;
  /** Integer number of events on that day. */
  count: number;
  /** Optional value sum on that day (e.g. GMV/ETB, revenue/ETB). */
  value?: number;
}

export interface DailyInput {
  /** ISO date string (yyyy-mm-dd) or Date. */
  day: string | Date;
  count: number;
  value?: number;
}

/** Millisecond width of a single UTC day. */
export const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(d: string | Date): Date {
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00.000Z`) : new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a contiguous set of daily buckets from `start` (inclusive) to `end`
 * (inclusive), filling `aggregates` into their matching buckets.
 *
 * @param start   first day (UTC midnight or ISO date)
 * @param end     last day (UTC midnight or ISO date)
 * @param aggregates optional per-day values to fold into the buckets
 * @returns array of buckets sorted ascending, one per day, no gaps.
 */
export function buildDailySeries(
  start: string | Date,
  end: string | Date,
  aggregates: DailyInput[] = [],
): DayBucket[] {
  const startDate = toUtcMidnight(start);
  const endDate = toUtcMidnight(end);

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('series end must not be before start');
  }

  const byDay = new Map<string, DayBucket>();
  for (const agg of aggregates) {
    const key = isoDay(toUtcMidnight(agg.day));
    const prev = byDay.get(key);
    byDay.set(key, {
      day: key,
      count: (prev?.count ?? 0) + agg.count,
      value: (prev?.value ?? 0) + (agg.value ?? 0),
    });
  }

  const out: DayBucket[] = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += DAY_MS) {
    const key = isoDay(new Date(t));
    const existing = byDay.get(key);
    out.push(existing ?? { day: key, count: 0, value: 0 });
  }
  return out;
}

/** A single point in a series — count plus an optional money value/day label. */
export interface SeriesLike {
  day?: string;
  count: number;
  value?: number;
}

/** Difference between the last two buckets (value-aware, falls back to count). */
export function deltaOfSeries(series: SeriesLike[]): number {
  if (series.length < 2) return 0;
  const last = series[series.length - 1]!;
  const prev = series[series.length - 2]!;
  return Number(last.value ?? last.count) - Number(prev.value ?? prev.count);
}

/** Peak / max value across a series (for chart scaling). */
export function maxSeriesValue(series: SeriesLike[]): number {
  let max = 0;
  for (const s of series) {
    const v = Number(s.value ?? s.count);
    if (v > max) max = v;
  }
  return max;
}

/** Truncate one or more metrics to a fixed endpoint so a chart always lands on
 * `today` and can be queried incrementally (day 0..N-1 where N = days).
 */
export function startDateForDays(days: number, end: Date = new Date()): Date {
  const endMid = toUtcMidnight(end);
  // days represents the *number of buckets*; the window covers the trailing
  // `days` calendar days ending today inclusive.
  return new Date(endMid.getTime() - (days - 1) * DAY_MS);
}
