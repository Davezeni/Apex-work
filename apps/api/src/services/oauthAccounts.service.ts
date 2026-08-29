import type { OAuthProvider } from '@apex-work/shared';
import type { OAuthProfile } from './oauth.service.js';
import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export async function listMine(userId: string) {
  return prisma.oAuthAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      provider: true,
      email: true,
      profileName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
}

/**
 * Link a provider identity to the currently authenticated Apex-Work account.
 * This is deliberately separate from OAuth login: it never merges accounts,
 * never issues a new session, and refuses identities already owned elsewhere.
 */
export async function link(userId: string, profile: OAuthProfile) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('User');

  const providerAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: { id: true, userId: true },
  });
  if (providerAccount && providerAccount.userId !== userId) {
    throw new ConflictError(
      'That provider account is already connected to another Apex-Work account',
    );
  }

  const existingForProvider = await prisma.oAuthAccount.findUnique({
    where: { userId_provider: { userId, provider: profile.provider } },
    select: { id: true },
  });
  if (existingForProvider && !providerAccount) {
    throw new ConflictError(`A different ${profile.provider} account is already connected`);
  }

  if (profile.email) {
    const emailOwner = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== userId) {
      throw new ConflictError('That provider email belongs to another Apex-Work account');
    }
  }

  if (providerAccount) {
    await prisma.oAuthAccount.update({
      where: { id: providerAccount.id },
      data: {
        email: profile.email ?? null,
        profileName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
    return { ok: true, provider: profile.provider, email: profile.email ?? null };
  }

  try {
    await prisma.oAuthAccount.create({
      data: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        userId,
        email: profile.email ?? null,
        profileName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
  } catch (error) {
    // A concurrent link can win either unique constraint. Do not turn it into
    // an unhandled 500 or silently attach the wrong provider identity.
    if ((error as { code?: string }).code === 'P2002') {
      throw new ConflictError('That provider account was linked in another session');
    }
    throw error;
  }
  return { ok: true, provider: profile.provider, email: profile.email ?? null };
}

/**
 * Never allow an OAuth-only user to remove their final sign-in method. They
 * must first add a phone, password, or passkey so the account cannot become
 * inaccessible.
 */
export async function unlink(userId: string, provider: OAuthProvider) {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider },
    select: { id: true },
  });
  if (!account) throw new NotFoundError('OAuth account');

  const [oauthCount, passkeyCount, user] = await Promise.all([
    prisma.oAuthAccount.count({ where: { userId } }),
    prisma.passkey.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, isPhoneVerified: true, passwordHash: true },
    }),
  ]);

  const hasAnotherRecoveryMethod =
    oauthCount > 1 ||
    passkeyCount > 0 ||
    !!user?.passwordHash ||
    (!!user?.phone && user.isPhoneVerified);
  if (!hasAnotherRecoveryMethod) {
    throw new ConflictError(
      'Add a phone, password, or passkey before disconnecting your last sign-in method',
    );
  }

  await prisma.oAuthAccount.delete({ where: { id: account.id } });
  return { ok: true, provider };
}
