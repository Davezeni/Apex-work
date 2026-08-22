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
const TTL_MS = 30 * 60 * 1000; // Metered creds live ~2h; refresh at 30 min.

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (!env.METERED_API_KEY) return STUN_ONLY;
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.servers;

  try {
    const res = await fetch(
      `https://${env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${env.METERED_API_KEY}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const servers = (await res.json()) as RTCIceServer[];
    // Metered returns an array already in RTCIceServer shape.
    cache = { fetchedAt: Date.now(), servers: [...STUN_ONLY.slice(0, 1), ...servers] };
    return cache.servers;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Metered TURN fetch failed — falling back to STUN');
    return STUN_ONLY;
  }
}
