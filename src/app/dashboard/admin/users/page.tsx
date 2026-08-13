'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { ProfileRole } from '@/lib/billing/admin';

type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
  accessSource?: 'profile_role' | 'billing_admin_email' | 'both';
};

type AdminUsersPayload = {
  admins: AdminProfile[];
  requesterRole: ProfileRole;
  requesterProfileExists: boolean;
  requesterEmailIsAllowlisted: boolean;
  canAssignSuperAdmin: boolean;
};

const ROLE_OPTIONS: ProfileRole[] = ['member', 'admin', 'billing_admin', 'super_admin'];

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [requesterRole, setRequesterRole] = useState<ProfileRole>('member');
  const [requesterProfileExists, setRequesterProfileExists] = useState(true);
  const [requesterEmailIsAllowlisted, setRequesterEmailIsAllowlisted] = useState(false);
  const [canAssignSuperAdmin, setCanAssignSuperAdmin] = useState(false);

  const [identifierMode, setIdentifierMode] = useState<'email' | 'userId'>('email');
  const [identifier, setIdentifier] = useState('');
  const [targetRole, setTargetRole] = useState<ProfileRole>('billing_admin');

  const allowedRoleOptions = useMemo(() => {
    return canAssignSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((role) => role !== 'super_admin');
  }, [canAssignSuperAdmin]);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/admin/users', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = (await response.json()) as AdminUsersPayload | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload ? payload.error || 'Failed to load admin users.' : 'Failed to load admin users.');
      }

      const data = payload as AdminUsersPayload;
      setAdmins(data.admins || []);
      setRequesterRole(data.requesterRole || 'member');
      setRequesterProfileExists(Boolean(data.requesterProfileExists));
      setRequesterEmailIsAllowlisted(Boolean(data.requesterEmailIsAllowlisted));
      setCanAssignSuperAdmin(Boolean(data.canAssignSuperAdmin));

      if (!data.canAssignSuperAdmin && targetRole === 'super_admin') {
        setTargetRole('billing_admin');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin users.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [targetRole]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAdmins();
    });
  }, [loadAdmins]);

  async function updateRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!identifier.trim()) {
      setError(identifierMode === 'email' ? 'Enter a target email.' : 'Enter a target user id.');
      return;
    }

    if (!canAssignSuperAdmin && targetRole === 'super_admin') {
      setError('Only super_admin can assign super_admin.');
      return;
    }

    setSaving(true);
    try {
      const body =
        identifierMode === 'email'
          ? { email: identifier.trim(), role: targetRole }
          : { userId: identifier.trim(), role: targetRole };

      const response = await fetch('/api/payments/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { error?: string; profile?: AdminProfile };
      if (!response.ok || !payload.profile) {
        throw new Error(payload.error || 'Failed to update admin role.');
      }

      const targetLabel = payload.profile.email || payload.profile.id;
      setSuccess(`Updated role for ${targetLabel} to ${payload.profile.role}.`);
      setIdentifier('');
      await loadAdmins();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update admin role.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <Link href="/dashboard/admin/billing" className="text-sm text-neutral-400 hover:text-white inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Admin Billing
            </Link>
            <h1 className="text-3xl font-bold mt-2">Admin Users</h1>
            <p className="text-sm text-neutral-400 mt-1">Manage platform admin roles from the dashboard.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadAdmins();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-neutral-950 text-sm hover:bg-neutral-900"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5 mb-6">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Your role: <strong className="text-white">{requesterRole}</strong></span>
            <span className="text-neutral-500">|</span>
            <span>{canAssignSuperAdmin ? 'You can assign super_admin.' : 'You cannot assign super_admin.'}</span>
          </div>

          {!requesterProfileExists && (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Your authenticated Supabase user does not have a matching profiles row yet. The admin roster reads from public.profiles, so create/backfill that row if you want a profile-backed record.
            </div>
          )}

          {requesterEmailIsAllowlisted && requesterRole !== 'super_admin' && (
            <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
              Your admin access is coming from BILLING_ADMIN_EMAILS, not from a profiles role.
            </div>
          )}

          <form onSubmit={updateRole} className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
              <label className="block text-xs text-neutral-400 mb-2">Identifier Type</label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIdentifierMode('email')}
                  className={`px-2.5 py-1.5 rounded-lg border ${identifierMode === 'email' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-neutral-300'}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setIdentifierMode('userId')}
                  className={`px-2.5 py-1.5 rounded-lg border ${identifierMode === 'userId' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-neutral-300'}`}
                >
                  User ID
                </button>
              </div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 p-2">
              <label className="block text-xs text-neutral-400 mb-2">
                {identifierMode === 'email' ? 'Target Email' : 'Target User ID'}
              </label>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={identifierMode === 'email' ? 'name@company.com' : 'UUID'}
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
              <label className="block text-xs text-neutral-400 mb-2">Role</label>
              <select
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value as ProfileRole)}
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {allowedRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Update Role'}
              </button>
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold mb-3 inline-flex items-center gap-2"><Users className="w-4 h-4" /> Current Admin Accounts</h2>
          {loading ? (
            <p className="text-sm text-neutral-400">Loading admin users...</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-neutral-400">No admin users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-white/10">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">{admin.full_name || '-'}</td>
                      <td className="py-2 pr-4">{admin.email}</td>
                      <td className="py-2 pr-4 capitalize">{admin.role.replace('_', ' ')}</td>
                      <td className="py-2 pr-4 capitalize">{admin.accessSource?.replace('_', ' ') || 'profile role'}</td>
                      <td className="py-2 pr-4">{new Date(admin.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
