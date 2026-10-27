'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  History,
  Users,
  Trophy,
  Palette,
  ArrowLeft,
  Shield,
  Activity,
  Layers,
  Globe,
  UserPlus,
  UserMinus,
  RefreshCw,
} from 'lucide-react';
import { Organization, OrganizationRole, OrganizationAuditLog } from '@/types';

export default function OrganizationAuditPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [logs, setLogs] = useState<OrganizationAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const orgRes = await fetch(`/api/organizations/${orgId}`);
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrg(orgData.organization);
        setRole(orgData.role);
      }

      const auditRes = await fetch(`/api/organizations/${orgId}/audit`);
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setLogs(auditData.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'member_invited':
      case 'member_joined':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'role_updated':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'member_removed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'competition_linked':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'competition_unlinked':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'branding_updated':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'domain_configured':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'member_invited':
      case 'member_joined':
        return <UserPlus className="w-3.5 h-3.5" />;
      case 'member_removed':
        return <UserMinus className="w-3.5 h-3.5" />;
      case 'role_updated':
        return <Shield className="w-3.5 h-3.5" />;
      case 'competition_linked':
      case 'competition_unlinked':
        return <Layers className="w-3.5 h-3.5" />;
      case 'branding_updated':
        return <Palette className="w-3.5 h-3.5" />;
      case 'domain_configured':
        return <Globe className="w-3.5 h-3.5" />;
      default:
        return <Activity className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
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
            <History className="w-5 h-5 text-violet-400" />
            <h1 className="font-bold text-base tracking-tight text-white">
              {org?.name ? `${org.name} — Security & Audit History` : 'Security & Audit History'}
            </h1>
            {role && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20">
                {role}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="Refresh Log"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20"
          >
            <History className="w-3.5 h-3.5" /> Audit Trail
          </Link>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white">Workspace Audit Trail</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Immutable log of role changes, member additions, competition links, and branding modifications.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-500 gap-3">
            <History className="w-8 h-8 text-violet-500 animate-pulse" />
            <p className="text-sm">Loading security logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center border border-white/5 space-y-2">
            <History className="w-8 h-8 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No audit events recorded</h3>
            <p className="text-xs text-neutral-500">
              Actions performed in this workspace will automatically be logged here.
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-neutral-900/60 uppercase text-[10px] font-bold text-neutral-400 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor / Target</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {getActionIcon(log.action)}
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-sans">
                        <span className="font-semibold text-white block">
                          {log.actor_profile?.full_name || log.actor?.full_name || 'System / Owner'}
                        </span>
                        <span className="text-[10px] text-neutral-500 block">
                          {log.actor_profile?.email || log.actor?.email || (log.actor_id ? `ID: ${log.actor_id.slice(0, 10)}...` : 'System')}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-sans text-neutral-300">
                        {log.details ? (
                          typeof log.details === 'object' ? (
                            <span>
                              {Object.entries(log.details)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' • ')}
                            </span>
                          ) : (
                            String(log.details)
                          )
                        ) : (
                          <span className="text-neutral-600">No additional details</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-400 font-sans text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
