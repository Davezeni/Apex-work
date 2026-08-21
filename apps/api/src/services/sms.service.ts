import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * SMS abstraction. Uses AfroMessage in prod; console in dev.
 * Docs: https://afromessage.com/api-doc
 *
 * The service is chosen at module load based on env:
 * - If AFROMESSAGE_API_KEY is set → real SMS via AfroMessage.
 * - Otherwise → console provider (logs the OTP so devs can grab it from stdout).
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
 * AfroMessage sender.
 * `from` = your identifier ID (required, from dashboard).
 * `sender` = registered sender name (optional; requires paid subscription).
 * If sender isn't provided, AfroMessage uses a default shortcode.
 */
class AfroMessageProvider implements SmsProvider {
  readonly name = 'afromessage';
  private readonly base = 'https://api.afromessage.com/api/send';

  async send(to: string, message: string) {
    if (!env.AFROMESSAGE_API_KEY) {
      logger.warn('AFROMESSAGE_API_KEY not set — SMS not sent');
      return { ok: false, error: 'no_api_key' };
    }

    const url = new URL(this.base);
    // NOTE: AfroMessage uses two different concepts often confused in their UI:
    //   - `from` (short code / sender ID) — must be a code AfroMessage assigned
    //     to your account for sending. Beta accounts typically don't have one.
    //   - `sender` — optional pre-registered brand name (requires paid plan).
    //
    // If you don't have a short code, DON'T send `from` — AfroMessage will use
    // their default shortcode automatically. That's the case on beta / trial.
    //
    // Only set `from` if you have a real, verified short code (not the account
    // UUID shown in the Profile page).
    if (env.AFROMESSAGE_IDENTIFIER_ID && env.AFROMESSAGE_IDENTIFIER_ID.trim().length > 0) {
      url.searchParams.set('from', env.AFROMESSAGE_IDENTIFIER_ID.trim());
    }
    // `sender` = optional registered sender name; only set if non-empty
    if (env.AFROMESSAGE_SENDER && env.AFROMESSAGE_SENDER.trim().length > 0) {
      url.searchParams.set('sender', env.AFROMESSAGE_SENDER.trim());
    }
    url.searchParams.set('to', to);
    url.searchParams.set('message', message);

    try {
      const res = await fetch(url, {
        method: 'GET', // AfroMessage's simple API is a GET with query params
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
        logger.error({ status: res.status, raw: raw.slice(0, 500), to }, 'AfroMessage returned non-JSON');
        return { ok: false, error: `non_json_${res.status}` };
      }

      const payload = data as {
        acknowledge?: string;
        response?: { message_id?: string; status?: string; errors?: unknown };
        error?: string;
      };

      if (payload.acknowledge !== 'success') {
        // Log everything so we can debug — this is important for onboarding.
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
          error: payload.error ?? payload.response?.status ?? 'send_failed',
        };
      }

      logger.info(
        { to, messageId: payload.response?.message_id },
        'AfroMessage SMS sent successfully',
      );
      return { ok: true, providerRef: payload.response?.message_id };
    } catch (err) {
      logger.error({ err, to }, 'AfroMessage network error');
      return { ok: false, error: 'network_error' };
    }
  }
}

// Provider selection: real SMS when configured, console otherwise.
// Note: even in prod, if AFROMESSAGE_API_KEY isn't set we fall back to console
// (never blocks the app; devs/admins see the OTP in logs).
const useAfroMessage = !!env.AFROMESSAGE_API_KEY;
export const sms: SmsProvider = useAfroMessage ? new AfroMessageProvider() : new ConsoleSmsProvider();

logger.info({ provider: sms.name, useAfroMessage }, 'SMS provider initialized');
