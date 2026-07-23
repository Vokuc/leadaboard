'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DatabaseService } from '@/lib/db';
import { Leaderboard, CompetitionType } from '@/types';
import { 
  Trophy, 
  Gamepad2, 
  Activity, 
  Briefcase, 
  Plus, 
  LogOut, 
  ExternalLink, 
  MoreVertical, 
  Copy, 
  Archive, 
  Trash2, 
  Calendar, 
  Users, 
  Search, 
  FolderLock, 
  ArchiveRestore,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import Link from 'next/link';
import HelpModal from '@/components/HelpModal';
import { dashboardHelp } from '@/lib/help-content';

export default function DashboardPage() {
  const { profile, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [seasonStatuses, setSeasonStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    }
  }, [profile, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const data = activeTab === 'active' 
        ? await DatabaseService.getLeaderboards() 
        : await DatabaseService.getArchivedLeaderboards();
      setLeaderboards(data);

      // Fetch player counts and seasons for each board
      const counts: Record<string, number> = {};
      const seasons: Record<string, string> = {};

      for (const lb of data) {
        const mems = await DatabaseService.getMembers(lb.id);
        counts[lb.id] = mems.length;

        const seas = await DatabaseService.getSeasons(lb.id);
        if (seas.length > 0) {
          const activeSeason = seas[0];
          seasons[lb.id] = activeSeason.name;
        } else {
          seasons[lb.id] = 'Indefinite';
        }
      }
      setPlayerCounts(counts);
      setSeasonStatuses(seasons);
    } catch (err) {
      console.error('Error loading leaderboards:', err);
      showToast('Failed to load leaderboards.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, profile]);

  useEffect(() => {
    if (profile) {
      queueMicrotask(() => {
        void loadData();
      });
    }
  }, [loadData, profile]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleDuplicate = async (id: string, name: string) => {
    setActiveDropdown(null);
    try {
      await DatabaseService.duplicateLeaderboard(id);
      showToast(`Duplicated "${name}" successfully.`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Failed to duplicate leaderboard.', 'error');
    }
  };

  const handleArchive = async (id: string, name: string, isCurrentlyArchived: boolean) => {
    setActiveDropdown(null);
    try {
      await DatabaseService.updateLeaderboard(id, { 
        status: isCurrentlyArchived ? 'active' : 'archived' 
      });
      showToast(
        isCurrentlyArchived 
          ? `Restored "${name}" to active status.` 
          : `Archived "${name}" successfully.`, 
        'success'
      );
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Action failed.', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setActiveDropdown(null);
    if (!confirm(`Are you absolutely sure you want to delete "${name}"? This will permanently wipe all player profiles, scores, and activity history.`)) {
      return;
    }
    try {
      await DatabaseService.deleteLeaderboard(id);
      showToast(`Deleted "${name}" permanently.`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete leaderboard.', 'error');
    }
  };

  const getCategoryIcon = (type: CompetitionType) => {
    switch (type) {
      case 'gaming': return <Gamepad2 className="w-4 h-4" />;
      case 'sports': 
      case 'fitness': return <Activity className="w-4 h-4" />;
      case 'workplace': return <Briefcase className="w-4 h-4" />;
      case 'reading': return <BookOpen className="w-4 h-4" />;
      case 'education': return <GraduationCap className="w-4 h-4" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  // Filtered boards based on search query
  const filteredLeaderboards = leaderboards.filter(lb => 
    lb.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (lb.description && lb.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Compute overall stats
  const totalBoards = leaderboards.length;
  const totalPlayers = Object.values(playerCounts).reduce((a, b) => a + b, 0);
  const activeSeasons = Object.values(seasonStatuses).filter(s => s !== 'Indefinite').length;

  if (authLoading || (!profile && loading)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <Trophy className="w-8 h-8 text-violet-500 animate-bounce" />
          <span className="text-sm font-semibold tracking-wider animate-pulse">Loading console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-500" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              LeagueBoard
            </span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-neutral-900 border-neutral-800 text-neutral-400">
            Console
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url && (
              <img src={profile.avatar_url} alt="Profile" className="w-8 h-8 rounded-lg border border-white/10" />
            )}
            <div className="hidden md:block text-left">
              <h4 className="text-xs font-bold leading-none">{profile?.full_name}</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">{profile?.email}</p>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="p-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8">
        {/* Statistics Panels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass p-4 rounded-2xl">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Boards</span>
            <h3 className="text-2xl font-bold mt-1 text-white">{totalBoards}</h3>
          </div>
          <div className="glass p-4 rounded-2xl">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Players</span>
            <h3 className="text-2xl font-bold mt-1 text-violet-400">{totalPlayers}</h3>
          </div>
          <div className="glass p-4 rounded-2xl">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Seasons</span>
            <h3 className="text-2xl font-bold mt-1 text-cyan-400">{activeSeasons}</h3>
          </div>
          <div className="glass p-4 rounded-2xl">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Platform Health</span>
            <h3 className="text-2xl font-bold mt-1 text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              100%
            </h3>
          </div>
        </div>

        {/* Dashboard Title Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">My Leaderboards</h1>
            <p className="text-sm text-neutral-400 mt-1">Configure scoring, register players, and audit event logs.</p>
          </div>
          <div className="flex items-center gap-2">
            <HelpModal {...dashboardHelp} />
            <Link
              href="/dashboard/create"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-sm font-semibold rounded-xl text-white shadow-lg shadow-violet-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Leaderboard
            </Link>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-850 mb-6">
          {/* Active / Archive Toggle */}
          <div className="flex border-b border-neutral-800 p-0.5 bg-neutral-950/60 rounded-xl border max-w-fit">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'active' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'archived' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Archived
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by board name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-neutral-950/60 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="glass p-6 rounded-2xl border border-white/5 animate-pulse h-48 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-4 bg-neutral-800 rounded w-2/3" />
                  <div className="h-3 bg-neutral-800 rounded w-5/6" />
                </div>
                <div className="h-8 bg-neutral-800 rounded w-full mt-4" />
              </div>
            ))}
          </div>
        ) : filteredLeaderboards.length === 0 ? (
          /* Empty State */
          <div className="glass p-12 text-center rounded-2xl flex flex-col items-center justify-center border-white/5 shadow-xl">
            <div className="p-4 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-500 mb-4">
              <FolderLock className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-white">No leaderboards found</h3>
            <p className="text-sm text-neutral-400 mt-1 max-w-sm">
              {searchQuery 
                ? 'No leaderboards match your filter. Try adjusting your query.' 
                : activeTab === 'archived' 
                  ? 'Your archive is empty. Drag boards to archive when a competition ends.'
                  : 'Start tracking competition rankings by creating your first modular leaderboard.'
              }
            </p>
            {!searchQuery && activeTab === 'active' && (
              <Link
                href="/dashboard/create"
                className="mt-6 flex items-center gap-1.5 px-4.5 py-2.5 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl text-white shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Build First Leaderboard
              </Link>
            )}
          </div>
        ) : (
          /* Leaderboard Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeaderboards.map(lb => (
              <div 
                key={lb.id} 
                className="glass p-6 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-neutral-900/40 transition-all flex flex-col justify-between relative shadow-lg group"
              >
                {/* Options Dropdown Trigger */}
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === lb.id ? null : lb.id)}
                    className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === lb.id && (
                    <>
                      {/* Overlay to close */}
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                      
                      <div className="absolute right-0 mt-1.5 w-40 glass rounded-xl shadow-2xl border border-white/10 p-1.5 z-50 text-xs space-y-1">
                        <button
                          onClick={() => handleDuplicate(lb.id, lb.name)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Duplicate
                        </button>
                        
                        <button
                          onClick={() => handleArchive(lb.id, lb.name, lb.status === 'archived')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {lb.status === 'archived' ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5" /> Restore Active
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5" /> Archive Board
                            </>
                          )}
                        </button>

                        <div className="border-t border-white/5 my-1" />
                        
                        <button
                          onClick={() => handleDelete(lb.id, lb.name)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Card Content */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-violet-400">
                      {getCategoryIcon(lb.competition_type)}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {lb.competition_type}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white tracking-tight group-hover:text-violet-400 transition-colors">
                    {lb.name}
                  </h3>
                  
                  <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 h-8 leading-relaxed">
                    {lb.description || 'No description supplied.'}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                    {/* Players Count */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Registered Players
                      </span>
                      <span className="font-bold text-neutral-300">{playerCounts[lb.id] ?? 0}</span>
                    </div>

                    {/* Season Limit */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Season Timeline
                      </span>
                      <span className="font-semibold text-neutral-300 truncate max-w-[120px]">
                        {seasonStatuses[lb.id] ?? 'Indefinite'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-6 flex gap-2">
                  <Link
                    href={`/dashboard/leaderboards/${lb.id}`}
                    className="flex-1 py-2 text-center text-xs font-semibold rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-white transition-all cursor-pointer"
                  >
                    Open Console
                  </Link>
                  <a
                    href={`/leaderboards/${lb.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    title="Open Public Real-time View"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
