'use client';

import { useIsMobile } from '@/hooks/use-media-query';
import { DesktopLanding } from '@/components/landing/desktop-landing';
import { MobileHome } from '@/components/mobile/mobile-home';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  // Subscribe to the token so this re-renders the moment login/refresh lands.
  const accessToken = useAuthStore((s) => s.accessToken);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration flicker: render skeleton until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileShell activeTab="home">
        <MobileHome />
      </MobileShell>
    );
  }

  // Desktop / logged-in users must land INSIDE the app, not on the static
  // marketing landing — otherwise signing in appears to do nothing (they get
  // dumped back on the landing page). Route authenticated desktop users to the
  // marketplace home.
  if (accessToken) {
    router.replace('/browse');
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <DesktopLanding />;
}
