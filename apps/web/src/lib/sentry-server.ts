/**
 * Sentry server init (Node runtime). No-ops when `SENTRY_DSN` is absent.
 */
import * as Sentry from '@sentry/nextjs';

let _inited = false;

export function initSentryServer(): void {
  const dsn = process.env.SENTRY_DSN;
  if (_inited || !dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
  _inited = true;
}
