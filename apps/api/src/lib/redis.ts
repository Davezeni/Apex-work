import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Shared Redis client for cache, rate-limits, sessions, pub/sub.
 *
 * Resilience:
 * - Exponential backoff on retries (up to 30s between attempts).
 * - Auth errors (WRONGPASS) don't cause an infinite tight-loop reconnect.
 * - Errors are logged once per state change, not per attempt.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Exponential backoff, capped at 30s
  retryStrategy: (times) => Math.min(times * 500, 30_000),
  // On specific errors (like auth failures), don't retry commands — surface the error.
  reconnectOnError: (err) => {
    const msg = err.message ?? '';
    // Don't reconnect on auth errors — they're config problems, not transient.
    if (msg.includes('WRONGPASS') || msg.includes('NOAUTH')) return false;
    return true;
  },
});

// De-dupe noisy repeated errors — log once per unique error message.
const seenErrors = new Set<string>();
redis.on('error', (err) => {
  const key = err.message ?? String(err);
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  logger.error({ err: { message: key, code: (err as { code?: string }).code } }, 'Redis error');
  // Clear the dedupe set after 60s so we hear about persistent issues periodically.
  setTimeout(() => seenErrors.delete(key), 60_000);
});
redis.on('ready', () => {
  seenErrors.clear();
  logger.info('Redis ready');
});
redis.on('connect', () => logger.debug('Redis TCP connected'));

/** Separate connection for Socket.io adapter (pub/sub) */
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();
