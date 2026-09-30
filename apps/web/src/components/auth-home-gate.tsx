'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client gate for `/`: signed-in DESKTOP visitors belong inside the app, so
 * they are redirected to /browse (overlaid with a spinner while it lands).
 *
 * Lives as a tiny client island so the page itself can stay a server
 * component — the marketing landing (and its hero, the LCP element) renders
 * in the server HTML instead of waiting for hydration. Mobile signed-in
 * visitors intentionally stay on `/` (the mobile feed IS their home).
 */
export function AuthHomeGate() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    if (desktop && accessToken) {
      setActive(true);
      router.replace('/browse');
    }
  }, [accessToken, router]);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
