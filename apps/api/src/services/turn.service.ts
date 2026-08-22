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

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

let cache: { fetchedAt: number; servers: RTCIceServer[] } | null = null;
let lastError: { at: string; url: string; message: string } | null = null;
let lastSuccessUrl: string | null = null;
const TTL_MS = 30 * 60 * 1000;

export function turnDebug() {
  return {
    hasKey: !!env.METERED_API_KEY,
    appName: env.METERED_APP_NAME,
    cachedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
    cachedServerCount: cache?.servers.length ?? 0,
    lastError,
    lastSuccessUrl,
  };
}

export function invalidateTurnCache() {
  cache = null;
  lastError = null;
}

async function tryFetch(url: string): Promise<RTCIceServer[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      lastError = {
        at: new Date().toISOString(),
        url: url.replace(env.METERED_API_KEY ?? '', 'REDACTED'),
        message: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
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
      lastError = {
        at: new Date().toISOString(),
        url: url.replace(env.METERED_API_KEY ?? '', 'REDACTED'),
        message: 'empty server list',
      };
      return null;
    }
    lastSuccessUrl = url.replace(env.METERED_API_KEY ?? '', 'REDACTED');
    return list;
  } catch (err) {
    lastError = {
      at: new Date().toISOString(),
      url: url.replace(env.METERED_API_KEY ?? '', 'REDACTED'),
      message: (err as Error).message || 'unknown',
    };
    return null;
  }
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!env.METERED_API_KEY) return STUN_ONLY;
  if (cache && Date.now() - cache.fetchedAt < TTL_MS && cache.servers.length > STUN_ONLY.length) {
    return cache.servers;
  }

  const key = env.METERED_API_KEY;
  // Order matters: try the app-specific endpoint first (paid tier), then
  // fall back to the global endpoint (free Open Relay tier).
  const candidates = [
    // Global / Open Relay — works with any Metered account by default.
    `https://global.metered.live/api/v1/turn/credentials?apiKey=${key}`,
    // App-specific endpoint (for paid tier or custom named apps).
    env.METERED_APP_NAME
      ? `https://${env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${key}`
      : null,
  ].filter((u): u is string => u !== null);

  for (const url of candidates) {
    const list = await tryFetch(url);
    if (list) {
      cache = { fetchedAt: Date.now(), servers: [...STUN_ONLY.slice(0, 1), ...list] };
      logger.info({ n: list.length, url: url.replace(key, 'REDACTED') }, 'TURN credentials fetched');
      return cache.servers;
    }
  }

  logger.warn({ lastError }, 'All Metered endpoints failed — falling back to STUN');
  return STUN_ONLY;
}
