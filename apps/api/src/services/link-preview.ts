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
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) {
    // IPv6 (or IPv6-mapped) — block all internal/private/site-local ranges.
    return (
      host === '::' || // unspecified
      host === '::1' || // loopback
      host.startsWith('::ffff:') || // IPv4-mapped (e.g. ::ffff:127.0.0.1)
      host.startsWith('fe80:') || // link-local
      host.startsWith('fc') || // unique-local (fc00::/7)
      host.startsWith('fd') ||
      host.startsWith('fec0:') || // site-local
      host.startsWith('::ffff:') // v4-mapped private
    );
  }
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^[0-9]+(\.[0-9]+){3}$/.test(host)
  );
}

const MAX_REDIRECTS = 5;

/**
 * Fetch a URL and build a rich link preview. Guards against SSRF (private
 * hosts) on the INITIAL URL **and on every HTTP redirect hop** — the fetch
 * runs with `redirect: 'manual'` and we follow each `Location` ourselves,
 * re-validating the destination against loopback/private/link-local/IPv6
 * ranges before issuing the next request. Limits response size/time and falls
 * back to a bare domain card.
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
    let current = url;
    let hops = 0;
    let res: Response;

    // Manual redirect chain — validate every destination host.
    for (;;) {
      res = await fetch(current.href, {
        signal: ac.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ApexBot/1.0; +https://apex)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break; // 3xx with no Location → treat as non-html
        if (hops >= MAX_REDIRECTS) break; // too many hops → bail
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          break;
        }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') break;
        // SSRF: reject a redirect that points at a private/internal host.
        if (isBlockedHost(next.hostname)) {
          const bare: LinkPreviewResult = { url: current.href, domain: safeDomain(current.href) };
          UNFURL_CACHE.set(rawUrl, { at: Date.now(), value: bare });
          return bare;
        }
        current = next;
        hops++;
        continue;
      }
      break; // non-redirect response → emit the current URL
    }

    const finalUrl = current.href;
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
