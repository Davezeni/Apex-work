/**
 * Chapa payment gateway integration.
 *
 * Docs: https://developer.chapa.co/docs/accept-payments/
 *
 * Flows used by Apex-Work:
 *   1. Initialize a checkout transaction → hosted payment URL.
 *   2. Verify a transaction by tx_ref after a webhook or return redirect.
 *   3. Optionally initiate/verify withdrawals through Chapa Transfers when
 *      the explicit CHAPA_TRANSFERS_ENABLED feature flag is enabled.
 *
 * We NEVER trust webhook payloads alone — every webhook triggers a
 * server-side verify() call before we credit anything. Payment and transfer
 * credentials stay on the API; the browser only sees public configuration.
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

export interface ChapaBank {
  name: string;
  code: string;
}

export interface TransferResult {
  ok: boolean;
  status: 'pending' | 'failed' | 'unknown';
  reference?: string;
  error?: string;
  raw?: unknown;
}

class ChapaService {
  private get secretKey() {
    return env.CHAPA_SECRET_KEY;
  }

  private bankCache: { fetchedAt: number; banks: ChapaBank[] } | null = null;

  isConfigured(): boolean {
    return !!this.secretKey;
  }

  transfersEnabled(): boolean {
    return this.isConfigured() && env.CHAPA_TRANSFERS_ENABLED;
  }

  /**
   * Chapa rejects some placeholder email TLDs (.example.com is blocked; .et
   * is blocked entirely). For OTP-only accounts we may not have an email —
   * synthesize a safe placeholder on a domain that passes Chapa's validation.
   *
   * We deliberately use `apex-work.com` (a real-sounding domain that passes
   * Chapa's DNS-lookup check). Chapa doesn't actually send mail to this
   * address; it's only stored on the receipt.
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
        amount: data.data.amount !== undefined ? Number(data.data.amount) : undefined,
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

  /** Fetch and cache Chapa's live bank-code list for transfer payouts. */
  async listBanks(): Promise<ChapaBank[]> {
    if (!this.secretKey) return [];
    if (this.bankCache && Date.now() - this.bankCache.fetchedAt < 6 * 60 * 60 * 1000) {
      return this.bankCache.banks;
    }

    try {
      const res = await fetch(`${CHAPA_BASE}/banks`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      const raw = (await res.json()) as unknown;
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Chapa bank list failed');
        return [];
      }

      const root = raw as {
        data?: unknown;
        banks?: unknown;
      };
      const candidates = Array.isArray(raw)
        ? raw
        : Array.isArray(root.data)
          ? root.data
          : Array.isArray(root.banks)
            ? root.banks
            : root.data && typeof root.data === 'object' && Array.isArray((root.data as { banks?: unknown }).banks)
              ? (root.data as { banks: unknown[] }).banks
              : [];

      const banks = candidates.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const name = row.name ?? row.bank_name ?? row.bankName;
        const code = row.code ?? row.bank_code ?? row.bankCode ?? row.id;
        return typeof name === 'string' && (typeof code === 'string' || typeof code === 'number')
          ? [{ name, code: String(code) }]
          : [];
      });
      this.bankCache = { fetchedAt: Date.now(), banks };
      return banks;
    } catch (err) {
      logger.warn({ err }, 'Chapa bank list network error');
      return [];
    }
  }

  /** Resolve our user-facing payout destination to Chapa's current bank code. */
  async findBankCode(destination: string): Promise<string | null> {
    const aliases: Record<string, string[]> = {
      telebirr: ['telebirr'],
      cbebirr: ['cbebirr', 'cbe birr'],
      cbe_bank: ['commercial bank of ethiopia', 'cbe bank', 'cbe'],
      awash_bank: ['awash bank', 'awash'],
      dashen_bank: ['dashen bank', 'dashen'],
      bank_of_abyssinia: ['bank of abyssinia', 'abyssinia'],
    };
    const wanted = aliases[destination] ?? [destination];
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizedWanted = wanted.map(normalize);
    const banks = await this.listBanks();
    const match = banks.find((bank) => {
      const name = normalize(bank.name);
      return normalizedWanted.some((alias) => name === alias || name.includes(alias) || alias.includes(name));
    });
    return match?.code ?? null;
  }

  /** Queue a Chapa transfer. Final status is confirmed by verifyTransfer(). */
  async initiateTransfer(input: {
    amountEtb: number;
    accountNumber: string;
    accountName?: string;
    bankCode: string;
    reference: string;
  }): Promise<TransferResult> {
    if (!this.secretKey) return { ok: false, status: 'unknown', error: 'chapa_not_configured' };

    try {
      const numericCode = /^\d+$/.test(input.bankCode) ? Number(input.bankCode) : input.bankCode;
      const res = await fetch(`${CHAPA_BASE}/transfers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_name: input.accountName,
          account_number: input.accountNumber,
          amount: String(input.amountEtb),
          currency: 'ETB',
          reference: input.reference,
          bank_code: numericCode,
        }),
      });
      const raw = (await res.json()) as unknown;
      const root = raw as { status?: string; message?: unknown; data?: unknown };
      const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {};
      const providerReference =
        (typeof root.data === 'string' ? root.data : undefined) ??
        (typeof data.reference === 'string' ? data.reference : undefined) ??
        (typeof data.tx_ref === 'string' ? data.tx_ref : undefined) ??
        (typeof data.transfer_id === 'string' ? data.transfer_id : undefined) ??
        input.reference;
      const status = String(root.status ?? data.status ?? '').toLowerCase();

      if (!res.ok || status === 'failed' || status === 'error') {
        const message = typeof root.message === 'string' ? root.message : `transfer_failed_${res.status}`;
        logger.warn({ status: res.status, message }, 'Chapa transfer failed');
        return { ok: false, status: 'failed', reference: providerReference, error: message, raw };
      }
      if (status === 'success' || status === 'pending' || status === 'queued') {
        return { ok: true, status: 'pending', reference: providerReference, raw };
      }
      return { ok: false, status: 'unknown', reference: providerReference, error: 'unknown_transfer_status', raw };
    } catch (err) {
      logger.error({ err }, 'Chapa transfer network error');
      return { ok: false, status: 'unknown', error: 'network_error' };
    }
  }

  async verifyTransfer(reference: string): Promise<TransferResult> {
    if (!this.secretKey) return { ok: false, status: 'unknown', error: 'chapa_not_configured' };
    try {
      const res = await fetch(`${CHAPA_BASE}/transfers/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      const raw = (await res.json()) as unknown;
      const root = raw as { status?: string; message?: unknown; data?: unknown };
      const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {};
      const status = String(data.status ?? root.status ?? '').toLowerCase();
      if (status === 'success' || status === 'completed') return { ok: true, status: 'pending', reference, raw };
      if (status === 'failed' || status === 'reverted' || status === 'error') {
        return { ok: false, status: 'failed', reference, error: typeof root.message === 'string' ? root.message : status, raw };
      }
      return { ok: false, status: 'unknown', reference, error: 'unknown_transfer_status', raw };
    } catch (err) {
      logger.warn({ err, reference }, 'Chapa transfer verification network error');
      return { ok: false, status: 'unknown', reference, error: 'network_error' };
    }
  }

  /**
   * Chapa signs webhooks with a shared secret you configure in their dashboard.
   * Verify by computing HMAC-SHA256 of the request body with the secret and
   * comparing with the chapa-signature headers via timing-safe compare.
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
