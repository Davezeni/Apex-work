import type { OAuthProvider } from '@apex-work/shared';
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
