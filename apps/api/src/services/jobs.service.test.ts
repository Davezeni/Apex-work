import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    bid: { findUnique: vi.fn() },
    job: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    order: { create: vi.fn(), delete: vi.fn() },
    payment: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyMock: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notifications.service.js', () => ({ notify: notifyMock }));
vi.mock('./categories.service.js', () => ({
  getCategoryFeePercent: vi.fn().mockResolvedValue(10),
}));

import { acceptBid } from './jobs.service.js';
import { chapa } from './chapa.service.js';

const bid = {
  id: 'bid-1',
  jobId: 'job-1',
  freelancerId: 'freelancer-1',
  priceEtb: 5000,
  deliveryDays: 7,
  message: 'I can do this',
  withdrawnAt: null,
  job: {
    id: 'job-1',
    clientId: 'client-1',
    isOpen: true,
    closedAt: null,
    title: 'Build a website',
    categoryId: 'web',
  },
  freelancer: { id: 'freelancer-1' },
};

beforeEach(() => {
  vi.clearAllMocks();
  notifyMock.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) =>
    cb(prismaMock),
  );
});

describe('acceptBid', () => {
  it('reopens the job when Chapa payment initialization fails (does not stay closed)', async () => {
    prismaMock.bid.findUnique.mockResolvedValue(bid);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'client-1',
      email: 'client@example.com',
      phone: '+251911111111',
      isPhoneVerified: true,
      fullName: 'Client One',
    });
    prismaMock.job.updateMany.mockResolvedValue({ count: 1 }); // claim wins
    prismaMock.order.create.mockResolvedValue({ id: 'order-x', status: 'PENDING' });
    vi.spyOn(chapa, 'isConfigured').mockReturnValue(true);
    vi.spyOn(chapa, 'initialize').mockResolvedValue({ ok: false, error: 'Payment gateway error' });
    prismaMock.order.delete.mockResolvedValue({});
    prismaMock.payment.upsert.mockResolvedValue({});
    prismaMock.job.update.mockResolvedValue(bid.job);

    await expect(acceptBid('bid-1', 'client-1')).rejects.toThrow(/Payment gateway error/i);

    // The provisional order is removed AND the job is restored to open.
    expect(prismaMock.order.delete).toHaveBeenCalledWith({ where: { id: 'order-x' } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { isOpen: true, closedAt: null },
    });
  });
});
