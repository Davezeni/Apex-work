/**
 * Site-wide announcement banner helpers.
 *
 * The announcement is stored as a JSON value in the typed `AppSetting` store
 * (`content.siteAnnouncement`). These pure helpers validate the shape and
 * normalise tone so the public read endpoint and client can render it safely.
 */

export type AnnouncementTone = 'info' | 'promo' | 'urgent';

export interface Announcement {
  id: string;
  text: string;
  href?: string;
  cta?: string;
  tone: AnnouncementTone;
}

const MAX_TEXT = 240;
const MAX_HREF = 300;
const MAX_CTA = 40;

/**
 * Normalise an arbitrary stored value into a safe `Announcement`, or return
 * `null` if it isn't one. Never throws — malformed/missing content simply
 * means "no banner".
 */
export function sanitiseAnnouncement(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const text = typeof v.text === 'string' ? v.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return null;

  const tone: AnnouncementTone =
    v.tone === 'promo' || v.tone === 'urgent' ? v.tone : 'info';

  const href = typeof v.href === 'string' ? v.href.slice(0, MAX_HREF) : undefined;
  const cta = typeof v.cta === 'string' ? v.cta.slice(0, MAX_CTA) : undefined;

  // Only allow safe (http/https or relative) hrefs.
  const safeHref = href && /^(https?:\/\/|\/)/.test(href) ? href : undefined;

  return { id: 'site-announcement', text, href: safeHref, cta: safeHref ? cta : undefined, tone };
}
