import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    gig: { findUnique: vi.fn() },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    payment: { create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    wallet: { update: vi.fn(), upsert: vi.fn() },
    user: { update: vi.fn() },
    transaction: { create: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyMock: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notifications.service.js', () => ({ notify: notifyMock }));
// Order creation reads the platform fee through the Redis-backed cache helper.
// Stub Redis so tests run offline and cachedRead falls through to the live fee.
vi.mock('../lib/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), keys: vi.fn() },
}));

import {
  acceptDelivery,
  autoReleaseEscrow,
  cancelOrder,
  confirmPaymentByTxRef,
  createOrderAndInitiatePayment,
  markDelivered,
  requestRevision,
} from './orders.service.js';
import { chapa } from './chapa.service.js';

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
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  );
});

describe('order escrow lifecycle', () => {
  it('releases seller funds and completes an accepted delivery atomically', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    // acceptDelivery now claims the transition via updateMany (CAS) and reads
    // back with findUniqueOrThrow — a concurrent transition would match 0 rows.
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'COMPLETED' });

    const result = await acceptDelivery(order.id, order.clientId);

    expect(result.status).toBe('COMPLETED');
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id, status: order.status },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(prismaMock.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: order.sellerId },
        data: expect.objectContaining({
          pendingEtb: { decrement: order.sellerNetEtb },
          balanceEtb: { increment: order.sellerNetEtb },
        }),
      }),
    );
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ORDER_PAYOUT', amountEtb: order.sellerNetEtb }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.sellerId }));
  });

  it('aborts without paying if the order was already transitioned concurrently', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    // Concurrent accept already flipped the status → CAS claims 0 rows.
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(acceptDelivery(order.id, order.clientId)).rejects.toMatchObject({
      statusCode: 409,
    });
    // No wallet credit / ledger / completed-order bump may run.
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
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
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        data: expect.objectContaining({ status: 'IN_REVIEW', deliveredAt: expect.any(Date) }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.clientId }));
  });

  it('returns a reviewed order to active when the client requests revision', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order);
    prismaMock.order.update.mockResolvedValue({ ...order, status: 'ACTIVE' });

    const result = await requestRevision(
      order.id,
      order.clientId,
      'Please adjust the primary color.',
    );

    expect(result.status).toBe('ACTIVE');
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: order.sellerId,
        title: 'Revision requested',
      }),
    );
  });

  it('refunds the client ledger and removes held funds when an active order is cancelled', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, status: 'ACTIVE' });
    // cancelOrder now claims the transition via updateMany (CAS) and reads back.
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({ ...order, status: 'CANCELLED' });

    const result = await cancelOrder(order.id, order.clientId, 'Client changed scope');

    expect(result.status).toBe('CANCELLED');
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id, status: 'ACTIVE' }, // cancel claims from the exact status it read (ACTIVE here)
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    expect(prismaMock.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: order.sellerId },
        data: { pendingEtb: { decrement: order.sellerNetEtb } },
      }),
    );
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ORDER_REFUND', amountEtb: order.amountEtb }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: order.sellerId }));
  });

  it('aborts a concurrent cancellation (0 rows claimed) without refunding or notifying', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...order, status: 'ACTIVE' });
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 }); // already cancelled concurrently

    await expect(cancelOrder(order.id, order.clientId)).rejects.toThrow(/already been cancelled/i);
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('only notifies once when the same payment is claimed, even on a duplicate webhook', async () => {
    const pendingOrder = {
      ...order,
      status: 'PENDING' as const,
      payments: [{ id: 'payment-1', status: 'PENDING' as const, providerRef: 'apex-order-1' }],
      seller: { id: order.sellerId },
      gig: { title: order.title },
    };
    const verify = vi.spyOn(chapa, 'verify').mockResolvedValue({
      ok: true,
      status: 'success',
      amount: order.amountEtb,
      method: 'telebirr',
      raw: { status: 'success' },
    });
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder);
    prismaMock.wallet.upsert.mockResolvedValue({ userId: order.sellerId });
    prismaMock.transaction.create.mockResolvedValue({});

    // The order-transition gate is the source of truth. First (winning) call
    // claims PENDING -> ACTIVE and notifies.
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    await confirmPaymentByTxRef('apex-order-1');
    const firstNotifyCalls = notifyMock.mock.calls.length;
    expect(firstNotifyCalls).toBe(2);

    // Duplicate webhook: order already ACTIVE -> 0 rows claimed -> no re-notify.
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    const res = await confirmPaymentByTxRef('apex-order-1');
    expect(res.updated).toBe(false);
    expect(notifyMock.mock.calls.length).toBe(firstNotifyCalls);
    verify.mockRestore();
  });
});

describe('checkout payment flow', () => {
  it('creates a pending order and payment after Chapa returns a checkout URL', async () => {
    const gig = {
      id: 'gig-1',
      ownerId: 'seller-1',
      status: 'ACTIVE' as const,
      title: 'Logo design',
      packages: [{ tier: 'BASIC' as const, title: 'Basic', priceEtb: 1000, deliveryDays: 3 }],
      owner: { id: 'seller-1', fullName: 'Seller One' },
    };
    const pendingOrder = {
      id: 'order-2',
      clientId: 'client-1',
      sellerId: 'seller-1',
      amountEtb: 1000,
      platformFeeEtb: 100,
      sellerNetEtb: 900,
      status: 'PENDING' as const,
      title: 'Logo design — Basic',
    };
    prismaMock.gig.findUnique.mockResolvedValue(gig);
    prismaMock.order.create.mockResolvedValue(pendingOrder);
    prismaMock.payment.upsert.mockResolvedValue({ id: 'payment-1' });
    const initialize = vi.spyOn(chapa, 'initialize').mockResolvedValue({
      ok: true,
      checkoutUrl: 'https://checkout.chapa.co/test-order',
    });

    const result = await createOrderAndInitiatePayment(
      'client-1',
      gig.id,
      'BASIC',
      'Use the supplied brand colors.',
      {
        id: 'client-1',
        email: 'client@example.com',
        phone: '+251911111111',
        isPhoneVerified: true,
        fullName: 'Client One',
      },
    );

    expect(result.checkoutUrl).toBe('https://checkout.chapa.co/test-order');
    expect(result.devSkipped).toBe(false);
    // Payment record is created atomically with the order (recoverable), upserted
    // on the unique providerRef so a retry can't duplicate it.
    expect(prismaMock.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerRef: `apex-${pendingOrder.id}` },
        create: expect.objectContaining({
          orderId: pendingOrder.id,
          providerRef: `apex-${pendingOrder.id}`,
          status: 'PENDING',
        }),
      }),
    );
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        amountEtb: 1000,
        txRef: `apex-${pendingOrder.id}`,
      }),
    );
    initialize.mockRestore();
  });

  it('verifies the provider, credits escrow, and activates the order exactly once', async () => {
    const pendingOrder = {
      ...order,
      status: 'PENDING' as const,
      payments: [{ id: 'payment-1', status: 'PENDING' as const, providerRef: 'apex-order-1' }],
      seller: { id: order.sellerId },
      gig: { title: order.title },
    };
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.wallet.upsert.mockResolvedValue({ userId: order.sellerId });
    prismaMock.transaction.create.mockResolvedValue({});
    // The order-transition CAS is the gate: claim PENDING -> ACTIVE wins.
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    const verify = vi.spyOn(chapa, 'verify').mockResolvedValue({
      ok: true,
      status: 'success',
      amount: order.amountEtb,
      method: 'telebirr',
      raw: { status: 'success' },
    });

    const result = await confirmPaymentByTxRef('apex-order-1');

    expect(result.updated).toBe(true);
    // Order transition is claimed via CAS (PENDING -> ACTIVE) as the gate.
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id, status: 'PENDING' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerRef: 'apex-order-1', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'SUCCESS', method: 'telebirr' }),
      }),
    );
    expect(prismaMock.wallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: order.sellerId },
        update: { pendingEtb: { increment: order.sellerNetEtb } },
      }),
    );
    expect(notifyMock).toHaveBeenCalledTimes(2);
    verify.mockRestore();
  });
});

describe('escrow auto-release', () => {
  const deliverable = {
    id: 'order-rel',
    status: 'DELIVERED' as const,
    clientId: 'client-1',
    sellerId: 'seller-1',
    title: 'Task',
    amountEtb: 1000,
    sellerNetEtb: 900,
    platformFeeEtb: 100,
    deliveredAt: new Date(),
  };

  it('claims DELIVERED -> COMPLETED before paying (CAS), then notifies once', async () => {
    // reminder query returns none; release query returns one deliverable.
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([deliverable]);
    prismaMock.transaction.findFirst.mockResolvedValue(null); // no prior payout
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 }); // CAS claim wins
    prismaMock.wallet.upsert.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});

    const res = await autoReleaseEscrow();

    expect(res.released).toBe(1);
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-rel', status: 'DELIVERED' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ORDER_PAYOUT', relatedId: 'order-rel' }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it('rescues IN_REVIEW orders (no milestones) — CAS claims on the live status', async () => {
    const inReview = { ...deliverable, id: 'order-stuck', status: 'IN_REVIEW' as const };
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([inReview]);
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.wallet.upsert.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});

    const res = await autoReleaseEscrow();

    expect(res.released).toBe(1);
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-stuck', status: 'IN_REVIEW' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it('skips an order already paid (0 rows claimed) — no double payout', async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([deliverable]);
    // The order is no longer DELIVERED (already paid/COMPLETED), so the CAS
    // claims 0 rows and the payout is skipped.
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await autoReleaseEscrow();

    expect(res.released).toBe(0);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('does not double-credit a wallet when the payout ledger row already exists (DB idempotency)', async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([deliverable]);
    prismaMock.wallet.upsert.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 }); // CAS wins

    // Simulate the unique-constraint guard: the order's payout ledger row was
    // already written by a prior attempt, so the DB rejects the duplicate.
    for (let i = 0; i < 4; i++) {
      prismaMock.transaction.create.mockRejectedValueOnce({ code: 'P2002' });
    }
    const res = await autoReleaseEscrow();

    // ledgerOnce swallowed the unique violation -> money not moved again.
    expect(res.released).toBe(0);
    expect(prismaMock.wallet.upsert).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('skips when a concurrent release already flipped the order to COMPLETED (0 rows)', async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([deliverable]);
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 }); // lost the race

    const res = await autoReleaseEscrow();

    expect(res.released).toBe(0);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
