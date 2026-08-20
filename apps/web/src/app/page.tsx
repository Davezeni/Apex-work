'use client';

import { useIsMobile } from '@/hooks/use-media-query';
import { DesktopLanding } from '@/components/landing/desktop-landing';
import { MobileHome } from '@/components/mobile/mobile-home';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const isMobile = useIsMobile();
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

  return <DesktopLanding />;
}
