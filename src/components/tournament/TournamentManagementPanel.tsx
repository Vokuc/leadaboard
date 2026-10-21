'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  Crown,
  Plus,
  Save,
  Shuffle,
  Trophy,
  Users,
  Code,
  AlertCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Workflow,
  Loader2,
} from 'lucide-react';
import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { TournamentService } from '@/lib/tournament/service';
import { CompetitionPathwayService } from '@/lib/competition/pathway/service';
import { CompetitionLifecycleService } from '@/lib/competition/lifecycle/service';
import {
  CompetitionConfig,
  Leaderboard,
  LeaderboardMember,
  TournamentBracketView,
  TournamentSeedingMode,
  TournamentState,
  Team,
  QualificationPreview,
  PathwayTieHandling,
} from '@/types';
import { TeamRosterManagement } from '@/components/teams/TeamRosterManagement';
import { CompetitionSchedulerPanel } from '@/components/competition/scheduling/CompetitionSchedulerPanel';
import { RegistrationManagementPanel } from '@/components/competition/registration/RegistrationManagementPanel';
import { EventDayControlPanel } from '@/components/competition/event-day/EventDayControlPanel';

interface TournamentManagementPanelProps {
  leaderboard: Leaderboard;
  competitionConfig: CompetitionConfig;
  onLeaderboardUpdated: (leaderboard: Leaderboard) => void;
}

type TabKey = 'overview' | 'bracket' | 'matches' | 'schedule' | 'event_day' | 'registrations' | 'participants' | 'teams' | 'settings' | 'integrations';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function TournamentManagementPanel({
  leaderboard,
  competitionConfig,
  onLeaderboardUpdated,
}: TournamentManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bracketView, setBracketView] = useState<TournamentBracketView | null>(null);
  const [recentResults, setRecentResults] = useState<Array<Awaited<ReturnType<typeof TournamentService.getRecentResults>>[number]>>([]);
  const [embedCopied, setEmbedCopied] = useState(false);

  const [settingsName, setSettingsName] = useState(leaderboard.name);
  const [settingsDescription, setSettingsDescription] = useState(leaderboard.description || '');
  const [settingsVisibility, setSettingsVisibility] = useState(leaderboard.visibility);
  const [settingsCover, setSettingsCover] = useState(leaderboard.cover_image_url || '');

  const [stateSelection, setStateSelection] = useState<TournamentState>('draft');
  const [bracketSizeSelection, setBracketSizeSelection] = useState(8);
  const [seedingSelection, setSeedingSelection] = useState<TournamentSeedingMode>('random');
  const [availableLeagues, setAvailableLeagues] = useState<Leaderboard[]>([]);
  const [sourceLeagueId, setSourceLeagueId] = useState<string>('');
  const [tieHandlingSelection, setTieHandlingSelection] = useState<PathwayTieHandling>('standard_rules');
  const [qualifierCountSelection, setQualifierCountSelection] = useState<number>(8);
  const [qualificationPreview, setQualificationPreview] = useState<QualificationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberTeam, setNewMemberTeam] = useState('');

  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { home: number; away: number }>>({});

  const loadTournamentData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const [nextMembers, nextBracketView, nextRecentResults, allLeaderboards, nextTeams] = await Promise.all([
        DatabaseService.getMembers(leaderboard.id),
        TournamentService.getBracketView(leaderboard.id),
        TournamentService.getRecentResults(leaderboard.id),
        DatabaseService.getLeaderboards(),
        DatabaseService.getTeams(leaderboard.id),
      ]);

      setMembers(nextMembers);
      setTeams(nextTeams);
      setBracketView(nextBracketView);
      setRecentResults(nextRecentResults);
      const otherLbs = allLeaderboards.filter((lb) => lb.id !== leaderboard.id);
      setAvailableLeagues(otherLbs);
      if (otherLbs.length > 0) {
        setSourceLeagueId((current) => current || otherLbs[0].id);
      }

      if (nextBracketView) {
        setStateSelection(nextBracketView.tournament.state);
        setBracketSizeSelection(nextBracketView.tournament.bracket_size);
        setSeedingSelection(nextBracketView.tournament.seeding_mode);
      }
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to load tournament data.'));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [leaderboard.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTournamentData();
    });
  }, [loadTournamentData]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!leaderboard.id) {
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`tournament:${leaderboard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_matches', filter: `leaderboard_id=eq.${leaderboard.id}` },
          () => {
            void loadTournamentData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_match_results' },
          () => {
            void loadTournamentData(true);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('leaderboardos_')) {
        void loadTournamentData(true);
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    const interval = window.setInterval(() => {
      void loadTournamentData(true);
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.clearInterval(interval);
    };
  }, [leaderboard.id, loadTournamentData]);

  const rounds = useMemo(() => bracketView?.rounds || [], [bracketView]);
  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);

  const getScoreDraft = (matchId: string, homeFallback = 0, awayFallback = 0) => {
    return scoreDrafts[matchId] || { home: homeFallback, away: awayFallback };
  };

  const updateScoreDraft = (matchId: string, home: number, away: number) => {
    setScoreDrafts((current) => ({
      ...current,
      [matchId]: { home, away },
    }));
  };

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMemberName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await DatabaseService.addMember(leaderboard.id, {
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || null,
        team: newMemberTeam.trim() || null,
        notes: null,
        avatar_url: null,
      });

      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberTeam('');
      setToast('Participant added.');
      await loadTournamentData(true);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to add participant.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBracket = async () => {
    setSaving(true);
    try {
      await TournamentService.generateBracket({
        leaderboardId: leaderboard.id,
        bracketSize: bracketSizeSelection,
        seedingMode: seedingSelection,
        sourceLeagueId: seedingSelection === 'league_standings' ? sourceLeagueId : undefined,
      });
      await CompetitionLifecycleService.updateOperationalStatus({
        leaderboardId: leaderboard.id,
        targetStatus: 'in_progress',
        reason: 'Bracket generated',
      });
      setToast('Bracket generated. BYEs auto-advanced where applicable.');
      await loadTournamentData(true);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to generate bracket.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewQualification = async () => {
    if (!sourceLeagueId) return;
    setPreviewing(true);
    try {
      const preview = await CompetitionPathwayService.previewQualification({
        sourceLeaderboardId: sourceLeagueId,
        destinationLeaderboardId: leaderboard.id,
        qualifierCount: qualifierCountSelection || bracketSizeSelection,
        tieHandling: tieHandlingSelection,
      });
      setQualificationPreview(preview);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to preview qualification.'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommitPathway = async () => {
    if (!sourceLeagueId) return;
    setCommitting(true);
    try {
      await CompetitionPathwayService.commitQualification({
        sourceLeaderboardId: sourceLeagueId,
        destinationLeaderboardId: leaderboard.id,
        qualifierCount: qualifierCountSelection || bracketSizeSelection,
        tieHandling: tieHandlingSelection,
        forceReset: true,
      });
      setToast('Qualification pathway committed. Bracket successfully generated!');
      setQualificationPreview(null);
      await loadTournamentData(true);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to commit qualification pathway.'));
    } finally {
      setCommitting(false);
    }
  };

  const handleSaveResult = async (matchId: string) => {
    const draft = scoreDrafts[matchId];
    if (!draft) {
      return;
    }

    setSaving(true);
    try {
      await TournamentService.saveMatchResult({
        matchId,
        homeScore: draft.home,
        awayScore: draft.away,
      });
      setToast('Result saved. Winner auto-advanced.');
      await loadTournamentData(true);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to save result.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await DatabaseService.updateLeaderboard(leaderboard.id, {
        name: settingsName.trim(),
        description: settingsDescription.trim() || null,
        visibility: settingsVisibility,
        cover_image_url: settingsCover.trim() || null,
      });

      await TournamentService.updateTournamentState(leaderboard.id, stateSelection);
      onLeaderboardUpdated(updated);
      setToast('Tournament settings saved.');
      await loadTournamentData(true);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-2xl p-8 text-sm text-neutral-400">Loading tournament console...</div>;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          {toast}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Engine</div>
          <div className="mt-2 text-lg font-bold text-white">Tournament</div>
          <div className="mt-1 text-xs text-neutral-400">Single elimination bracket</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Participants</div>
          <div className="mt-2 text-lg font-bold text-white">{members.length}</div>
          <div className="mt-1 text-xs text-neutral-400">Registered competitors</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Matches</div>
          <div className="mt-2 text-lg font-bold text-white">{allMatches.length}</div>
          <div className="mt-1 text-xs text-neutral-400">{allMatches.filter((item) => item.match.state === 'completed').length} completed</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Champion</div>
          <div className="mt-2 text-lg font-bold text-white">{bracketView?.champion?.name || 'TBD'}</div>
          <div className="mt-1 text-xs text-neutral-400">{bracketView?.tournament.state || 'draft'}</div>
        </div>
      </div>

      <div className="flex max-w-4xl gap-2 rounded-2xl border border-neutral-850 bg-neutral-900/40 p-1 overflow-x-auto custom-scrollbar">
        {(['overview', 'bracket', 'matches', 'schedule', 'event_day', 'registrations', 'participants', 'teams', 'settings', 'integrations'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold capitalize transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab === 'event_day' ? 'Event Day ⚡' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy className="h-4 w-4 text-violet-400" /> Bracket Snapshot
            </div>
            <div className="mt-4 space-y-3 text-xs">
              {rounds.length === 0 ? (
                <div className="text-neutral-500">No bracket generated yet. Add participants and generate a bracket.</div>
              ) : (
                rounds.map((round) => (
                  <div key={round.round.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                    <div className="font-semibold text-white">{round.round.round_name}</div>
                    <div className="mt-1 text-neutral-400">{round.matches.length} matches</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Shuffle className="h-4 w-4 text-cyan-400" /> Bracket Generation
              </div>
              <div className="mt-4 space-y-3">
                <select
                  value={bracketSizeSelection}
                  onChange={(event) => setBracketSizeSelection(Number(event.target.value) || 8)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white"
                >
                  {[2, 4, 8, 16, 32, 64, 128].map((size) => (
                    <option key={size} value={size}>{size} slots</option>
                  ))}
                </select>
                <select
                  value={seedingSelection}
                  onChange={(event) => setSeedingSelection(event.target.value as TournamentSeedingMode)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white"
                >
                  <option value="random">Random seeding</option>
                  <option value="manual">Manual seeding</option>
                  <option value="league_standings">Seed from existing league standings</option>
                </select>

                {seedingSelection === 'league_standings' && (
                  <div className="space-y-3 pt-1 border-t border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-neutral-400">Source League</label>
                      {availableLeagues.length === 0 ? (
                        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                          No other leagues available to seed from.
                        </div>
                      ) : (
                        <select
                          value={sourceLeagueId}
                          onChange={(event) => {
                            setSourceLeagueId(event.target.value);
                            setQualificationPreview(null);
                          }}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white"
                        >
                          {availableLeagues.map((lb) => (
                            <option key={lb.id} value={lb.id}>
                              {lb.name} ({lb.competition_type})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-400">Qualifiers Count</label>
                        <select
                          value={qualifierCountSelection}
                          onChange={(e) => {
                            setQualifierCountSelection(Number(e.target.value));
                            setQualificationPreview(null);
                          }}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5 text-xs text-white"
                        >
                          {[2, 4, 8, 16, 32].map((num) => (
                            <option key={num} value={num}>{num} Qualifiers</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-400">Cutoff Tie Handling</label>
                        <select
                          value={tieHandlingSelection}
                          onChange={(e) => {
                            setTieHandlingSelection(e.target.value as PathwayTieHandling);
                            setQualificationPreview(null);
                          }}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="standard_rules">Standard Rules</option>
                          <option value="manual_approval">Manual Approval</option>
                          <option value="random">Random Draw</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={previewing || !sourceLeagueId}
                        onClick={() => void handlePreviewQualification()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/20 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                      >
                        {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        Preview Qualifiers
                      </button>

                      <button
                        type="button"
                        disabled={committing || !sourceLeagueId || (qualificationPreview !== null && !qualificationPreview.canCommit)}
                        onClick={() => void handleCommitPathway()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Commit Pathway
                      </button>
                    </div>

                    {/* Preview Results Box */}
                    {qualificationPreview && (
                      <div className="mt-3 p-3 rounded-xl border border-violet-500/30 bg-neutral-950/80 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-violet-300">
                          <span className="flex items-center gap-1.5">
                            <Workflow className="h-3.5 w-3.5" /> Qualification Preview
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {qualificationPreview.qualifiers.length} Qualified
                          </span>
                        </div>

                        {qualificationPreview.warnings.length > 0 && (
                          <div className="space-y-1">
                            {qualificationPreview.warnings.map((w, widx) => (
                              <div key={widx} className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1 text-xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Qualifiers (Ranked Seeds)</div>
                          <div className="max-h-36 overflow-y-auto space-y-1">
                            {qualificationPreview.qualifiers.map((q) => (
                              <div key={q.memberId} className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-900 border border-white/5 text-[11px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-violet-400 font-bold">#{q.seedIndex}</span>
                                  <span className="text-white font-medium">{q.name}</span>
                                  {q.team && <span className="text-neutral-500 text-[10px]">({q.team})</span>}
                                </div>
                                <span className="text-neutral-400 font-mono">{q.points} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Round 1 Matchup Preview</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {qualificationPreview.bracketPlacementPreview.map((m) => (
                              <div key={m.matchIndex} className="p-1.5 rounded-lg bg-neutral-900 border border-white/5 text-[10px]">
                                <span className="font-bold text-neutral-400">M{m.matchIndex}: </span>
                                <span className="text-emerald-400 font-semibold">{m.homeParticipantName}</span>
                                <span className="text-neutral-500"> vs </span>
                                <span className="text-amber-400 font-semibold">{m.awayParticipantName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {seedingSelection !== 'league_standings' && (
                  <button
                    type="button"
                    disabled={saving || members.length < 2}
                    onClick={() => void handleGenerateBracket()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Shuffle className="h-4 w-4" /> Generate bracket
                  </button>
                )}
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Activity className="h-4 w-4 text-emerald-400" /> Recent Results
              </div>
              <div className="mt-4 space-y-3 text-xs">
                {recentResults.length === 0 ? (
                  <div className="text-neutral-500">No completed matches yet.</div>
                ) : (
                  recentResults.slice(0, 5).map((item) => (
                    <div key={item.match.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                      <div className="font-semibold text-white">{item.homeMember?.name} {item.result.home_score} - {item.result.away_score} {item.awayMember?.name}</div>
                      <div className="mt-1 text-[11px] text-neutral-500">Round {item.match.round_index}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bracket' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rounds.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-sm text-neutral-500">No bracket generated yet.</div>
          ) : (
            rounds.map((round) => (
              <div key={round.round.id} className="glass rounded-2xl p-5">
                <div className="mb-3 text-sm font-bold text-white">{round.round.round_name}</div>
                <div className="space-y-3 text-xs">
                  {round.matches.map((node) => {
                    const result = node.result;
                    return (
                      <div key={node.match.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                        <div className="font-semibold text-white">{node.homeMember?.name || 'TBD'} vs {node.awayMember?.name || 'TBD'}</div>
                        <div className="mt-1 text-neutral-400">State: {node.match.state}</div>
                        <div className="mt-1 text-neutral-400">{result ? `${result.home_score} - ${result.away_score}` : 'No result yet'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-4">
          {allMatches.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-sm text-neutral-500">Generate a bracket to manage matches.</div>
          ) : (
            allMatches.map((node) => {
              const result = node.result;
              const draft = getScoreDraft(node.match.id, result?.home_score || 0, result?.away_score || 0);
              const canSave = !!node.homeMember && !!node.awayMember && node.match.state !== 'bye' && node.match.state !== 'cancelled';

              return (
                <div key={node.match.id} className="glass rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{node.homeMember?.name || 'TBD'} vs {node.awayMember?.name || 'TBD'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                        {node.match.scheduled_at && (
                          <span className="flex items-center gap-1.5 text-neutral-300">
                            <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                            {new Date(node.match.scheduled_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {node.match.venue_name && (
                          <span className="text-emerald-400 font-medium">
                            • {node.match.venue_name} {node.match.court_field ? `(${node.match.court_field})` : ''}
                          </span>
                        )}
                        <span className="text-neutral-500">• Round {node.match.round_index}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {node.match.scheduling_status && node.match.scheduling_status !== 'unscheduled' && (
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            node.match.scheduling_status === 'scheduled'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              : node.match.scheduling_status === 'conflict'
                              ? 'border-red-500/20 bg-red-500/10 text-red-400'
                              : node.match.scheduling_status === 'rescheduled'
                              ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                              : 'border-neutral-700 bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {node.match.scheduling_status}
                        </span>
                      )}
                      <div className="rounded-lg border border-white/5 px-2 py-1 text-[11px] uppercase tracking-widest text-neutral-400">{node.match.state}</div>
                    </div>
                  </div>

                  {node.match.scheduling_status === 'conflict' && node.match.conflict_reason && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-2 text-xs text-red-300">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                      <span>{node.match.conflict_reason}</span>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                    <input
                      type="number"
                      value={draft.home}
                      onChange={(event) => updateScoreDraft(node.match.id, Number(event.target.value) || 0, draft.away)}
                      className="w-20 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white"
                    />
                    <span className="text-sm font-bold text-white">-</span>
                    <input
                      type="number"
                      value={draft.away}
                      onChange={(event) => updateScoreDraft(node.match.id, draft.home, Number(event.target.value) || 0)}
                      className="w-20 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={saving || !canSave}
                      onClick={() => void handleSaveResult(node.match.id)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Save result
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <CompetitionSchedulerPanel
          leaderboard={leaderboard}
          engine="tournament"
          members={members}
          onScheduleCommitted={() => void loadTournamentData(true)}
        />
      )}

      {activeTab === 'event_day' && (
        <EventDayControlPanel
          leaderboard={leaderboard}
          competitionConfig={competitionConfig}
        />
      )}

      {activeTab === 'registrations' && (
        <RegistrationManagementPanel
          leaderboard={leaderboard}
          members={members}
          teams={teams}
          onMembersUpdated={() => void loadTournamentData(true)}
        />
      )}

      {activeTab === 'participants' && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleCreateMember} className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-violet-400" /> Add Participant
            </div>
            <input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="Participant name" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input value={newMemberEmail} onChange={(event) => setNewMemberEmail(event.target.value)} placeholder="Contact email (optional)" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input 
              value={newMemberTeam} 
              onChange={(event) => setNewMemberTeam(event.target.value)} 
              list="tournament-teams-datalist"
              placeholder="Team or group (select or type new)" 
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" 
            />
            <datalist id="tournament-teams-datalist">
              {teams.map((t) => (
                <option key={t.id} value={t.name}>{t.short_code ? `[${t.short_code}]` : ''}</option>
              ))}
            </datalist>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Save
            </button>
          </form>

          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-cyan-400" /> Registered Participants
            </div>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{member.name}</div>
                    <div className="text-[11px] text-neutral-500">{member.team || 'No group assigned'}</div>
                  </div>
                  <div className="text-[11px] text-neutral-500">{member.email || 'No email'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <TeamRosterManagement
          leaderboardId={leaderboard.id}
          onChanged={() => void loadTournamentData(true)}
        />
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="glass rounded-2xl p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input value={settingsName} onChange={(event) => setSettingsName(event.target.value)} placeholder="Tournament name" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input value={settingsCover} onChange={(event) => setSettingsCover(event.target.value)} placeholder="Cover image URL" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <select value={settingsVisibility} onChange={(event) => setSettingsVisibility(event.target.value as Leaderboard['visibility'])} className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <select value={stateSelection} onChange={(event) => setStateSelection(event.target.value as TournamentState)} className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white">
              <option value="draft">Draft</option>
              <option value="registration_open">Registration Open</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <textarea value={settingsDescription} onChange={(event) => setSettingsDescription(event.target.value)} rows={4} placeholder="Description" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />

          <div className="flex items-center justify-between">
            <Link href={`/leaderboards/${leaderboard.slug}`} target="_blank" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
              <ArrowUpRight className="h-4 w-4" /> Open public tournament page
            </Link>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> Save settings
            </button>
          </div>
        </form>
      )}

      {activeTab === 'integrations' && (
        <div className="glass p-6 rounded-2xl border-white/5 shadow-xl">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Code className="w-5 h-5 text-violet-400" /> Embed Widget
          </h2>
          <p className="text-sm text-neutral-400 mb-6">
            Display this tournament bracket on your own website, blog, or community portal.
          </p>
          
          <div className="bg-black/50 border border-neutral-800 p-4 rounded-xl mb-6 relative">
            <p className="text-[10px] text-neutral-500 mb-2 uppercase tracking-wider font-bold">Copy iframe code</p>
            <code className="text-[11px] text-neutral-300 font-mono break-all block w-full bg-transparent border-none p-0">
              {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${leaderboard?.slug}?theme=dark" width="100%" height="400" frameborder="0" style="border-radius: 12px; overflow: hidden; max-width: 600px; margin: 0 auto; display: block;"></iframe>`}
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
      )}

    {bracketView?.champion && (
        <div className="glass rounded-2xl p-4 text-sm text-amber-200 border border-amber-500/20 bg-amber-500/10">
          <div className="flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4" /> Champion: {bracketView.champion.name}
          </div>
        </div>
      )}

      <div className="text-[11px] text-neutral-500">
        Template: {competitionConfig.template_key} · Match updates propagate automatically with realtime subscriptions.
      </div>
    </div>
  );
}
