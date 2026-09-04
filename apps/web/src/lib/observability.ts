'use client';

import { identify, track } from './analytics';

/**
 * Identify the signed-in user to Sentry + PostHog (no-op when unconfigured).
 * Call once when the user session is known.
 */
export function identifyUser(user: { id?: string; username?: string; fullName?: string; role?: string } | null): void {
  if (!user?.id) return;
  identify(user.id);
  track('identify_user', { username: user.username, role: user.role });
}
