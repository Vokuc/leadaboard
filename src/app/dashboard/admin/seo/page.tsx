'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, AlertTriangle, CheckCircle2, Link as LinkIcon, BarChart } from 'lucide-react';
import Link from 'next/link';

type ScannedPage = {
  path: string;
  status: 'ok' | 'error' | 'fetch_failed';
  code?: number;
  title: string | null;
  hasDescription: boolean;
  hasCanonical: boolean;
  h1Count: number;
};

type SeoDiagnosticsResponse = {
  success?: boolean;
  scannedPages?: ScannedPage[];
  publicLeaderboardsCount?: number;
  error?: string;
};

export default function AdminSeoDashboardPage() {
  const [data, setData] = useState<SeoDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seo/diagnostics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2 mb-4 text-sm w-fit">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">SEO Diagnostics Engine</h1>
            <p className="text-neutral-400 mt-2">Monitor technical SEO health and organic conversion tracking.</p>
          </div>
          <button 
            onClick={fetchDiagnostics}
            disabled={loading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Run Audit
          </button>
        </div>

        {loading ? (
          <div className="glass rounded-xl p-12 text-center border border-white/5">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-4" />
            <p className="text-neutral-400">Scanning pages and analyzing metadata...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* High-Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-neutral-300">Pages Scanned</h3>
                  <Search className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-3xl font-black">{data?.scannedPages?.length || 0}</p>
              </div>
              <div className="glass p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-neutral-300">Public Leaderboards</h3>
                  <BarChart className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-black">{data?.publicLeaderboardsCount || 0}</p>
                <p className="text-xs text-neutral-500 mt-2">Indexed by Google</p>
              </div>
              <div className="glass p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-neutral-300">Site Verification</h3>
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-xl font-bold text-emerald-400">Configured</p>
                <p className="text-xs text-neutral-500 mt-2">Google Search Console</p>
              </div>
            </div>

            {/* Workflow Guide */}
            <div className="glass rounded-xl border border-white/5 p-6 space-y-4">
              <h2 className="text-xl font-bold border-b border-white/10 pb-4">SEO Prioritization Workflow</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div>
                  <h4 className="font-bold text-amber-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Positions 4 - 10</h4>
                  <p className="text-sm text-neutral-400 mt-2"><strong>Strategy: CTR Optimization.</strong> These pages are in striking distance. Rewrite the Title Tag and Meta Description to be more compelling and increase click-through rate.</p>
                </div>
                <div>
                  <h4 className="font-bold text-violet-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-400"></span> Positions 11 - 20</h4>
                  <p className="text-sm text-neutral-400 mt-2"><strong>Strategy: Content Refresh.</strong> You are stuck on Page 2. Add an FAQ section, improve formatting, add images, and ensure the H1 perfectly matches search intent.</p>
                </div>
                <div>
                  <h4 className="font-bold text-blue-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Positions 21 - 50</h4>
                  <p className="text-sm text-neutral-400 mt-2"><strong>Strategy: Link Building.</strong> These pages lack authority. Point more internal links to them from higher-ranking pages, or build external backlinks.</p>
                </div>
              </div>
            </div>

            {/* Diagnostics Table */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold">Page Diagnostics</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-neutral-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Route</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Title Tag</th>
                      <th className="px-6 py-4 font-medium">Description</th>
                      <th className="px-6 py-4 font-medium">Canonical</th>
                      <th className="px-6 py-4 font-medium">H1 Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data?.scannedPages?.map((page, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-violet-300">{page.path}</td>
                        <td className="px-6 py-4">
                          {page.status === 'ok' ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> OK</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Error</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {page.title ? (
                            <span className="truncate max-w-[200px] block" title={page.title}>{page.title}</span>
                          ) : (
                            <span className="text-red-400 font-bold">Missing</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {page.hasDescription ? <span className="text-emerald-400">Present</span> : <span className="text-red-400 font-bold">Missing</span>}
                        </td>
                        <td className="px-6 py-4">
                          {page.hasCanonical ? <span className="text-emerald-400">Present</span> : <span className="text-amber-400">Missing</span>}
                        </td>
                        <td className="px-6 py-4">
                          {page.h1Count === 1 ? (
                            <span className="text-emerald-400">1</span>
                          ) : (
                            <span className="text-red-400 font-bold">{page.h1Count}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
