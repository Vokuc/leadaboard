import type { User } from '@supabase/supabase-js';

const ADMIN_ROLE_CANDIDATES = new Set(['admin', 'billing_admin', 'super_admin', 'superadmin']);
const PROFILE_ADMIN_ROLE_CANDIDATES = new Set(['admin', 'billing_admin', 'super_admin']);

function normalizeRole(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim().toLowerCase()];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().toLowerCase());
  }

  return [];
}

export function getBillingAdminEmailsFromEnv(): Set<string> {
  const raw = process.env.BILLING_ADMIN_EMAILS || '';
  const emails = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  return new Set(emails);
}

export function isUserBillingAdmin(user: User, adminEmails = getBillingAdminEmailsFromEnv()): boolean {
  const appMetadata = user.app_metadata || {};
  const userMetadata = user.user_metadata || {};

  const roles = [
    ...normalizeRole((appMetadata as Record<string, unknown>).role),
    ...normalizeRole((appMetadata as Record<string, unknown>).roles),
    ...normalizeRole((userMetadata as Record<string, unknown>).role),
    ...normalizeRole((userMetadata as Record<string, unknown>).roles),
  ];

  if (roles.some((role) => ADMIN_ROLE_CANDIDATES.has(role))) {
    return true;
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    return false;
  }

  return adminEmails.has(email);
}

export type ProfileRole = 'member' | 'admin' | 'billing_admin' | 'super_admin';

export function normalizeProfileRole(value: unknown): ProfileRole {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'admin' || raw === 'billing_admin' || raw === 'super_admin') {
    return raw;
  }
  return 'member';
}

export function isProfileRoleBillingAdmin(value: unknown): boolean {
  const normalized = normalizeProfileRole(value);
  return PROFILE_ADMIN_ROLE_CANDIDATES.has(normalized);
}
