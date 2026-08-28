import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    wallet: { update: vi.fn() },
    user: { update: vi.fn() },
    transaction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyMock: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notifications.service.js', () => ({ notify: notifyMock }));

import {
  acceptDelivery,
  cancelOrder,
  markDelivered,
  requestRevision,
} from './orders.service.js';

const order = {
  id: 'order-1',
  clientId: 'client-1',
  sellerId: 'seller-1',
  sellerNetEtb: 900,
  amountEtb: 1000,
  status: 'IN_REVIEW' as const,
  title: 'Logo design',
};

beforeEach(() => {
  vi.clearAllMocks();
  notifyMock.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
});

describe('order escrow lifecycle', () => {
  it('releases seller funds and completes an accepted delivery atomically', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.order.update.mockResolvedValue({ ...order, status: 'COMPLETED' });

    const result = await acceptDelivery(order.id, order.clientId);

    expect(result.status).toBe('COMPLETED');
    expect(prismaMock.wallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: order.sellerId },
      data: expect.objectContaining({
        pendingEtb: { decrement: order.sellerNetEtb },
        balanceEtb: { increment: order.sellerNetEtb },
      }),
    }));
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ORDER_PAYOUT', amountEtb: order.sellerNetEtb }),
    }));
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.sellerId }));
  });

  it('rejects acceptance by anyone other than the client', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);

    await expect(acceptDelivery(order.id, 'stranger')).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('moves an active order to review with delivery notes and files', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, status: 'ACTIVE' });
    prismaMock.order.update.mockResolvedValue({ ...order, status: 'IN_REVIEW' });

    const result = await markDelivered(order.id, order.sellerId, {
      notes: 'Final files attached',
      files: ['https://files.example.com/final.pdf'],
    });

    expect(result.status).toBe('IN_REVIEW');
    expect(prismaMock.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: order.id },
      data: expect.objectContaining({ status: 'IN_REVIEW', deliveredAt: expect.any(Date) }),
    }));
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.clientId }));
  });

  it('returns a reviewed order to active when the client requests revision', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.order.update.mockResolvedValue({ ...order, status: 'ACTIVE' });

    const result = await requestRevision(order.id, order.clientId, 'Please adjust the primary color.');

    expect(result.status).toBe('ACTIVE');
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: order.sellerId,
      title: 'Revision requested',
    }));
  });

  it('refunds the client ledger and removes held funds when an active order is cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, status: 'ACTIVE' });
    prismaMock.order.update.mockResolvedValue({ ...order, status: 'CANCELLED' });

    const result = await cancelOrder(order.id, order.clientId, 'Client changed scope');

    expect(result.status).toBe('CANCELLED');
    expect(prismaMock.wallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: order.sellerId },
      data: { pendingEtb: { decrement: order.sellerNetEtb } },
    }));
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ORDER_REFUND', amountEtb: order.amountEtb }),
    }));
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.sellerId }));
  });
});
