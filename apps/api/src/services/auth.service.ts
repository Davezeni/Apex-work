import { OTP_LENGTH, OTP_TTL_SECONDS, type UserRole } from '@apex-work/shared';
import type { OAuthProfile } from './oauth.service.js';
import type { OtpPurpose, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  generateOtp,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from '../lib/hash.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { env } from '../config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../lib/errors.js';
import { redis } from '../lib/redis.js';
import { sms } from './sms.service.js';
import { logger } from '../config/logger.js';
import {
  findUserByTrustedDevice,
  issueTrustedDevice,
} from './trustedDevice.service.js';

const OTP_TOKEN_PREFIX = 'otp-verified:'; // Redis key prefix
const OTP_TOKEN_TTL_SEC = 15 * 60; // token to complete signup after OTP

/**
 * Convert an "expires-in" like "30d" / "15m" / "1h" to seconds.
 * Only supports simple units — no ms lib needed.
 */
const parseDurationSec = (input: string): number => {
  const m = /^(\d+)([smhdw])$/.exec(input);
  if (!m) return 900;
  const [, n, unit] = m;
  const value = Number(n);
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    default: return 900;
  }
};

// ==========================================
// OTP
// ==========================================

export interface RequestOtpResult {
  /** true if we actually sent an SMS; false if the device is trusted (skip OTP). */
  sent: boolean;
  /** Set when sent=false — client should call POST /auth/login/trusted-device to complete login. */
  deviceTrusted?: boolean;
  /** Set when we already know who this is (for the client to show "signing in as X" hint). */
  hasPin?: boolean;
}

export const requestOtp = async (
  phone: string,
  purpose: OtpPurpose,
  deviceToken?: string,
): Promise<RequestOtpResult> => {
  // Business rules:
  // - SIGNUP: phone must NOT already have a user
  // - LOGIN: phone MUST have a user
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, pinHash: true },
  });
  if (purpose === 'SIGNUP' && existing) {
    throw new ConflictError('This phone number is already registered. Please sign in instead.');
  }
  if (purpose === 'LOGIN' && !existing) {
    // Use a specific code so the frontend can offer "Create an account?" fallback.
    const { AppError } = await import('../lib/errors.js');
    throw new AppError(
      'No account found for this phone. Sign up to create one.',
      404,
      'ACCOUNT_NOT_FOUND',
    );
  }

  // Fast path for LOGIN: if the caller has a trusted-device token for this
  // phone, tell them to complete via the trusted-device endpoint — no SMS,
  // no cost, no friction.
  if (purpose === 'LOGIN' && existing && deviceToken) {
    const trustedUser = await findUserByTrustedDevice(phone, deviceToken);
    if (trustedUser) {
      return { sent: false, deviceTrusted: true, hasPin: !!existing.pinHash };
    }
  }

  const code = generateOtp(OTP_LENGTH);
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  // Invalidate any pending OTPs for this phone/purpose
  await prisma.otp.updateMany({
    where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });

  await prisma.otp.create({ data: { phone, codeHash, purpose, expiresAt } });

  const message = `Your Apex-Work code is ${code}. Valid for ${OTP_TTL_SECONDS / 60} minutes. Do not share.`;
  const result = await sms.send(phone, message);
  if (!result.ok) {
    // In production with a real SMS provider, this is a hard fail — the user
    // will never receive the code. Surface it as a service unavailability.
    // In dev (console provider) result.ok is always true.
    logger.error({ phone, provider: sms.name, error: result.error }, 'SMS delivery failed');
    throw new (await import('../lib/errors.js')).AppError(
      'We could not send an SMS to that number. Please try again in a moment.',
      503,
      'SMS_DELIVERY_FAILED',
    );
  }
  return { sent: true, hasPin: !!existing?.pinHash };
};

/**
 * Verify OTP. On success, returns a short-lived token the client uses
 * to complete signup or perform actions like password reset.
 */
export const verifyOtp = async (
  phone: string,
  code: string,
): Promise<{ verifiedToken: string; userId: string | null }> => {
  const codeHash = sha256(code);

  // Grab most recent unconsumed OTP for phone
  const otp = await prisma.otp.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) throw new BadRequestError('Code expired or invalid. Request a new one.');

  // Constant-time compare via hash equality
  if (otp.codeHash !== codeHash) {
    // Track attempts; lock after N failures
    const updated = await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= 5) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestError('Too many wrong attempts. Request a new code.');
    }
    throw new BadRequestError('Incorrect code');
  }

  await prisma.otp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });

  // Issue a short-lived Redis-backed token so signup/reset flows can prove OTP passed
  const verifiedToken = randomToken(24);
  await redis.setex(
    `${OTP_TOKEN_PREFIX}${verifiedToken}`,
    OTP_TOKEN_TTL_SEC,
    JSON.stringify({ phone, purpose: otp.purpose, userId: existing?.id ?? null }),
  );

  return { verifiedToken, userId: existing?.id ?? null };
};

const consumeVerifiedToken = async (token: string): Promise<{ phone: string; purpose: OtpPurpose; userId: string | null }> => {
  const raw = await redis.get(`${OTP_TOKEN_PREFIX}${token}`);
  if (!raw) throw new UnauthorizedError('Verification token expired. Restart the flow.');
  await redis.del(`${OTP_TOKEN_PREFIX}${token}`);
  return JSON.parse(raw) as { phone: string; purpose: OtpPurpose; userId: string | null };
};

// ==========================================
// Sessions / Tokens
// ==========================================

const issueTokens = async (
  user: Pick<User, 'id' | 'role'>,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const accessToken = signAccessToken({ sub: user.id, role: user.role as UserRole });
  const jti = randomToken(16);
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  const refreshExpiresMs = parseDurationSec(env.JWT_REFRESH_EXPIRES_IN) * 1000;

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(jti), // store hash, not token
      expiresAt: new Date(Date.now() + refreshExpiresMs),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseDurationSec(env.JWT_ACCESS_EXPIRES_IN),
  };
};

// ==========================================
// Public API
// ==========================================

export interface SignupData {
  phone: string;
  otpToken: string;
  fullName: string;
  role: UserRole;
  email?: string;
  password?: string;
  referralCode?: string;
}

const generateUniqueUsername = async (base: string): Promise<string> => {
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'user';
  // Try N times with a numeric suffix
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${clean}${Date.now().toString(36)}`;
};

/**
 * Combined helper: issue JWT tokens AND mint a trusted-device token so the
 * next login on this browser skips OTP entirely. Called from signup, OTP
 * login, and trusted-device login — one place, one behaviour.
 */
const issueTokensAndTrustDevice = async (
  user: Pick<User, 'id' | 'role'>,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const [tokens, device] = await Promise.all([
    issueTokens(user, ctx),
    issueTrustedDevice({ userId: user.id, userAgent: ctx.userAgent, ipAddress: ctx.ipAddress }),
  ]);
  return { ...tokens, deviceToken: device.deviceToken, deviceExpiresAt: device.expiresAt };
};

export const signup = async (data: SignupData, ctx: { userAgent?: string; ipAddress?: string }) => {
  const verified = await consumeVerifiedToken(data.otpToken);
  if (verified.phone !== data.phone) throw new UnauthorizedError('Token mismatch');
  if (verified.userId) throw new ConflictError('Account already exists');

  const passwordHash = data.password ? await hashPassword(data.password) : null;
  const username = await generateUniqueUsername(data.fullName);

  let referredById: string | null = null;
  if (data.referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: data.referralCode },
      select: { id: true },
    });
    referredById = referrer?.id ?? null;
  }

  const user = await prisma.user.create({
    data: {
      phone: data.phone,
      email: data.email ?? null,
      passwordHash,
      fullName: data.fullName,
      username,
      role: data.role,
      isPhoneVerified: true,
      referredById,
      wallet: { create: {} },
    },
    select: { id: true, role: true },
  });

  const tokens = await issueTokensAndTrustDevice(user, ctx);
  return { user, tokens };
};

export const loginWithOtp = async (
  otpToken: string,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const verified = await consumeVerifiedToken(otpToken);
  if (!verified.userId) throw new NotFoundError('User');

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw new UnauthorizedError('Account inactive');

  const tokens = await issueTokensAndTrustDevice(user, ctx);
  return { user, tokens };
};

/**
 * OTP-free login: caller presents a valid trusted-device token.
 * Trust was established during a prior full OTP flow on this browser.
 */
export const loginWithTrustedDevice = async (
  phone: string,
  deviceToken: string,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const user = await findUserByTrustedDevice(phone, deviceToken);
  if (!user) throw new UnauthorizedError('Device is not trusted or has expired');
  // issueTokens (not issueTokensAndTrustDevice) — the device is ALREADY trusted;
  // rolling extension happened inside findUserByTrustedDevice.
  const tokens = await issueTokens({ id: user.id, role: user.role as UserRole }, ctx);
  return { user: { id: user.id, role: user.role }, tokens };
};

// ==========================================
// OAuth
// ==========================================

export type OAuthLoginResult =
  | { pending: true }
  | {
      pending: false;
      user: { id: string; role: UserRole };
      phone: string | null;
      requiresPhone: boolean;
      tokens: Awaited<ReturnType<typeof issueTokensAndTrustDevice>>;
    };

/**
 * Link a provider identity to an existing account by provider subject or
 * verified email, then issue the same trusted-device session as OTP login.
 * New OAuth identities are returned as `pending` so the caller can create a
 * limited account and send the user through phone step-up before high-trust actions.
 */
export const loginWithOAuth = async (
  profile: OAuthProfile,
  ctx: { userAgent?: string; ipAddress?: string },
): Promise<OAuthLoginResult> => {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: {
      user: { select: { id: true, role: true, phone: true, isPhoneVerified: true, isActive: true, avatarUrl: true } },
    },
  });

  let user = linked?.user ?? null;
  if (!user && profile.email) {
    user = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, role: true, phone: true, isPhoneVerified: true, isActive: true, avatarUrl: true },
    });
  }
  if (!user) return { pending: true };
  if (!user.isActive) throw new UnauthorizedError('Account inactive');

  if (!linked) {
    try {
      await prisma.oAuthAccount.create({
        data: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          userId: user.id,
          email: profile.email ?? null,
          profileName: profile.fullName,
          avatarUrl: profile.avatarUrl ?? null,
        },
      });
    } catch (err) {
      // A concurrent callback may have linked the same provider subject. Only
      // hide that race; all other database errors must surface.
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }

  if (!user.avatarUrl && profile.avatarUrl) {
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: profile.avatarUrl } });
  }

  const tokens = await issueTokensAndTrustDevice(user, ctx);
  return {
    pending: false,
    user: { id: user.id, role: user.role as UserRole },
    phone: user.phone,
    requiresPhone: !user.phone || !user.isPhoneVerified,
    tokens,
  };
};

/** Finish a new OAuth account after the user verifies their Ethiopian phone. */
export const completeOAuthSignup = async (
  profile: OAuthProfile,
  input: {
    phone?: string;
    otpToken?: string;
    fullName: string;
    role: Extract<UserRole, 'CLIENT' | 'FREELANCER'>;
  },
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  // Phone signup can provide an OTP here. OAuth signup deliberately omits
  // both fields: it creates a limited account first and asks for phone OTP
  // only when the user reaches a high-trust action.
  if (input.phone || input.otpToken) {
    if (!input.phone || !input.otpToken) {
      throw new UnauthorizedError('Phone verification token is invalid');
    }
    const verified = await consumeVerifiedToken(input.otpToken);
    if (verified.phone !== input.phone || verified.purpose !== 'SIGNUP' || verified.userId) {
      throw new UnauthorizedError('Phone verification token is invalid');
    }
  }

  const existingPhone = input.phone
    ? await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } })
    : null;
  if (existingPhone) throw new ConflictError('This phone number is already registered. Please sign in instead.');
  if (profile.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
    if (existingEmail) throw new ConflictError('An account already uses this email. Please sign in instead.');
  }

  try {
    const user = await prisma.user.create({
      data: {
        phone: input.phone ?? null,
        email: profile.email ?? null,
        fullName: input.fullName.trim() || profile.fullName,
        username: await generateUniqueUsername(input.fullName.trim() || profile.fullName),
        avatarUrl: profile.avatarUrl ?? null,
        role: input.role,
        isPhoneVerified: !!input.phone,
        isEmailVerified: !!profile.email,
        wallet: { create: {} },
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            email: profile.email ?? null,
            profileName: profile.fullName,
            avatarUrl: profile.avatarUrl ?? null,
          },
        },
      },
      select: { id: true, role: true },
    });
    const tokens = await issueTokensAndTrustDevice(user, ctx);
    return { user, tokens };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ConflictError('This phone or OAuth account is already registered. Please sign in instead.');
    }
    throw err;
  }
};

/** Complete phone verification for an OAuth-created account. */
export const completePhoneVerification = async (
  userId: string,
  input: { phone: string; otpToken: string },
) => {
  const verified = await consumeVerifiedToken(input.otpToken);
  if (verified.phone !== input.phone || verified.purpose !== 'RESET') {
    throw new UnauthorizedError('Phone verification token is invalid');
  }
  if (verified.userId && verified.userId !== userId) {
    throw new UnauthorizedError('Phone verification token belongs to another account');
  }

  const owner = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
  if (owner && owner.id !== userId) {
    throw new ConflictError('That phone number is already registered to another account');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { phone: input.phone, isPhoneVerified: true },
    select: { phone: true, isPhoneVerified: true },
  });
};

// ==========================================
// PIN
// ==========================================

/**
 * Set (or replace) the user's 6-digit PIN.
 * Rate-limited at the route layer; here we just hash & store.
 */
export const setPin = async (userId: string, pin: string): Promise<void> => {
  const pinHash = await hashPassword(pin);
  await prisma.user.update({ where: { id: userId }, data: { pinHash } });
};

/** Remove the user's PIN (they can always set a new one). */
export const removePin = async (userId: string): Promise<void> => {
  await prisma.user.update({ where: { id: userId }, data: { pinHash: null } });
};

/**
 * Verify a PIN against a stored device token. Used for repeat-visit login.
 * Requires BOTH:
 *   - deviceToken must be trusted for the phone (same as trusted-device login)
 *   - PIN must match the user's stored hash
 * We check device first so an unknown attacker can't brute-force via arbitrary
 * phone numbers.
 *
 * On success, mints a fresh session and rolls the device.
 */
export const loginWithPin = async (
  phone: string,
  pin: string,
  deviceToken: string,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const user = await findUserByTrustedDevice(phone, deviceToken);
  if (!user) throw new UnauthorizedError('Device is not trusted or has expired');
  if (!user.pinHash) throw new UnauthorizedError('No PIN is set for this account');
  const ok = await verifyPassword(user.pinHash, pin).catch(() => false);
  if (!ok) throw new UnauthorizedError('Incorrect PIN');
  const tokens = await issueTokens({ id: user.id, role: user.role as UserRole }, ctx);
  return { user: { id: user.id, role: user.role }, tokens };
};

export const loginWithPassword = async (
  email: string,
  password: string,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true, isActive: true },
  });
  // Constant-time-ish: always run verify to avoid user-enumeration timing attacks.
  // Dummy bcrypt hash of a random string — verify will fail but takes similar time.
  const DUMMY_BCRYPT = '$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV';
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_BCRYPT, password).catch(() => false);
  if (!user || !user.passwordHash || !ok) {
    throw new UnauthorizedError('Invalid email or password');
  }
  if (!user.isActive) throw new UnauthorizedError('Account inactive');

  const tokens = await issueTokens({ id: user.id, role: user.role }, ctx);
  return { user: { id: user.id, role: user.role }, tokens };
};

export const refresh = async (
  refreshTokenRaw: string,
  ctx: { userAgent?: string; ipAddress?: string },
) => {
  // We already verify JWT signature/expiry in the router via verifyRefreshToken()
  // Here we handle rotation + DB revocation
  const { verifyRefreshToken } = await import('../lib/jwt.js');
  const decoded = verifyRefreshToken(refreshTokenRaw);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(decoded.jti) },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== decoded.sub) {
    // Possible token reuse — revoke ALL user tokens (defensive)
    if (stored?.userId) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new UnauthorizedError('Refresh token invalid or already used');
  }

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user?.isActive) throw new UnauthorizedError('Account inactive');

  // Revoke old, issue new (rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens({ id: user.id, role: user.role }, ctx);
};

export const logout = async (refreshTokenRaw: string): Promise<void> => {
  const { verifyRefreshToken } = await import('../lib/jwt.js');
  try {
    const decoded = verifyRefreshToken(refreshTokenRaw);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(decoded.jti), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore — logout is idempotent
  }
};
