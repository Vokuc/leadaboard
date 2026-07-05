'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { Leaderboard, Season, ActivityLog, Ranking, ScoreEvent } from '@/types';
import { 
  Trophy, 
  Search, 
  Calendar, 
  ExternalLink, 
  Users, 
  Activity, 
  Clock, 
  Share2, 
  QrCode, 
  X, 
  Sparkles, 
  Copy,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import QRCode from 'qrcode';

export default function PublicLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [rankFilter, setRankFilter] = useState<'all' | 'top10' | 'top50'>('all');
  
  // Selected Player Profile Modal
  const [selectedPlayer, setSelectedPlayer] = useState<Ranking | null>(null);
  const [playerHistory, setPlayerHistory] = useState<ScoreEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sharing Popup
  const [showShareModal, setShowShareModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const loadData = async (isSilent = false) => {
    if (!slug) return;
    if (!isSilent) setLoading(true);
    try {
      const lb = await DatabaseService.getLeaderboardBySlug(slug);
      if (!lb) {
        setLoading(false);
        return;
      }
      setLeaderboard(lb);

      const host = typeof window !== 'undefined' ? window.location.origin : '';
      setShareUrl(`${host}/leaderboards/${lb.slug}`);

      // Fetch seasons
      const seas = await DatabaseService.getSeasons(lb.id);
      if (seas.length > 0) setSeason(seas[0]);

      // Fetch rankings
      const ranks = await DatabaseService.getRankings(lb.id);
      setRankings(ranks);

      // Fetch activity logs
      const logs = await DatabaseService.getActivityLogs(lb.id);
      setActivityLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    loadData();
  }, [slug]);

  // Real-Time Subscriptions
  useEffect(() => {
    if (!leaderboard) return;

    if (isSupabaseConfigured && supabase) {
      // Live Supabase Realtime Channels
      const scoreChannel = supabase
        .channel(`public:score_events:leaderboard_${leaderboard.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'score_events', 
          filter: `leaderboard_id=eq.${leaderboard.id}` 
        }, () => {
          loadData(true); // Silent reload on score additions
        })
        .subscribe();

      return () => {
        scoreChannel.unsubscribe();
      };
    } else {
      // Demo Mode: Binds to storage updates across browser tabs
      const handleStorageUpdate = (e: StorageEvent) => {
        if (e.key && e.key.startsWith('leagueboard_')) {
          loadData(true); // Silent reload on local updates
        }
      };
      window.addEventListener('storage', handleStorageUpdate);
      
      // Keep a fallback minor poll just in case of local same-window sandboxing
      const interval = setInterval(() => {
        loadData(true);
      }, 3000);

      return () => {
        window.removeEventListener('storage', handleStorageUpdate);
        clearInterval(interval);
      };
    }
  }, [leaderboard]);

  // QR rendering when modal opens
  useEffect(() => {
    if (showShareModal && qrCanvasRef.current && shareUrl) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        shareUrl,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('QR Render err:', err);
        }
      );
    }
  }, [showShareModal, shareUrl]);

  // Fetch player logs history
  useEffect(() => {
    if (!selectedPlayer) return;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const hist = await DatabaseService.getPlayerHistory(selectedPlayer.member_id);
        setPlayerHistory(hist);
      } catch (err) {
        console.error(err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [selectedPlayer]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <Trophy className="w-8 h-8 text-violet-500 animate-bounce" />
      </div>
    );
  }

  if (!leaderboard) {
    return (
      <div className="min-h-screen bg-black bg-grid flex flex-col items-center justify-center text-neutral-400 px-4 text-center">
        <X className="w-12 h-12 text-red-500 mb-4 bg-red-500/10 p-2.5 rounded-full border border-red-500/20" />
        <h2 className="text-xl font-bold text-white">Leaderboard Not Found</h2>
        <p className="text-xs text-neutral-500 mt-1 max-w-xs">Double check the URL parameters or contact the tournament organizer.</p>
        <Link href="/" className="mt-6 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-semibold hover:text-white transition-colors">
          Go back home
        </Link>
      </div>
    );
  }

  // Calculate unique teams for filter options
  const teams = Array.from(new Set(rankings.map(r => r.team).filter(Boolean))) as string[];

  // Apply filters in memory
  const filteredRankings = rankings
    .filter(r => r.is_active)
    .filter(r => r.player_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 (r.team && r.team.toLowerCase().includes(searchQuery.toLowerCase())))
    .filter(r => teamFilter === 'all' || r.team === teamFilter)
    .filter((_, idx) => {
      if (rankFilter === 'top10') return idx < 10;
      if (rankFilter === 'top50') return idx < 50;
      return true;
    });

  // Top 3 Podium holders
  const topThree = rankings.slice(0, 3);
  // Get podium indexes in visual display order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = [
    topThree[1] ? { ...topThree[1], displayRank: 2 } : null,
    topThree[0] ? { ...topThree[0], displayRank: 1 } : null,
    topThree[2] ? { ...topThree[2], displayRank: 3 } : null
  ].filter(Boolean);

  const displayCategoryLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16 relative">
      {/* Glow overlays */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] rounded-full blur-[140px] pointer-events-none opacity-40 ${
        leaderboard.competition_type === 'gaming' ? 'bg-purple-900/15' :
        leaderboard.competition_type === 'workplace' ? 'bg-emerald-900/15' :
        'bg-cyan-900/15'
      }`} />

      {/* Public Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-500 animate-pulse-glow" />
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            LeagueBoard
          </span>
        </Link>
        
        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-850 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-900 text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" /> Share Page
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 mt-8">
        {/* Banner Details */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="flex justify-center items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
              {displayCategoryLabel(leaderboard.competition_type)} Challenge
            </span>
            {season && (
              <span className="text-xs text-neutral-600 flex items-center gap-1">
                • <Calendar className="w-3.5 h-3.5" /> {season.name}
              </span>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{leaderboard.name}</h1>
          <p className="text-sm text-neutral-400 mt-2 leading-relaxed">{leaderboard.description}</p>
        </div>

        {/* ==========================================
            VISUAL PODIUM SECTION (TOP 3)
            ========================================== */}
        {rankings.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-center items-end gap-6 sm:gap-4 mb-16 max-w-3xl mx-auto px-4 mt-8">
            {podiumOrder.map((player) => {
              if (!player) return null;
              
              const isFirst = player.displayRank === 1;
              const isSecond = player.displayRank === 2;
              
              return (
                <div 
                  key={player.member_id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`flex flex-col items-center cursor-pointer transition-transform hover:-translate-y-1 w-full max-w-[200px] sm:max-w-none relative ${
                    isFirst ? 'order-1 sm:order-2 z-20' :
                    isSecond ? 'order-2 sm:order-1 z-10' :
                    'order-3 z-10'
                  }`}
                >
                  {/* Visual crown for #1 */}
                  {isFirst && (
                    <span className="text-xl absolute -top-5 text-amber-400 animate-bounce">👑</span>
                  )}

                  {/* Avatar Frame with metallic borders */}
                  <div className="relative mb-3">
                    <img 
                      src={player.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(player.player_name)}`} 
                      alt={player.player_name} 
                      className={`w-16 h-16 rounded-full object-cover border-2 shadow-xl ${
                        isFirst ? 'w-20 h-20 border-amber-500 glow-primary' :
                        isSecond ? 'border-neutral-300' :
                        'border-amber-700'
                      }`}
                    />
                    <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                      isFirst ? 'bg-amber-500 border-amber-400 text-black' :
                      isSecond ? 'bg-neutral-300 border-neutral-200 text-black' :
                      'bg-amber-700 border-amber-600 text-white'
                    }`}>
                      {player.displayRank}
                    </span>
                  </div>

                  {/* Player info card on podium */}
                  <div className={`glass p-4 rounded-xl border border-white/5 w-full text-center flex flex-col justify-between ${
                    isFirst ? 'h-36 border-violet-500/20 bg-violet-950/5' :
                    isSecond ? 'h-32' :
                    'h-28'
                  }`}>
                    <div>
                      <h4 className="font-bold text-sm truncate max-w-[120px] text-white">{player.player_name}</h4>
                      <p className="text-[10px] text-neutral-500 truncate max-w-[125px] font-semibold mt-0.5">
                        {player.team || 'Freelance'}
                      </p>
                    </div>

                    <div className="mt-3">
                      <span className={`text-base font-extrabold block ${
                        isFirst ? 'text-violet-400' : 'text-white'
                      }`}>
                        {player.total_points.toLocaleString()}
                      </span>
                      <span className="text-[8px] text-neutral-400 uppercase tracking-wider block font-bold mt-0.5">Points</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==========================================
            RANKINGS GRID / LIST SECTION
            ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            
            {/* SEARCH & FILTERS BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 rounded-2xl bg-neutral-900/40 border border-neutral-850">
              {/* Search box */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search competitor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-neutral-950/65 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap gap-2">
                {/* Team selector */}
                {teams.length > 0 && (
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-neutral-950/65 border border-neutral-850 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="all">All Teams</option>
                    {teams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}

                {/* Top filter buttons */}
                <div className="flex border border-neutral-850 p-0.5 bg-neutral-950/65 rounded-xl">
                  {(['all', 'top10', 'top50'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setRankFilter(opt)}
                      className={`px-3 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-colors cursor-pointer ${
                        rankFilter === opt ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      {opt === 'all' ? 'All' : opt === 'top10' ? 'Top 10' : 'Top 50'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FULL RANKINGS datagrid */}
            <div className="glass rounded-2xl overflow-hidden border-white/5 shadow-xl">
              <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                <thead className="bg-neutral-950/65 text-neutral-450 uppercase font-bold tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 text-center w-14">Rank</th>
                    <th scope="col" className="px-6 py-3.5">Competitor</th>
                    <th scope="col" className="px-6 py-3.5">Team</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {filteredRankings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-neutral-500">
                        No active competitors found matching selection.
                      </td>
                    </tr>
                  ) : (
                    filteredRankings.map((r, idx) => {
                      const absoluteRank = rankings.findIndex(rank => rank.member_id === r.member_id) + 1;
                      
                      return (
                        <tr 
                          key={r.member_id} 
                          onClick={() => setSelectedPlayer(r)}
                          className="hover:bg-white/[0.01] transition-all cursor-pointer group"
                        >
                          <td className="px-6 py-4 text-center">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold mx-auto ${
                              absoluteRank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                              absoluteRank === 2 ? 'bg-neutral-300/20 text-neutral-300 border border-neutral-300/20' :
                              absoluteRank === 3 ? 'bg-amber-700/20 text-amber-650 border border-amber-700/20' :
                              'text-neutral-500'
                            }`}>
                              {absoluteRank}
                            </span>
                          </td>
                          <td className="px-6 py-4 flex items-center gap-3">
                            <img 
                              src={r.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.player_name)}`} 
                              alt={r.player_name} 
                              className="w-7 h-7 rounded border border-white/5 group-hover:border-violet-500/35 transition-colors" 
                            />
                            <span className="font-bold text-white group-hover:text-violet-400 transition-colors text-sm">{r.player_name}</span>
                          </td>
                          <td className="px-6 py-4 text-neutral-400">
                            {r.team ? (
                              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-850 font-semibold text-[9px] uppercase tracking-wide">
                                {r.team}
                              </span>
                            ) : (
                              <span className="text-neutral-700">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-sm text-neutral-250">
                            {r.total_points.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDEBAR: RECENT EVENT LOGS */}
          <div className="glass p-6 rounded-2xl h-[450px] flex flex-col justify-between shadow-xl">
            <div>
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                <Activity className="w-4 h-4 text-violet-400" /> Recent Live Logs
              </h4>

              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                {activityLogs.length === 0 ? (
                  <div className="text-center text-neutral-600 text-xs py-10">
                    No activity logs recorded.
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="text-[11px] p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <p className="text-neutral-300 font-medium leading-relaxed">{log.message}</p>
                      <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                        <Clock className="w-3 h-3 text-neutral-600" />
                        <span>
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ==========================================
          MODAL: PLAYER PROFILE CARD OVERLAY
          ========================================== */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          {/* Backdrop trigger close */}
          <div className="absolute inset-0" onClick={() => setSelectedPlayer(null)} />
          
          <div className="glass-premium max-w-md w-full p-6 rounded-2xl shadow-2xl relative border-white/10 glow-primary z-10">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Profile Hero */}
            <div className="flex flex-col items-center text-center pb-5 border-b border-white/5">
              <img 
                src={selectedPlayer.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(selectedPlayer.player_name)}`} 
                alt={selectedPlayer.player_name}
                className="w-16 h-16 rounded-2xl border-2 border-violet-500/30 object-cover mb-3 glow-primary"
              />
              <h3 className="font-bold text-lg text-white leading-none">{selectedPlayer.player_name}</h3>
              {selectedPlayer.team && (
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 mt-2">
                  {selectedPlayer.team}
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 my-5">
              <div className="glass p-3.5 rounded-xl text-center">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Current Rank</span>
                <span className="text-xl font-black text-violet-400 block mt-1">
                  #{rankings.findIndex(rank => rank.member_id === selectedPlayer.member_id) + 1}
                </span>
              </div>
              <div className="glass p-3.5 rounded-xl text-center">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Total Score</span>
                <span className="text-xl font-black text-white block mt-1">{selectedPlayer.total_points.toLocaleString()}</span>
              </div>
            </div>

            {/* Score Logs History list */}
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-violet-400" /> Logged Score History
              </h4>

              <div className="space-y-1.5 overflow-y-auto max-h-36 pr-1 text-xs">
                {historyLoading ? (
                  <div className="text-center text-neutral-500 text-xs py-4">Loading stats history...</div>
                ) : playerHistory.length === 0 ? (
                  <div className="text-center text-neutral-600 text-xs py-4">No score logs found for player.</div>
                ) : (
                  playerHistory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex justify-between items-center p-2 rounded-lg bg-black/45 border border-white/5"
                    >
                      <div>
                        <span className="font-bold text-white block text-[11px]">{item.reason}</span>
                        <span className="block text-[8px] text-neutral-500 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        item.points >= 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {item.points >= 0 ? `+${item.points}` : item.points}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Achievements Section Placeholder */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Claimed Badges & Medals</span>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center opacity-35" title="Earned when player reaches top 3 (Placeholder)">
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center opacity-35" title="Earned when player reaches 1,000 points (Placeholder)">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center opacity-35" title="Earned when player has a 3-event streak (Placeholder)">
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: SHARING QR & LINKS
          ========================================== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowShareModal(false)} />
          
          <div className="glass-premium max-w-sm w-full p-6 rounded-2xl shadow-2xl relative border-white/10 glow-primary z-10 flex flex-col items-center text-center">
            {/* Close */}
            <button 
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <Share2 className="w-5 h-5 text-violet-400 mb-2" />
            <h3 className="font-bold text-sm text-white">Share Leaderboard</h3>
            <p className="text-[10px] text-neutral-500 mt-1 max-w-[200px]">Copy the public link or scan the code invitation.</p>

            {/* Canvas QR */}
            <div className="mt-5 p-2 bg-white rounded-xl shadow-inner border border-neutral-200">
              <canvas ref={qrCanvasRef} />
            </div>

            {/* Click to Copy */}
            <div className="mt-6 flex w-full border border-neutral-850 p-1 bg-neutral-950/65 rounded-xl text-xs gap-1.5 items-center">
              <span className="flex-1 text-neutral-450 truncate text-[11px] px-2 text-left">{shareUrl}</span>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer whitespace-nowrap glow-primary"
              >
                <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
