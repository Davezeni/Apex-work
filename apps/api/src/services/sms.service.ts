import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';
import { normalizeEthiopianMsisdn } from './sms-msisdn.js';

/**
 * SMS abstraction. Real SMS in prod (SMSEthiopia or AfroMessage); console in dev.
 * Docs: https://smsethiopia.com/#/landing/docs/api-v2 | https://afromessage.com/api-doc
 *
 * The provider is chosen at module load from SMS_PROVIDER (default 'auto'):
 * - 'auto' → SMSEthiopia when SMSETHIOPIA_API_KEY is set, else AfroMessage when
 *   AFROMESSAGE_API_KEY is set, else console (logs the OTP to stdout).
 * - 'smsethiopia' | 'afromessage' → force that provider (console fallback if its key is missing).
 */
export interface SmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<{ ok: boolean; providerRef?: string; error?: string }>;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  async send(to: string, message: string) {
    logger.info({ to, message }, '[DEV] SMS');
    return { ok: true, providerRef: `dev-${Date.now()}` };
  }
}

/**
 * SMSEthiopia sender — https://smsethiopia.com (pay-as-you-go, no monthly fee).
 * Docs: https://smsethiopia.com/#/landing/docs/api-v2
 *
 * - Auth: `KEY` header. Each API key belongs to ONE campaign; the campaign's
 *   Sender ID and SMS package apply to every message (no per-request sender).
 * - `msisdn` must be exactly 12 digits starting with 2519.
 * - Error 10006 = campaign sender ID not approved yet (retry later, not immediately).
 * - Error 10007 = key bound to the free test campaign (whitelist-only) —
 *   create the key under a PAID campaign to send to any number.
 */
class SmsEthiopiaProvider implements SmsProvider {
  readonly name = 'smsethiopia';
  private readonly base = 'https://smsethiopia.com/api/v2/sms/send';

  async send(to: string, message: string) {
    if (!env.SMSETHIOPIA_API_KEY) {
      logger.warn('SMSETHIOPIA_API_KEY not set — SMS not sent');
      return { ok: false, error: 'no_api_key' };
    }
    const msisdn = normalizeEthiopianMsisdn(to);
    if (!msisdn) {
      logger.warn({ to }, 'SMSEthiopia: recipient is not a valid ET mobile (2519XXXXXXXX)');
      return { ok: false, error: 'invalid_msisdn' };
    }

    try {
      const res = await fetch(this.base, {
        method: 'POST',
        headers: {
          KEY: env.SMSETHIOPIA_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ msisdn, text: message }),
      });

      if (res.status === 429) {
        logger.warn({ to: msisdn }, 'SMSEthiopia rate limited — back off and retry');
        return { ok: false, error: 'rate_limited' };
      }

      const raw = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        logger.error(
          { status: res.status, raw: raw.slice(0, 500), to: msisdn },
          'SMSEthiopia returned non-JSON',
        );
        return { ok: false, error: `non_json_${res.status}` };
      }

      const payload = data as {
        sent?: boolean;
        id?: string | number;
        description?: string;
        status?: string;
        message?: string;
      };

      if (!res.ok || payload.sent !== true) {
        logger.error(
          { status: res.status, to: msisdn, description: payload.description ?? payload.message },
          'SMSEthiopia send failed',
        );
        return {
          ok: false,
          error: payload.description ?? payload.message ?? `send_failed_${res.status}`,
        };
      }

      logger.info(
        {
          to: msisdn,
          messageId: payload.id,
          status: payload.status,
          description: payload.description,
        },
        'SMSEthiopia SMS accepted',
      );
      return { ok: true, providerRef: payload.id != null ? String(payload.id) : undefined };
    } catch (err) {
      logger.error({ err, to: msisdn }, 'SMSEthiopia network error');
      return { ok: false, error: 'network_error' };
    }
  }
}

/**
 * AfroMessage sender.
 * `from` = your identifier ID (required, from dashboard).
 * `sender` = registered sender name (optional; requires paid subscription).
 * If sender isn't provided, AfroMessage uses a default shortcode.
 */
class AfroMessageProvider implements SmsProvider {
  readonly name = 'afromessage';
  private readonly base = 'https://api.afromessage.com/api/send';
  /**
   * Once we detect the account can't use custom `from`/`sender`, we skip them
   * on subsequent calls. Avoids a wasted retry per SMS forever.
   */
  private skipCustomSender = false;

  async send(to: string, message: string) {
    if (!env.AFROMESSAGE_API_KEY) {
      logger.warn('AFROMESSAGE_API_KEY not set — SMS not sent');
      return { ok: false, error: 'no_api_key' };
    }

    // First attempt: with configured from/sender (unless we already learned they're bad)
    const first = await this.attempt(to, message, /* stripped */ this.skipCustomSender);
    if (first.ok) return first;

    // Auto-recover: if failure is about invalid identifier / sender / short code,
    // retry once WITHOUT `from`/`sender` and remember it for future calls.
    // This survives misconfigured env vars from users who don't have a paid plan.
    if (!this.skipCustomSender && first.error && /invalid|short\s*code|sender/i.test(first.error)) {
      logger.warn(
        { to, error: first.error },
        'AfroMessage rejected identifier/sender; retrying with defaults',
      );
      this.skipCustomSender = true;
      const retry = await this.attempt(to, message, true);
      if (retry.ok) {
        logger.info({ to }, 'AfroMessage SMS sent via default shortcode/sender fallback');
      }
      return retry;
    }

    return first;
  }

  private async attempt(
    to: string,
    message: string,
    stripped: boolean,
  ): Promise<{ ok: boolean; providerRef?: string; error?: string }> {
    const url = new URL(this.base);
    // NOTE: AfroMessage has two easily-confused concepts, and BOTH require an
    // approved paid subscription to use custom values:
    //   - `from` (short code) — assigned to your account. UUID on Profile ≠ this.
    //   - `sender` — pre-registered brand name (e.g. 'ApexWork').
    // Beta / trial accounts get a default shortcode automatically when you omit both.
    if (!stripped && env.AFROMESSAGE_IDENTIFIER_ID?.trim()) {
      url.searchParams.set('from', env.AFROMESSAGE_IDENTIFIER_ID.trim());
    }
    if (!stripped && env.AFROMESSAGE_SENDER?.trim()) {
      url.searchParams.set('sender', env.AFROMESSAGE_SENDER.trim());
    }
    url.searchParams.set('to', to);
    url.searchParams.set('message', message);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.AFROMESSAGE_API_KEY}`,
          Accept: 'application/json',
        },
      });

      const raw = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        logger.error(
          { status: res.status, raw: raw.slice(0, 500), to },
          'AfroMessage returned non-JSON',
        );
        return { ok: false, error: `non_json_${res.status}` };
      }

      const payload = data as {
        acknowledge?: string;
        response?: { message_id?: string; status?: string; errors?: string[] };
        error?: string;
      };

      if (payload.acknowledge !== 'success') {
        // Pull the first error string if present — it's the most actionable value.
        const firstErr = Array.isArray(payload.response?.errors)
          ? payload.response?.errors?.[0]
          : undefined;
        logger.error(
          {
            status: res.status,
            to,
            acknowledge: payload.acknowledge,
            responseStatus: payload.response?.status,
            responseErrors: payload.response?.errors,
            error: payload.error,
          },
          'AfroMessage send failed',
        );
        return {
          ok: false,
          error: firstErr ?? payload.error ?? payload.response?.status ?? 'send_failed',
        };
      }

      // acknowledge === 'success' covers both "sent" and "Send is in progress..."
      logger.info(
        { to, messageId: payload.response?.message_id, status: payload.response?.status },
        'AfroMessage SMS accepted',
      );
      return { ok: true, providerRef: payload.response?.message_id };
    } catch (err) {
      logger.error({ err, to }, 'AfroMessage network error');
      return { ok: false, error: 'network_error' };
    }
  }
}

// Provider selection (see header comment). Even in prod a missing key never
// blocks the app: the console provider logs the OTP for devs/admins.
function resolveSmsProvider(): SmsProvider {
  const want = env.SMS_PROVIDER;
  const smsethiopia = () => {
    if (env.SMSETHIOPIA_API_KEY) return new SmsEthiopiaProvider();
    logger.warn(
      'SMS_PROVIDER wants SMSEthiopia but SMSETHIOPIA_API_KEY is not set — using console',
    );
    return new ConsoleSmsProvider();
  };
  const afromessage = () => {
    if (env.AFROMESSAGE_API_KEY) return new AfroMessageProvider();
    logger.warn(
      'SMS_PROVIDER wants AfroMessage but AFROMESSAGE_API_KEY is not set — using console',
    );
    return new ConsoleSmsProvider();
  };
  if (want === 'smsethiopia') return smsethiopia();
  if (want === 'afromessage') return afromessage();
  if (env.SMSETHIOPIA_API_KEY) return smsethiopia();
  if (env.AFROMESSAGE_API_KEY) return afromessage();
  return new ConsoleSmsProvider();
}

export const sms: SmsProvider = resolveSmsProvider();

logger.info({ provider: sms.name, smsProvider: env.SMS_PROVIDER }, 'SMS provider initialized');
