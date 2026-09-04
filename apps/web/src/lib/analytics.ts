/**
 * PostHog product analytics (web).
 *
 * Initialises posthog-js on the client only when `NEXT_PUBLIC_POSTHOG_KEY` is
 * present, so local/dev runs without keys are a no-op. Respects an opt-out
 * stored under the `apx-consent` key (off = disable capture). `track()` is safe
 * to call anywhere — it no-ops on the server or when PostHog isn't configured.
 */
'use client';

import type posthog from 'posthog-js';

// Lazily loaded so callers at module scope never force the bundle in.
let _posthog: typeof posthog | null = null;
let _inited = false;

function configured(): boolean {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function getPosthog(): typeof posthog | null {
  if (!configured()) return null;
  if (!_posthog) {
    // dynamic import keeps it out of the initial bundle path until first use
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _posthog = require('posthog-js') as typeof posthog;
  }
  return _posthog;
}

/** Initialise PostHog. Call once, client-side (e.g. in a provider effect). */
export function initPosthog(): void {
  if (_inited || !configured()) return;
  const ph = getPosthog();
  if (!ph) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  ph.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, { api_host: host });
  _inited = true;
}

/** Track a product event. No-op unless PostHog is configured. */
export function track(event: string, properties?: Record<string, unknown>): void {
  const ph = getPosthog();
  if (!ph) return;
  try {
    ph.capture(event, properties);
  } catch {
    /* swallow so analytics never breaks the app */
  }
}

/** Associate the current browser session with a distinct user id. */
export function identify(id: string): void {
  const ph = getPosthog();
  if (!ph || !id) return;
  try {
    ph.identify(id);
  } catch {
    /* ignore */
  }
}
