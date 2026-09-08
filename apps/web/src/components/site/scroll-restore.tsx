'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Cross-browser scroll restoration for the App Router.
 *
 * Next's built-in restoration is flaky when page height changes between the
 * moment you leave and the moment you come back (infinite feeds, deferred
 * layouts), and it can be defeated by `scroll-behavior: smooth`. This stores
 * the window scroll position per route in sessionStorage and restores it when
 * the user navigates back/forward (popstate), so the Browse/Gigs list never
 * jumps back to the top.
 *
 * SSR-safe: no writes until mounted.
 */
export function ScrollRestore() {
  const path = usePathname();

  useEffect(() => {
    const key = `scroll:${path}`;

    const save = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };

    const restore = () => {
      try {
        const saved = sessionStorage.getItem(key);
        if (saved == null) return;
        const top = Math.max(0, parseInt(saved, 10) || 0);
        // Ignore tiny values so a back-nav onto a fresh page isn't yanked.
        if (window.scrollY === top) return;
        // `auto` bypasses the global smooth scroll so restore is instantaneous.
        window.scrollTo({ top, behavior: 'auto' });
      } catch {
        /* ignore */
      }
    };

    // Save continuously (throttled to rAF) so the latest position is captured.
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        save();
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', restore);
    // Also restore on the initial mount (covers a reload landing mid-flow).
    restore();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('popstate', restore);
    };
  }, [path]);

  return null;
}
