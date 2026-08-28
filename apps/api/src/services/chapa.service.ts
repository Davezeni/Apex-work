/**
 * Chapa payment gateway integration.
 *
 * Docs: https://developer.chapa.co/docs/accept-payments/
 *
 * Two flows we use:
 *   1. Initialize a transaction → get a hosted checkout URL (redirect user there)
 *   2. Verify a transaction by tx_ref → confirm status after webhook or return
 *
 * We NEVER trust webhook payloads alone — every webhook triggers a
 * server-side verify() call before we credit anything. Prevents forged
 * callbacks from crediting fake orders.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const CHAPA_BASE = 'https://api.chapa.co/v1';

export interface InitializeInput {
  amountEtb: number;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
  customer: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
  };
  title?: string;
  description?: string;
}

export interface InitializeResult {
  ok: boolean;
  checkoutUrl?: string;
  error?: string;
  rawErrors?: unknown;
}

export interface VerifyResult {
  ok: boolean;
  status: 'success' | 'failed' | 'pending' | 'unknown';
  amount?: number;
  currency?: string;
  method?: string;
  reference?: string;
  raw?: unknown;
  error?: string;
}

class ChapaService {
  private get secretKey() {
    return env.CHAPA_SECRET_KEY;
  }

  isConfigured(): boolean {
    return !!this.secretKey;
  }

  /**
   * Chapa rejects some placeholder email TLDs (.example.com is blocked; .et
   * is blocked entirely). For OTP-only accounts we may not have an email —
   * synthesize a safe placeholder on a domain that passes Chapa's validation.
   *
   * We deliberately use `apex-work.com` (a real-sounding domain that passes
   * Chapa's DNS-lookup check). Chapa doesn't actually send mail to this
   * address; it's only stored on the receipt.
   *
   * Exposed as a static helper so both this service and callers building the
   * payload share ONE source of truth for the "what email do we send to Chapa"
   * rule.
   */
  static safeEmail(email: string | null | undefined, userId: string): string {
    if (email && !email.endsWith('.et')) return email;
    return `user-${userId}@apex-work.com`;
  }

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    if (!this.secretKey) return { ok: false, error: 'chapa_not_configured' };

    const [firstName, ...rest] = (input.customer.firstName || 'Customer').trim().split(/\s+/);
    const lastName = input.customer.lastName ?? rest.join(' ') ?? 'Apex';

    const body = {
      amount: String(input.amountEtb),
      currency: 'ETB',
      email: input.customer.email,
      first_name: firstName || 'Customer',
      last_name: lastName || 'Apex',
      phone_number: input.customer.phone?.replace(/^\+251/, '0'),
      tx_ref: input.txRef,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      customization: {
        title: (input.title ?? 'Apex-Work').slice(0, 16),
        description: (input.description ?? 'Order payment').slice(0, 50),
      },
    };

    try {
      const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        status?: string;
        message?: unknown;
        data?: { checkout_url?: string };
      };
      if (data.status !== 'success' || !data.data?.checkout_url) {
        logger.warn({ status: res.status, message: data.message }, 'Chapa initialize failed');
        // Chapa returns validation errors as { message: { field: ['rule'] } }.
        // Flatten to something human-readable so users see "Invalid email"
        // instead of a generic "initialize_failed".
        let readableError = 'initialize_failed';
        if (typeof data.message === 'string') {
          readableError = data.message;
        } else if (data.message && typeof data.message === 'object') {
          const parts: string[] = [];
          for (const [field, rules] of Object.entries(data.message as Record<string, unknown>)) {
            const ruleList = Array.isArray(rules) ? rules.join(', ') : String(rules);
            parts.push(`${field}: ${ruleList}`);
          }
          readableError = parts.join('; ') || 'initialize_failed';
        }
        return {
          ok: false,
          error: readableError,
          rawErrors: data.message,
        };
      }
      return { ok: true, checkoutUrl: data.data.checkout_url };
    } catch (err) {
      logger.error({ err }, 'Chapa initialize network error');
      return { ok: false, error: 'network_error' };
    }
  }

  async verify(txRef: string): Promise<VerifyResult> {
    if (!this.secretKey) return { ok: false, status: 'unknown', error: 'chapa_not_configured' };

    try {
      const res = await fetch(
        `${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.secretKey}` },
        },
      );
      const data = (await res.json()) as {
        status?: string;
        message?: string;
        data?: {
          status?: string;
          amount?: string | number;
          currency?: string;
          method?: string;
          reference?: string;
        };
      };
      if (data.status !== 'success' || !data.data) {
        return {
          ok: false,
          status: 'unknown',
          error: data.message ?? 'verify_failed',
          raw: data,
        };
      }
      const chapaStatus = (data.data.status ?? '').toLowerCase();
      const mapped: VerifyResult['status'] =
        chapaStatus === 'success'
          ? 'success'
          : chapaStatus === 'failed'
            ? 'failed'
            : chapaStatus === 'pending'
              ? 'pending'
              : 'unknown';
      return {
        ok: true,
        status: mapped,
        amount: data.data.amount ? Number(data.data.amount) : undefined,
        currency: data.data.currency,
        method: data.data.method,
        reference: data.data.reference,
        raw: data.data,
      };
    } catch (err) {
      logger.error({ err }, 'Chapa verify network error');
      return { ok: false, status: 'unknown', error: 'network_error' };
    }
  }

  /**
   * Chapa signs webhooks with a shared secret you configure in their dashboard.
   * Verify by computing HMAC-SHA256 of the request body with the secret and
   * comparing with the `x-chapa-signature` header via timing-safe compare.
   */
  verifyWebhookSignature(rawBody: string, providedSignature: string | undefined): boolean {
    if (!env.CHAPA_WEBHOOK_SECRET || !providedSignature) return false;
    try {
      const secret = env.CHAPA_WEBHOOK_SECRET;
      // Chapa documents two signature headers: one is an HMAC of the
      // payload and the other is an HMAC of the configured secret. Accept
      // either header form; the route checks every supplied signature and
      // still performs server-side transaction verification afterwards.
      const expectedPayload = createHmac('sha256', secret).update(rawBody).digest('hex');
      const expectedSecret = createHmac('sha256', secret).update(secret).digest('hex');
      const provided = Buffer.from(providedSignature.trim(), 'hex');
      if (provided.length === 0) return false;
      return [expectedPayload, expectedSecret].some((expected) => {
        const actual = Buffer.from(expected, 'hex');
        return actual.length === provided.length && timingSafeEqual(actual, provided);
      });
    } catch {
      return false;
    }
  }
}

export const chapa = new ChapaService();
export { ChapaService };
