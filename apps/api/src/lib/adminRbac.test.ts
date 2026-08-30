import { describe, it, expect } from 'vitest';
import { can, capabilitiesFor, isAdminRole, allCapabilities } from './adminRbac.js';

describe('adminRbac', () => {
  it('ADMIN (super-admin) can do everything', () => {
    for (const cap of allCapabilities()) {
      expect(can('ADMIN', cap)).toBe(true);
    }
    expect(capabilitiesFor('ADMIN')).toHaveLength(allCapabilities().length);
  });

  it('MODERATOR handles content but not money/roles', () => {
    expect(can('MODERATOR', 'moderation:content')).toBe(true);
    expect(can('MODERATOR', 'moderation:reports')).toBe(true);
    expect(can('MODERATOR', 'support:tickets')).toBe(true);
    expect(can('MODERATOR', 'money:orders')).toBe(false);
    expect(can('MODERATOR', 'users:manage')).toBe(false);
    expect(can('MODERATOR', 'settings:manage')).toBe(false);
  });

  it('FINANCE handles money but not moderation', () => {
    expect(can('FINANCE', 'money:orders')).toBe(true);
    expect(can('FINANCE', 'money:withdrawals')).toBe(true);
    expect(can('FINANCE', 'subscriptions:manage')).toBe(true);
    expect(can('FINANCE', 'moderation:content')).toBe(false);
    expect(can('FINANCE', 'broadcast:send')).toBe(false);
  });

  it('SUPPORT handles tickets only', () => {
    expect(can('SUPPORT', 'support:tickets')).toBe(true);
    expect(can('SUPPORT', 'dashboard:view')).toBe(true);
    expect(can('SUPPORT', 'money:orders')).toBe(false);
    expect(can('SUPPORT', 'moderation:content')).toBe(false);
  });

  it('scopes are consistent (a grant in ADMIN_CAPABILITIES is always valid)', () => {
    // Every capability must list at least the super-admin.
    for (const cap of allCapabilities()) {
      expect(can('ADMIN', cap)).toBe(true);
    }
  });

  it('isAdminRole distinguishes staff from end-user roles', () => {
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('MODERATOR')).toBe(true);
    expect(isAdminRole('SUPPORT')).toBe(true);
    expect(isAdminRole('FINANCE')).toBe(true);
    expect(isAdminRole('CLIENT')).toBe(false);
    expect(isAdminRole('FREELANCER')).toBe(false);
  });
});
