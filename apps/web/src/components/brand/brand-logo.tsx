'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * SINGLE SOURCE OF TRUTH for the Apex-Work brand imagery.
 *
 * The logo lives in exactly one place on disk: /public/brand/*.png. Every
 * surface in the app (landing nav, auth screens, onboarding, PWA icons,
 * favicon) renders through <BrandMark> / <BrandLogo> below. To change the
 * logo app-wide, replace these three files (keeping the filenames):
 *
 *   public/brand/logo-mark.png     — the mark alone (current: 333x306)
 *   public/brand/logo-lockup.png   — mark + wordmark BAKED side by side
 *                                    (1365x306; regenerate from the two
 *                                    files above after any swap)
 *   public/brand/logo-full.png     — mark + wordmark, stacked
 *   public/brand/logo-wordmark.png — the wordmark alone (current: 1219x65)
 *
 * …then bump BRAND_VERSION below (cache-busting) — nothing else needs
 * touching. The icon/favicons derive from the SAME folder:
 *   icon-192/512.png ('any'), icon-*-maskable.png (Android), apple-icon.png
 * A logo swap = replace those PNG files (same names/sizes) in /public/brand/.
 */

export const BRAND = {
  mark: '/brand/logo-mark.png',
  lockup: '/brand/logo-lockup.png',
  full: '/brand/logo-full.png',
  wordmark: '/brand/logo-wordmark.png',
  markWidth: 333,
  markHeight: 306,
  lockupWidth: 1365,
  lockupHeight: 306,
  wordmarkWidth: 582,
  wordmarkHeight: 65,
  /** appended to every brand URL (?v=N) — bump to bust caches after a swap */
  version: '11',
} as const;

/** The mark alone (scales by height in px). */
export function BrandMark({
  size = 32,
  className,
  alt = 'Apex-Work',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={`${BRAND.mark}?v=${BRAND.version}`}
      alt={alt}
      width={Math.round((size * BRAND.markWidth) / BRAND.markHeight)}
      height={size}
      priority
      className={cn('h-auto w-auto', className)}
      style={{ height: size, width: 'auto' }}
    />
  );
}

/**
 * Horizontal lockup: ONE pre-composed PNG (mark + wordmark baked together
 * with pixel-measured spacing — big text seated at the mark's base, snug
 * off the handshake arm). A single image means no CSS gap can appear.
 */
export function BrandLogo({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <Image
      src={`${BRAND.lockup}?v=${BRAND.version}`}
      alt="Apex-Work"
      width={Math.round((height * BRAND.lockupWidth) / BRAND.lockupHeight)}
      height={height}
      priority
      className={cn('h-auto w-auto', className)}
      style={{ height, width: 'auto' }}
    />
  );
}
