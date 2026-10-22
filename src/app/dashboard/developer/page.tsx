'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Key,
  Webhook,
  BookOpen,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Send,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Code,
  Terminal,
} from 'lucide-react';
import { ApiKeyScope, WebhookDelivery, WebhookEventType } from '@/types';

interface SafeApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookSubView {
  id: string;
  url: string;
  events: WebhookEventType[];
  description: string | null;
  status: 'active' | 'disabled';
  secret_preview: string;
  created_at: string;
}

const AVAILABLE_SCOPES: Array<{ id: ApiKeyScope; label: string; description: string }> = [
  { id: 'competitions:read', label: 'competitions:read', description: 'Read public and owned private competitions, standings, and results' },
  { id: 'competitions:write', label: 'competitions:write', description: 'Modify owned competition settings, rosters, and registration' },
  { id: 'scores:submit', label: 'scores:submit', description: 'Submit match results, fixture scores, and score events' },
  { id: 'participants:write', label: 'participants:write', description: 'Register competitors and update participant metadata' },
  { id: 'webhooks:manage', label: 'webhooks:manage', description: 'Create, test, and delete webhook subscriptions' },
  { id: 'admin', label: 'admin', description: 'Full administrative access across all competition resources' },
];

const AVAILABLE_WEBHOOK_EVENTS: Array<{ id: WebhookEventType; label: string; description: string }> = [
  { id: 'competition.updated', label: 'competition.updated', description: 'Triggered when standings, metadata, or stages update' },
  { id: 'result.submitted', label: 'result.submitted', description: 'Triggered when a new score or match result is submitted' },
  { id: 'result.approved', label: 'result.approved', description: 'Triggered when a pending score receives administrative approval' },
  { id: 'competition.completed', label: 'competition.completed', description: 'Triggered when a champion is crowned or tournament concludes' },
  { id: 'participant.registered', label: 'participant.registered', description: 'Triggered when a new participant registers' },
  { id: 'ping', label: 'ping', description: 'System health check and test delivery event' },
];

export default function DeveloperDashboardPage() {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<SafeApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubView[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  // Create Key Modal State
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['competitions:read', 'scores:submit']);
  const [rateLimit, setRateLimit] = useState(60);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Rotate Key Modal State
  const [rotatedSecret, setRotatedSecret] = useState<{ keyId: string; secret: string } | null>(null);

  // Register Webhook Modal State
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['competition.updated', 'result.submitted']);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  // Test Ping State
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, whRes, delRes] = await Promise.all([
        fetch('/api/developer/keys').then((r) => (r.ok ? r.json() : { keys: [] })).catch(() => ({ keys: [] })),
        fetch('/api/v1/webhooks', {
          headers: { 'Authorization': 'Bearer local_dev_bypass' },
        })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .catch(() => ({ data: [] })),
        fetch('/api/developer/webhooks/deliveries')
          .then((r) => (r.ok ? r.json() : { deliveries: [] }))
          .catch(() => ({ deliveries: [] })),
      ]);

      if (keysRes && keysRes.keys) setKeys(keysRes.keys);
      if (whRes && whRes.data) setWebhooks(whRes.data);
      if (delRes && delRes.deliveries) setDeliveries(delRes.deliveries);
    } catch (err) {
      console.error('Failed loading developer data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  // Create Key Handler
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: selectedScopes,
          rate_limit_per_minute: rateLimit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');

      setCreatedSecret(data.plaintextSecret);
      setNewKeyName('');
      setShowCreateKeyModal(false);
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error creating key', 'error');
    }
  };

  // Revoke Key Handler
  const handleRevokeKey = async (keyId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/developer/keys/${keyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      showToast(`API Key "${name}" revoked.`, 'success');
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error revoking key', 'error');
    }
  };

  // Rotate Secret Handler
  const handleRotateSecret = async (keyId: string, name: string) => {
    if (!confirm(`Rotate secret for "${name}"? The previous secret will immediately stop working.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/developer/keys/${keyId}/rotate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rotate secret');

      setRotatedSecret({ keyId, secret: data.newPlaintextSecret });
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error rotating secret', 'error');
    }
  };

  // Register Webhook Handler
  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer local_dev_bypass',
        },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          description: webhookDesc.trim() || undefined,
          events: selectedEvents,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to register webhook');

      setCreatedWebhookSecret(data.data.subscription.secret);
      setWebhookUrl('');
      setWebhookDesc('');
      setShowAddWebhookModal(false);
      showToast('Webhook registered successfully!', 'success');
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error registering webhook', 'error');
    }
  };

  // Delete Webhook Handler
  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook subscription?')) return;
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer local_dev_bypass' },
      });
      if (!res.ok) throw new Error('Failed to delete webhook');
      showToast('Webhook deleted.', 'success');
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting webhook', 'error');
    }
  };

  // Test Ping Handler
  const handleTestPing = async (id: string) => {
    setTestingWebhookId(id);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer local_dev_bypass' },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Test ping delivered successfully (HTTP 200)!', 'success');
      } else {
        showToast(`Delivery status: ${data.data?.delivery?.status || 'failed'} (${data.data?.delivery?.error_message || 'HTTP error'})`, 'error');
      }
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send ping', 'error');
    } finally {
      setTestingWebhookId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid text-white flex flex-col">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold backdrop-blur-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/90 border-red-500/30 text-red-300'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </Link>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <h1 className="font-extrabold text-sm tracking-tight text-white">Developer Platform & Secure API</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              v1.0
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'keys'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> API Keys
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'webhooks'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" /> Webhooks
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> API Reference
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
        {/* ========================================================================= */}
        {/* TAB 1: API KEYS */}
        {/* ========================================================================= */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" /> Scoped API Credentials
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                  API keys allow automated tools, Discord bots, tournament orchestrators, and game servers to securely
                  read standings and post verified results.
                </p>
              </div>
              <button
                onClick={() => setShowCreateKeyModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Generate New API Key
              </button>
            </div>

            {/* Created Secret Warning Banner */}
            {createdSecret && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Important: Copy your API Secret Key now</span>
                </div>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  For your security, we only store a salted SHA-256 hash of this key. It will never be shown to you
                  again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2.5 rounded-xl bg-black/80 border border-amber-500/40 text-xs font-mono text-amber-100 select-all overflow-x-auto">
                    {createdSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdSecret, 'Secret Key')}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                  >
                    {copiedText === 'Secret Key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'Secret Key' ? 'Copied' : 'Copy Key'}</span>
                  </button>
                  <button
                    onClick={() => setCreatedSecret(null)}
                    className="px-3 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Rotated Secret Banner */}
            {rotatedSecret && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Secret Rotated Successfully</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2.5 rounded-xl bg-black/80 border border-emerald-500/40 text-xs font-mono text-emerald-100 select-all overflow-x-auto">
                    {rotatedSecret.secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(rotatedSecret.secret, 'Rotated Key')}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                  >
                    {copiedText === 'Rotated Key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'Rotated Key' ? 'Copied' : 'Copy Key'}</span>
                  </button>
                  <button
                    onClick={() => setRotatedSecret(null)}
                    className="px-3 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Keys Table */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/5 text-[10px] uppercase font-bold text-neutral-400">
                    <tr>
                      <th className="px-5 py-3.5">Name</th>
                      <th className="px-5 py-3.5">Key Prefix</th>
                      <th className="px-5 py-3.5">Scopes</th>
                      <th className="px-5 py-3.5">Rate Limit</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Created</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-neutral-500">
                          Loading API keys...
                        </td>
                      </tr>
                    ) : keys.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                          No API keys generated yet. Click &quot;Generate New API Key&quot; to create your first key.
                        </td>
                      </tr>
                    ) : (
                      keys.map((k) => (
                        <tr key={k.id} className="hover:bg-white/[0.02] transition">
                          <td className="px-5 py-4 font-bold text-white">{k.name}</td>
                          <td className="px-5 py-4">
                            <code className="text-cyan-300 font-mono text-[11px] bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/30">
                              {k.key_prefix}...
                            </code>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {k.scopes.map((s) => (
                                <span
                                  key={s}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-neutral-300">{k.rate_limit_per_minute} req/min</td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                k.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : k.status === 'revoked'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                              }`}
                            >
                              {k.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-neutral-400 text-[11px]">
                            {new Date(k.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {k.status === 'active' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleRotateSecret(k.id, k.name)}
                                  className="p-1.5 text-neutral-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition cursor-pointer"
                                  title="Rotate Secret"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRevokeKey(k.id, k.name)}
                                  className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition cursor-pointer"
                                  title="Revoke Key"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-600 italic">Revoked</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WEBHOOKS */}
        {/* ========================================================================= */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-cyan-400" /> Event Webhooks
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                  Receive cryptographically signed HMAC SHA-256 HTTP notifications whenever standings update, matches
                  conclude, or competitors register.
                </p>
              </div>
              <button
                onClick={() => setShowAddWebhookModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Register Webhook
              </button>
            </div>

            {/* Created Webhook Secret */}
            {createdWebhookSecret && (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Webhook Signing Secret</span>
                </div>
                <p className="text-xs text-cyan-300/80 leading-relaxed">
                  Use this secret to verify the HMAC signature header (<code className="text-white">X-LeaderboardOS-Signature</code>) on incoming webhook requests.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2.5 rounded-xl bg-black/80 border border-cyan-500/40 text-xs font-mono text-cyan-100 select-all overflow-x-auto">
                    {createdWebhookSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdWebhookSecret, 'Webhook Secret')}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                  >
                    {copiedText === 'Webhook Secret' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'Webhook Secret' ? 'Copied' : 'Copy Secret'}</span>
                  </button>
                  <button
                    onClick={() => setCreatedWebhookSecret(null)}
                    className="px-3 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Subscriptions List */}
            <div className="space-y-3">
              {loading ? (
                <div className="glass p-8 rounded-2xl text-center text-xs text-neutral-500">Loading webhooks...</div>
              ) : webhooks.length === 0 ? (
                <div className="glass p-8 rounded-2xl text-center text-xs text-neutral-500">
                  No webhook endpoints configured. Click &quot;Register Webhook&quot; to configure your receiving URL.
                </div>
              ) : (
                webhooks.map((sub) => (
                  <div key={sub.id} className="glass p-5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-cyan-300">{sub.url}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {sub.status}
                          </span>
                        </div>
                        {sub.description && <p className="text-xs text-neutral-400 mt-1">{sub.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestPing(sub.id)}
                          disabled={testingWebhookId === sub.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          <span>{testingWebhookId === sub.id ? 'Sending...' : 'Test Ping'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(sub.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition cursor-pointer"
                          title="Delete Webhook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold mr-1">Events:</span>
                      {sub.events.map((e) => (
                        <span
                          key={e}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent Deliveries Table */}
            <div className="glass rounded-2xl border border-white/5 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" /> Recent Delivery Logs
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 border-b border-white/5 text-[10px] uppercase font-bold text-neutral-400">
                    <tr>
                      <th className="px-4 py-2.5">Time</th>
                      <th className="px-4 py-2.5">Event</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Attempts</th>
                      <th className="px-4 py-2.5">Response / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                          No recent deliveries logged.
                        </td>
                      </tr>
                    ) : (
                      deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-neutral-400 text-[11px]">
                            {new Date(d.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-cyan-300 text-[11px]">{d.event}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                d.status === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {d.status_code ? `HTTP ${d.status_code}` : d.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-300">{d.attempts}</td>
                          <td className="px-4 py-3 text-neutral-400 text-[11px] max-w-xs truncate">
                            {d.error_message || 'OK'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: API REFERENCE & DOCUMENTATION */}
        {/* ========================================================================= */}
        {activeTab === 'docs' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" /> LeaderboardOS REST API Reference (v1.0)
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Authoritative API specifications, security headers, rate limits, and language-specific integration
                examples.
              </p>
            </div>

            {/* Security & Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
                <h3 className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Authentication
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Provide your API key in every request header:
                </p>
                <code className="block p-2 rounded-lg bg-black/60 text-[10px] font-mono text-neutral-300">
                  Authorization: Bearer lb_live_...
                </code>
              </div>
              <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
                <h3 className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Rate Limiting
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Sliding window (60 req/min). Inspect response headers:
                </p>
                <code className="block p-2 rounded-lg bg-black/60 text-[10px] font-mono text-neutral-300">
                  X-RateLimit-Limit, X-RateLimit-Remaining
                </code>
              </div>
              <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
                <h3 className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" /> Idempotency
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Prevent duplicate score submissions with:
                </p>
                <code className="block p-2 rounded-lg bg-black/60 text-[10px] font-mono text-neutral-300">
                  Idempotency-Key: your_uuid_here
                </code>
              </div>
            </div>

            {/* Endpoints Directory */}
            <div className="glass rounded-2xl border border-white/5 p-6 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Available Endpoints</h3>
              <div className="space-y-4">
                {/* 1. Competitions */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      GET
                    </span>
                    <code className="text-xs font-mono text-white font-bold">/api/v1/competitions</code>
                  </div>
                  <p className="text-xs text-neutral-400">
                    List public competitions with pagination (<code className="text-cyan-300">page</code>, <code className="text-cyan-300">pageSize</code>), category, and engine filtering.
                  </p>
                </div>

                {/* 2. Standings */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      GET
                    </span>
                    <code className="text-xs font-mono text-white font-bold">/api/v1/competitions/:idOrSlug/standings</code>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Fetch current rank table, member points, and league statistics.
                  </p>
                </div>

                {/* 3. Fixtures */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      GET
                    </span>
                    <code className="text-xs font-mono text-white font-bold">/api/v1/competitions/:idOrSlug/fixtures</code>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Retrieve scheduled tournament bracket matches or round-robin league fixtures.
                  </p>
                </div>

                {/* 4. Score Submission */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      POST
                    </span>
                    <code className="text-xs font-mono text-white font-bold">/api/v1/competitions/:idOrSlug/scores</code>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Submit verified score adjustments or match results. Requires scope <code className="text-cyan-300">scores:submit</code>.
                  </p>
                  <pre className="p-3 rounded-lg bg-black/80 text-[11px] font-mono text-neutral-300 overflow-x-auto">
{`// Tournament/League Match Body:
{ "match_id": "match-uuid", "home_score": 3, "away_score": 1 }

// Simple Points Leaderboard Body:
{ "member_id": "member-uuid", "points": 50, "reason": "First Place Victory" }`}
                  </pre>
                </div>

                {/* 5. Webhooks */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      CRUD
                    </span>
                    <code className="text-xs font-mono text-white font-bold">/api/v1/webhooks</code>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Manage real-time push subscriptions. Requires scope <code className="text-cyan-300">webhooks:manage</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Code Examples */}
            <div className="glass rounded-2xl border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Webhook Signature Verification (Node.js)</h3>
              <p className="text-xs text-neutral-400">
                Verify incoming webhooks using Node crypto to prevent spoofing and replay attacks:
              </p>
              <pre className="p-4 rounded-xl bg-black/80 border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`import crypto from 'crypto';

export function verifyLeaderboardOSWebhook(rawBody, signatureHeader, secret) {
  // 1. Parse header (t=timestamp,v1=signature)
  const parts = Object.fromEntries(signatureHeader.split(',').map(kv => kv.split('=')));
  const { t, v1 } = parts;

  // 2. Reject replay attacks (> 5 minutes drift)
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10)) > 300) {
    throw new Error('Timestamp outside tolerance window');
  }

  // 3. Compute expected HMAC
  const expected = crypto.createHmac('sha256', secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest('hex');

  // 4. Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: CREATE API KEY */}
      {showCreateKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-cyan-400" /> Generate New API Key
            </h3>
            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Key Name / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. Discord Bot, Match Reporter"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Rate Limit</label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value, 10) || 60)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">Requests per minute</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">Permissions & Scopes</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-start gap-2.5 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedScopes([...selectedScopes, scope.id]);
                          else setSelectedScopes(selectedScopes.filter((s) => s !== scope.id));
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="block font-mono text-[11px] font-bold text-cyan-300">{scope.label}</span>
                        <span className="block text-[10px] text-neutral-400 leading-tight">{scope.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateKeyModal(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER WEBHOOK */}
      {showAddWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Webhook className="w-5 h-5 text-cyan-400" /> Register Webhook Destination
            </h3>
            <form onSubmit={handleRegisterWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Destination URL (HTTPS)</label>
                <input
                  type="url"
                  placeholder="https://your-api.com/webhooks/leaderboardos"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Production Game Server Sync"
                  value={webhookDesc}
                  onChange={(e) => setWebhookDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">Subscribe to Events</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-start gap-2.5 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedEvents([...selectedEvents, event.id]);
                          else setSelectedEvents(selectedEvents.filter((ev) => ev !== event.id));
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="block font-mono text-[11px] font-bold text-cyan-300">{event.label}</span>
                        <span className="block text-[10px] text-neutral-400 leading-tight">{event.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWebhookModal(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
