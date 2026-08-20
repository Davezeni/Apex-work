import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@apex-work/shared';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

export type AccessPayload = {
  sub: string; // userId
  role: UserRole;
  type: 'access';
};

export type RefreshPayload = {
  sub: string;
  jti: string; // token id — must match stored hash
  type: 'refresh';
};

export const signAccessToken = (payload: Omit<AccessPayload, 'type'>): string => {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, opts);
};

export const signRefreshToken = (payload: Omit<RefreshPayload, 'type'>): string => {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, opts);
};

export const verifyAccessToken = (token: string): AccessPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
    if (decoded.type !== 'access') throw new Error('Wrong token type');
    return decoded;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): RefreshPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as RefreshPayload;
    if (decoded.type !== 'refresh') throw new Error('Wrong token type');
    return decoded;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
};
