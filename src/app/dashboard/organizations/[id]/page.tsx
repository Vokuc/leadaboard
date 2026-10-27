'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Building2,
  Trophy,
  Users,
  Palette,
  History,
  Plus,
  ArrowLeft,
  ExternalLink,
  Unlink,
  AlertCircle,
  X,
  Layers,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Organization, OrganizationRole, Leaderboard } from '@/types';

export default function OrganizationWorkspacePage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [competitions, setCompetitions] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedLbId, setSelectedLbId] = useState<string>('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Load organization details
      const orgRes = await fetch(`/api/organizations/${orgId}`);
      if (!orgRes.ok) {
        throw new Error('Organization not found');
      }
      const orgData = await orgRes.json();
      setOrg(orgData.organization);
      setRole(orgData.role);

      // 2. Load linked competitions
      const compRes = await fetch(`/api/organizations/${orgId}/competitions`);
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompetitions(compData.competitions || []);
      }
    } catch (err: unknown) {
      console.error(err);
      showToast((err as Error).message || 'Failed to load workspace data', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const handleLinkCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLbId) return;
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboard_id: selectedLbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link competition');

      showToast('Competition linked to organization workspace successfully!', 'success');
      setShowLinkModal(false);
      setSelectedLbId('');
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlink = async (lbId: string, lbName: string) => {
    if (
      !confirm(
        `Are you sure you want to unlink "${lbName}" from this organization? It will return to the owner's personal workspace.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/organizations/${orgId}/competitions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboard_id: lbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink competition');

      showToast(`Unlinked "${lbName}" from organization.`, 'success');
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const canManage = role === 'owner' || role === 'admin' || role === 'manager';

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <Building2 className="w-8 h-8 text-violet-500 animate-pulse" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-neutral-400 p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-bold text-white">Organization Not Found</h2>
        <Link href="/dashboard/organizations" className="mt-4 text-xs text-violet-400 underline">
          Return to Organizations
        </Link>
      </div>
    );
  }

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
            href="/dashboard/organizations"
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Workspaces
          </Link>
          <span className="text-neutral-700">/</span>
          <div className="flex items-center gap-2">
            {org.logo_url ? (
              <SafeImage
                src={org.logo_url}
                alt={org.name}
                width={24}
                height={24}
                className="w-6 h-6 rounded-md object-contain border border-white/10"
              />
            ) : (
              <Building2 className="w-5 h-5 text-violet-400" />
            )}
            <h1 className="font-bold text-base tracking-tight text-white">{org.name}</h1>
          </div>
          {role && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                role === 'owner'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : role === 'admin'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  : role === 'manager'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {role}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/create`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> New Competition
          </Link>
        </div>
      </header>

      {/* Workspace Navigation Tabs */}
      <div className="border-b border-white/5 bg-neutral-950/60 sticky top-[57px] z-30 px-6 md:px-12 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
          <Link
            href={`/dashboard/organizations/${org.id}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20"
          >
            <Trophy className="w-3.5 h-3.5" /> Competitions
          </Link>
          <Link
            href={`/dashboard/organizations/${org.id}/members`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Members & Roles
          </Link>
          <Link
            href={`/dashboard/organizations/${org.id}/branding`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Palette className="w-3.5 h-3.5" /> Branding & Domain
          </Link>
          <Link
            href={`/dashboard/organizations/${org.id}/audit`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Audit Trail
          </Link>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
        {/* Workspace Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-4 rounded-2xl border border-white/5">
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
              Competitions
            </span>
            <h3 className="text-2xl font-bold mt-1 text-white">{competitions.length}</h3>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
              Branding
            </span>
            <h3 className="text-2xl font-bold mt-1 text-violet-400">
              {org.primary_color || org.logo_url ? 'Configured' : 'Default'}
            </h3>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
              Custom Domain
            </span>
            <h3 className="text-2xl font-bold mt-1 text-cyan-400">
              {org.custom_domain ? org.custom_domain_status || 'Pending' : 'Not Set'}
            </h3>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
              Your Permission
            </span>
            <h3 className="text-2xl font-bold mt-1 text-emerald-400 capitalize">
              {role || 'Viewer'}
            </h3>
          </div>
        </div>

        {/* Competitions Management Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Managed Competitions</h2>
              <p className="text-xs text-neutral-400">
                All competitions active within the {org.name} organization workspace.
              </p>
            </div>

            {canManage && (
              <button
                onClick={() => setShowLinkModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" /> Associate Competition
              </button>
            )}
          </div>

          {competitions.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center border border-white/5 space-y-3">
              <Trophy className="w-8 h-8 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No competitions linked yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Associate existing competitions to manage them with your organization team, or create a new competition under this organization.
              </p>
              {canManage && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Associate Existing Competition
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitions.map((comp) => (
                <div
                  key={comp.id}
                  className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                          {comp.competition_type}
                        </span>
                        <span className="text-[10px] font-medium text-neutral-500">
                          {comp.visibility}
                        </span>
                      </div>

                      {canManage && (
                        <button
                          onClick={() => handleUnlink(comp.id, comp.name)}
                          className="text-neutral-500 hover:text-rose-400 text-xs p-1 transition-colors"
                          title="Unlink from Organization"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-white">{comp.name}</h3>
                    {comp.description && (
                      <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                        {comp.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">/{comp.slug}</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leaderboards/${comp.slug}`}
                        target="_blank"
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800"
                      >
                        Public <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/dashboard/leaderboards/${comp.id}`}
                        className="flex items-center gap-1 text-xs text-white bg-violet-600 hover:bg-violet-500 px-3 py-1 rounded-lg font-semibold"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* LINK COMPETITION MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-white text-base">Associate Competition</h3>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300 leading-relaxed">
              <strong>Ownership Protection:</strong> Associating a competition with an organization allows team members (Admins and Managers) to administer fixtures and scores, while preserving your underlying competition ownership.
            </div>

            <form onSubmit={handleLinkCompetition} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Select Competition to Link *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Leaderboard ID (e.g. lb-workplace-1)"
                  value={selectedLbId}
                  onChange={(e) => setSelectedLbId(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-neutral-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading || !selectedLbId.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {linkLoading ? 'Associating...' : 'Link to Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
