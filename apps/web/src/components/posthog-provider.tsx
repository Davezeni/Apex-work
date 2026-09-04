'use client';

import { useEffect } from 'react';
import { initPosthog } from '@/lib/analytics';

/**
 * Mounts PostHog init on the client. Renders nothing; keep it inside the
 * Providers tree so `initPosthog()` runs after hydration on every page.
 */
export function PostHogInit() {
  useEffect(() => {
    initPosthog();
  }, []);
  return null;
}
