import rateLimit, { type Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { failure } from '../lib/response.js';
import { RATE_LIMITS } from '@apex-work/shared';
import { logger } from '../config/logger.js';

/**
 * Create a Redis-backed rate limiter that degrades gracefully if Redis is unavailable.
 * If Redis is down, we skip rate limiting (log a warning) instead of failing the request.
 * Bootstrap resilience > perfect rate limits; alerts should cover Redis outages.
 */
const makeLimiter = (
  key: string,
  windowMs: number,
  max: number,
  overrides: Partial<Options> = {},
) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip if Redis client is not ready — prevents 500s during startup or brief outages.
    skip: () => {
      if (redis.status !== 'ready') {
        // eslint-disable-next-line no-console
        return true;
      }
      return false;
    },
    store: new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: unknown[]) => (redis as any).call(...args),
      prefix: `rl:${key}:`,
    }),
    handler: (_req, res) =>
      failure(res, 'RATE_LIMITED', 'Too many requests, please try again later', 429),
    ...overrides,
  });

// Warn once when we're skipping due to Redis being down (avoids log spam).
let warnedRedisDown = false;
redis.on('end', () => {
  if (!warnedRedisDown) {
    logger.warn('Redis disconnected — rate limiting disabled until reconnect');
    warnedRedisDown = true;
  }
});
redis.on('ready', () => {
  if (warnedRedisDown) {
    logger.info('Redis reconnected — rate limiting re-enabled');
    warnedRedisDown = false;
  }
});

export const authLimiter = makeLimiter('auth', RATE_LIMITS.auth.window, RATE_LIMITS.auth.max);
export const otpLimiter = makeLimiter('otp', RATE_LIMITS.otp.window, RATE_LIMITS.otp.max, {
  // Key by phone in the body when present, else IP
  keyGenerator: (req) => {
    const body = req.body as { phone?: string } | undefined;
    return body?.phone ?? req.ip ?? 'unknown';
  },
});
export const apiLimiter = makeLimiter('api', RATE_LIMITS.api.window, RATE_LIMITS.api.max);
