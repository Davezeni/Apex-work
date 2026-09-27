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
 *   public/brand/logo-full.png     — mark + wordmark, stacked
 *   public/brand/logo-wordmark.png — the wordmark alone (current: 1219x206)
 *
 * …then bump BRAND_VERSION below (cache-busting) — nothing else needs
 * touching. The icon/favicons derive from the SAME folder:
 *   icon-192/512.png ('any'), icon-*-maskable.png (Android), apple-icon.png
 * A logo swap = replace those PNG files (same names/sizes) in /public/brand/.
 */

export const BRAND = {
  mark: '/brand/logo-mark.png',
  full: '/brand/logo-full.png',
  wordmark: '/brand/logo-wordmark.png',
  markWidth: 333,
  markHeight: 306,
  wordmarkWidth: 1219,
  wordmarkHeight: 206,
  /** appended to every brand URL (?v=N) — bump to bust caches after a swap */
  version: '2',
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
 * Horizontal lockup. The wordmark TUCKS into the mark's box (the A-frame
 * slants right, so its top-right corner is empty) and sits slightly low to
 * meet the mark's visual mass. Factors are relative to `height`, derived
 * from the 52px nav lockup: word 0.88x, tuck -0.21x, drop +0.10x.
 */
export function BrandLogo({ height = 32, className }: { height?: number; className?: string }) {
  const wordHeight = Math.round(height * 0.88);
  return (
    <span className={cn('inline-flex items-center', className)}>
      <BrandMark size={height} />
      <Image
        src={`${BRAND.wordmark}?v=${BRAND.version}`}
        alt=""
        width={Math.round((wordHeight * BRAND.wordmarkWidth) / BRAND.wordmarkHeight)}
        height={wordHeight}
        className="h-auto w-auto"
        style={{
          height: wordHeight,
          width: 'auto',
          marginLeft: -Math.round(height * 0.21),
          transform: `translateY(${Math.round(height * 0.1)}px)`,
        }}
      />
    </span>
  );
}
