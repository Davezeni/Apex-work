import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock, chapaMock } = vi.hoisted(() => ({
  prismaMock: {
    withdrawal: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    wallet: { update: vi.fn(), findUnique: vi.fn() },
    transaction: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyMock: vi.fn(),
  chapaMock: {
    transfer: vi.fn(),
    verifyTransfer: vi.fn(),
    transfersEnabled: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notifications.service.js', () => ({ notify: notifyMock }));
vi.mock('./chapa.service.js', () => ({ chapa: chapaMock }));

import { markStatus, cancelWithdrawal } from './withdrawals.service.js';

const wd = {
  id: 'wd-1',
  userId: 'u-1',
  amountEtb: 1000,
  status: 'PENDING' as const,
  providerRef: null,
  failureReason: null,
  processedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  notifyMock.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof prismaMock) => unknown) => cb(prismaMock));
  prismaMock.withdrawal.findUnique.mockResolvedValue(wd);
});

describe('withdrawal state transitions', () => {
  it('releases a refund when cancel moves PENDING → CANCELLED', async () => {
    prismaMock.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValue({ ...wd, status: 'CANCELLED' });

    const result = await markStatus('wd-1', 'CANCELLED', { failureReason: 'User cancelled' });

    expect(result.status).toBe('CANCELLED');
    expect(prismaMock.wallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: wd.userId },
      data: { balanceEtb: { increment: wd.amountEtb } },
    }));
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ORDER_REFUND', amountEtb: wd.amountEtb }),
    }));
  });

  it('never refunds an illegal SUCCESS → CANCELLED transition', async () => {
    const active = { ...wd, status: 'SUCCESS' as const };
    prismaMock.withdrawal.findUnique.mockResolvedValue(active);

    await expect(markStatus('wd-1', 'CANCELLED')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.withdrawal.updateMany).not.toHaveBeenCalled();
  });

  it('aborts when a concurrent transition already changed the state (no double refund)', async () => {
    // Race: admin marks SUCCESS while user cancels. CAS claims 0 rows.
    prismaMock.withdrawal.updateMany.mockResolvedValue({ count: 0 });

    await expect(markStatus('wd-1', 'CANCELLED')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects cancelling a non-pending withdrawal', async () => {
    const active = { ...wd, status: 'PROCESSING' as const };
    prismaMock.withdrawal.findUnique.mockResolvedValue(active);

    await expect(cancelWithdrawal('u-1', 'wd-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
