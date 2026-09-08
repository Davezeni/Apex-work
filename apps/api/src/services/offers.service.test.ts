import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    customOffer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    payment: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyMock: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./notifications.service.js', () => ({ notify: notifyMock }));

import { respondToOffer } from './offers.service.js';
import { chapa } from './chapa.service.js';

const offer = {
  id: 'offer-1',
  conversationId: 'conv-1',
  senderId: 'seller-1',
  recipientId: 'client-1',
  gigId: null,
  title: 'Landing page',
  description: 'Build a landing page',
  priceEtb: 5000,
  deliveryDays: 5,
  status: 'PENDING' as const,
  expiresAt: new Date(Date.now() + 60_000),
  respondedAt: null,
  sender: { id: 'seller-1', fullName: 'Seller One' },
  recipient: { id: 'client-1', phone: '+251911111111', isPhoneVerified: true, fullName: 'Client One' },
};

beforeEach(() => {
  vi.clearAllMocks();
  notifyMock.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) =>
    cb(prismaMock),
  );
});

describe('respondToOffer (accept)', () => {
  it('claims PENDING -> ACCEPTED atomically before creating the order', async () => {
    prismaMock.customOffer.findUnique.mockResolvedValue(offer);
    prismaMock.customOffer.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.create.mockResolvedValue({ id: 'order-x', status: 'PENDING' });
    vi.spyOn(chapa, 'isConfigured').mockReturnValue(true);
    vi.spyOn(chapa, 'initialize').mockResolvedValue({
      ok: true,
      checkoutUrl: 'https://checkout.chapa.co/test',
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: offer.recipientId,
      email: 'client@example.com',
      phone: '+251911111111',
      fullName: 'Client One',
    });
    prismaMock.payment.upsert.mockResolvedValue({});

    const res = (await respondToOffer('offer-1', 'client-1', 'accept')) as {
      order: { id: string };
      checkoutUrl: string;
    };

    expect(prismaMock.customOffer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'offer-1', status: 'PENDING', expiresAt: { gt: expect.any(Date) } },
      data: expect.objectContaining({ status: 'ACCEPTED' }),
    }));
    // Exactly one order is created.
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
    expect(res.order.id).toBe('order-x');
  });

  it('aborts when two accepts race (0 rows claimed) and never creates an order', async () => {
    prismaMock.customOffer.findUnique.mockResolvedValue(offer);
    prismaMock.customOffer.updateMany.mockResolvedValue({ count: 0 }); // lost the race

    await expect(respondToOffer('offer-1', 'client-1', 'accept')).rejects.toThrow(/no longer active/);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('aborts on accept-after-expiry (claim where includes unexpired) and never creates an order', async () => {
    prismaMock.customOffer.findUnique.mockResolvedValue({
      ...offer,
      expiresAt: new Date(Date.now() - 10_000), // already expired
    });
    prismaMock.customOffer.updateMany.mockResolvedValue({ count: 0 });

    await expect(respondToOffer('offer-1', 'client-1', 'accept')).rejects.toThrow(/no longer active|expired/);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});
