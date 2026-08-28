import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChapaService } from './chapa.service.js';

describe('ChapaService', () => {
  const secret = 'unit-test-webhook-secret';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a payload HMAC signature', () => {
    const service = new ChapaService();
    const body = JSON.stringify({ data: { tx_ref: 'apex-test-order' } });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('accepts the documented secret HMAC signature form', () => {
    const service = new ChapaService();
    const body = JSON.stringify({ tx_ref: 'apex-test-order' });
    const signature = createHmac('sha256', secret).update(secret).digest('hex');
    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a tampered or malformed signature', () => {
    const service = new ChapaService();
    const body = JSON.stringify({ tx_ref: 'apex-test-order' });
    expect(service.verifyWebhookSignature(body, '00')).toBe(false);
    expect(service.verifyWebhookSignature(`${body}x`, createHmac('sha256', secret).update(body).digest('hex'))).toBe(false);
  });

  it('does not enable transfers without the explicit feature flag', () => {
    const service = new ChapaService();
    expect(service.isConfigured()).toBe(true);
    expect(service.transfersEnabled()).toBe(false);
  });

  it('normalizes a safe fallback email for missing or Ethiopian .et emails', () => {
    expect(ChapaService.safeEmail(null, 'user123')).toBe('user-user123@apex-work.com');
    expect(ChapaService.safeEmail('dawit@example.com', 'user123')).toBe('dawit@example.com');
    expect(ChapaService.safeEmail('dawit@company.et', 'user123')).toBe('user-user123@apex-work.com');
  });

  it('parses the bank-list response and caches it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { name: 'Telebirr', code: 123 },
        { bank_name: 'Awash Bank', bank_code: '456' },
      ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ChapaService();

    await expect(service.listBanks()).resolves.toEqual([
      { name: 'Telebirr', code: '123' },
      { name: 'Awash Bank', code: '456' },
    ]);
    await expect(service.findBankCode('awash_bank')).resolves.toBe('456');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes a successful transfer response to processing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: 'chapa-transfer-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new ChapaService();

    await expect(service.initiateTransfer({
      amountEtb: 100,
      accountNumber: '1000123456',
      accountName: 'Test User',
      bankCode: '123',
      reference: 'apx-wd-test',
    })).resolves.toMatchObject({ ok: true, status: 'pending', reference: 'chapa-transfer-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transfers',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps a failed transfer response to failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'failed', message: 'Invalid account' }), { status: 400 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new ChapaService();

    await expect(service.initiateTransfer({
      amountEtb: 100,
      accountNumber: '1000123456',
      bankCode: '123',
      reference: 'apx-wd-test',
    })).resolves.toMatchObject({ ok: false, status: 'failed', error: 'Invalid account' });
  });
});
