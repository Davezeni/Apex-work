/**
 * Keepalive helpers.
 *
 * Two totally separate concerns living in one small module:
 *
 *   1) `startSelfPing()` — every 4 minutes, hit our own /v1/ping. On
 *      Render's free tier the dyno is idled after ~15min of inactivity,
 *      which manifests as a 30-60s cold start on the next request. A
 *      cheap in-process self-ping keeps the process considered "active"
 *      and — combined with our GitHub Actions cron warmer that hits us
 *      from outside every 5min — eliminates cold starts entirely.
 *
 *   2) `startRedisHeartbeat()` — every 4 minutes, `redis.ping()`. Upstash
 *      closes idle TLS connections after ~5 minutes, so the FIRST
 *      request after an idle window would previously eat one full RTT
 *      just to reconnect. Sending a PING every 4min defeats the idle
 *      timer without keeping any pending work.
 */
import { logger } from '../config/logger.js';
import { redis } from './redis.js';

const FOUR_MIN = 4 * 60 * 1000;

export function startRedisHeartbeat(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      await redis.ping();
    } catch (err) {
      // Don't spam logs; the ioredis error handler already logs the first.
      logger.debug({ err }, 'redis heartbeat failed');
    }
  }, FOUR_MIN);
  // Don't hold the event loop open just for pings.
  timer.unref();
  return timer;
}

export function startSelfPing(port: number): NodeJS.Timeout | null {
  // Only in production — no point during local dev.
  if (process.env.NODE_ENV !== 'production') return null;
  const url = `http://127.0.0.1:${port}/v1/ping`;
  const timer = setInterval(() => {
    // Best-effort HEAD. Native fetch (Node 20+) is fine.
    fetch(url, { method: 'HEAD' }).catch(() => undefined);
  }, FOUR_MIN);
  timer.unref();
  return timer;
}
