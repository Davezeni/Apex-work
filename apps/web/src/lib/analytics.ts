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
    // dynamic import keeps it out of the initial bundle path until first use.
    // posthog-js is an ESM package: depending on how the bundler resolves a
    // CommonJS `require`, the real singleton can be the module itself OR the
    // `.default` export. Normalise to whichever exposes `.init` so we never
    // call `.init()` on the empty namespace object (which crashed the app).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('posthog-js') as { default?: typeof posthog } & typeof posthog;
    _posthog = mod.default && typeof mod.default.init === 'function' ? mod.default : mod;
  }
  return _posthog;
}

/** LocalStorage key for analytics consent. */
export const CONSENT_KEY = 'apx-consent';

/** The user has consented to tracking (or hasn't been asked yet). */
export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Initialise PostHog. Call once, client-side (e.g. in a provider effect). */
export function initPosthog(): void {
  if (_inited || !configured()) return;
  const ph = getPosthog();
  if (!ph) return;
  // Fully guarded: analytics must NEVER be able to crash the app.
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (key) ph.init(key, { api_host: host });
    // Respect a saved opt-out.
    if (!hasConsent()) ph.opt_out_capturing();
    _inited = true;
  } catch {
    /* swallow so analytics can never break the app */
  }
}

/** Opt the current browser in/out of PostHog capturing. */
export function setConsent(consent: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  const ph = getPosthog();
  if (!ph) return;
  try {
    if (consent) ph.opt_in_capturing();
    else ph.opt_out_capturing();
  } catch {
    /* ignore */
  }
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
