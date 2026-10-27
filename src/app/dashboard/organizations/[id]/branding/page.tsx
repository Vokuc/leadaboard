'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Palette,
  Globe,
  ArrowLeft,
  Trophy,
  Users,
  History,
  RefreshCw,
  Lock,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import Logo from '@/components/Logo';
import { Organization, OrganizationRole } from '@/types';

export default function OrganizationBrandingPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Branding Form State
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [accentColor, setAccentColor] = useState('#10b981');

  // Custom Domain State
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<string>('pending');
  const [dnsInstructions, setDnsInstructions] = useState<{
    cname_target: string;
    txt_record: string;
    txt_value: string;
  } | null>(null);

  // Billing entitlement status
  const [hasBrandingPlan, setHasBrandingPlan] = useState(true);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        const o = data.organization as Organization;
        setOrg(o);
        setRole(data.role);

        setName(o.name || '');
        setLogoUrl(o.logo_url || '');
        setPrimaryColor(o.primary_color || '#8b5cf6');
        setSecondaryColor(o.secondary_color || '#06b6d4');
        setAccentColor(o.accent_color || '#10b981');
        setCustomDomain(o.custom_domain || '');
        setDomainStatus(o.domain_status || 'pending');

        if (o.custom_domain) {
          setDnsInstructions({
            cname_target: 'cname.leaderboardos.com',
            txt_record: `_leaderboardos-challenge.${o.custom_domain}`,
            txt_value: `lb-verify-${o.id.slice(0, 12)}`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load branding data', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          logo_url: logoUrl.trim() || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setHasBrandingPlan(false);
        }
        throw new Error(data.error || 'Failed to update branding');
      }

      showToast('Organization branding updated successfully!', 'success');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save branding', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigureDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomain.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: customDomain.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to configure custom domain');
      }

      setDnsInstructions(data.dns_instructions);
      setDomainStatus(data.status);
      showToast('Custom domain challenge generated. Configure your DNS records below.', 'success');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to configure domain', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/domain/verify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'DNS challenge verification pending');
      }
      setDomainStatus(data.status);
      showToast(data.message || 'Domain verified!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Domain verification error', 'error');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const canEdit = role === 'owner' || role === 'admin';

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
            <Palette className="w-5 h-5 text-violet-400" />
            <h1 className="font-bold text-base tracking-tight text-white">
              {org?.name ? `${org.name} — Branding & White-Label` : 'Branding & White-Label'}
            </h1>
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-500" />}
          </div>
        </div>
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20"
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-10">
        <div>
          <h2 className="text-xl font-bold text-white">White-Label & Organization Identity</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Customize public competition headers, embedded widgets, and domain routing for your organization.
          </p>
        </div>

        {/* Plan Feature Check Alert */}
        {!hasBrandingPlan && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="block font-bold">Pro/Business Feature:</strong>
                <span>
                  Custom branding and white-label capabilities are available on Pro and Business plans.
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors shrink-0"
            >
              Upgrade Plan &rarr;
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Brand Configuration Form */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Palette className="w-4 h-4 text-violet-400" />
              <h3 className="font-bold text-white text-sm">Visual Brand Tokens</h3>
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Organization Display Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Logo Image URL (PNG or SVG)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/org-logo.png"
                  disabled={!canEdit}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] text-white"
                    />
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Branding Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Live Preview Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Live Public Page Preview
              </span>
              <span className="text-[10px] text-neutral-500">
                Retains LeaderboardOS Attribution
              </span>
            </div>

            {/* Mock Co-Branded Competition Header */}
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-neutral-950 p-6 space-y-6 shadow-2xl relative">
              {/* Brand Top Line */}
              <div
                className="h-1 w-full absolute top-0 left-0"
                style={{ backgroundColor: primaryColor }}
              />

              {/* Mock Nav Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Logo className="scale-75 origin-left" />
                  <span className="text-neutral-700">|</span>
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      <SafeImage
                        src={logoUrl}
                        alt="Logo"
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded object-contain shrink-0"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {name ? name.charAt(0).toUpperCase() : 'O'}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-neutral-200">
                      {name || 'Organization Name'}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] text-neutral-500 px-2 py-0.5 rounded bg-white/5">
                  Public View
                </span>
              </div>

              {/* Mock Hero Header */}
              <div className="text-center space-y-2 py-3">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[11px] text-neutral-400">Presented by</span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5"
                    style={{
                      borderColor: `${primaryColor}40`,
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }}
                  >
                    {name || 'Organization'}
                  </span>
                </div>
                <h4 className="text-xl font-extrabold text-white">Autumn Championship 2026</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Official seasonal leaderboard organized under the {name || 'Organization'} workspace.
                </p>
              </div>

              {/* Mock Embed Attribution Footer */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-500">
                <span>{name || 'Organization'} Official Event</span>
                <span className="flex items-center gap-1 text-violet-400 font-semibold">
                  <Trophy className="w-3 h-3" /> Powered by LeaderboardOS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Domain Section (Requirement 8) */}
        <div className="glass rounded-2xl p-6 border border-white/5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Custom Domain Routing</h3>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
            Map a custom subdomain (such as <code>esports.yourdomain.com</code>) to your organization competitions. To prevent security vulnerabilities and misconfiguration, domains remain in <strong>Pending</strong> status until verified through DNS records.
          </p>

          <form onSubmit={handleConfigureDomain} className="space-y-4 max-w-lg text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Custom FQDN (Subdomain)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="leaderboards.mycompany.com"
                  disabled={!canEdit}
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                {canEdit && (
                  <button
                    type="submit"
                    disabled={saving || !customDomain.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Generate Challenge
                  </button>
                )}
              </div>
            </div>
          </form>

          {dnsInstructions && (
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200">Required DNS Records:</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    domainStatus === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  Status: {domainStatus}
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="p-3 bg-black/60 rounded-lg border border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">
                      CNAME Record
                    </span>
                    <span className="text-cyan-300">
                      {customDomain} &rarr; {dnsInstructions.cname_target}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-black/60 rounded-lg border border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">
                      TXT Challenge Record
                    </span>
                    <span className="text-violet-300 block">{dnsInstructions.txt_record}</span>
                    <span className="text-neutral-400 block text-[10px] mt-0.5">
                      Value: {dnsInstructions.txt_value}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <p className="text-[11px] text-neutral-500">
                  Note: DNS propagation and automatic TLS certificate provisioning may take up to 24 hours.
                </p>
                <button
                  onClick={handleVerifyDomain}
                  disabled={verifyingDomain}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${verifyingDomain ? 'animate-spin' : ''}`}
                  />
                  Verify DNS Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
