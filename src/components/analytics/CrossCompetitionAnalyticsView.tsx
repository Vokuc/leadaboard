'use client';

import React, { useEffect, useState } from 'react';
import {
  OrganizerAnalyticsOverview,
  CompetitionType,
} from '@/types';
import { CompetitionGraphService } from '@/lib/analytics/competition-graph';
import {
  Trophy,
  CheckCircle2,
  MapPin,
  Download,
  AlertTriangle,
  Layers,
  Users,
  Activity,
  Filter,
  BarChart3,
} from 'lucide-react';

interface CrossCompetitionAnalyticsViewProps {
  organizationId?: string | null;
  actorUserId?: string | null;
}

export const CrossCompetitionAnalyticsView: React.FC<CrossCompetitionAnalyticsViewProps> = ({
  organizationId,
  actorUserId,
}) => {
  const [analytics, setAnalytics] = useState<OrganizerAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    CompetitionGraphService.getOrganizerAnalytics(
      {
        organizationId: organizationId || undefined,
        competitionType: selectedCategory !== 'all' ? (selectedCategory as CompetitionType) : undefined,
      },
      actorUserId || undefined
    )
      .then((data) => {
        if (isMounted) {
          setAnalytics(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load cross-competition analytics:', err);
          setError('Could not retrieve analytics. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId, actorUserId, selectedCategory]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const csv = await CompetitionGraphService.exportResultsCsv(
        {
          organizationId: organizationId || undefined,
          competitionType: selectedCategory !== 'all' ? (selectedCategory as CompetitionType) : undefined,
        },
        actorUserId || undefined
      );

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cross-competition-analytics-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate CSV export.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Activity className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
        <p className="text-sm font-medium">Computing cross-competition analytics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{error || 'No analytics data available.'}</p>
      </div>
    );
  }

  const { match_verification } = analytics;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Cross-Competition Data Graph & Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Relational intelligence across participants, teams, locations, seasons, and verified results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-8 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="sports">Sports</option>
              <option value="gaming">Gaming / Esports</option>
              <option value="fitness">Fitness</option>
              <option value="workplace">Workplace</option>
              <option value="education">Education</option>
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Competitions */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Competitions</span>
            <span className="p-1 rounded bg-blue-500/10 text-blue-400">
              <Trophy className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.total_competitions}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
            <span className="text-emerald-400">{analytics.active_competitions} active</span>
            <span>•</span>
            <span>{analytics.completed_competitions} completed</span>
          </div>
        </div>

        {/* Verified Results Ratio */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Result Verification</span>
            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {match_verification.verified_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {match_verification.verified} verified of {match_verification.total} total matches
          </div>
        </div>

        {/* Unique Athletes & Participants */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Unique Participants</span>
            <span className="p-1 rounded bg-purple-500/10 text-purple-400">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.total_unique_participants}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {analytics.total_competitions} managed competitions
          </div>
        </div>

        {/* Venues & Locations */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Active Venues</span>
            <span className="p-1 rounded bg-amber-500/10 text-amber-400">
              <MapPin className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.total_venues}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Courts and fields utilized in scheduling
          </div>
        </div>
      </div>

      {/* Verification Breakdown Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Data Provenance & Verification Breakdown
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Audit Guard Active
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {match_verification.disputed > 0 ? (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {match_verification.disputed} disputed results under review
              </span>
            ) : (
              <span className="text-slate-500">No active disputes</span>
            )}
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${(match_verification.verified / Math.max(match_verification.total, 1)) * 100}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Verified: ${match_verification.verified}`}
          />
          <div
            style={{ width: `${(match_verification.unverified / Math.max(match_verification.total, 1)) * 100}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Unverified: ${match_verification.unverified}`}
          />
          <div
            style={{ width: `${(match_verification.disputed / Math.max(match_verification.total, 1)) * 100}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Disputed: ${match_verification.disputed}`}
          />
        </div>

        <div className="flex items-center gap-6 mt-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Verified ({match_verification.verified})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Submitted / In Review ({match_verification.unverified})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Disputed ({match_verification.disputed})</span>
          </div>
        </div>
      </div>

      {/* Competitions Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Competitions in Scope
          </h3>
          <span className="text-xs text-slate-400">{analytics.recent_competitions.length} listed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Competition</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Athletes</th>
                <th className="py-2.5 px-4 text-center">Matches</th>
                <th className="py-2.5 px-4 text-center">Verified</th>
                <th className="py-2.5 px-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analytics.recent_competitions.map((comp) => (
                <tr key={comp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                    {comp.name}
                    {comp.is_verified && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 rounded">
                        Verified
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 capitalize text-slate-400">{comp.competition_type}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        comp.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium">{comp.participants_count}</td>
                  <td className="py-3 px-4 text-center font-medium">{comp.matches_count}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-emerald-400 font-semibold">{comp.verified_matches_count}</span>
                    <span className="text-slate-500"> / {comp.matches_count}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(comp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Venues Utilization Section */}
      {analytics.venues_utilization.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Locations & Venues Utilization
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {analytics.venues_utilization.map((v) => (
              <div
                key={v.venue_id}
                className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg text-xs"
              >
                <div className="font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>{v.venue_name}</span>
                  {v.court_field && (
                    <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 rounded">
                      {v.court_field}
                    </span>
                  )}
                </div>
                <div className="text-slate-400 space-y-0.5 text-[11px]">
                  <div>Shared across: <strong className="text-slate-200">{v.competitions_count}</strong> competitions</div>
                  <div>Scheduled matches: <strong className="text-slate-200">{v.total_matches_scheduled}</strong></div>
                  <div>Completed: <strong className="text-emerald-400">{v.completed_matches}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
