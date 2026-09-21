import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';
import { normalizeEthiopianMsisdn } from './sms-msisdn.js';

/**
 * SMS abstraction. Real SMS in prod (SMSEthiopia); console in dev.
 * Docs: https://smsethiopia.com/#/landing/docs/api-v2
 *
 * The provider is chosen at module load from SMS_PROVIDER (default 'auto'):
 * - 'auto' | 'smsethiopia' → SMSEthiopia when SMSETHIOPIA_API_KEY is set,
 *   else console (logs the OTP to stdout). There is deliberately NO second
 *   provider: SMSEthiopia is the single SMS path (redundant fallbacks were
 *   removed for operational simplicity — see git history for AfroMessage).
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
        // Their error bodies have no fixed schema (10006 = campaign sender not
        // approved yet, 10007 = key bound to the free whitelist-only campaign).
        // Pull the numeric code and any message-ish string straight from the
        // raw body so the Render log always shows the gateway's own words.
        const codeMatch = raw.match(/\b1000\d\b/);
        const msgMatch = raw.match(
          /"(?:description|message|msg|error|detail)"\s*:\s*"([^"]{3,300})"/,
        );
        const detail = msgMatch?.[1] ?? (codeMatch ? `sms_error_${codeMatch[0]}` : undefined);
        logger.error(
          {
            status: res.status,
            to: msisdn,
            detail: detail ?? '(no message in body)',
            body: raw.slice(0, 400),
          },
          'SMSEthiopia send failed',
        );
        return { ok: false, error: detail ?? `send_failed_${res.status}` };
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
  if (want === 'smsethiopia' || want === 'auto') return smsethiopia();
  return new ConsoleSmsProvider();
}

export const sms: SmsProvider = resolveSmsProvider();

logger.info({ provider: sms.name, smsProvider: env.SMS_PROVIDER }, 'SMS provider initialized');
