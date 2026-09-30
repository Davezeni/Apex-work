'use client';

import { useEffect } from 'react';
import { initPosthog } from '@/lib/analytics';

/**
 * Mounts PostHog init on the client. Renders nothing; keep it inside the
 * Providers tree so `initPosthog()` runs after hydration on every page.
 */
export function PostHogInit() {
  useEffect(() => {
    // Defer analytics until the page is fully loaded AND the main thread is
    // idle: PostHog's config/surveys requests were competing with hero/LCP
    // bandwidth on slow connections. Timeout bounds how late it can run.
    const start = () => initPosthog();
    let idleId: number | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(start, { timeout: 4000 });
    } else {
      fallback = setTimeout(start, 2500);
    }
    return () => {
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (fallback !== undefined) clearTimeout(fallback);
    };
  }, []);
  return null;
}
