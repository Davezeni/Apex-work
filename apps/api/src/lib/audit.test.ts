import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { adminAuditLog: { create: vi.fn() } },
}));

vi.mock('./prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../config/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

import { adminAudit, actorFromReq } from './audit.js';

describe('audit helper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists a full audit entry', async () => {
    prismaMock.adminAuditLog.create.mockResolvedValue({ id: 'a1' });
    await adminAudit({
      adminId: 'admin-1',
      adminName: 'Aster (@aster)',
      adminRole: 'ADMIN',
      action: 'GIG.MODERATE',
      resourceType: 'GIG',
      resourceId: 'gig-1',
      after: { status: 'PAUSED' },
      ip: '1.2.3.4',
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: 'admin-1',
          action: 'GIG.MODERATE',
          resourceType: 'GIG',
          resourceId: 'gig-1',
          ip: '1.2.3.4',
        }),
      }),
    );
  });

  it('never throws when the write fails (fire-and-forget)', async () => {
    prismaMock.adminAuditLog.create.mockRejectedValue(new Error('db down'));
    await expect(
      adminAudit({ adminId: 'x', adminName: 'x', adminRole: 'ADMIN', action: 'A', resourceType: 'B' }),
    ).resolves.toBeUndefined();
  });

  it('derives actor identity from the request user and cached role', () => {
    const actor = actorFromReq({ user: { sub: 'admin-2' } } as never);
    expect(actor.adminId).toBe('admin-2');
    expect(actor.adminRole).toBe('unknown'); // no role cached on bare req
  });
});
