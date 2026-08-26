/**
 * TURN credentials for WebRTC calls.
 *
 * Metered has two key/endpoint combinations. The API key must be the
 * credential-specific key from TURN Server → Manage Credentials → Show API
 * Key; the Developers → Secret Key is a management key and returns 401 from
 * this endpoint. We try the common app-name variants so a hyphen/underscore
 * mismatch does not break calls.
 *
 * If Metered is missing, misconfigured, or temporarily unavailable, calls
 * receive Metered OpenRelay's public static fallback. This is deliberately
 * server-selected and does not expose the long-lived METERED_API_KEY.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const STUN_ONLY: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// OpenRelay fallback keeps calls usable on networks where STUN-only fails.
// These are public demo credentials supplied by Metered for OpenRelay; they
// are not the user's account secret and are safe to return as ICE credentials.
const OPEN_RELAY_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

const STUN_PLUS_FALLBACK = [...STUN_ONLY.slice(0, 1), ...OPEN_RELAY_FALLBACK];

let cache: { fetchedAt: number; servers: RTCIceServer[] } | null = null;
let lastError: { at: string; url: string; message: string } | null = null;
let lastSuccessUrl: string | null = null;
const lastAttempts: Array<{ url: string; ok: boolean; message: string }> = [];
const TTL_MS = 30 * 60 * 1000;

const redactedUrl = (url: string, key = env.METERED_API_KEY): string => {
  if (!key) return url;
  return url.replace(encodeURIComponent(key), 'REDACTED').replace(key, 'REDACTED');
};

const keyPreview = (key: string | undefined): string | null =>
  key ? `${key.slice(0, 4)}…${key.slice(-4)}` : null;

export function turnDebug() {
  return {
    hasKey: !!env.METERED_API_KEY,
    keyPreview: keyPreview(env.METERED_API_KEY),
    appName: env.METERED_APP_NAME,
    cachedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
    cachedServerCount: cache?.servers.length ?? (!env.METERED_API_KEY ? STUN_PLUS_FALLBACK.length : 0),
    lastSuccessUrl,
    fallbackActive: !env.METERED_API_KEY || (!!cache && !lastSuccessUrl),
    lastError,
    lastAttempts: lastAttempts.slice(-8),
  };
}

export function invalidateTurnCache() {
  cache = null;
  lastError = null;
  lastSuccessUrl = null;
  lastAttempts.length = 0;
}

async function tryFetch(url: string): Promise<RTCIceServer[] | null> {
  const safeUrl = redactedUrl(url);
  const at = new Date().toISOString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const result = `HTTP ${res.status}: ${body.slice(0, 160)}`;
      lastError = { at, url: safeUrl, message: result };
      lastAttempts.push({ url: safeUrl, ok: false, message: result });
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
      const result = 'empty server list';
      lastError = { at, url: safeUrl, message: result };
      lastAttempts.push({ url: safeUrl, ok: false, message: result });
      return null;
    }
    lastSuccessUrl = safeUrl;
    lastAttempts.push({ url: safeUrl, ok: true, message: `OK (${list.length} servers)` });
    return list;
  } catch (err) {
    const result = (err as Error).message || 'unknown network error';
    lastError = { at, url: safeUrl, message: result };
    lastAttempts.push({ url: safeUrl, ok: false, message: result });
    return null;
  }
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.servers;
  if (!env.METERED_API_KEY) {
    cache = { fetchedAt: Date.now(), servers: STUN_PLUS_FALLBACK };
    return cache.servers;
  }

  const key = encodeURIComponent(env.METERED_API_KEY);
  const configuredName = env.METERED_APP_NAME.trim();
  const names = [configuredName, 'apex_work', 'apex-work']
    .filter(Boolean)
    .filter((name, index, all) => all.indexOf(name) === index);
  const candidates = [
    ...names.map((name) => `https://${name}.metered.live/api/v1/turn/credentials?apiKey=${key}`),
    `https://global.metered.live/api/v1/turn/credentials?apiKey=${key}`,
  ];

  for (const url of candidates) {
    const list = await tryFetch(url);
    if (list) {
      cache = { fetchedAt: Date.now(), servers: [...STUN_ONLY.slice(0, 1), ...list] };
      logger.info({ n: list.length, url: redactedUrl(url) }, 'TURN credentials fetched');
      return cache.servers;
    }
  }

  logger.warn({ lastError, attempts: lastAttempts.slice(-4) }, 'Metered failed — using OpenRelay fallback');
  cache = { fetchedAt: Date.now(), servers: STUN_PLUS_FALLBACK };
  return cache.servers;
}
