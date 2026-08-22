/**
 * TURN credentials.
 *
 * If METERED_API_KEY is set, we fetch short-lived TURN credentials from
 * Metered on demand (they issue a fresh username+password every call).
 * Otherwise we return public STUN only.
 *
 * We never send the API key to the browser — only the ephemeral
 * username+password bound to a specific TURN URL.
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
const TTL_MS = 30 * 60 * 1000; // Metered creds live ~2h; refresh at 30 min.

/** Debug view — only exposed via the admin-gated /v1/push/turn-debug endpoint. */
export function turnDebug() {
  return {
    hasKey: !!env.METERED_API_KEY,
    appName: env.METERED_APP_NAME,
    cachedAt: cache ? new Date(cache.fetchedAt).toISOString() : null,
    cachedServerCount: cache?.servers.length ?? 0,
    lastError,
  };
}

export function invalidateTurnCache() {
  cache = null;
  lastError = null;
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!env.METERED_API_KEY) return STUN_ONLY;
  // Only trust the cache when it actually contains TURN entries.
  if (cache && Date.now() - cache.fetchedAt < TTL_MS && cache.servers.length > STUN_ONLY.length) {
    return cache.servers;
  }

  const url = `https://${env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${env.METERED_API_KEY}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const servers = (await res.json()) as RTCIceServer[];
    if (!Array.isArray(servers) || servers.length === 0) {
      throw new Error('empty server list');
    }
    cache = { fetchedAt: Date.now(), servers: [...STUN_ONLY.slice(0, 1), ...servers] };
    lastError = null;
    logger.info({ n: servers.length }, 'TURN credentials fetched');
    return cache.servers;
  } catch (err) {
    const message = (err as Error).message || 'unknown';
    lastError = {
      at: new Date().toISOString(),
      url: url.replace(env.METERED_API_KEY ?? '', 'REDACTED'),
      message,
    };
    logger.warn({ err: message }, 'Metered TURN fetch failed — falling back to STUN');
    return STUN_ONLY;
  }
}
