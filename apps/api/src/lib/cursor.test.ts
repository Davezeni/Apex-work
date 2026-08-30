import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, nextCursor, pageFromQuery } from './cursor.js';

describe('cursor pagination', () => {
  const at = (iso: string) => new Date(iso);

  it('round-trips a cursor', () => {
    const enc = encodeCursor(at('2026-08-30T10:00:00Z'), 'abc123');
    const dec = decodeCursor(enc);
    expect(dec).not.toBeNull();
    expect(dec!.id).toBe('abc123');
    expect(dec!.createdAt.toISOString()).toBe('2026-08-30T10:00:00.000Z');
  });

  it('rejects malformed cursors', () => {
    expect(decodeCursor('not-a-real-cursor')).toBeNull();
    expect(decodeCursor('%%%')).toBeNull();
    expect(decodeCursor(Buffer.from('onlydate', 'utf8').toString('base64url'))).toBeNull();
  });

  it('computes hasMore and next cursor only when a page is full', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      createdAt: at(`2026-08-30T10:00:0${i}Z`),
      id: `id${i}`,
    }));
    // Exactly at limit → hasMore true based on length check in nextCursor.
    const full = nextCursor(rows, 5);
    expect(full.hasMore).toBe(true);
    expect(full.cursor).toBeTruthy();

    const partial = nextCursor(rows.slice(0, 3), 5);
    expect(partial.hasMore).toBe(false);
    expect(partial.cursor).toBeNull();
  });

  it('sanitizes page params from query', () => {
    expect(pageFromQuery({ limit: 10 })).toEqual({ cursor: null, limit: 10 });
    expect(pageFromQuery({ limit: 10000 }).limit).toBe(100); // clamped to max
    expect(pageFromQuery({ limit: -5 }).limit).toBe(1); // clamped to min
    expect(pageFromQuery({ cursor: 'x' }).cursor).toBe('x');
    expect(pageFromQuery({}).cursor).toBeNull();
  });
});
