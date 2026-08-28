import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ChapaService } from './chapa.service.js';

describe('ChapaService', () => {
  const service = new ChapaService();
  const secret = 'unit-test-webhook-secret';

  it('accepts a payload HMAC signature', () => {
    const body = JSON.stringify({ data: { tx_ref: 'apex-test-order' } });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('accepts the documented secret HMAC signature form', () => {
    const body = JSON.stringify({ tx_ref: 'apex-test-order' });
    const signature = createHmac('sha256', secret).update(secret).digest('hex');
    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a tampered or malformed signature', () => {
    const body = JSON.stringify({ tx_ref: 'apex-test-order' });
    expect(service.verifyWebhookSignature(body, '00')).toBe(false);
    expect(service.verifyWebhookSignature(`${body}x`, createHmac('sha256', secret).update(body).digest('hex'))).toBe(false);
  });

  it('does not enable transfers without the explicit feature flag', () => {
    expect(service.isConfigured()).toBe(true);
    expect(service.transfersEnabled()).toBe(false);
  });

  it('normalizes a safe fallback email for missing or Ethiopian .et emails', () => {
    expect(ChapaService.safeEmail(null, 'user123')).toBe('user-user123@apex-work.com');
    expect(ChapaService.safeEmail('dawit@example.com', 'user123')).toBe('dawit@example.com');
    expect(ChapaService.safeEmail('dawit@company.et', 'user123')).toBe('user-user123@apex-work.com');
  });
});
