import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's `cn` helper — merge Tailwind classes safely */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * Resolve a media URL to one the browser <img>/<audio>/<video> can load.
 * Avatars/attachments served by the API may come back as a root-relative path
 * (e.g. "/v1/uploads/files/<id>"). On the web origin that path would 404, so we
 * prefix it with the API base. Absolute (http/blob/data) URLs pass through.
 */
export function resolveMediaUrl(input?: string | null): string | undefined {
  if (!input) return undefined;
  if (/^(https?:)?\/\//.test(input) || input.startsWith('data:') || input.startsWith('blob:'))
    return input;
  if (input.startsWith('/') && MEDIA_BASE) return `${MEDIA_BASE}${input}`;
  return input;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an ETB amount for display */
export function formatEtb(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact human number: 1200 -> "1.2K" */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Relative time: "2h ago" */
export function timeAgo(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(seconds) >= secs) return rtf.format(-Math.floor(seconds / secs), unit);
  }
  return 'just now';
}
