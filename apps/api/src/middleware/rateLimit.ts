import rateLimit, { type Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { failure } from '../lib/response.js';
import { RATE_LIMITS } from '@apex-work/shared';

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
    store: new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: unknown[]) => (redis as any).call(...args),
      prefix: `rl:${key}:`,
    }),
    handler: (_req, res) =>
      failure(res, 'RATE_LIMITED', 'Too many requests, please try again later', 429),
    ...overrides,
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
