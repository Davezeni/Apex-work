import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    oAuthAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

import { link } from './oauthAccounts.service.js';

const profile = {
  provider: 'google' as const,
  providerAccountId: 'google-user-1',
  email: 'user@example.com',
  fullName: 'Apex User',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('OAuth account linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) => {
        if ('id' in where) return Promise.resolve({ id: 'user-1' });
        return Promise.resolve(null);
      },
    );
    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.oAuthAccount.create.mockResolvedValue({ id: 'oauth-1' });
    prismaMock.oAuthAccount.update.mockResolvedValue({ id: 'oauth-1' });
  });

  it('links a new provider identity without issuing a session', async () => {
    await expect(link('user-1', profile)).resolves.toEqual({
      ok: true,
      provider: 'google',
      email: 'user@example.com',
    });

    expect(prismaMock.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        provider: 'google',
        providerAccountId: 'google-user-1',
        userId: 'user-1',
        email: 'user@example.com',
        profileName: 'Apex User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(prismaMock.oAuthAccount.update).not.toHaveBeenCalled();
  });

  it('rejects a provider identity owned by another Apex-Work account', async () => {
    prismaMock.oAuthAccount.findUnique.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        'provider_providerAccountId' in where
          ? Promise.resolve({ id: 'oauth-1', userId: 'other-user' })
          : Promise.resolve(null),
    );

    await expect(link('user-1', profile)).rejects.toMatchObject({
      statusCode: 409,
      message: 'That provider account is already connected to another Apex-Work account',
    });
    expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('rejects a provider email belonging to another Apex-Work account', async () => {
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) => {
        if ('id' in where) return Promise.resolve({ id: 'user-1' });
        return Promise.resolve({ id: 'other-user' });
      },
    );

    await expect(link('user-1', profile)).rejects.toMatchObject({
      statusCode: 409,
      message: 'That provider email belongs to another Apex-Work account',
    });
    expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('refreshes an already linked identity for the same account idempotently', async () => {
    prismaMock.oAuthAccount.findUnique.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        'provider_providerAccountId' in where
          ? Promise.resolve({ id: 'oauth-1', userId: 'user-1' })
          : Promise.resolve({ id: 'oauth-1' }),
    );

    await expect(link('user-1', profile)).resolves.toMatchObject({ ok: true, provider: 'google' });
    expect(prismaMock.oAuthAccount.update).toHaveBeenCalledWith({
      where: { id: 'oauth-1' },
      data: {
        email: 'user@example.com',
        profileName: 'Apex User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
  });
});
