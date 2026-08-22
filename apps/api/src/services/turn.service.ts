/**
 * TURN credentials.
 *
 * Metered has TWO products with different endpoints:
 *   1. "Open Relay" (free tier) — global endpoint `global.xirsys.net`-style
 *      served at `https://global.metered.live/api/v1/turn/credentials`.
 *      Uses just the API key; no per-app subdomain needed.
 *   2. "Managed TURN" (paid) — per-app subdomain
 *      `https://<APP>.metered.live/api/v1/turn/credentials`.
 *      Requires METERED_APP_NAME to match the app you created.
 *
 * We try #2 first if METERED_APP_NAME is set, then fall back to #1.
 * Either way, if both fail we serve STUN-only so calls still connect
 * on friendly networks.
 *
 * We never send the API key to the browser — only the ephemeral
 * username+password bound to the returned TURN URL.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const STUN_ONLY: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/**
 * Publicly documented static-auth TURN from Metered's Open Relay project.
 * Anyone can use these — no key needed — so we ship them as a hard fallback
 * whenever our own Metered credentials fetch fails. Ethiopian ISPs are
 * heavily CGNAT'd and pure STUN often can't punch through, so having
 * *some* relay is dramatically better than having none.
 * See https://www.metered.ca/tools/openrelay/
 */
const OPEN_RELAY_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

let cache: { fetchedAt: number; servers: RTCIceServer[] } | null = null;
let lastError: { at: string; url: string; message: string } | null = null;
let lastSuccessUrl: string | null = null;
let lastAttempts: { url: string; ok: boolean; message: string }[] = [];
const TTL_MS = 30 * 60 * 1000;

export function turnDebug() {
  return {
    hasKey: !!env.METERED_API_KEY,
    keyPreview: env.METERED_API_KEY
      ? `${env.METERED_API_KEY.slice(0, 4)}…${env.METERED_API_KEY.slice(-4)} (len ${env.METERED_API_KEY.length})`
      : null,
    appName: env.METERED_APP_NAME,
    cachedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
    cachedServerCount: cache?.servers.length ?? 0,
    lastError,
    lastSuccessUrl,
    lastAttempts,
  };
}

export function invalidateTurnCache() {
  cache = null;
  lastError = null;
  lastAttempts = [];
}

function redact(url: string): string {
  return env.METERED_API_KEY ? url.replace(env.METERED_API_KEY, 'REDACTED') : url;
}

async function tryFetch(url: string): Promise<RTCIceServer[] | null> {
  const safeUrl = redact(url);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const message = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      lastError = { at: new Date().toISOString(), url: safeUrl, message };
      lastAttempts.push({ url: safeUrl, ok: false, message });
      return null;
    }
    const parsed = (await res.json()) as unknown;
    // Metered sometimes wraps in an object, sometimes returns the array raw.
    const list: RTCIceServer[] = Array.isArray(parsed)
      ? (parsed as RTCIceServer[])
      : Array.isArray((parsed as { iceServers?: RTCIceServer[] }).iceServers)
        ? (parsed as { iceServers: RTCIceServer[] }).iceServers
        : [];
    if (list.length === 0) {
      const message = 'empty server list';
      lastError = { at: new Date().toISOString(), url: safeUrl, message };
      lastAttempts.push({ url: safeUrl, ok: false, message });
      return null;
    }
    lastSuccessUrl = safeUrl;
    lastAttempts.push({ url: safeUrl, ok: true, message: `${list.length} servers` });
    return list;
  } catch (err) {
    const message = (err as Error).message || 'unknown';
    lastError = { at: new Date().toISOString(), url: safeUrl, message };
    lastAttempts.push({ url: safeUrl, ok: false, message });
    return null;
  }
}

/** STUN + free Open Relay TURN — used whenever we don't have valid Metered creds. */
const STUN_PLUS_FALLBACK: RTCIceServer[] = [...STUN_ONLY, ...OPEN_RELAY_FALLBACK];

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!env.METERED_API_KEY) return STUN_PLUS_FALLBACK;
  if (cache && Date.now() - cache.fetchedAt < TTL_MS && cache.servers.length > STUN_ONLY.length) {
    return cache.servers;
  }
  // Reset per-refresh attempt log so the diagnostics panel only shows the
  // most recent probe cycle, not accumulated history.
  lastAttempts = [];

  const key = env.METERED_API_KEY;
  // Build candidate endpoint list. Metered accepts both:
  //   - global endpoint (Open Relay free tier)
  //   - per-app subdomain (Managed TURN or custom named apps)
  // We also try both hyphen AND underscore variants of the configured app
  // name — Metered's dashboard normalises names differently in different
  // places and users routinely trip on it (e.g. `apex-work` vs `apex_work`).
  const appNames = new Set<string>();
  if (env.METERED_APP_NAME) {
    const n = env.METERED_APP_NAME.trim();
    appNames.add(n);
    if (n.includes('-')) appNames.add(n.replace(/-/g, '_'));
    if (n.includes('_')) appNames.add(n.replace(/_/g, '-'));
  }
  const candidates: string[] = [
    // App-specific endpoint(s) first — these serve the account's provisioned
    // credentials directly. If the app name doesn't match, we fall through
    // to the global endpoint which works with the raw API key alone.
    ...Array.from(appNames).map(
      (name) => `https://${name}.metered.live/api/v1/turn/credentials?apiKey=${key}`,
    ),
    // Global / Open Relay — works with any Metered account by default.
    `https://global.metered.live/api/v1/turn/credentials?apiKey=${key}`,
  ];

  for (const url of candidates) {
    const list = await tryFetch(url);
    if (list) {
      cache = { fetchedAt: Date.now(), servers: [...STUN_ONLY.slice(0, 1), ...list] };
      logger.info({ n: list.length, url: url.replace(key, 'REDACTED') }, 'TURN credentials fetched');
      return cache.servers;
    }
  }

  logger.warn({ lastError }, 'All Metered endpoints failed — falling back to Open Relay TURN');
  return STUN_PLUS_FALLBACK;
}
