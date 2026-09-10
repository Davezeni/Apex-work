import { createHash } from 'node:crypto';
import { logger } from '../config/logger.js';
import type { TranslateResult } from '@apex-work/shared';

/**
 * Free machine translation for one-tap chat message translation.
 *
 * Provider chain: Google's keyless gtx endpoint first (best coverage for
 * am/ti/om, usually reachable from datacenter IPs), falling back to
 * MyMemory (keyless free tier). Results are cached in memory for 24h and
 * rate-limited per user by the route, so we stay far inside free quotas.
 */

const PROVIDER_URL = 'https://api.mymemory.translated.net/get';
const CACHE_MAX = 2000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

const cache = new Map<string, { result: TranslateResult; at: number }>();

function cacheKey(text: string, source: string, target: string): string {
  return createHash('sha1').update(`${source}|${target}|${text}`).digest('hex');
}

/**
 * Detect the source language when the client doesn't send one. Ethiopic
 * script covers Amharic/Tigrinya (we map to 'am' — providers handle both
 * reasonably from that hint); Latin script is treated as English (covers
 * Afaan Oromoo too, which shares the alphabet).
 */
export function detectSource(text: string): 'am' | 'en' {
  return /[\u1200-\u137F]/.test(text) ? 'am' : 'en';
}

class TranslationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Provider 1 (preferred): Google's free keyless gtx endpoint. Supports every
 * locale we ship (incl. ti/om) with good quality. May be unreachable from
 * some datacenter IPs — callers fall through to MyMemory on any failure.
 */
async function gtxTranslate(text: string, source: string, target: string): Promise<string | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t` +
      `&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
      `&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const out = (data[0] as unknown[])
      .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? '') : ''))
      .join('');
    return out.trim() ? out : null;
  } catch {
    return null;
  }
}

/** Provider 2 (fallback): MyMemory — keyless free tier, TM+MT mix. */
async function myMemoryTranslate(text: string, source: string, target: string): Promise<string> {
  const url =
    `${PROVIDER_URL}?q=${encodeURIComponent(text)}&langpair=` +
    `${encodeURIComponent(source)}|${encodeURIComponent(target)}&mt=1`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    logger.warn({ err: e }, 'translate provider unreachable');
    throw new TranslationError('Translation service unavailable', 503);
  }
  if (!res.ok) {
    throw new TranslationError('Translation service unavailable', 503);
  }
  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    quotaFinished?: boolean;
  };
  const translated = data.responseData?.translatedText;
  if (data.quotaFinished || !translated || String(data.responseStatus ?? '200') !== '200') {
    throw new TranslationError('Translation quota reached — try again later', 503);
  }
  return translated;
}

export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<TranslateResult> {
  if (source === target) {
    return { translated: text, source, target, cached: false };
  }
  const key = cacheKey(text, source, target);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    cache.delete(key); // refresh LRU position
    cache.set(key, hit);
    return { ...hit.result, cached: true };
  }

  const gtx = await gtxTranslate(text, source, target);
  const translated = gtx ?? (await myMemoryTranslate(text, source, target));
  const result: TranslateResult = { translated, source, target, cached: false };

  if (cache.size >= CACHE_MAX) {
    // evict the oldest entry (insertion-order Map)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { result, at: Date.now() });
  return result;
}
