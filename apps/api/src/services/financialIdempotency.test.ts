import { describe, expect, it, vi } from 'vitest';
import { ledgerOnce, isUniqueViolation } from './financialIdempotency.js';

describe('ledgerOnce', () => {
  const entry = {
    userId: 'u1',
    type: 'ORDER_PAYMENT' as const,
    amountEtb: 100,
    description: 'test',
    relatedId: 'order-1',
  };

  it('applies the ledger row + wallet mutation when the row is new', async () => {
    const tx = {
      transaction: { create: vi.fn().mockResolvedValue({}) },
    };
    const wallet = vi.fn().mockResolvedValue(undefined);

    const res = await ledgerOnce(tx as never, entry, wallet);

    expect(res.applied).toBe(true);
    expect(tx.transaction.create).toHaveBeenCalledWith({ data: entry });
    expect(wallet).toHaveBeenCalledTimes(1);
  });

  it('skips the wallet mutation on a duplicate (P2002) — no double credit', async () => {
    const tx = {
      transaction: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) },
    };
    const wallet = vi.fn();

    const res = await ledgerOnce(tx as never, entry, wallet);

    expect(res.applied).toBe(false);
    expect(wallet).not.toHaveBeenCalled();
  });

  it('rethrows non-uniqueness errors', async () => {
    const tx = {
      transaction: { create: vi.fn().mockRejectedValue(new Error('boom')) },
    };
    await expect(ledgerOnce(tx as never, entry)).rejects.toThrow('boom');
  });
});

describe('isUniqueViolation', () => {
  it('identifies P2002 and ignores other errors', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation({ code: 'P2003' })).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});
