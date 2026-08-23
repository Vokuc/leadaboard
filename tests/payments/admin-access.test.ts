import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isProfileRoleBillingAdmin, isUserBillingAdmin, normalizeProfileRole } from '@/lib/billing/admin';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'member@example.com',
    role: 'authenticated',
    ...overrides,
  } as User;
}

describe('billing admin access resolver', () => {
  it('treats app_metadata.role=admin as billing admin', () => {
    const user = makeUser({ app_metadata: { role: 'admin' } });
    expect(isUserBillingAdmin(user, new Set())).toBe(true);
  });

  it('treats app_metadata.roles containing billing_admin as billing admin', () => {
    const user = makeUser({ app_metadata: { roles: ['member', 'billing_admin'] } });
    expect(isUserBillingAdmin(user, new Set())).toBe(true);
  });

  it('supports admin email allowlist from environment-derived set', () => {
    const user = makeUser({ email: 'ops@example.com' });
    expect(isUserBillingAdmin(user, new Set(['ops@example.com']))).toBe(true);
  });

  it('denies users without admin role or allowlisted email', () => {
    const user = makeUser({ app_metadata: { role: 'member' }, email: 'member@example.com' });
    expect(isUserBillingAdmin(user, new Set(['ops@example.com']))).toBe(false);
  });

  it('normalizes profile roles safely', () => {
    expect(normalizeProfileRole('admin')).toBe('admin');
    expect(normalizeProfileRole('billing_admin')).toBe('billing_admin');
    expect(normalizeProfileRole('super_admin')).toBe('super_admin');
    expect(normalizeProfileRole('unknown')).toBe('member');
    expect(normalizeProfileRole(undefined)).toBe('member');
  });

  it('recognizes billing admins from profile role', () => {
    expect(isProfileRoleBillingAdmin('admin')).toBe(true);
    expect(isProfileRoleBillingAdmin('billing_admin')).toBe(true);
    expect(isProfileRoleBillingAdmin('super_admin')).toBe(true);
    expect(isProfileRoleBillingAdmin('member')).toBe(false);
  });
});
