import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), keys: vi.fn() },
}));

import {
  listContentPages,
  getContentPage,
  upsertContentPage,
  getSiteConfig,
  upsertSiteConfig,
  getHomeConfig,
  upsertHomeConfig,
  CONTENT_PAGES,
  DEFAULT_SITE_CONFIG,
  DEFAULT_HOME_CONFIG,
} from './content.service.js';

describe('content service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists every known content page with built-in defaults when unset', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([]);
    const pages = await listContentPages();
    expect(pages.length).toBe(CONTENT_PAGES.length);
    expect(pages.some((p) => p.slug === 'privacy' && p.markdown.includes('Data we collect'))).toBe(
      true,
    );
    expect(pages.every((p) => p.updatedAt === null)).toBe(true);
  });

  it('returns the default markdown for an unset page', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const page = await getContentPage('terms');
    expect(page?.slug).toBe('terms');
    expect(page?.title).toBe('Terms & Conditions');
    expect(page?.markdown).toContain('Governing law');
    expect(page?.updatedAt).toBeNull();
  });

  it('returns a stored (edited) page and its updatedAt', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'content.page.privacy',
      value: { title: 'Our Privacy', markdown: '## Edited\nnew text' },
      updatedAt: new Date('2026-09-08T10:00:00Z'),
    });
    const page = await getContentPage('privacy');
    expect(page?.title).toBe('Our Privacy');
    expect(page?.markdown).toBe('## Edited\nnew text');
    expect(page?.updatedAt).not.toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    const page = await getContentPage('does-not-exist');
    expect(page).toBeNull();
  });

  it('persists an edit and invalidates the cache', async () => {
    const { redis } = await import('../lib/redis.js');
    prismaMock.appSetting.upsert.mockResolvedValue({
      key: 'content.page.faq',
      value: { title: 'FAQ', markdown: '## Q' },
      updatedAt: new Date('2026-09-08T10:00:00Z'),
    });
    const page = await upsertContentPage('faq', { title: 'FAQ', markdown: '## Q' }, 'admin-1');
    expect(page.slug).toBe('faq');
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'content.page.faq' },
        create: expect.objectContaining({
          value: { title: 'FAQ', markdown: '## Q' },
          updatedById: 'admin-1',
        }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith('apex-cache:content:page:faq');
  });

  it('rejects an unknown slug on upsert', async () => {
    await expect(
      upsertContentPage('nope', { title: 'X', markdown: 'Y' }, 'admin-1'),
    ).rejects.toThrow(/Unknown content page/);
  });

  it('returns the bundled site config defaults when unset', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const cfg = await getSiteConfig();
    expect(cfg).toEqual(DEFAULT_SITE_CONFIG);
  });

  it('returns a stored (edited) site config', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'content.site',
      value: { ...DEFAULT_SITE_CONFIG, supportEmail: 'hello@apex-work.com' },
    });
    const cfg = await getSiteConfig();
    expect(cfg.supportEmail).toBe('hello@apex-work.com');
    expect(cfg.brandName).toBe(DEFAULT_SITE_CONFIG.brandName);
  });

  it('persists a site config edit and invalidates the cache', async () => {
    const { redis } = await import('../lib/redis.js');
    prismaMock.appSetting.upsert.mockResolvedValue({
      key: 'content.site',
      value: DEFAULT_SITE_CONFIG,
    });
    const cfg = await upsertSiteConfig(
      { ...DEFAULT_SITE_CONFIG, supportPhone: '+251900000000' },
      'admin-1',
    );
    expect(cfg.supportPhone).toBe('+251900000000');
    expect(redis.del).toHaveBeenCalledWith('apex-cache:content:site');
  });

  it('rejects an invalid site config (bad email)', async () => {
    await expect(
      upsertSiteConfig({ ...DEFAULT_SITE_CONFIG, supportEmail: 'nope' }, 'admin-1'),
    ).rejects.toThrow();
  });

  it('returns the bundled home marketing config defaults when unset', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const cfg = await getHomeConfig();
    expect(cfg.heroTitle).toBe(DEFAULT_HOME_CONFIG.heroTitle);
    expect(cfg.stats.length).toBe(DEFAULT_HOME_CONFIG.stats.length);
    expect(cfg.featured.length).toBe(DEFAULT_HOME_CONFIG.featured.length);
  });

  it('returns a stored (edited) home config', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'content.home',
      value: { ...DEFAULT_HOME_CONFIG, heroBadge: 'Now live in Bahir Dar' },
    });
    const cfg = await getHomeConfig();
    expect(cfg.heroBadge).toBe('Now live in Bahir Dar');
  });

  it('persists a home config edit and invalidates the cache', async () => {
    const { redis } = await import('../lib/redis.js');
    prismaMock.appSetting.upsert.mockResolvedValue({
      key: 'content.home',
      value: DEFAULT_HOME_CONFIG,
    });
    const cfg = await upsertHomeConfig(
      { ...DEFAULT_HOME_CONFIG, heroCtaPrimary: 'Browse services' },
      'admin-1',
    );
    expect(cfg.heroCtaPrimary).toBe('Browse services');
    expect(redis.del).toHaveBeenCalledWith('apex-cache:content:home');
  });

  it('rejects an invalid home config (empty stats array / bad gradient)', async () => {
    await expect(
      upsertHomeConfig({ ...DEFAULT_HOME_CONFIG, stats: [] }, 'admin-1'),
    ).rejects.toThrow();
    const featured = DEFAULT_HOME_CONFIG.featured[0] ?? {
      name: 'X',
      title: 'Y',
      city: 'Z',
      rating: '5.0',
      reviews: 1,
      skills: [],
      price: 1,
      gradient: 'from-a to-b',
    };
    await expect(
      upsertHomeConfig(
        { ...DEFAULT_HOME_CONFIG, featured: [{ ...featured, gradient: 'invalid' }] },
        'admin-1',
      ),
    ).rejects.toThrow();
  });
});
