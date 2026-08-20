import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

/** Argon2id — modern, memory-hard, resistant to GPU attacks. */
const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB (OWASP 2024 recommendation)
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, ARGON_OPTS);

export const verifyPassword = (hash: string, plain: string): Promise<boolean> =>
  argon2.verify(hash, plain);

/** Fast, non-reversible hash for OTPs and refresh-token bookkeeping */
export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

/** Cryptographically-secure random string (URL-safe) */
export const randomToken = (bytes = 32): string =>
  randomBytes(bytes).toString('base64url');

/** Numeric OTP (fixed length, cryptographically random, no leading-zero bias) */
export const generateOtp = (length = 6): string => {
  const max = 10 ** length;
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0) % max;
  return n.toString().padStart(length, '0');
};
