/**
 * Cursor pagination helper (keyset pagination).
 *
 * Admin list endpoints grow with catalog size; offset pagination is O(offset)
 * and prone to duplicates when rows change. Keyset pagination uses the
 * (createdAt, id) tuple as the cursor so pages are stable and index-backed.
 * Cursors are opaque, base64url-encoded JSON. Add a composite index on
 * (createdAt DESC, id DESC) on the paginated tables for best results.
 */

const CURSOR_DELIM = '|';

export interface CursorPayload {
  cursor: string | null; // last row's cursor value (encoded)
  limit: number;
}

export interface PageParams {
  cursor?: string | null;
  limit?: number;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** Decode and sanitize query params into a safe cursor + limit. */
export function pageFromQuery(q: PageParams): CursorPayload {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));
  const cursor = typeof q.cursor === 'string' && q.cursor.length > 0 ? q.cursor : null;
  return { cursor, limit };
}

/** Encode a (createdAt, id) cursor value for a row. */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}${CURSOR_DELIM}${id}`, 'utf8').toString('base64url');
}

/** Decode a cursor back to its parts. Returns null if malformed. */
export function decodeCursor(encoded: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const idx = raw.lastIndexOf(CURSOR_DELIM);
    if (idx < 0) return null;
    const createdAt = new Date(raw.slice(0, idx));
    const id = raw.slice(idx + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Build the `cursor` for this page and a `hasMore` flag for the response. */
export function nextCursor<T extends { createdAt: Date; id: string }>(
  items: T[],
  limit: number,
): { cursor: string | null; hasMore: boolean } {
  if (items.length < limit) return { cursor: null, hasMore: false };
  const last = items[items.length - 1];
  if (!last) return { cursor: null, hasMore: false };
  return { cursor: encodeCursor(last.createdAt, last.id), hasMore: true };
}

/**
 * Prisma criteria for "older than the cursor". Compose with the caller's own
 * `where` (which must not already contain an `OR`).
 */
export function cursorWhere(decoded: { createdAt: Date; id: string }): Record<string, unknown> {
  return {
    OR: [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, id: { lt: decoded.id } },
    ],
  };
}
