import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    setex: vi.fn(),
    get: vi.fn(),
    getdel: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

import {
  callbackUrl,
  consumeHandoff,
  consumeState,
  createHandoff,
  exchangeCode,
  start,
} from './oauth.service.js';

describe('OAuth provider integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.setex.mockResolvedValue('OK');
    redisMock.getdel.mockResolvedValue(null);
    redisMock.del.mockResolvedValue(1);
  });

  it('builds a Google authorization URL and stores a single-use state', async () => {
    const url = await start('google', 'FREELANCER', '/onboarding');
    const parsed = new URL(url);
    const state = parsed.searchParams.get('state');

    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.searchParams.get('client_id')).toBe('google-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe(callbackUrl('google'));
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
    expect(state).toBeTruthy();
    expect(redisMock.setex).toHaveBeenCalledWith(
      expect.stringContaining(`oauth:state:${state}`),
      600,
      expect.stringContaining('FREELANCER'),
    );
  });

  it('consumes matching state and rejects a missing state', async () => {
    redisMock.getdel.mockResolvedValueOnce(JSON.stringify({
      provider: 'github', role: 'CLIENT', next: '/profile',
    }));
    await expect(consumeState('state-123', 'github')).resolves.toEqual({
      provider: 'github', role: 'CLIENT', next: '/profile',
    });
    expect(redisMock.getdel).toHaveBeenCalledWith('oauth:state:state-123');

    redisMock.getdel.mockResolvedValueOnce(null);
    await expect(consumeState('expired-state', 'github')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('exchanges a Google code without exposing the provider token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-secret-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sub: 'google-user-1',
        name: 'Google User',
        email: 'user@gmail.com',
        email_verified: true,
        picture: 'https://lh.example/avatar.png',
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeCode('google', 'auth-code');
    expect(result).toEqual({
      provider: 'google',
      providerAccountId: 'google-user-1',
      email: 'user@gmail.com',
      fullName: 'Google User',
      avatarUrl: 'https://lh.example/avatar.png',
    });
    expect(JSON.stringify(result)).not.toContain('google-secret-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exchanges a GitHub code and chooses the verified primary email', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'github-secret-token' }), { status: 200 });
      }
      if (url.endsWith('/user')) {
        return new Response(JSON.stringify({ id: 42, login: 'octocat', name: null, avatar_url: 'https://github.com/avatar.png' }), { status: 200 });
      }
      return new Response(JSON.stringify([
        { email: 'old@example.com', primary: false, verified: true },
        { email: 'octo@example.com', primary: true, verified: true },
      ]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('github', 'auth-code')).resolves.toEqual({
      provider: 'github',
      providerAccountId: '42',
      email: 'octo@example.com',
      fullName: 'octocat',
      avatarUrl: 'https://github.com/avatar.png',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('makes OAuth handoffs one-time', async () => {
    const handoff = await createHandoff({
      accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, phone: '+251911111111', requiresPhone: false,
    });
    expect(handoff.length).toBeGreaterThan(30);
    redisMock.getdel.mockResolvedValueOnce(JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, phone: '+251911111111', requiresPhone: false,
    }));
    await expect(consumeHandoff(handoff)).resolves.toMatchObject({ phone: '+251911111111' });
    expect(redisMock.getdel).toHaveBeenCalledWith(expect.stringContaining(handoff));
  });
});
