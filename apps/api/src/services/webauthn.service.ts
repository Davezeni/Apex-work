/**
 * WebAuthn (passkeys) via @simplewebauthn/server.
 *
 * Flow:
 *   REGISTER (already-authed user adds a passkey):
 *     1. Client GETs /v1/auth/passkey/register-options → server generates challenge,
 *        stores it in Redis keyed by userId (5min TTL).
 *     2. Browser prompts biometric, returns attestation.
 *     3. Client POSTs the attestation to /v1/auth/passkey/register → server verifies
 *        against the stored challenge and persists a Passkey row.
 *
 *   LOGIN (unauthenticated repeat visit):
 *     1. Client POSTs /v1/auth/passkey/login-options with phone → server looks up
 *        that user's registered credentials, generates a challenge, stores it in
 *        Redis keyed by phone.
 *     2. Browser prompts biometric using any of those credentials.
 *     3. Client POSTs the assertion to /v1/auth/passkey/login → server verifies
 *        against the stored challenge + credential public key, mints session tokens.
 *
 * Storage of raw credentials:
 *   credentialId + publicKey are base64url strings (opaque to us).
 *   counter is a monotonic value to detect cloned authenticators.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../lib/errors.js';

const CHALLENGE_TTL_SEC = 5 * 60;

function rpConfig(): { rpID: string; rpName: string; origin: string } {
  const rpID = env.WEBAUTHN_RP_ID ?? new URL(env.WEB_URL).hostname;
  const origin = env.WEBAUTHN_RP_ORIGIN ?? env.WEB_URL;
  return { rpID, rpName: env.WEBAUTHN_RP_NAME, origin };
}

// -------------------- Registration --------------------

export async function beginRegistration(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, fullName: true, passkeys: { select: { credentialId: true, transports: true } } },
  });
  if (!user) throw new NotFoundError('User');
  const { rpID, rpName } = rpConfig();

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    userDisplayName: user.fullName,
    // Prefer platform (built-in) authenticators for best UX (Face ID, fingerprint).
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as ('internal' | 'usb' | 'nfc' | 'ble')[],
    })),
    attestationType: 'none',
    timeout: 60_000,
  });

  await redis.setex(`webauthn:reg:${userId}`, CHALLENGE_TTL_SEC, options.challenge);
  return options;
}

export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  label?: string,
) {
  const expectedChallenge = await redis.get(`webauthn:reg:${userId}`);
  if (!expectedChallenge) throw new BadRequestError('Registration challenge expired');
  const { rpID, origin } = rpConfig();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new BadRequestError('Passkey registration failed verification');
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const passkey = await prisma.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: BigInt(credential.counter),
      transports: (credential.transports ?? []) as string[],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      label: label ?? null,
    },
    select: { id: true, label: true, createdAt: true },
  });

  await redis.del(`webauthn:reg:${userId}`);
  return passkey;
}

// -------------------- Authentication --------------------

export async function beginAuthentication(phone: string) {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      passkeys: { select: { credentialId: true, transports: true } },
    },
  });
  if (!user) throw new NotFoundError('User');
  if (user.passkeys.length === 0) {
    throw new BadRequestError('No passkeys registered for this account');
  }
  const { rpID } = rpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as ('internal' | 'usb' | 'nfc' | 'ble')[],
    })),
    timeout: 60_000,
  });

  await redis.setex(`webauthn:auth:${phone}`, CHALLENGE_TTL_SEC, options.challenge);
  return options;
}

export async function finishAuthentication(
  phone: string,
  response: AuthenticationResponseJSON,
): Promise<{ userId: string; role: string }> {
  const expectedChallenge = await redis.get(`webauthn:auth:${phone}`);
  if (!expectedChallenge) throw new BadRequestError('Authentication challenge expired');
  const { rpID, origin } = rpConfig();

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: { select: { id: true, role: true, phone: true, isActive: true } } },
  });
  if (!passkey) throw new UnauthorizedError('Unknown passkey');
  if (passkey.user.phone !== phone) throw new UnauthorizedError('Passkey does not belong to this account');
  if (!passkey.user.isActive) throw new UnauthorizedError('Account inactive');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
      counter: Number(passkey.counter),
      transports: passkey.transports as ('internal' | 'usb' | 'nfc' | 'ble')[],
    },
    requireUserVerification: false,
  });

  if (!verification.verified) throw new UnauthorizedError('Passkey verification failed');

  // Bump the counter (cloned authenticator detection) + lastUsedAt.
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });
  await redis.del(`webauthn:auth:${phone}`);

  return { userId: passkey.user.id, role: passkey.user.role };
}

// -------------------- Management --------------------

export async function listUserPasskeys(userId: string) {
  return prisma.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

export async function deletePasskey(userId: string, passkeyId: string): Promise<boolean> {
  const res = await prisma.passkey.deleteMany({ where: { id: passkeyId, userId } });
  return res.count > 0;
}
