import { describe, it, expect } from 'vitest';
import { buildDailySeries, startDateForDays, DAY_MS } from './series.js';

describe('buildDailySeries', () => {
  it('fills a full contiguous range with no gaps', () => {
    const out = buildDailySeries('2026-08-25', '2026-08-28');
    expect(out.map((b) => b.day)).toEqual(['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']);
    expect(out.every((b) => b.count === 0 && b.value === 0)).toBe(true);
  });

  it('maps per-day aggregates into the right buckets and sums', () => {
    const out = buildDailySeries('2026-08-25', '2026-08-28', [
      { day: '2026-08-26', count: 3, value: 1000 },
      { day: '2026-08-26', count: 2, value: 500 },
      { day: '2026-08-28', count: 5, value: 2500 },
    ]);
    expect(out[0]).toEqual({ day: '2026-08-25', count: 0, value: 0 });
    expect(out[1]).toEqual({ day: '2026-08-26', count: 5, value: 1500 });
    expect(out[2]).toEqual({ day: '2026-08-27', count: 0, value: 0 });
    expect(out[3]).toEqual({ day: '2026-08-28', count: 5, value: 2500 });
  });

  it('normalises Date inputs to UTC midnight', () => {
    const out = buildDailySeries(new Date(Date.UTC(2026, 0, 1, 23, 59)), new Date(Date.UTC(2026, 0, 2, 1, 0)));
    expect(out.map((b) => b.day)).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('supports a single-day window', () => {
    const out = buildDailySeries('2026-08-30', '2026-08-30', [{ day: '2026-08-30', count: 7 }]);
    expect(out).toEqual([{ day: '2026-08-30', count: 7, value: 0 }]);
  });

  it('throws when end precedes start', () => {
    expect(() => buildDailySeries('2026-08-30', '2026-08-28')).toThrow(/end must not be before start/);
  });
});

describe('startDateForDays', () => {
  it('returns the trailing window start ending on the given day (inclusive)', () => {
    // 30-day window ending today (2026-08-30) starts on 2026-08-01.
    const end = new Date(Date.UTC(2026, 7, 30, 12, 0)); // Aug 30 noon
    const start = startDateForDays(30, end);
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('endpoint math produces exactly `days` buckets', () => {
    const days = 15;
    const end = new Date('2026-09-01T10:00:00.000Z');
    const start = startDateForDays(days, end);
    const span = Math.round((start.getTime() - Date.UTC(2026, 8, 1)) / DAY_MS);
    expect(Math.abs(span)).toBe(days - 1);
  });
});
