import { redis } from './redis.js';
import { logger } from '../config/logger.js';

/**
 * Shared Redis hot-read cache.
 *
 * Why: the marketplace's highest-traffic reads (gig detail, public category
 * list, public profile/stats) currently hit Postgres on every request. On the
 * free Render/Neon tier that's the dominant source of latency + DB load, and it
 * makes cold starts slow. Caching these in Redis gives ~ms reads and offloads
 * the database.
 *
 * Design:
 *  - Express semantics: en/ge in (only JSON-safe payloads). We accept any value
 *    and JSON-serialize/parse, so callers pass objects/arrays/scalars.
 *  - Key prefix (`apex-cache:`) keeps it tidy and namespaced per environment.
 *  - Every cache miss on a public helper here is bounded by a TTL.
 *  - Hard-bounded jitter-free TTL default (configurable), so stale data is
 *    evicted predictably.
 *
 * Resilience (CRITICAL — a slow/dead Redis must NEVER take the API down):
 *  - Every `cachedRead` runs inside try/catch. Any Redis error is logged once
 *    and the caller falls through to the live `loader()`. The cache is strictly
 *    an accelerator, never a correctness dependency.
 *  - `invalidate()` is best-effort: on Redis failure it just logs (a stale
 *    cache entry expires via TTL anyway).
 *
 * Safety:
 *  - Only cache idempotent GET-ish reads. NEVER cache anything derived from the
 *    authenticated user (auth data) or money, to avoid leaking cross-tenant
 *    state. Callers are responsible for that; this file documents the rule.
 */

const PREFIX = 'apex-cache:';
const DEFAULT_TTL_SEC = 60;

/** Build the Redis key for a namespace + any components. */
export function cacheKey(
  namespace: string,
  ...parts: (string | number | null | undefined)[]
): string {
  const tail = parts
    .filter((p) => p !== null && p !== undefined)
    .map(String)
    .join(':');
  return `${PREFIX}${namespace}${tail ? `:${tail}` : ''}`;
}

/**
 * Read a value from the cache; on miss, call `loader()` and write it back (with
 * a JSON-safe result). If the cache/Redis is unavailable, run the loader anyway.
 *
 * @param key     Full cache key (use `cacheKey`).
 * @param loader  Async producer of the value when not cached.
 * @param ttlSec  Cache lifetime in seconds (default 60).
 */
export async function cachedRead<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<T> {
  try {
    const raw = await redis.get(key);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    logger.warn({ err, key }, 'Cache read failed — serving live data');
  }

  const value = await loader();

  // Fire-and-forget write; never block the response or fail the read on a
  // cache write error. Guard against storing undefined (JSON.stringify of
  // undefined is `undefined`, which would look like a miss on next read).
  if (value !== undefined) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch (err) {
      logger.warn({ err, key }, 'Cache write failed');
    }
  }

  return value;
}

/**
 * Invalidate a cache key (and any prefix-matching keys, if `prefix` is true).
 * Best-effort: on Redis failure we log and continue — the stale entry evicts
 * via its TTL, so a repo/API deploy never leaves permanently-bad data.
 */
export async function invalidate(key: string, opts: { prefix?: boolean } = {}): Promise<void> {
  try {
    if (opts.prefix) {
      const keys = await redis.keys(`${key}*`);
      if (keys.length) await redis.del(...keys);
    } else {
      await redis.del(key);
    }
  } catch (err) {
    logger.warn({ err, key }, 'Cache invalidation failed');
  }
}

/** Convenience: invalidate every key under a namespace prefix, e.g. category list. */
export async function invalidatePrefix(namespace: string): Promise<void> {
  return invalidate(`${PREFIX}${namespace}`, { prefix: true });
}
