import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireCapability } from './adminOnly.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

function run(middleware: (req: Request, res: Response, next: NextFunction) => void, req: Partial<Request>) {
  return new Promise<{ error: unknown }>((resolve) => {
    middleware(
      req as Request,
      {} as Response,
      (error) => resolve({ error }),
    );
  });
}

describe('requireCapability (RBAC middleware)', () => {
  it('allows an ADMIN to do everything the capability map grants', async () => {
    const middleware = requireCapability('settings:manage');
    const { error } = await run(middleware, { user: { sub: 'a' } as never, userRole: 'ADMIN' });
    expect(error).toBeUndefined();
  });

  it('denies a MODERATOR access to settings:manage', async () => {
    const middleware = requireCapability('settings:manage');
    const { error } = await run(middleware, { user: { sub: 'a' } as never, userRole: 'MODERATOR' });
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('allows a FINANCE user to touch money but not admins', async () => {
    expect((await run(requireCapability('money:orders'), { user: { sub: 'a' } as never, userRole: 'FINANCE' })).error).toBeUndefined();
    expect((await run(requireCapability('users:manage'), { user: { sub: 'a' } as never, userRole: 'FINANCE' })).error).toBeInstanceOf(ForbiddenError);
  });

  it('returns Unauthorized when the caller is not authenticated', async () => {
    const { error } = await run(requireCapability('settings:manage'), { userRole: 'ADMIN' as never });
    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});
