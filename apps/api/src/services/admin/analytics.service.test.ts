import { describe, it, expect } from 'vitest';
import { deltaOfSeries, maxSeriesValue } from '../../lib/series.js';

describe('deltaOfSeries', () => {
  it('returns diff of the two most recent buckets (value-aware)', () => {
    const series = [
      { day: 'a', count: 1, value: 100 },
      { day: 'b', count: 1, value: 160 },
    ];
    expect(deltaOfSeries(series)).toBe(60);
  });

  it('falls back to count when value is absent', () => {
    const series = [{ day: 'a', count: 5 }, { day: 'b', count: 9 }];
    expect(deltaOfSeries(series)).toBe(4);
  });

  it('returns 0 for a series with fewer than two buckets', () => {
    expect(deltaOfSeries([])).toBe(0);
    expect(deltaOfSeries([{ day: 'a', count: 3, value: 10 }])).toBe(0);
  });

  it('handles declining values (negative delta)', () => {
    const series = [
      { day: 'a', count: 1, value: 200 },
      { day: 'b', count: 1, value: 120 },
    ];
    expect(deltaOfSeries(series)).toBe(-80);
  });
});

describe('maxSeriesValue', () => {
  it('finds the max value across buckets', () => {
    const series = [
      { day: 'a', count: 1, value: 50 },
      { day: 'b', count: 2, value: 220 },
      { day: 'c', count: 0, value: 0 },
    ];
    expect(maxSeriesValue(series)).toBe(220);
  });

  it('uses count when value is undefined', () => {
    const series = [{ day: 'a', count: 3 }, { day: 'b', count: 12 }];
    expect(maxSeriesValue(series)).toBe(12);
  });

  it('returns 0 for an empty series', () => {
    expect(maxSeriesValue([])).toBe(0);
  });
});
