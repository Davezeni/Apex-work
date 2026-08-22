/**
 * Admin-only guard. Assumes `requireAuth` has run first (sets req.user).
 * We look up role once and cache on the request object; sub-middlewares
 * can read `req.userRole` without another DB round-trip.
 */
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userRole?: string;
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    if (!u) return next(new UnauthorizedError());
    if (u.role !== 'ADMIN') return next(new ForbiddenError('Admin only'));
    req.userRole = u.role;
    next();
  } catch (err) {
    next(err);
  }
}
