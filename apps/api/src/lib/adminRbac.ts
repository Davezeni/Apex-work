/**
 * RBAC — role-based access control for the admin panel.
 *
 * Authorization is capability-based: an admin middleware checks whether the
 * caller's role is in the list for the requested capability. `ADMIN` is the
 * legacy super-admin that may do anything. Roles and capabilities live in
 * `@apex-work/shared` (`ADMIN_ROLES` / `ADMIN_CAPABILITIES`) so the web admin
 * UI can render the same permission model.
 */
import type { AdminCapability, AdminRole } from '@apex-work/shared';
import { ADMIN_CAPABILITIES } from '@apex-work/shared';

/** Does `role` hold `capability`? `ADMIN` always passes. */
export function can(role: AdminRole, capability: AdminCapability): boolean {
  if (role === 'ADMIN') return true;
  return (ADMIN_CAPABILITIES[capability] as readonly string[]).includes(role);
}

/** All capabilities granted to a role. */
export function capabilitiesFor(role: AdminRole): AdminCapability[] {
  if (role === 'ADMIN') return Object.keys(ADMIN_CAPABILITIES) as AdminCapability[];
  return (Object.keys(ADMIN_CAPABILITIES) as AdminCapability[]).filter((cap) =>
    (ADMIN_CAPABILITIES[cap] as readonly string[]).includes(role),
  );
}

/** True if the role is a staff/admin role (has panel access). */
export function isAdminRole(role: string): role is AdminRole {
  return (['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE'] as string[]).includes(role);
}

/** All known capabilities, for listing in the admin UI or a `/me` dump. */
export function allCapabilities(): AdminCapability[] {
  return Object.keys(ADMIN_CAPABILITIES) as AdminCapability[];
}
