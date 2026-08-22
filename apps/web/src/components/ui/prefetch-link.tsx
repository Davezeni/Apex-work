'use client';

import Link, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type AnchorHTMLAttributes, type ReactNode } from 'react';

/**
 * Drop-in replacement for next/link that upgrades prefetching.
 *
 * Next 14's `<Link prefetch>` only prefetches when the link enters the
 * viewport, and only fetches the page's RSC payload. For a mobile-first
 * app where users tap after briefly hovering / focusing / touchStart-ing,
 * that's a fraction of a second too late — the page still has to compile
 * data on tap.
 *
 * PrefetchLink triggers `router.prefetch(href)` on the *first* strong
 * intent signal (pointerenter / focus / touchstart), deduped per link
 * instance so we don't hammer the network on multi-touch scrolls.
 *
 * Safe for SSR: router.prefetch is a no-op during hydration.
 */
type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    /** Disable the intent-prefetch entirely (still uses Next's viewport prefetch). */
    intentPrefetch?: boolean;
  };

export function PrefetchLink({
  href,
  children,
  intentPrefetch = true,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...rest
}: Props) {
  const router = useRouter();
  const prefetched = useRef(false);

  const trigger = () => {
    if (prefetched.current || !intentPrefetch) return;
    prefetched.current = true;
    try {
      const target = typeof href === 'string' ? href : href.pathname ?? '';
      if (target) router.prefetch(target);
    } catch {
      // Prefetch failures are always safe to ignore.
    }
  };

  return (
    <Link
      href={href}
      {...rest}
      onPointerEnter={(e) => {
        trigger();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        trigger();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        trigger();
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
