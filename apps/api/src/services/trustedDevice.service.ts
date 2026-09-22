/**
 * Trusted-device pattern (Telegram/WhatsApp/Uber model):
 *
 *   1. First login on a device → user completes OTP flow.
 *   2. We issue a random `deviceToken` (256 bits) + store its sha256 hash.
 *   3. Client persists the raw token in localStorage.
 *   4. On subsequent OTP requests, client sends deviceToken. If it's a valid
 *      match for the given phone, we skip OTP entirely and mint a session.
 *   5. Tokens roll over: every use extends the expiresAt to +30 days.
 *   6. Revocation: DB row deletion or explicit sign-out-everywhere.
 *
 * Security invariants:
 *   - Raw token NEVER lands in the DB (only its hash).
 *   - Tokens are per-user and single-use for issuance (can't share across phones).
 *   - A device is a soft factor, NOT a bearer credential — user still needs
 *     access to the phone number to bootstrap it. Compromising the DB gives
 *     an attacker nothing; compromising the browser gives them one session.
 */
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { writeUserAudit } from '../lib/audit.js';

const TRUST_DAYS = 30;
const TRUST_MS = TRUST_DAYS * 24 * 60 * 60 * 1000;

/** Parse a User-Agent string into something short + human-readable. */
export function labelForUA(ua: string | undefined | null): string {
  if (!ua) return 'Unknown device';
  // Extremely cheap heuristics — no ua-parser-js needed for our purposes.
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const os = /iPhone|iPad|iOS/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Mac OS X/i.test(ua)
        ? 'macOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Firefox/i.test(ua)
        ? 'Firefox'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${os}${isMobile ? ' Mobile' : ''} · ${browser}`;
}

export interface IssueDeviceInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

/** Mint a new trusted-device record + return the raw token to send to client. */
export async function issueTrustedDevice(input: IssueDeviceInput): Promise<{
  deviceToken: string;
  expiresAt: Date;
}> {
  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + TRUST_MS);
  // First time we see this device type for this user → worth an audit row.
  // Repeat logins from the same browser stay silent (no noise).
  const label = labelForUA(input.userAgent);
  const seenBefore = await prisma.trustedDevice.count({
    where: { userId: input.userId, label },
  });
  const created = await prisma.trustedDevice.create({
    data: {
      userId: input.userId,
      tokenHash,
      label,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt,
    },
  });
  if (seenBefore === 0) {
    void writeUserAudit({
      userId: input.userId,
      action: 'AUTH.DEVICE_ADDED',
      resourceType: 'DEVICE',
      resourceId: created.id,
      meta: { label },
    });
  }
  return { deviceToken: raw, expiresAt };
}

/**
 * Look up a device token for a given phone. Returns the User if valid + not
 * expired + not revoked. Rolls the expiry forward on successful match so
 * frequently-used devices stay trusted indefinitely.
 */
export async function findUserByTrustedDevice(
  phone: string,
  deviceToken: string,
): Promise<User | null> {
  if (!deviceToken || deviceToken.length < 20) return null;
  const tokenHash = sha256(deviceToken);
  const now = new Date();

  const record = await prisma.trustedDevice.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < now) return null;
  if (record.user.phone !== phone) return null;
  if (!record.user.isActive) return null;

  // Rolling expiry — extend on use.
  await prisma.trustedDevice.update({
    where: { id: record.id },
    data: {
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + TRUST_MS),
    },
  });

  return record.user;
}

/** List a user's trusted devices for the "Sessions" settings screen. */
export async function listUserDevices(userId: string) {
  return prisma.trustedDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      label: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}

/** Revoke a specific device (user removes it from their sessions list). */
export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const res = await prisma.trustedDevice.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** Revoke ALL devices for a user — used when they lose their phone. */
export async function revokeAllDevices(userId: string): Promise<number> {
  const res = await prisma.trustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
