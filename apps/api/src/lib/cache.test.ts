import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

vi.mock('./redis.js', () => ({ redis: redisMock }));
vi.mock('../config/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { cacheKey, cachedRead, invalidate, invalidatePrefix } from './cache.js';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cacheKey', () => {
  it('builds a namespaced key and drops empty components', () => {
    expect(cacheKey('gig', 'slug-1', undefined, null)).toBe('apex-cache:gig:slug-1');
    expect(cacheKey('gig')).toBe('apex-cache:gig');
    expect(cacheKey('cats', 'x', 2)).toBe('apex-cache:cats:x:2');
  });
});

describe('cachedRead', () => {
  it('returns the cached value without calling the loader on a hit', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ a: 1 }));
    const loader = vi.fn().mockResolvedValue({ a: 1 });

    const out = await cachedRead('k', loader);
    expect(out).toEqual({ a: 1 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('calls the loader and writes to cache on a miss', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    const loader = vi.fn().mockResolvedValue({ b: 2 });

    const out = await cachedRead('k', loader, 30);
    expect(out).toEqual({ b: 2 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith('k', JSON.stringify({ b: 2 }), 'EX', 30);
  });

  it('falls through to the loader when Redis is unavailable (never breaks)', async () => {
    redisMock.get.mockRejectedValue(new Error('redis down'));
    const loader = vi.fn().mockResolvedValue('live');

    const out = await cachedRead('k', loader);
    expect(out).toBe('live');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not treat a cache write failure as a read failure', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockRejectedValue(new Error('write boom'));
    const loader = vi.fn().mockResolvedValue({ ok: true });

    const out = await cachedRead('k', loader);
    expect(out).toEqual({ ok: true });
  });

  it('skips caching undefined results', async () => {
    redisMock.get.mockResolvedValue(null);
    const loader = vi.fn().mockResolvedValue(undefined);

    await cachedRead('k', loader);
    expect(redisMock.set).not.toHaveBeenCalled();
  });
});

describe('invalidate', () => {
  it('del-invalidates a single key', async () => {
    redisMock.del.mockResolvedValue(1);
    await invalidate('apex-cache:gig:x');
    expect(redisMock.del).toHaveBeenCalledWith('apex-cache:gig:x');
  });

  it('prefix-invalidates matching keys', async () => {
    redisMock.keys.mockResolvedValue(['apex-cache:cats', 'apex-cache:cats:web']);
    redisMock.del.mockResolvedValue(2);
    await invalidatePrefix('cats');
    expect(redisMock.del).toHaveBeenCalledWith('apex-cache:cats', 'apex-cache:cats:web');
  });

  it('swallows Redis errors (best-effort)', async () => {
    redisMock.keys.mockRejectedValue(new Error('boom'));
    await expect(invalidatePrefix('cats')).resolves.toBeUndefined();
  });
});
