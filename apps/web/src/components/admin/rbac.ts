/**
 * Client-side RBAC mirror. Kept in sync with `@apex-work/shared`
 * (ADMIN_CAPABILITIES) so the Admin panel can render each staff role's
 * permissions. The server is authoritative; this is display-only.
 */
import { ADMIN_CAPABILITIES } from '@apex-work/shared';

export type SharedAdminRole = 'ADMIN' | 'MODERATOR' | 'SUPPORT' | 'FINANCE';

export function allCapabilitiesForRole(role: string): string[] {
  const caps = Object.keys(ADMIN_CAPABILITIES) as string[];
  if (role === 'ADMIN') return caps;
  return caps.filter((cap) =>
    (ADMIN_CAPABILITIES as Record<string, readonly string[]>)[cap]?.includes(role),
  );
}

export function canRole(role: string, capability: string): boolean {
  if (role === 'ADMIN') return true;
  return (ADMIN_CAPABILITIES as Record<string, readonly string[]>)[capability]?.includes(role) ?? false;
}
