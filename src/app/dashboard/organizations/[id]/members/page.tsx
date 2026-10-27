'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Mail,
  ArrowLeft,
  Trophy,
  Palette,
  History,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import {
  Organization,
  OrganizationRole,
  OrganizationMember,
  OrganizationInvitation,
} from '@/types';

export default function OrganizationMembersPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrganizationRole | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('manager');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Organization info & current role
      const orgRes = await fetch(`/api/organizations/${orgId}`);
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrg(orgData.organization);
        setCurrentUserRole(orgData.role);
      }

      // 2. Members & Invitations
      const memRes = await fetch(`/api/organizations/${orgId}/members`);
      if (memRes.ok) {
        const memData = await memRes.json();
        setMembers(memData.members || []);
        setInvitations(memData.invitations || []);
      }
    } catch (err: unknown) {
      console.error(err);
      showToast('Failed to load member roster', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      showToast(`Invitation sent to ${inviteEmail}`, 'success');
      setShowInviteModal(false);
      setInviteEmail('');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send invitation', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: OrganizationRole) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update member role');

      showToast('Member role updated successfully', 'success');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      showToast(`Removed ${memberName} from organization`, 'success');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/organizations/${orgId}`}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Workspace
          </Link>
          <span className="text-neutral-700">/</span>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h1 className="font-bold text-base tracking-tight text-white">
              {org?.name ? `${org.name} — Members & Permissions` : 'Members & Permissions'}
            </h1>
          </div>
        </div>

        {canManageMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite Member
          </button>
        )}
      </header>

      {/* Workspace Navigation Tabs */}
      <div className="border-b border-white/5 bg-neutral-950/60 sticky top-[57px] z-30 px-6 md:px-12 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
          <Link
            href={`/dashboard/organizations/${orgId}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" /> Competitions
          </Link>
          <Link
            href={`/dashboard/organizations/${orgId}/members`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20"
          >
            <Users className="w-3.5 h-3.5" /> Members & Roles
          </Link>
          <Link
            href={`/dashboard/organizations/${orgId}/branding`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Palette className="w-3.5 h-3.5" /> Branding & Domain
          </Link>
          <Link
            href={`/dashboard/organizations/${orgId}/audit`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Audit Trail
          </Link>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white">Organization Team Members</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Control access to organization competitions, scoring submissions, and branding configuration.
          </p>
        </div>

        {/* Members Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-neutral-900/60 uppercase text-[10px] font-bold text-neutral-400 border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined Date</th>
                  {canManageMembers && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && members.length === 0 ? (
                  <tr>
                    <td colSpan={canManageMembers ? 4 : 3} className="px-4 py-8 text-center text-neutral-500">
                      Loading team members...
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const profile = m.profile || m.user;
                    const name = profile?.full_name || 'Member';
                    const email = profile?.email || 'N/A';
                    return (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <SafeImage
                          src={
                            profile?.avatar_url ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
                              email
                            )}`
                          }
                          alt={name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-lg object-cover border border-white/10"
                        />
                        <div>
                          <span className="font-bold text-white block">{name}</span>
                          <span className="text-[11px] text-neutral-500 block">{email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {canManageMembers && m.role !== 'owner' ? (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              handleRoleChange(m.id, e.target.value as OrganizationRole)
                            }
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-violet-500"
                          >
                            <option value="admin">Administrator</option>
                            <option value="manager">Manager</option>
                            <option value="viewer">Viewer (Read-Only)</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              m.role === 'owner'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : m.role === 'admin'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : m.role === 'manager'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {m.role}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-neutral-400">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>

                      {canManageMembers && (
                        <td className="px-4 py-3.5 text-right">
                          {m.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(m.id, name)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove Member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Invitations Section */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-300">Pending Invitations</h3>
            <div className="glass rounded-2xl border border-white/5 divide-y divide-white/5">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-4 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-neutral-500" />
                    <div>
                      <span className="font-semibold text-white block">{inv.email}</span>
                      <span className="text-[10px] text-neutral-500">
                        Role: {inv.role} • Sent: {new Date(inv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-bold tracking-wider">
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* INVITE MEMBER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-white text-base">Invite Organization Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Colleague Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="coach@myschool.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Assigned Role *</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="admin">Administrator (Manage competitions, branding, members)</option>
                  <option value="manager">Manager (Enter scores, manage rosters, update fixtures)</option>
                  <option value="viewer">Viewer (Read-only access to organization workspaces)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-neutral-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
