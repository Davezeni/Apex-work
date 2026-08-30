/**
 * Admin-only guards. `requireAdmin` establishes that the caller is staff.
 * `requireCapability(cap)` additionally enforces RBAC — the caller's role
 * must be granted the capability (see lib/adminRbac.ts). Both assume
 * `requireAuth` has run first (sets req.user).
 *
 * We look up role once per request and cache it on `req` so sub-middlewares
 * don't hit the DB again.
 */
import type { NextFunction, Request, Response } from 'express';
import type { AdminCapability } from '@apex-work/shared';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { can, isAdminRole } from '../lib/adminRbac.js';

declare module 'express-serve-static-core' {
  interface Request {
    userRole?: string;
  }
}

/** Load the caller's real role from the DB (never trust the JWT claim). */
async function loadRole(userId: string): Promise<string | undefined> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role;
}

/** Must be a staff/admin role; caches `req.userRole`. */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  try {
    const role = await loadRole(req.user.sub);
    if (!role || !isAdminRole(role)) {
      return next(new ForbiddenError('Admin access only'));
    }
    req.userRole = role;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforce an RBAC capability. Must be used AFTER `requireAdmin` so
 * `req.userRole` is populated. Returns a ForbiddenError when the role lacks
 * the capability (so a reviewer can't touch money, an operator can't change
 * roles, etc.).
 */
export function requireCapability(capability: AdminCapability) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) return next(new UnauthorizedError());
    if (!isAdminRole(req.userRole) || !can(req.userRole, capability)) {
      return next(new ForbiddenError(`Requires ${capability} permission`));
    }
    next();
  };
}
