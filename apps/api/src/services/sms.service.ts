import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * SMS abstraction. Uses AfroMessage in prod; console in dev.
 * Docs: https://afromessage.com/api-doc
 */
export interface SmsProvider {
  send(to: string, message: string): Promise<{ ok: boolean; providerRef?: string }>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    logger.info({ to, message }, '[DEV] SMS');
    return { ok: true, providerRef: `dev-${Date.now()}` };
  }
}

class AfroMessageProvider implements SmsProvider {
  async send(to: string, message: string) {
    if (!env.AFROMESSAGE_API_KEY) {
      logger.warn('AFROMESSAGE_API_KEY not set — SMS not sent');
      return { ok: false };
    }
    try {
      const url = new URL('https://api.afromessage.com/api/send');
      url.searchParams.set('from', env.AFROMESSAGE_IDENTIFIER_ID ?? '');
      url.searchParams.set('sender', env.AFROMESSAGE_SENDER);
      url.searchParams.set('to', to);
      url.searchParams.set('message', message);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.AFROMESSAGE_API_KEY}` },
      });
      const data = (await res.json()) as { acknowledge?: string; response?: { message_id?: string } };
      if (data.acknowledge !== 'success') {
        logger.error({ data }, 'AfroMessage send failed');
        return { ok: false };
      }
      return { ok: true, providerRef: data.response?.message_id };
    } catch (err) {
      logger.error({ err }, 'AfroMessage error');
      return { ok: false };
    }
  }
}

export const sms: SmsProvider =
  isDev || !env.AFROMESSAGE_API_KEY ? new ConsoleSmsProvider() : new AfroMessageProvider();
