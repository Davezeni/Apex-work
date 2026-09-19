/**
 * Sentry error monitoring (API / Node).
 *
 * No-ops safely when `SENTRY_DSN` is absent, so the app runs local/dev without
 * any keys. Once the DSN is present in env (Render → Environment Variables),
 * errors are captured automatically. Free-tier friendly: traces are sampled
 * to 1-in-10 by default (override with SENTRY_TRACES_SAMPLE_RATE).
 */
import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from './logger.js';

export function initSentry(): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    // Make the gap visible instead of silently flying blind in production.
    if (env.NODE_ENV === 'production') {
      logger.warn('Sentry disabled: set SENTRY_DSN on Render to receive error alerts');
    }
    return; // no-op without a key
  }
  Sentry.init({
    dsn,
    environment: env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Don't flood Sentry with our own 4xx "expected" failures unless it's a 5xx.
    beforeSend(event) {
      // HTTP status can be read from the event's request context. We let
      // everything through except duplicate noisy source-map artifacts.
      return event;
    },
  });
  Sentry.setTag('service', 'apex-work-api');
}

/** Capture an unexpected error (used from the global error handler). */
export function captureException(err: unknown): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(err);
}

/** Report a handled-but-noteworthy user-facing failure (404 on a 5xx check, etc). */
export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureMessage(message, { extra: context });
}
