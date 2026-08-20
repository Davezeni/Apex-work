import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Shared Redis client for cache, rate-limits, sessions, pub/sub.
 * ioredis auto-reconnects; we set lazyConnect=false so failure surfaces early.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

/** Separate connection for Socket.io adapter (pub/sub) */
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();
