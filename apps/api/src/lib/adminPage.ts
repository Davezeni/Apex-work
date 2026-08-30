/**
 * Cursor-pagination helper for admin list endpoints. Wraps the boilerplate so
 * every admin list shares identical, correct cursor handling:
 *   - parse `limit` + `cursor` from query
 *   - decode to a `cursorWhere` Prisma condition
 *   - fetch limit+1 rows, compute `hasMore` and the next cursor
 */
import type { Request } from 'express';
import { decodeCursor, cursorWhere, nextCursor, DEFAULT_LIMIT, MAX_LIMIT } from './cursor.js';

interface PageArgs {
  fetch: (opts: { limit: number; cursorWhere?: Record<string, unknown> }) => Promise<
    Array<{ createdAt: Date; id: string }>
  >;
  defaultLimit?: number;
}

export async function paginate(req: Request, { fetch, defaultLimit }: PageArgs) {
  const raw = Number(req.query.limit);
  const limit = raw ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw))) : defaultLimit ?? DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length > 0 ? req.query.cursor : null;
  const decoded = cursor ? decodeCursor(cursor) : null;
  const cursorFilter = decoded ? cursorWhere(decoded) : undefined;
  const rows = await fetch({ limit, cursorWhere: cursorFilter });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next = nextCursor(items, limit);
  return { items, cursor: next.hasMore ? next.cursor : null, hasMore: next.hasMore };
}
