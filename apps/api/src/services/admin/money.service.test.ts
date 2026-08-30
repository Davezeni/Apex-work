import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { refundOrder, adjustWallet, adminLedger } from './money.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../lib/errors.js';

describe('money.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('refundOrder', () => {
    const order = {
      id: 'o1',
      orderNumber: 'ORD-1',
      clientId: 'client-1',
      amountEtb: 1000,
      status: 'ACTIVE',
      client: { wallet: { id: 'w1', balanceEtb: 500 } },
      seller: { wallet: { id: 'w2', balanceEtb: 0 } },
    };

    it('credits the client wallet, records a ledger entry and cancels the order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.$transaction.mockImplementation(async (fn) => fn({
        wallet: { update: vi.fn() },
        transaction: { create: vi.fn() },
        order: { update: vi.fn().mockResolvedValue({ id: 'o1', status: 'CANCELLED' }) },
      }));

      const res = await refundOrder('o1', 400, 'service not delivered');
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(res.refundedEtb).toBe(400);
      expect(res.order.status).toBe('CANCELLED');
    });

    it('rejects a non-existent order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      await expect(refundOrder('nope', 1, 'x')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects an amount exceeding the order total', async () => {
      prismaMock.order.findUnique.mockResolvedValue(order);
      await expect(refundOrder('o1', 2000, 'x')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('rejects a client without a wallet', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...order, client: { wallet: null } });
      await expect(refundOrder('o1', 100, 'x')).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('adjustWallet', () => {
    it('credits a wallet and increments lifetimeEarned', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({ userId: 'u1', balanceEtb: 0 });
      prismaMock.$transaction.mockImplementation(async (fn) => fn({
        wallet: { update: vi.fn() },
        transaction: { create: vi.fn().mockResolvedValue({ id: 't1' }) },
      }));
      const res = await adjustWallet('u1', 'MANUAL_CREDIT', 250, 'support goodwill');
      expect(res.balanceEtb).toBe(250);
      expect(res.txn.id).toBe('t1');
    });

    it('rejects a debit that would overdraw', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({ userId: 'u1', balanceEtb: 100 });
      await expect(adjustWallet('u1', 'MANUAL_DEBIT', 200, 'penalty')).rejects.toBeInstanceOf(BadRequestError);
    });

    it('throws NotFound when the wallet is missing', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue(null);
      await expect(adjustWallet('u1', 'MANUAL_CREDIT', 10, 'x')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('adminLedger', () => {
    it('returns rows with user info', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([{ id: 't1' }]);
      const rows = await adminLedger({ userId: 'u1', limit: 25 });
      expect(prismaMock.transaction.findMany).toHaveBeenCalled();
      expect(rows).toHaveLength(1);
    });

    it('combines user and cursor filters with AND', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([]);
      await adminLedger({ userId: 'u1', cursorWhere: { OR: [{ createdAt: { lt: new Date() } }] }, limit: 25 });
      const arg = prismaMock.transaction.findMany.mock.calls[0]![0];
      expect(arg.where.AND).toHaveLength(2);
    });
  });
});
