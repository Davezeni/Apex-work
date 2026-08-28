import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, redisMock, trustedDeviceMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn() },
  },
  redisMock: {
    get: vi.fn(),
    del: vi.fn(),
  },
  trustedDeviceMock: {
    issueTrustedDevice: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));
vi.mock('./sms.service.js', () => ({ sms: { name: 'test', send: vi.fn() } }));
vi.mock('./trustedDevice.service.js', () => ({
  findUserByTrustedDevice: vi.fn(),
  issueTrustedDevice: trustedDeviceMock.issueTrustedDevice,
}));

import { completeOAuthSignup, completePhoneVerification } from './auth.service.js';

describe('OAuth phone step-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.del.mockResolvedValue(1);
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });
    trustedDeviceMock.issueTrustedDevice.mockResolvedValue({
      deviceToken: 'device-token-12345678901234567890',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('rejects a signup-purpose token for the logged-in phone step-up', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({
      phone: '+251911111111', purpose: 'SIGNUP', userId: null,
    }));

    await expect(completePhoneVerification('oauth-user', {
      phone: '+251911111111', otpToken: 'otp-token',
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('binds a free RESET-verified phone and marks it verified', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({
      phone: '+251911111111', purpose: 'RESET', userId: null,
    }));
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({ phone: '+251911111111', isPhoneVerified: true });

    await expect(completePhoneVerification('oauth-user', {
      phone: '+251911111111', otpToken: 'otp-token',
    })).resolves.toEqual({ phone: '+251911111111', isPhoneVerified: true });
    expect(redisMock.del).toHaveBeenCalledWith(expect.stringContaining('otp-token'));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'oauth-user' },
      data: { phone: '+251911111111', isPhoneVerified: true },
      select: { phone: true, isPhoneVerified: true },
    });
  });

  it('does not take a phone number already owned by another account', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({
      phone: '+251911111111', purpose: 'RESET', userId: 'other-user',
    }));

    await expect(completePhoneVerification('oauth-user', {
      phone: '+251911111111', otpToken: 'otp-token',
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('creates a limited OAuth account without phone verification', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'oauth-user', role: 'CLIENT' });
    const result = await completeOAuthSignup({
      provider: 'google',
      providerAccountId: 'google-user-1',
      email: 'user@gmail.com',
      fullName: 'Google User',
      avatarUrl: 'https://lh.example/avatar.png',
    }, {
      fullName: 'Google User',
      role: 'CLIENT',
    }, { userAgent: 'unit-test', ipAddress: '127.0.0.1' });

    expect(result.user).toEqual({ id: 'oauth-user', role: 'CLIENT' });
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: null, isPhoneVerified: false }),
    }));
    expect(trustedDeviceMock.issueTrustedDevice).toHaveBeenCalled();
  });
});
