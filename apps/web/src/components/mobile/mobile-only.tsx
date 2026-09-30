'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';

/**
 * Renders children only on phones, AFTER hydration. SSR output is empty so:
 * - the server-rendered desktop landing stays the sole first-paint content
 *   (its hero is the LCP element and must not compete with a hidden copy
 *   of the mobile feed), and
 * - the mobile feed's data hooks don't fire on desktop visits.
 *
 * Pair with `md:hidden` so the pre-hydration flash shows neither variant.
 */
export function MobileOnly({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isMobile) return null;
  return <>{children}</>;
}
