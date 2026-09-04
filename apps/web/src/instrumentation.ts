/**
 * Sentry Next.js server/edge init (modern App Router setup).
 *
 * Next.js runs `register()` on the server at startup. Sentry must be init'd
 * here for server + edge errors to be captured. No-ops without `SENTRY_DSN`.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentryServer } = await import('./lib/sentry-server');
    initSentryServer();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    const { initSentryEdge } = await import('./lib/sentry-edge');
    initSentryEdge();
  }
}

// Instrument request errors from React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
