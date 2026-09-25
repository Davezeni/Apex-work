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
 *   public/brand/logo-mark.png   — the mark alone (current: 333x306)
 *   public/brand/logo-full.png   — mark + wordmark, stacked
 *   public/brand/logo-wordmark.png — the wordmark alone (horizontal)
 *
 * …then bump /public/brand/version.png content or BRAND_VERSION below so
 * caches bust. Nothing else needs touching.
 */

export const BRAND = {
  mark: '/brand/logo-mark.png',
  full: '/brand/logo-full.png',
  wordmark: '/brand/logo-wordmark.png',
  markWidth: 333,
  markHeight: 306,
  /** bump to bust caches after a logo swap */
  version: '1',
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
      src={BRAND.mark}
      alt={alt}
      width={Math.round((size * BRAND.markWidth) / BRAND.markHeight)}
      height={size}
      priority
      className={cn('h-auto w-auto', className)}
      style={{ height: size, width: 'auto' }}
    />
  );
}

/** Horizontal lockup: mark + wordmark, matched heights. */
export function BrandLogo({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark size={height} />
      <Image
        src={BRAND.wordmark}
        alt=""
        width={Math.round((height * 1272) / 259)}
        height={height}
        className="h-auto w-auto"
        style={{ height: Math.round(height * 0.72), width: 'auto' }}
      />
    </span>
  );
}
