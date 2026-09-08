import rateLimit, {
  MemoryStore,
  type Store,
  type Options,
  type IncrementResponse,
} from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { failure } from '../lib/response.js';
import { RATE_LIMITS } from '@apex-work/shared';
import { logger } from '../config/logger.js';

/**
 * A store that uses Redis when it is ready and transparently falls back to a
 * local in-memory counter during a Redis outage. This guarantees rate limits
 * are still ENFORCED (unlike silently disabling them), at the cost of the
 * counters being per-instance while degraded. When Redis returns, counts
 * resume against the shared store automatically.
 */
class ResilientStore implements Store {
  private readonly memory: MemoryStore;
  private readonly remote: Store;
  public readonly prefix: string;
  // Mirrors the shared Redis store: keys affect other instances, so keep the
  // double-count validation active (same behaviour as before this change).
  public readonly localKeys = false;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.memory = new MemoryStore();
    this.remote = new RedisStore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: unknown[]) => (redis as any).call(...args),
      prefix,
    });
  }

  private get active(): Store {
    return redis.status === 'ready' ? this.remote : this.memory;
  }

  init(options: Options): void {
    this.memory.init(options);
    this.remote.init?.(options);
  }

  increment(key: string): Promise<IncrementResponse> | IncrementResponse {
    return this.active.increment(key);
  }

  decrement(key: string): Promise<void> | void {
    return this.active.decrement(key);
  }

  resetKey(key: string): Promise<void> | void {
    return this.active.resetKey(key);
  }

  resetAll(): Promise<void> | void {
    return this.active.resetAll?.();
  }

  shutdown(): void {
    this.memory.shutdown();
    this.remote.shutdown?.();
  }
}

/**
 * Build a Redis-backed rate limiter that degrades to an in-memory counter if
 * Redis is unavailable, instead of throwing or dropping the limit entirely.
 * This keeps brute-force protection on auth/OTP/PIN endpoints ALIVE even when
 * Redis is down, while still scaling with the shared store when healthy.
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
    store: new ResilientStore(`rl:${key}:`),
    handler: (_req, res) =>
      failure(res, 'RATE_LIMITED', 'Too many requests, please try again later', 429),
    ...overrides,
  });

// Log state changes once so operators know the store switched to memory.
let warnedRedisDown = false;
redis.on('end', () => {
  if (!warnedRedisDown) {
    logger.warn('Redis disconnected — rate limiting falling back to local memory');
    warnedRedisDown = true;
  }
});
redis.on('ready', () => {
  if (warnedRedisDown) {
    logger.info('Redis reconnected — rate limiting back on shared stores');
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
/**
 * AI-limiter — tighter than the general limiter because every AI call hits an
 * LLM provider (cost + latency). 20 calls / min per IP/user.
 */
export const aiLimiter = makeLimiter('ai', RATE_LIMITS.ai.window, RATE_LIMITS.ai.max);

/**
 * PIN-specific limiter. PINs have only 1M possible values (6 digits), so an
 * attacker with a stolen device token could brute-force in minutes without
 * throttling. Cap PIN attempts at 10 per hour per phone.
 */
export const pinLimiter = makeLimiter('pin', 60 * 60 * 1000, 10, {
  keyGenerator: (req) => {
    const body = req.body as { phone?: string } | undefined;
    return body?.phone ?? req.ip ?? 'unknown';
  },
});
