/**
 * SSRF-safe URL validation for server-side fetches of user-influenced URLs.
 *
 * Blocks, in order:
 *   1. non-http(s) schemes (file:, data:, gopher:, …)
 *   2. embedded userinfo           (https://user:pass@host — obscures the target)
 *   3. private/internal HOSTNAMES  (localhost, *.local, *.internal, any dotted
 *      IPv4 literal — there is no legitimate reason for a user URL to point at
 *      a raw IP, so all of them are refused, mirroring link-preview's rule)
 *   4. private ADDRESSES behind public-looking DNS  (10.0.0.5.nip.io,
 *      sslip.io, DNS-rebinding style bypasses) — the hostname is resolved and
 *      EVERY returned address is checked against internal ranges.
 *
 * `assertPublicUrl` throws a short code-style Error; callers translate it to
 * their own failure shape (route -> 400, service -> fallback).
 */
import dns from 'node:dns/promises';

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** True for hostnames that are themselves internal (literal IPs, localhost…). */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) {
    return (
      host === '::' ||
      host === '::1' ||
      host.startsWith('::ffff:') || // IPv4-mapped
      host.startsWith('fe80:') || // link-local
      host.startsWith('fc') || // unique-local fc00::/7
      host.startsWith('fd') ||
      host.startsWith('fec0:') // site-local (deprecated)
    );
  }
  return (
    V4.test(host) || // ANY dotted-quad literal (public or private)
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  );
}

/** True for resolved IP addresses inside internal/reserved ranges. */
export function isInternalAddress(address: string): boolean {
  const m = address.toLowerCase().match(V4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10.0.0.0/8
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
      (a === 169 && b === 254) || // link-local (cloud metadata!)
      (a === 172 && b >= 16 && b <= 31) || // 172.16/12
      (a === 192 && b === 168) // 192.168/16
    );
  }
  const host = address.toLowerCase();
  return (
    host === '::' ||
    host === '::1' ||
    host.startsWith('::ffff:') ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fec0:')
  );
}

/** Validate + DNS-resolve a user-influenced URL. Throws coded Errors. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('INVALID_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('SCHEME');
  if (url.username || url.password) throw new Error('USERINFO');
  if (isPrivateHost(url.hostname)) throw new Error('PRIVATE_HOST');
  // Fail-CLOSED on proof of an internal address; fail-OPEN on resolution
  // errors (NXDOMAIN/transient DNS) — the subsequent fetch fails naturally.
  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (records.some((record) => isInternalAddress(record.address))) throw new Error('PRIVATE_DNS');
  } catch (error) {
    if (error instanceof Error && error.message === 'PRIVATE_DNS') throw error;
  }
  return url;
}

/** Async check for redirect hops: hostname must not be internal and must not resolve internal. */
export async function assertResolvablePublicHost(hostname: string): Promise<void> {
  if (isPrivateHost(hostname)) throw new Error('PRIVATE_HOST');
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.some((record) => isInternalAddress(record.address))) throw new Error('PRIVATE_DNS');
  } catch (error) {
    if (error instanceof Error && error.message === 'PRIVATE_DNS') throw error;
    // resolution errors: let the fetch proceed and fail on its own
  }
}
