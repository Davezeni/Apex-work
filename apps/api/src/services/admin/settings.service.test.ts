import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appSetting: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
// The settings service now caches the platform fee via Redis. Stub the Redis
// client so tests run without a live server and cachedRead falls through to
// the live loader (getSetting), keeping the unit assertions meaningful.
vi.mock('../../lib/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), keys: vi.fn() },
}));

import {
  upsertSetting,
  listSettings,
  getPlatformFeePercent,
  SETTING_KEYS,
} from './settings.service.js';

describe('settings service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unknown setting key', async () => {
    await expect(upsertSetting('bogus.key', 1, 'admin-1')).rejects.toThrow(/Unknown setting key/);
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range platform fee', async () => {
    await expect(upsertSetting(SETTING_KEYS.platformFeePercent, 101, 'admin-1')).rejects.toThrow();
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('persists a valid platform fee', async () => {
    prismaMock.appSetting.upsert.mockResolvedValue({
      key: SETTING_KEYS.platformFeePercent,
      value: 12,
    });
    const res = await upsertSetting(SETTING_KEYS.platformFeePercent, 12, 'admin-1');
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: SETTING_KEYS.platformFeePercent },
        create: expect.objectContaining({ value: 12, updatedById: 'admin-1' }),
      }),
    );
    expect(res.value).toBe(12);
  });

  it('invalidates the platform-fee cache when the fee is persisted', async () => {
    // Capture the redis.del mock exposed via the redis module mock.
    const { redis } = await import('../../lib/redis.js');
    prismaMock.appSetting.upsert.mockResolvedValue({
      key: SETTING_KEYS.platformFeePercent,
      value: 18,
    });
    await upsertSetting(SETTING_KEYS.platformFeePercent, 18, 'admin-1');
    expect(redis.del).toHaveBeenCalledWith('apex-cache:settings:platform-fee');
  });

  it('returns the default fee when nothing is stored', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    expect(await getPlatformFeePercent()).toBe(10);
  });

  it('returns an override fee when stored', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: SETTING_KEYS.platformFeePercent,
      value: 15,
    });
    expect(await getPlatformFeePercent()).toBe(15);
  });

  it('lists every known setting even when unset, with a null updatedAt', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    const all = await listSettings();
    expect(all.length).toBe(Object.keys(SETTING_KEYS).length);
    expect(all.every((s) => s.updatedAt === null)).toBe(true);
  });

  it('attributes an updated setting to the admin who last touched it', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.platformFeePercent,
        value: 12,
        updatedAt: new Date(),
        updatedById: 'admin-1',
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'admin-1', fullName: 'Aster Kebede', username: 'aster' },
    ]);
    const all = await listSettings();
    const fee = all.find((s) => s.key === SETTING_KEYS.platformFeePercent)!;
    expect(fee.exists).toBe(true);
    expect(fee.updatedByName).toContain('Aster Kebede');
  });
});
