'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Users,
  Trophy,
  Palette,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  Trash2,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Organization, OrganizationRole } from '@/types';
import { uploadImageAsset, MAX_IMAGE_UPLOAD_SIZE_BYTES } from '@/lib/image-upload';

interface OrgWithMembership extends Organization {
  role?: OrganizationRole;
  member_count?: number;
  competition_count?: number;
}

export default function OrganizationsListPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrgWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, [loadOrganizations]);

  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleLogoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
      setLogoError('Image size exceeds 2 MB. Please choose a smaller file.');
      return;
    }

    setLogoUploading(true);
    setLogoError(null);

    try {
      const uploadedUrl = await uploadImageAsset(file, 'organization-logo');
      setLogoUrl(uploadedUrl);
    } catch (err: unknown) {
      setLogoError(err instanceof Error ? err.message : 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setShowCreateModal(false);
      setName('');
      setSlug('');
      setDescription('');
      setLogoUrl('');
      setLogoError(null);
      loadOrganizations();
      router.push(`/dashboard/organizations/${data.organization.id}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  const getRoleBadge = (role?: OrganizationRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'admin':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'manager':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'viewer':
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
      {/* Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Console
          </Link>
          <span className="text-neutral-700">/</span>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-500" />
            <h1 className="font-bold text-base tracking-tight text-white">Organizations</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/docs/creating-and-managing-organizations"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-violet-300 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Guide
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" /> Create Organization
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Organization Workspaces</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Group your competitions under dedicated school, club, or enterprise organizations with custom branding and role-based permissions.
            </p>
          </div>
          <Link
            href="/docs/creating-and-managing-organizations"
            className="inline-flex sm:hidden items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300"
          >
            <HelpCircle className="w-3.5 h-3.5" /> How organizations work
          </Link>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-500 gap-3">
            <Building2 className="w-8 h-8 text-violet-500 animate-pulse" />
            <p className="text-sm">Loading your workspaces...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center max-w-lg mx-auto border border-white/10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto text-violet-400">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">No organizations found</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Create an organization to invite team members, manage multiple leagues or tournaments collaboratively, and apply white-label branding.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
              >
                <Plus className="w-4 h-4" /> Create Your First Organization
              </button>
              <Link
                href="/docs/creating-and-managing-organizations"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-violet-400" /> Read User Guide
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="glass rounded-2xl p-6 border border-white/5 hover:border-violet-500/30 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      {org.logo_url ? (
                        <SafeImage
                          src={org.logo_url}
                          alt={org.name}
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-xl object-contain border border-white/10 bg-neutral-900/50"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-black text-lg">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-violet-400 transition-colors">
                          {org.name}
                        </h3>
                        <p className="text-[11px] text-neutral-500">/{org.slug}</p>
                      </div>
                    </div>

                    {org.role && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadge(
                          org.role
                        )}`}
                      >
                        {org.role}
                      </span>
                    )}
                  </div>

                  {org.description && (
                    <p className="text-xs text-neutral-400 mb-6 line-clamp-2 leading-relaxed">
                      {org.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-6 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Trophy className="w-3.5 h-3.5 text-violet-400" />
                      <span>{org.competition_count ?? 0} Competitions</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{org.member_count ?? 1} Members</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/organizations/${org.id}/branding`}
                      className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                      title="Custom Branding"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/dashboard/organizations/${org.id}/members`}
                      className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                      title="Team Members"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <Link
                    href={`/dashboard/organizations/${org.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white transition-colors"
                  >
                    Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE ORGANIZATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full max-h-[92vh] overflow-y-auto border border-white/10 shadow-2xl relative space-y-4 custom-scrollbar">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-white text-base">Create Organization</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Esports or St. Jude High School"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Workspace Slug *</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-neutral-950 border border-r-0 border-neutral-800 rounded-l-xl text-neutral-500 text-xs">
                    /org/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="acme-esports"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-r-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of your organization or league community"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              {/* Logo Upload with Device Picker & Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-neutral-300 font-semibold">Organization Logo</label>
                  <span className="text-[10px] text-neutral-500">Optional</span>
                </div>

                {logoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0 flex items-center justify-center">
                      <SafeImage
                        src={logoUrl}
                        alt="Logo preview"
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-neutral-200 truncate">{logoUrl}</p>
                      <p className="text-[10px] text-emerald-400 font-semibold">Logo uploaded</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="cursor-pointer px-2.5 py-1.5 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg transition-colors">
                        Change
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoFileSelected}
                          className="hidden"
                          disabled={logoUploading}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl('');
                          setLogoError(null);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                        title="Remove logo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <label className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-neutral-200 hover:text-white font-semibold cursor-pointer transition-colors text-xs">
                        {logoUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                            <span>Uploading logo...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-violet-400" />
                            <span>Select logo from device</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoFileSelected}
                          className="hidden"
                          disabled={logoUploading}
                        />
                      </label>
                      <span className="text-[11px] text-neutral-500 text-center sm:text-left">or enter image URL below</span>
                    </div>

                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setLogoError(null);
                      }}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 text-xs"
                    />
                    <p className="text-[10px] text-neutral-500">Supported formats: PNG, JPEG, WebP (up to 2 MB).</p>
                  </div>
                )}

                {logoError && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                    {logoError}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
                <Link
                  href="/docs/creating-and-managing-organizations"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-violet-300 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-violet-400" /> Need help? Read Org Guide
                </Link>

                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-neutral-800 hover:bg-neutral-900 text-neutral-300 font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || logoUploading}
                    className="w-full sm:w-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {createLoading ? 'Creating...' : 'Create Workspace'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
