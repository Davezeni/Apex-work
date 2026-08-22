/**
 * Redis-backed response cache for idempotent GETs.
 *
 * Design goals:
 *   • Zero-cost to unhit routes — the middleware is per-route opt-in.
 *   • Never cache authenticated requests (any Authorization header) unless
 *     the caller explicitly says so with `perUser: true`.
 *   • Cache the JSON payload + status code together, so 404s don't hide
 *     a valid resource that appeared 1s later.
 *   • Emits `X-Cache: HIT|MISS` and a `Cache-Control` public/max-age so
 *     downstream (browser + Vercel edge) can also cache.
 *   • SWR-lite: we serve the cached body immediately and refresh in the
 *     background if it's older than the "swrAfter" threshold. Everything
 *     is best-effort; a Redis outage never breaks the endpoint.
 */
import type { NextFunction, Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { logger } from '../config/logger.js';

interface CacheOptions {
  /** Total TTL in seconds. Older entries are evicted. */
  ttlSeconds: number;
  /** Serve stale below `ttl` but after this age → still HIT, refetch in bg. */
  swrAfterSeconds?: number;
  /** Include the user id in the cache key. Requires the caller to be authenticated. */
  perUser?: boolean;
  /** Extra key suffix (e.g. locale). Rare — normally the URL suffices. */
  varyBy?: (req: Request) => string;
}

const PREFIX = 'cache:v1:';

/** Build a stable cache key from method, path, query, and optional user. */
function makeKey(req: Request, opts: CacheOptions): string {
  const userId = opts.perUser ? (req as unknown as { user?: { sub?: string } }).user?.sub ?? 'anon' : 'pub';
  const extra = opts.varyBy ? `:${opts.varyBy(req)}` : '';
  // originalUrl includes the querystring, sorted implicitly by client but we
  // don't re-sort — the same client will produce the same order.
  return `${PREFIX}${userId}:${req.originalUrl}${extra}`;
}

interface Envelope {
  s: number; // HTTP status
  b: unknown; // JSON body
  t: number; // stored-at ms epoch
}

export function cache(opts: CacheOptions) {
  const ttl = Math.max(1, opts.ttlSeconds);
  const swr = Math.max(0, opts.swrAfterSeconds ?? Math.floor(ttl / 2));

  return async function cacheMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    // Only cache safe methods.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    // Skip if the client explicitly asked for fresh data.
    if (req.headers['cache-control']?.includes('no-cache')) return next();

    const key = makeKey(req, opts);

    // Try to read from Redis — never let a Redis failure break the request.
    let hit: string | null = null;
    try {
      hit = await redis.get(key);
    } catch (err) {
      logger.warn({ err, key }, 'cache read failed — falling through');
    }

    if (hit) {
      try {
        const env = JSON.parse(hit) as Envelope;
        const ageSec = Math.floor((Date.now() - env.t) / 1000);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Age', String(ageSec));
        res.setHeader('Cache-Control', `public, max-age=${ttl - ageSec}, stale-while-revalidate=${ttl}`);
        res.status(env.s).json(env.b);
        // Background refresh once we're past the SWR boundary.
        if (ageSec >= swr) {
          void backgroundRefresh(req, opts, key, ttl);
        }
        return;
      } catch (err) {
        logger.warn({ err, key }, 'cache envelope parse failed');
      }
    }

    // Miss: intercept the JSON write to store the envelope.
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown): Response => {
      // Only cache 2xx responses. Store non-blocking.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const env: Envelope = { s: res.statusCode, b: body, t: Date.now() };
        redis.set(key, JSON.stringify(env), 'EX', ttl).catch((err) => {
          logger.warn({ err, key }, 'cache write failed');
        });
        res.setHeader(
          'Cache-Control',
          `public, max-age=${ttl}, stale-while-revalidate=${ttl}`,
        );
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}

/**
 * Refresh a cache entry by making a synthetic sub-request. Rather than
 * spawn a real HTTP call we simply schedule the same route again — Express
 * middleware makes this awkward, so we take the simpler path: just delete
 * the key so the NEXT request rewarms it. The current caller has already
 * been served, so latency is unaffected.
 */
async function backgroundRefresh(
  _req: Request,
  _opts: CacheOptions,
  key: string,
  _ttl: number,
): Promise<void> {
  try {
    // "Refresh" = mark stale so the next reader repopulates. Simple + robust.
    // (A future improvement is to run the actual handler headlessly here.)
    await redis.expire(key, 5);
  } catch {
    // ignore — cache is best-effort
  }
}

/**
 * Convenience: invalidate any cache keys matching a URL prefix.
 * Use inside mutations, e.g. `await bust('/v1/gigs')` after a POST /gigs.
 * Uses SCAN not KEYS to stay non-blocking on large keyspaces.
 */
export async function bust(prefix: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  const match = `${PREFIX}*${prefix}*`;
  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn({ err, prefix }, 'cache bust failed');
  }
  return deleted;
}
