'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from './use-me';

/**
 * Auto-redirects freelancers who haven't completed onboarding to /onboarding.
 *
 * Placed high in the tree (mobile shell / providers) so ANY page that a
 * signed-in un-onboarded freelancer lands on gently steers them through
 * setup. Excludes auth pages and the onboarding flow itself to avoid loops.
 */
const EXEMPT_PATHS = ['/login', '/signup', '/onboarding'];

export function useOnboardingGuard() {
  const { data: me, isLoading, isSignedIn } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isSignedIn || !me) return;
    if (me.role !== 'FREELANCER') return;
    if (me.isOnboarded) return;
    if (EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    router.replace('/onboarding');
  }, [isLoading, isSignedIn, me, pathname, router]);
}
