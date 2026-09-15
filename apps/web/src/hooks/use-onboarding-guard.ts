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
 *
 * Freelancers WITHOUT a phone are exempt: they cannot sell or receive
 * payouts yet, so steering them into freelancer onboarding would dead-end
 * (the onboarding page sends phone-less freelancers back to the client
 * experience). Forcing the redirect would create an infinite / <-> /onboarding
 * loop. They can use the whole app as clients, and start selling once they
 * add + verify a phone (e.g. via Post a Gig -> /settings/phone), at which
 * point this guard resumes normally.
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
    if (!me.phone) return; // phone-less freelancer => client experience, no onboarding loop
    if (EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    router.replace('/onboarding');
  }, [isLoading, isSignedIn, me, pathname, router]);
}
