'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { CompetitionConfig, Leaderboard, Season, ScoringRule, LeaderboardMember, ActivityLog, Ranking, LeaderboardAdmin } from '@/types';
import { 
  Trophy, 
  ArrowLeft, 
  Share2, 
  QrCode,
  Activity, 
  Edit2, 
  Trash2, 
  Award, 
  Check, 
  AlertCircle,
  ExternalLink,
  UserPlus,
  Search,
  ShieldAlert,
  Crown,
  UserMinus
} from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import HelpModal from '@/components/HelpModal';
import { leaderboardManagementHelp } from '@/lib/help-content';
import { uploadImageAsset } from '@/lib/image-upload';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import SafeImage from '@/components/SafeImage';
import LeagueManagementPanel from '@/components/league/LeagueManagementPanel';
import TournamentManagementPanel from '@/components/tournament/TournamentManagementPanel';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function LeaderboardManagementPage() {
  const { profile, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const boardId = params.id as string;

  // DB States
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [competitionConfig, setCompetitionConfig] = useState<CompetitionConfig | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Layout Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'scores' | 'settings' | 'integrations'>('overview');
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // QR Code Canvas Ref
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [publicUrl, setPublicUrl] = useState('');

  // Modals & Form states
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState<LeaderboardMember | null>(null);

  // Player Form States
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerTeam, setPlayerTeam] = useState('');
  const [playerNotes, setPlayerNotes] = useState('');
  const [playerAvatarUrl, setPlayerAvatarUrl] = useState('');

  // Score Adjustment Form States
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('custom');
  const [pointsAdjustment, setPointsAdjustment] = useState<number>(10);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Permissions & Admins States
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState<LeaderboardAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Settings Form States
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsVisibility, setSettingsVisibility] = useState<'public' | 'private'>('public');
  const [settingsCoverUrl, setSettingsCoverUrl] = useState('');

  // Players Search Filter
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  const settingsDirty = !!leaderboard && (
    settingsName !== leaderboard.name ||
    settingsDesc !== (leaderboard.description || '') ||
    settingsVisibility !== leaderboard.visibility ||
    settingsCoverUrl !== (leaderboard.cover_image_url || '')
  );

  const playerModalDirty = showAddPlayerModal
    ? Boolean(playerName.trim() || playerEmail.trim() || playerTeam.trim() || playerNotes.trim() || playerAvatarUrl.trim())
    : !!showEditPlayerModal && (
        playerName !== showEditPlayerModal.name ||
        playerEmail !== (showEditPlayerModal.email || '') ||
        playerTeam !== (showEditPlayerModal.team || '') ||
        playerNotes !== (showEditPlayerModal.notes || '') ||
        playerAvatarUrl !== (showEditPlayerModal.avatar_url || '')
      );

  useUnsavedChangesWarning(
    (settingsDirty || playerModalDirty) && !saving,
    'You have unsaved leaderboard changes. Leave this page anyway?'
  );

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Auto-redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    }
  }, [profile, authLoading, router]);

  const loadAllData = useCallback(async () => {
    if (!profile || !boardId) return;
    try {
      const lb = await DatabaseService.getLeaderboardById(boardId);
      if (!lb) {
        showToast('Leaderboard not found.', 'error');
        router.push('/dashboard');
        return;
      }

      const ownerCheck = lb.owner_id === profile.id;
      const adminCheck = await DatabaseService.canManageLeaderboard(profile.id, lb.id);
      const hasPermission = ownerCheck || adminCheck;

      if (!hasPermission) {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      setIsOwner(ownerCheck);
      setLeaderboard(lb);
      setSettingsName(lb.name);
      setSettingsDesc(lb.description || '');
      setSettingsVisibility(lb.visibility);
      setSettingsCoverUrl(lb.cover_image_url || '');

      const host = typeof window !== 'undefined' ? window.location.origin : '';
      setPublicUrl(`${host}/leaderboards/${lb.slug}`);

      const config = await LeagueService.getCompetitionConfig(boardId);
      setCompetitionConfig(config);

      // Fetch children
      const seas = await DatabaseService.getSeasons(boardId);
      setSeasons(seas);

      const rls = await DatabaseService.getScoringRules(boardId);
      setRules(rls);

      const mems = await DatabaseService.getMembers(boardId);
      setMembers(mems);
      setSelectedMemberId((current) => current || mems[0]?.id || '');

      const ranks = await DatabaseService.getRankings(boardId);
      setRankings(ranks);

      const logs = await DatabaseService.getActivityLogs(boardId);
      setActivityLogs(logs);

      if (ownerCheck) {
        const adminList = await DatabaseService.getAdmins(boardId);
        setAdmins(adminList);
      }

    } catch (err) {
      console.error(err);
      showToast('Error loading management console.', 'error');
    } finally {
      setLoading(false);
    }
  }, [boardId, profile, router]);

  useEffect(() => {
    if (profile && boardId) {
      queueMicrotask(() => {
        void loadAllData();
      });
    }
  }, [boardId, loadAllData, profile]);

  // QR Code Renderer
  useEffect(() => {
    if (qrCanvasRef.current && publicUrl && activeTab === 'overview') {
      QRCode.toCanvas(
        qrCanvasRef.current,
        publicUrl,
        {
          width: 140,
          margin: 1.5,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('QR render error:', err);
        }
      );
    }
  }, [publicUrl, activeTab]);

  const copyPublicLink = () => {
    const resolvedPublicUrl = publicUrl || (typeof window !== 'undefined' && leaderboard ? `${window.location.origin}/leaderboards/${leaderboard.slug}` : '');

    if (!resolvedPublicUrl) {
      showToast('Public link is not ready yet.', 'error');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: leaderboard?.name || 'LeaderboardOS',
        text: 'Open this leaderboard',
        url: resolvedPublicUrl,
      }).then(() => {
        showToast('Share sheet opened.', 'success');
      }).catch(async () => {
        try {
          await navigator.clipboard.writeText(resolvedPublicUrl);
          showToast('Public leaderboard link copied to clipboard.', 'success');
        } catch {
          showToast('Could not share the link from this browser.', 'error');
        }
      });
      return;
    }

    navigator.clipboard.writeText(resolvedPublicUrl).then(() => {
      showToast('Public leaderboard link copied to clipboard.', 'success');
    }).catch(() => {
      showToast('Could not copy the public link.', 'error');
    });
  };

  const handlePlayerAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setAvatarUploading(true);

    try {
      const uploadedImage = await uploadImageAsset(file, 'player-avatar');
      setPlayerAvatarUrl(uploadedImage);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to load image.'), 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCoverImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setCoverUploading(true);

    try {
      const uploadedImage = await uploadImageAsset(file, 'leaderboard-cover');
      setSettingsCoverUrl(uploadedImage);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to load image.'), 'error');
    } finally {
      setCoverUploading(false);
    }
  };

  // Add Member
  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setSaving(true);
    try {
      await DatabaseService.addMember(boardId, {
        name: playerName.trim(),
        email: playerEmail.trim() || null,
        avatar_url: playerAvatarUrl.trim() || null,
        team: playerTeam.trim() || null,
        notes: playerNotes.trim() || null
      });

      showToast(`Added player "${playerName}" successfully.`, 'success');
      
      // Reset form
      setPlayerName('');
      setPlayerEmail('');
      setPlayerTeam('');
      setPlayerNotes('');
      setPlayerAvatarUrl('');
      setShowAddPlayerModal(false);
      
      // Reload lists
      void loadAllData();
    } catch (err: unknown) {
      console.error(err);
      showToast(getErrorMessage(err, 'Failed to add player.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Edit Member
  const handleEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditPlayerModal || !playerName.trim()) return;
    setSaving(true);
    try {
      await DatabaseService.updateMember(showEditPlayerModal.id, {
        name: playerName.trim(),
        email: playerEmail.trim() || null,
        avatar_url: playerAvatarUrl.trim() || null,
        team: playerTeam.trim() || null,
        notes: playerNotes.trim() || null
      });

      showToast(`Updated player "${playerName}" successfully.`, 'success');
      setShowEditPlayerModal(null);
      void loadAllData();
    } catch (err: unknown) {
      console.error(err);
      showToast(getErrorMessage(err, 'Failed to update player.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Member
  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove player "${name}"? This deletes all points logged for them.`)) {
      return;
    }
    try {
      await DatabaseService.removeMember(id);
      showToast(`Removed player "${name}".`, 'success');
      void loadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to remove player.', 'error');
    }
  };

  const handleRuleSelectionChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    if (ruleId === 'custom') {
      setPointsAdjustment(10);
      setAdjustmentReason('Custom Point Adjustment');
      return;
    }

    const rule = rules.find((item) => item.id === ruleId);
    if (rule) {
      setPointsAdjustment(rule.points);
      setAdjustmentReason(rule.event_name);
    }
  };

  // Award Points
  const handleAwardScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      showToast('Select a player to adjust score.', 'error');
      return;
    }
    setSaving(true);
    try {
      // Check who the current #1 player is before awarding points
      const oldRankOneId = rankings.length > 0 ? rankings[0].member_id : null;

      await DatabaseService.addScoreEvent(boardId, selectedMemberId, {
        rule_id: selectedRuleId === 'custom' ? null : selectedRuleId,
        points: pointsAdjustment,
        reason: adjustmentReason || 'Score Adjustment'
      });

      showToast(`Score adjusted by ${pointsAdjustment >= 0 ? '+' : ''}${pointsAdjustment} successfully.`, 'success');

      // Fetch fresh rankings to see if leader changed
      const freshRanks = await DatabaseService.getRankings(boardId);
      setRankings(freshRanks);

      const newRankOneId = freshRanks.length > 0 ? freshRanks[0].member_id : null;
      
      // If leader changed and they have positive points, burst confetti!
      if (newRankOneId && newRankOneId !== oldRankOneId && freshRanks[0].total_points > 0) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        showToast(`${freshRanks[0].player_name} has taken the #1 position on the podium! 👑`, 'success');
      }

      // Reload Logs
      const logs = await DatabaseService.getActivityLogs(boardId);
      setActivityLogs(logs);

      // Reload player details
      const mems = await DatabaseService.getMembers(boardId);
      setMembers(mems);

    } catch (err: unknown) {
      console.error(err);
      showToast('Failed to adjust score.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Admin Management
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !leaderboard) return;
    setAddingAdmin(true);
    try {
      const targetProfile = await DatabaseService.getProfileByEmail(newAdminEmail.trim());
      if (!targetProfile) {
        showToast('No registered profile matches this email address.', 'error');
        return;
      }

      await DatabaseService.addAdmin(leaderboard.id, targetProfile.id);
      const adminList = await DatabaseService.getAdmins(leaderboard.id);
      setAdmins(adminList);
      setNewAdminEmail('');
      showToast('Leaderboard admin added successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, 'Failed to add leaderboard admin.'), 'error');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!leaderboard) return;
    if (!confirm('Are you sure you want to remove this admin?')) return;
    try {
      await DatabaseService.removeAdmin(leaderboard.id, userId);
      const adminList = await DatabaseService.getAdmins(leaderboard.id);
      setAdmins(adminList);
      showToast('Leaderboard admin removed successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast(getErrorMessage(err, 'Failed to remove leaderboard admin.'), 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsName.trim()) return;
    setSaving(true);
    try {
      const updated = await DatabaseService.updateLeaderboard(boardId, {
        name: settingsName.trim(),
        description: settingsDesc.trim() || null,
        visibility: settingsVisibility,
        cover_image_url: settingsCoverUrl.trim() || null
      });
      setLeaderboard(updated);
      showToast('Leaderboard settings saved successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Board
  const handleDeleteBoard = async () => {
    if (!leaderboard) return;
    if (!confirm(`Are you absolutely sure you want to delete the leaderboard "${leaderboard.name}"? This action is permanent and cannot be undone.`)) {
      return;
    }
    try {
      await DatabaseService.deleteLeaderboard(boardId);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete leaderboard.', 'error');
    }
  };

  // Filter members in view
  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
    (m.team && m.team.toLowerCase().includes(playerSearchQuery.toLowerCase())) ||
    (m.email && m.email.toLowerCase().includes(playerSearchQuery.toLowerCase()))
  );

  const getRankLeader = () => {
    if (rankings.length === 0) return 'None';
    return rankings[0].player_name;
  };

  const getActiveSeasonName = () => {
    if (seasons.length === 0) return 'Indefinite';
    return seasons[0].name;
  };

  if (permissionDenied) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <div className="glass max-w-md p-8 rounded-3xl text-center border-white/5 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-3">Access Denied</h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            You don't have permission to manage this leaderboard. If you believe this is an error, contact the leaderboard owner.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 font-semibold rounded-xl text-white text-xs transition-all cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (authLoading || (!leaderboard && loading)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <Trophy className="w-8 h-8 text-violet-500 animate-bounce" />
      </div>
    );
  }

  if (leaderboard && competitionConfig?.engine_type === 'league_table') {
    return (
      <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
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

        <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Console
          </Link>

          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-500" />
            <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              LeaderboardOS
            </span>
          </div>

          <HelpModal {...leaderboardManagementHelp} />
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
          <div className="glass p-6 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[50px] pointer-events-none" />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                  league table
                </span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  {leaderboard.visibility}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{leaderboard.name}</h1>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl">{leaderboard.description || 'No description supplied.'}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" /> <span className="hidden md:inline">Embed</span>
              </button>
              <button
                onClick={copyPublicLink}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <a
                href={`/leaderboards/${leaderboard.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
              >
                Public View <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <LeagueManagementPanel leaderboard={leaderboard} competitionConfig={competitionConfig} onLeaderboardUpdated={setLeaderboard} />
        </main>
      </div>
    );
  }

  if (leaderboard && competitionConfig?.engine_type === 'tournament') {
    return (
      <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
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

        <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Console
          </Link>

          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-500" />
            <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              LeaderboardOS
            </span>
          </div>

          <HelpModal {...leaderboardManagementHelp} />
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 mt-8 space-y-8">
          <div className="glass p-6 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[50px] pointer-events-none" />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                  tournament
                </span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  {leaderboard.visibility}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{leaderboard.name}</h1>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl">{leaderboard.description || 'No description supplied.'}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" /> <span className="hidden md:inline">Embed</span>
              </button>
              <button
                onClick={copyPublicLink}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <a
                href={`/leaderboards/${leaderboard.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
              >
                Public View <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <TournamentManagementPanel leaderboard={leaderboard} competitionConfig={competitionConfig} onLeaderboardUpdated={setLeaderboard} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
      {/* Toast */}
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

      {/* Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Console
        </Link>
        
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-500" />
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            LeaderboardOS
          </span>
        </div>

        <HelpModal {...leaderboardManagementHelp} />
      </header>

      {/* Main Board Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 mt-8">
        {/* Banner Details */}
        <div className="glass p-6 rounded-2xl border-white/5 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[50px] pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                {leaderboard?.competition_type}
              </span>
              <span className="text-xs text-neutral-500">•</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                {leaderboard?.visibility}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{leaderboard?.name}</h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">{leaderboard?.description || 'No description supplied.'}</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowEmbedModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" /> <span className="hidden md:inline">Embed</span>
            </button>
            <button
              onClick={copyPublicLink}
              className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <a
              href={`/leaderboards/${leaderboard?.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
            >
              Public View <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-neutral-850 p-1 bg-neutral-900/40 rounded-2xl border mb-8 overflow-x-auto custom-scrollbar">
          {(['overview', 'players', 'scores', 'settings', 'integrations'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-neutral-800 text-white shadow-md' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ==========================================
            TAB CONTENT: OVERVIEW
            ========================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass p-4 rounded-xl">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Players</span>
                <h3 className="text-xl font-bold mt-1">{members.length}</h3>
              </div>
              <div className="glass p-4 rounded-xl">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Current Leader</span>
                <h3 className="text-xl font-bold mt-1 text-violet-400 truncate max-w-[150px]">{getRankLeader()}</h3>
              </div>
              <div className="glass p-4 rounded-xl">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Season Status</span>
                <h3 className="text-xl font-bold mt-1 text-cyan-400 truncate max-w-[150px]">{getActiveSeasonName()}</h3>
              </div>
              <div className="glass p-4 rounded-xl">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Score Entries</span>
                <h3 className="text-xl font-bold mt-1 text-emerald-400">{activityLogs.length} Logged</h3>
              </div>
            </div>

            {/* Sharing Tools and Live Feed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* QR and Share box */}
              <div className="glass p-6 rounded-2xl flex flex-col items-center text-center">
                <QrCode className="w-5 h-5 text-violet-400 mb-3" />
                <h4 className="font-bold text-sm">QR Invitation Code</h4>
                <p className="text-[10px] text-neutral-400 mt-1 max-w-[180px]">Scan to view live rankings on mobile devices.</p>
                
                {/* QR Canvas Render */}
                <div className="mt-5 p-2 bg-white rounded-xl">
                  <canvas ref={qrCanvasRef} />
                </div>
              </div>

              {/* Activity Log Feed */}
              <div className="md:col-span-2 glass p-6 rounded-2xl flex flex-col justify-between h-[270px]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-violet-400" /> Recent Competition Feed
                    </h4>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase">Latest Actions First</span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto max-h-[170px] pr-1">
                    {activityLogs.length === 0 ? (
                      <div className="text-center text-neutral-500 text-xs py-8">
                        No score events recorded yet. Go to the Scores tab to award points!
                      </div>
                    ) : (
                      activityLogs.map((log) => (
                        <div key={log.id} className="text-xs p-2 rounded-lg bg-black/35 border border-white/5 flex items-start gap-2 justify-between">
                          <p className="text-neutral-300 leading-relaxed font-medium">{log.message}</p>
                          <span className="text-[9px] text-neutral-500 whitespace-nowrap pt-0.5">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB CONTENT: PLAYERS
            ========================================== */}
        {activeTab === 'players' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search players by name or team..."
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-neutral-900/60 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>

              <button
                onClick={() => {
                  setPlayerName('');
                  setPlayerEmail('');
                  setPlayerTeam('');
                  setPlayerNotes('');
                  setPlayerAvatarUrl('');
                  setShowAddPlayerModal(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Add New Player
              </button>
            </div>

            {/* Players Table */}
            <div className="glass rounded-2xl overflow-hidden shadow-xl border-white/5">
              <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                <thead className="bg-neutral-950/65 text-neutral-450 uppercase font-bold tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Player Details</th>
                    <th scope="col" className="px-6 py-3.5">Team Group</th>
                    <th scope="col" className="px-6 py-3.5">Notes</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-neutral-500">
                        {playerSearchQuery ? 'No players match your search filter.' : 'No competitors added yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.01] transition-all">
                        <td className="px-6 py-3.5 flex items-center gap-3">
                          <SafeImage
                            src={m.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(m.name)}`}
                            alt={m.name}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-lg border border-white/5 object-cover"
                          />
                          <div>
                            <span className="font-bold text-white block text-sm">{m.name}</span>
                            {m.email && <span className="text-[10px] text-neutral-500 block mt-0.5">{m.email}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-neutral-300 font-medium">
                          {m.team ? (
                            <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-850 font-semibold text-[10px]">
                              {m.team}
                            </span>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-neutral-400 italic max-w-[200px] truncate">
                          {m.notes || <span className="text-neutral-600 not-italic">-</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setPlayerName(m.name);
                              setPlayerEmail(m.email || '');
                              setPlayerTeam(m.team || '');
                              setPlayerNotes(m.notes || '');
                              setPlayerAvatarUrl(m.avatar_url || '');
                              setShowEditPlayerModal(m);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer inline-flex"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(m.id, m.name)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors cursor-pointer inline-flex"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PLAYER ADD/EDIT MODAL OVERLAYS */}
            {(showAddPlayerModal || showEditPlayerModal) && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="glass-premium max-w-md w-full p-6 rounded-2xl shadow-2xl relative border-white/10 glow-primary">
                  <h3 className="font-bold text-base text-white tracking-tight mb-4">
                    {showAddPlayerModal ? 'Register Competitor' : 'Edit Competitor Details'}
                  </h3>

                  <form onSubmit={showAddPlayerModal ? handleAddPlayer : handleEditPlayer} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Player Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={playerEmail}
                        onChange={(e) => setPlayerEmail(e.target.value)}
                        className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Team Group (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Team Rogue, Sales - NA"
                        value={playerTeam}
                        onChange={(e) => setPlayerTeam(e.target.value)}
                        className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Avatar Photo URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://example.com/avatar.png"
                        value={playerAvatarUrl}
                        onChange={(e) => setPlayerAvatarUrl(e.target.value)}
                        className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                      />
                      <div className="mt-2 space-y-2 rounded-lg border border-neutral-850 bg-black/25 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[11px] text-neutral-500">Or upload an avatar from this device and store it as a public Supabase asset.</p>
                          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-all hover:border-neutral-700 hover:text-white">
                            {avatarUploading ? 'Uploading...' : 'Choose image'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePlayerAvatarSelected}
                              className="hidden"
                              disabled={avatarUploading}
                            />
                          </label>
                        </div>

                        {playerAvatarUrl && (
                          <div className="flex items-center gap-3">
                            <div
                              className="h-14 w-14 rounded-xl border border-white/10 bg-cover bg-center"
                              style={{ backgroundImage: `url(${playerAvatarUrl})` }}
                            />
                            <p className="text-[11px] text-neutral-500">Preview of the avatar that will be saved for this player.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Competitor Notes</label>
                      <input
                        type="text"
                        placeholder="Brief bio or details..."
                        value={playerNotes}
                        onChange={(e) => setPlayerNotes(e.target.value)}
                        className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPlayerModal(false);
                          setShowEditPlayerModal(null);
                        }}
                        className="px-4 py-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-lg font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 font-semibold rounded-lg text-white transition-all cursor-pointer text-xs disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Register'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB CONTENT: SCORES
            ========================================== */}
        {activeTab === 'scores' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Award Form */}
            <div className="glass p-6 rounded-2xl h-fit shadow-xl">
              <h3 className="font-bold text-sm flex items-center gap-1.5 mb-4 text-white uppercase tracking-wider">
                <Award className="w-4 h-4 text-violet-400" /> Score Adjustment Console
              </h3>
              
              <form onSubmit={handleAwardScore} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Select Player</label>
                  {members.length === 0 ? (
                    <div className="p-2 border border-dashed border-neutral-850 rounded-lg text-neutral-500 text-center">
                      Register players in the Players tab first!
                    </div>
                  ) : (
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all text-xs cursor-pointer"
                    >
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} {m.team ? `(${m.team})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Select Scoring Event Rule</label>
                  <select
                    value={selectedRuleId}
                      onChange={(e) => handleRuleSelectionChange(e.target.value)}
                    className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all text-xs cursor-pointer"
                  >
                    <option value="custom">Custom Point Override</option>
                    {rules.map(r => (
                      <option key={r.id} value={r.id}>{r.event_name} ({r.points >= 0 ? `+${r.points}` : r.points})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Points Weight</label>
                    <input
                      type="number"
                      required
                      value={pointsAdjustment}
                      onChange={(e) => setPointsAdjustment(parseInt(e.target.value) || 0)}
                      className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Log Reason Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Won Match, Custom override"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="block w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || members.length === 0}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer glow-primary mt-4"
                >
                  {saving ? 'Adjusting score...' : 'Log Score Event'}
                </button>
              </form>
            </div>

            {/* Standings list preview */}
            <div className="md:col-span-2 glass p-6 rounded-2xl shadow-xl flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm flex items-center gap-1.5 text-white uppercase tracking-wider">
                  <Trophy className="w-4 h-4 text-violet-400" /> Current Leaderboard Rankings
                </h4>
                <span className="text-[10px] text-neutral-500 font-bold uppercase">Tie-breakers automatically solved</span>
              </div>

              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                {rankings.length === 0 ? (
                  <div className="text-center text-neutral-500 text-xs py-12">
                    No competitors logged scores yet. Award points to establish the rankings!
                  </div>
                ) : (
                  rankings.map((r, idx) => (
                    <div 
                      key={r.member_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-black/45 border border-white/5 text-xs hover:border-white/10 hover:bg-black/60 transition-all hover:translate-x-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          idx === 1 ? 'bg-neutral-300/20 text-neutral-300 border border-neutral-300/30' :
                          idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                          'bg-neutral-900 border border-neutral-850 text-neutral-500'
                        }`}>
                          {idx + 1}
                        </span>
                        
                        <SafeImage
                          src={r.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.player_name)}`}
                          alt={r.player_name}
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded border border-white/5 object-cover"
                        />
                        <div>
                          <span className="font-bold text-white block">{r.player_name}</span>
                          {r.team && <span className="text-[9px] text-neutral-500 font-bold mt-0.5">{r.team}</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold ${
                          idx === 0 ? 'text-violet-400' : 'text-white'
                        }`}>
                          {r.total_points.toLocaleString()} pts
                        </span>
                        <span className="block text-[8px] text-neutral-500 mt-0.5">
                          Score at: {new Date(r.last_score_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB CONTENT: SETTINGS
            ========================================== */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Settings */}
            <div className="md:col-span-2 glass p-6 rounded-2xl shadow-xl">
              <h3 className="font-bold text-sm mb-4 text-white uppercase tracking-wider">Configure General Properties</h3>
              
              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Competition Title Name</label>
                  <input
                    type="text"
                    required
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Description</label>
                  <textarea
                    rows={3}
                    value={settingsDesc}
                    onChange={(e) => setSettingsDesc(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Cover banner URL</label>
                    <input
                      type="text"
                      value={settingsCoverUrl}
                      onChange={(e) => setSettingsCoverUrl(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                    />
                    <div className="mt-2 space-y-2 rounded-xl border border-neutral-850 bg-black/25 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] text-neutral-500">Or upload a banner image from this device and save the public URL automatically.</p>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-all hover:border-neutral-700 hover:text-white">
                          {coverUploading ? 'Uploading...' : 'Choose image'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverImageSelected}
                            className="hidden"
                            disabled={coverUploading}
                          />
                        </label>
                      </div>

                      {settingsCoverUrl && (
                        <div className="overflow-hidden rounded-xl border border-white/5 bg-black/30">
                          <div
                            className="h-28 w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${settingsCoverUrl})` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide">Visibility Privacy</label>
                    <select
                      value={settingsVisibility}
                      onChange={(e) => setSettingsVisibility(e.target.value as 'public' | 'private')}
                      className="block w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all cursor-pointer"
                    >
                      <option value="public">Public (Everyone can see)</option>
                      <option value="private">Private (Invite only)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-violet-600 hover:bg-violet-500 font-semibold rounded-xl text-white text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Save Settings
                </button>
              </form>
            </div>

            {/* Danger Zones */}
            {isOwner && (
              <div className="glass p-6 rounded-2xl border-red-500/10 shadow-xl flex flex-col justify-between h-[250px]">
                <div>
                  <h3 className="font-bold text-sm text-red-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" /> Danger Zone
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Removing this leaderboard wipes out all database records, custom configurations, player profiles, scoring events, and log feeds. This action is irreversible.
                  </p>
                </div>

                <button
                  onClick={handleDeleteBoard}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 rounded-xl text-xs font-semibold text-red-300 hover:text-white transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete Leaderboard
                </button>
              </div>
            )}

            {/* Admins Management */}
            {isOwner && (
              <div className="md:col-span-2 glass p-6 rounded-2xl shadow-xl">
                <h3 className="font-bold text-sm mb-2 text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-violet-400" /> Authorized Leaderboard Admins
                </h3>
                <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed">
                  Explicitly grant administrative access to this leaderboard. Admins can adjust scores, edit player lists, and organize matches, but they cannot manage other admins, delete the leaderboard, or modify ownership.
                </p>

                <form onSubmit={handleAddAdmin} className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Enter user email (e.g. john@example.com)"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                  />
                  <button
                    type="submit"
                    disabled={addingAdmin}
                    className="flex items-center gap-1.5 px-4.5 py-2 bg-violet-600 hover:bg-violet-500 font-semibold rounded-xl text-white text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" /> Add Admin
                  </button>
                </form>

                <div className="mt-6 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {admins.length === 0 ? (
                    <p className="text-neutral-500 text-[11px] italic">No extra admins configured for this leaderboard.</p>
                  ) : (
                    admins.map((admin) => (
                      <div key={admin.user_id} className="flex justify-between items-center bg-black/35 border border-neutral-850/50 p-3 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <Crown className="w-4 h-4 text-amber-500/80" />
                          <div className="text-xs">
                            <span className="font-bold text-white block">{admin.profile?.full_name || 'Admin User'}</span>
                            <span className="text-neutral-400 text-[10px]">{admin.profile?.email}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdmin(admin.user_id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-lg transition-all cursor-pointer"
                          title="Remove Admin"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ==========================================
            TAB CONTENT: INTEGRATIONS
            ========================================== */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl border-white/5 shadow-xl">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Code className="w-5 h-5 text-violet-400" /> Embed Widget
              </h2>
              <p className="text-sm text-neutral-400 mb-6">
                Display this leaderboard on your own website, blog, or community portal.
              </p>
              
              <div className="bg-black/50 border border-neutral-800 p-4 rounded-xl mb-6 relative">
                <p className="text-[10px] text-neutral-500 mb-2 uppercase tracking-wider font-bold">Copy iframe code</p>
                <code className="text-[11px] text-neutral-300 font-mono break-all block w-full bg-transparent border-none p-0">
                  &lt;iframe src="{publicUrl ? publicUrl.replace('/leaderboards/', '/embed/') : ''}?theme=dark" width="100%" height="400" frameborder="0" style="border-radius: 12px; overflow: hidden; max-width: 600px; margin: 0 auto; display: block;"&gt;&lt;/iframe&gt;
                </code>
                <button
                  onClick={() => {
                    const host = typeof window !== 'undefined' ? window.location.origin : '';
                    const embedCode = `<iframe src="${host}/embed/${leaderboard?.slug}?theme=dark" width="100%" height="400" frameborder="0" style="border-radius: 12px; overflow: hidden; max-width: 600px; margin: 0 auto; display: block;"></iframe>`;
                    navigator.clipboard.writeText(embedCode);
                    setEmbedCopied(true);
                    setTimeout(() => setEmbedCopied(false), 2000);
                  }}
                  className="absolute top-4 right-4 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer glow-primary"
                >
                  {embedCopied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-violet-400 shrink-0" />
                <p className="text-xs text-violet-200 leading-relaxed">
                  <strong>Tip:</strong> You can append <code className="text-[10px] bg-black/40 px-1 py-0.5 rounded">?theme=light</code> to the URL in the iframe code if you want a light mode widget instead.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-premium border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full relative">
            <h3 className="text-lg font-bold mb-2">Embed Widget</h3>
            <p className="text-xs text-neutral-400 mb-6">Copy this code into your website's HTML to display a live leaderboard widget.</p>
            
            <div className="bg-black/50 border border-neutral-800 p-3 rounded-xl mb-6">
              <code className="text-[11px] text-neutral-300 font-mono break-all">
                &lt;iframe src="{publicUrl ? publicUrl.replace('/leaderboards/', '/embed/') : ''}?theme=dark" width="100%" height="400" frameborder="0" style="border-radius: 12px; overflow: hidden; max-width: 600px; margin: 0 auto; display: block;"&gt;&lt;/iframe&gt;
              </code>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowEmbedModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const host = typeof window !== 'undefined' ? window.location.origin : '';
                  const embedCode = `<iframe src="${host}/embed/${leaderboard?.slug}?theme=dark" width="100%" height="400" frameborder="0" style="border-radius: 12px; overflow: hidden; max-width: 600px; margin: 0 auto; display: block;"></iframe>`;
                  navigator.clipboard.writeText(embedCode);
                  setEmbedCopied(true);
                  setTimeout(() => setEmbedCopied(false), 2000);
                }}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer"
              >
                {embedCopied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
