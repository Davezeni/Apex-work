import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    agency: { findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { setUserRole, verifyIdentity, suspendUser, adminListUsers, getUserDetail } from './community.service.js';
import { NotFoundError } from '../../lib/errors.js';

describe('community.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('changes a user role', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.user.update.mockResolvedValue({ id: 'u1', role: 'MODERATOR' });
    const res = await setUserRole('u1', 'MODERATOR');
    expect(res.role).toBe('MODERATOR');
  });

  it('rejects a role change for a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(setUserRole('u1', 'ADMIN')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('verifies identity', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.user.update.mockResolvedValue({ id: 'u1', isIdVerified: true });
    expect((await verifyIdentity('u1', true)).isIdVerified).toBe(true);
  });

  it('suspends and unsuspends a user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.user.update
      .mockResolvedValueOnce({ id: 'u1', isActive: false, suspendedAt: new Date() })
      .mockResolvedValueOnce({ id: 'u1', isActive: true, suspendedAt: null });
    const suspended = await suspendUser('u1', true);
    expect(suspended.isActive).toBe(false);
    const restored = await suspendUser('u1', false);
    expect(restored.isActive).toBe(true);
  });

  it('filters the user list by role and builds an AND when cursor present', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await adminListUsers({ role: 'FREELANCER', limit: 25, cursorWhere: { OR: [{ createdAt: { lt: new Date() } }] } });
    const arg = prismaMock.user.findMany.mock.calls[0]![0];
    expect(arg.where.AND).toHaveLength(2);
  });

  it('returns detail with counts for an existing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', wallet: { balanceEtb: 0 }, _count: { gigs: 1 } });
    const detail = await getUserDetail('u1');
    expect(detail._count.gigs).toBe(1);
  });
});
