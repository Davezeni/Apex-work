/**
 * Sentry browser init (client). Next.js calls this on the client.
 * No-ops when `NEXT_PUBLIC_SENTRY_DSN` is absent.
 */
import * as Sentry from '@sentry/nextjs';

export function onLoad() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

// Instrument client-side navigations so Sentry captures route transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
