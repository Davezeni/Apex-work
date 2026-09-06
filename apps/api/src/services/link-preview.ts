import { BadRequestError } from '../lib/errors.js';

export interface LinkPreviewResult {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const UNFURL_CACHE = new Map<string, { at: number; value: LinkPreviewResult }>();
const UNFURL_TTL = 15 * 60 * 1000; // 15 min
const MAX_HTML = 600_000;

/** Cheap HTML entity decode for title/description extracted from tags. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function metaContent(html: string, key: string): string | undefined {
  // Handles both <meta property="og:title" content="..."/> and attribute order variations.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["'][^>]*>`,
    'i',
  );
  const m = html.match(re) ?? html.match(alt);
  if (!m) return undefined;
  const via = decodeEntities(m[1] ?? '');
  return via || undefined;
}

function absoluteUrl(rel: string, base: string): string | undefined {
  try {
    const u = new URL(rel, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/** Parse OpenGraph / Twitter-card metadata out of a fetched HTML document. */
export function parseOpenGraph(html: string, base: string): LinkPreviewResult {
  const rawTitle =
    metaContent(html, 'og:title') ??
    metaContent(html, 'twitter:title') ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
  const description = metaContent(html, 'og:description') ?? metaContent(html, 'twitter:description');
  const siteName = metaContent(html, 'og:site_name');
  const imageRaw = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image');
  let domain = base;
  try {
    domain = new URL(base).hostname.replace(/^www\./, '');
  } catch {
    /* keep base */
  }
  return {
    url: base,
    domain,
    title: rawTitle ? decodeEntities(rawTitle) : undefined,
    description: description ? decodeEntities(description) : undefined,
    image: imageRaw ? absoluteUrl(imageRaw, base) : undefined,
    siteName: siteName ? decodeEntities(siteName) : undefined,
  };
}

function safeDomain(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

/** True if the host routes to a private/internal network (SSRF guard). */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^[0-9]+(\.[0-9]+){3}$/.test(host)
  );
}

/**
 * Fetch a URL and build a rich link preview. Guards against SSRF (private
 * hosts), limits response size/time, and falls back to a bare domain card.
 */
export async function unfurl(rawUrl: string): Promise<LinkPreviewResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestError('Only http(s) links are supported');
  }
  if (isBlockedHost(url.hostname)) throw new BadRequestError('Blocked host');

  const cached = UNFURL_CACHE.get(rawUrl);
  if (cached && Date.now() - cached.at < UNFURL_TTL) return cached.value;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6000);
  try {
    const res = await fetch(url.href, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ApexBot/1.0; +https://apex)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const finalUrl = res.url || url.href;
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok || !/text\/html/i.test(ctype)) {
      const bare: LinkPreviewResult = { url: finalUrl, domain: safeDomain(finalUrl) };
      UNFURL_CACHE.set(rawUrl, { at: Date.now(), value: bare });
      return bare;
    }
    const html = (await res.text()).slice(0, MAX_HTML);
    const preview = parseOpenGraph(html, finalUrl);
    UNFURL_CACHE.set(rawUrl, { at: Date.now(), value: preview });
    return preview;
  } catch {
    const bare: LinkPreviewResult = { url: url.href, domain: safeDomain(url.href) };
    UNFURL_CACHE.set(rawUrl, { at: Date.now(), value: bare });
    return bare;
  } finally {
    clearTimeout(timer);
  }
}
