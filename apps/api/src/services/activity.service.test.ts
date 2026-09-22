import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

import { listMyActivity } from './activity.service.js';

describe('listMyActivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns own-actor rows plus SYSTEM rows on the user's orders", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
    prismaMock.auditLog.findMany.mockImplementation(
      async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        // reflect the query contract back: own-actor OR system-on-my-orders
        expect(where.OR).toHaveLength(2);
        expect(where.OR[0]).toEqual({ adminId: 'u1', actorType: { in: ['USER', 'ADMIN'] } });
        expect(where.OR[1]).toEqual({
          actorType: 'SYSTEM',
          resourceType: 'ORDER',
          resourceId: { in: ['o1', 'o2'] },
        });
        return [
          {
            id: 'a1',
            createdAt: new Date('2026-09-22T10:00:00Z'),
            action: 'ORDER.AUTO_RELEASED',
            resourceType: 'ORDER',
            resourceId: 'o1',
            actorType: 'SYSTEM',
            meta: { releasedEtb: 850 },
          },
          {
            id: 'a2',
            createdAt: new Date('2026-09-22T09:00:00Z'),
            action: 'ORDER.DELIVERED',
            resourceType: 'ORDER',
            resourceId: 'o1',
            actorType: 'USER',
            meta: null,
          },
        ];
      },
    );

    const items = await listMyActivity('u1');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ action: 'ORDER.AUTO_RELEASED', actorType: 'SYSTEM' });
    expect(items[1]).toMatchObject({ action: 'ORDER.DELIVERED', actorType: 'USER' });
  });

  it('caps the feed at the requested limit', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    await listMyActivity('u1', 10);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
