'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CompetitionSponsor,
  Leaderboard,
  SponsorshipTier,
} from '@/types';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  MousePointerClick,
  Eye,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  Edit2,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';

interface SponsorshipManagementPanelProps {
  leaderboard: Leaderboard;
}

const TIER_OPTIONS: Array<{ value: SponsorshipTier; label: string; desc: string }> = [
  { value: 'headline', label: 'Headline Partner', desc: 'Prominent top placement on public pages and social cards' },
  { value: 'gold', label: 'Gold Sponsor', desc: 'Featured badge with high tier priority' },
  { value: 'silver', label: 'Silver Sponsor', desc: 'Standard featured sponsor card' },
  { value: 'bronze', label: 'Bronze Sponsor', desc: 'Supporting sponsor tier' },
  { value: 'partner', label: 'Official Partner', desc: 'Official collaborator badge' },
  { value: 'community', label: 'Community Sponsor', desc: 'Grassroots & community tier' },
];

export function SponsorshipManagementPanel({ leaderboard }: SponsorshipManagementPanelProps) {
  const [sponsors, setSponsors] = useState<CompetitionSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState<number>(0);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<CompetitionSponsor | null>(null);
  const [formName, setFormName] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formTier, setFormTier] = useState<SponsorshipTier>('community');
  const [formTagline, setFormTagline] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formOrder, setFormOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadSponsors = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/competitions/${leaderboard.id}/sponsors?all=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sponsors');
      setSponsors(data.sponsors || []);
      setNowTimestamp(Date.now());
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Failed to load sponsors.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leaderboard.id]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch(`/api/competitions/${leaderboard.id}/sponsors?all=true`);
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.sponsors)) {
          setSponsors(data.sponsors);
          setNowTimestamp(Date.now());
        }
      } catch (err: unknown) {
        if (!ignore) console.error(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, [leaderboard.id]);

  const openCreateModal = () => {
    setEditingSponsor(null);
    setFormName('');
    setFormWebsite('');
    setFormLogo('');
    setFormTier('community');
    setFormTagline('');
    setFormStart('');
    setFormEnd('');
    setFormOrder('0');
    setFormActive(true);
    setShowModal(true);
  };

  const openEditModal = (sponsor: CompetitionSponsor) => {
    setEditingSponsor(sponsor);
    setFormName(sponsor.name);
    setFormWebsite(sponsor.website_url);
    setFormLogo(sponsor.logo_url || '');
    setFormTier(sponsor.tier);
    setFormTagline(sponsor.tagline || '');
    setFormStart(sponsor.campaign_start ? sponsor.campaign_start.slice(0, 16) : '');
    setFormEnd(sponsor.campaign_end ? sponsor.campaign_end.slice(0, 16) : '');
    setFormOrder(String(sponsor.display_order || 0));
    setFormActive(sponsor.is_active);
    setShowModal(true);
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formName.trim(),
        website_url: formWebsite.trim(),
        logo_url: formLogo.trim() || null,
        tier: formTier,
        tagline: formTagline.trim() || null,
        campaign_start: formStart ? new Date(formStart).toISOString() : null,
        campaign_end: formEnd ? new Date(formEnd).toISOString() : null,
        display_order: parseInt(formOrder, 10) || 0,
        is_active: formActive,
      };

      const url = editingSponsor
        ? `/api/competitions/${leaderboard.id}/sponsors/${editingSponsor.id}`
        : `/api/competitions/${leaderboard.id}/sponsors`;
      const method = editingSponsor ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save sponsor.');

      showToast(editingSponsor ? 'Sponsor updated successfully.' : 'Sponsor added successfully.');
      setShowModal(false);
      void loadSponsors(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: string) => {
    if (!window.confirm('Are you sure you want to remove this sponsor?')) return;
    setDeletingId(sponsorId);

    try {
      const res = await fetch(`/api/competitions/${leaderboard.id}/sponsors/${sponsorId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete sponsor.');

      showToast('Sponsor removed successfully.');
      void loadSponsors(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate totals
  const totalImpressions = sponsors.reduce((acc, s) => acc + (s.impressions_count || 0), 0);
  const totalClicks = sponsors.reduce((acc, s) => acc + (s.clicks_count || 0), 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border border-emerald-800'
              : 'bg-rose-950 text-rose-200 border border-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Competition Sponsorships & Partners
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Display official event sponsors, represent sponsor benefits, and monitor real click and impression performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadSponsors(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-850 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Sponsor Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Sponsor
          </button>
        </div>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Verified Impressions</span>
            <Eye className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {totalImpressions.toLocaleString()}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Deduplicated per visitor / 1-hour window
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Sponsor Link Clicks</span>
            <MousePointerClick className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {totalClicks.toLocaleString()}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Deduplicated per visitor / 5-minute window
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Click-Through Rate (CTR)</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {overallCtr}%
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Ratio of verified clicks to impressions
          </p>
        </div>
      </div>

      {/* Sponsors Table / List */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 overflow-hidden backdrop-blur-md">
        <div className="px-6 py-4 border-b border-neutral-850 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Configured Sponsors ({sponsors.length})</h3>
          <span className="text-xs text-neutral-400">
            {sponsors.filter((s) => s.is_active).length} Active
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-neutral-400">Loading sponsorships...</div>
        ) : sponsors.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-neutral-600 mx-auto" />
            <h4 className="text-base font-semibold text-neutral-300">No Sponsors Configured</h4>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Feature sponsors on this competition to represent event brand partners, showcase headline sponsors, and track real engagement.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-850 hover:bg-neutral-800 text-xs font-medium text-white rounded-lg border border-neutral-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Sponsor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/60 text-neutral-400 border-b border-neutral-850 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3">Sponsor</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Campaign Dates</th>
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850/60">
                {sponsors.map((s) => {
                  const ctr =
                    s.impressions_count > 0
                      ? ((s.clicks_count / s.impressions_count) * 100).toFixed(1)
                      : '0.0';

                  const isExpired = s.campaign_end && nowTimestamp > 0 && new Date(s.campaign_end).getTime() < nowTimestamp;
                  const isFuture = s.campaign_start && nowTimestamp > 0 && new Date(s.campaign_start).getTime() > nowTimestamp;

                  return (
                    <tr key={s.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {s.logo_url ? (
                            <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                              <SafeImage
                                src={s.logo_url}
                                alt={s.name}
                                width={32}
                                height={32}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 shrink-0 flex items-center justify-center font-bold text-neutral-300">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">{s.name}</div>
                            <a
                              href={s.website_url}
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 truncate"
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate">{s.website_url.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-300">
                          {s.tier}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-neutral-400">
                        {s.campaign_start || s.campaign_end ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 text-neutral-500" />
                              <span>{s.campaign_start ? new Date(s.campaign_start).toLocaleDateString() : 'Immediate'}</span>
                              <span>&rarr;</span>
                              <span>{s.campaign_end ? new Date(s.campaign_end).toLocaleDateString() : 'Ongoing'}</span>
                            </div>
                            {isExpired && <span className="text-[10px] text-rose-400 font-medium">Campaign ended</span>}
                            {isFuture && <span className="text-[10px] text-amber-400 font-medium">Scheduled</span>}
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">Continuous</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right font-medium text-white">
                        {s.impressions_count.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right font-medium text-white">
                        {s.clicks_count.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right font-medium text-emerald-400">
                        {ctr}%
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            s.is_active && !isExpired
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                              : 'bg-neutral-600'
                          }`}
                          title={s.is_active ? 'Active' : 'Disabled'}
                        />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            title="Edit Sponsor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void handleDeleteSponsor(s.id)}
                            disabled={deletingId === s.id}
                            className="p-1.5 rounded-lg border border-neutral-800 hover:border-rose-900/50 bg-neutral-900/60 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Delete Sponsor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden text-white">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {editingSponsor ? 'Edit Sponsor' : 'Add New Sponsor'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSponsor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Sponsor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Website URL (Safe external link) *
                </label>
                <input
                  type="url"
                  required
                  value={formWebsite}
                  onChange={(e) => setFormWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[11px] text-neutral-500 mt-0.5 block">
                  Must begin with https:// or http://. Will be opened with rel=&quot;sponsored&quot;.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Logo Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formLogo}
                  onChange={(e) => setFormLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Sponsorship Tier *
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as SponsorshipTier)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                  >
                    {TIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Display Priority Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Tagline / Campaign Message (Optional)
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="e.g. Official Cloud Partner of the Summer Cup"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Campaign Start (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Campaign End (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-neutral-800 text-amber-500 focus:ring-amber-500 bg-neutral-950"
                />
                <label htmlFor="formActive" className="text-xs text-neutral-300 cursor-pointer">
                  Sponsor is active and eligible for public display
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingSponsor ? 'Update Sponsor' : 'Add Sponsor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
