import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Password hashing.
 *
 * We use bcryptjs (pure JS, no native compilation) for maximum portability
 * across cloud platforms (Render, Vercel, Koyeb, Fly.io) with their varying
 * build environments. For a production workload with hot signup paths, swap
 * for `argon2` (memory-hard, better) once you have a build pipeline that
 * reliably compiles native modules.
 *
 * Cost factor is configurable via BCRYPT_ROUNDS (default 12 — OWASP 2024).
 */

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_ROUNDS);

export const verifyPassword = (hash: string, plain: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Fast, non-reversible hash for OTPs and refresh-token bookkeeping. */
export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

/** Cryptographically-secure random string (URL-safe). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/**
 * Numeric OTP (fixed length, cryptographically random).
 * Uses rejection sampling to avoid modulo bias for the requested length.
 */
export const generateOtp = (length = 6): string => {
  const max = 10 ** length;
  // 4 bytes = 32-bit; the largest multiple of `max` that fits avoids bias.
  const cutoff = Math.floor(0xffffffff / max) * max;
  while (true) {
    const n = randomBytes(4).readUInt32BE(0);
    if (n < cutoff) return (n % max).toString().padStart(length, '0');
  }
};
