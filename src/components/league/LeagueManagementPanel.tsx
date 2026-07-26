'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, Calendar, ImageUp, Plus, Save, Shield, Swords, Trophy, Upload, Users } from 'lucide-react';
import { DatabaseService } from '@/lib/db';
import { getCompetitionTemplate } from '@/lib/competition/templates';
import { LeagueService } from '@/lib/league/service';
import { CompetitionConfig, CompetitionStatistic, Fixture, Leaderboard, LeaderboardMember, LeagueSettings, LeagueStandingRow } from '@/types';
import SafeImage from '@/components/SafeImage';
import { uploadImageAsset } from '@/lib/image-upload';

type TabKey = 'overview' | 'standings' | 'fixtures' | 'teams' | 'settings';

interface LeagueManagementPanelProps {
  leaderboard: Leaderboard;
  competitionConfig: CompetitionConfig;
  onLeaderboardUpdated: (leaderboard: Leaderboard) => void;
}

function formatStatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.00$/, '');
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function LeagueManagementPanel({ leaderboard, competitionConfig, onLeaderboardUpdated }: LeagueManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [statistics, setStatistics] = useState<CompetitionStatistic[]>([]);
  const [standings, setStandings] = useState<LeagueStandingRow[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [recentResults, setRecentResults] = useState<Array<Awaited<ReturnType<typeof LeagueService.getRecentResults>>[number]>>([]);
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamGroup, setTeamGroup] = useState('');
  const [teamNotes, setTeamNotes] = useState('');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [teamLogoUploading, setTeamLogoUploading] = useState(false);
  const [teamLogoUpdatingId, setTeamLogoUpdatingId] = useState<string | null>(null);

  const [homeMemberId, setHomeMemberId] = useState('');
  const [awayMemberId, setAwayMemberId] = useState('');
  const [roundName, setRoundName] = useState('Matchday 1');
  const [scheduledAt, setScheduledAt] = useState('');

  const [settingsName, setSettingsName] = useState(leaderboard.name);
  const [settingsDescription, setSettingsDescription] = useState(leaderboard.description || '');
  const [settingsVisibility, setSettingsVisibility] = useState(leaderboard.visibility);
  const [settingsCover, setSettingsCover] = useState(leaderboard.cover_image_url || '');
  const [pointsForWin, setPointsForWin] = useState(3);
  const [pointsForDraw, setPointsForDraw] = useState(1);
  const [pointsForLoss, setPointsForLoss] = useState(0);
  const [seasonName, setSeasonName] = useState('Season 1');

  const template = useMemo(() => getCompetitionTemplate(competitionConfig.template_key), [competitionConfig.template_key]);
  const enabledColumns = useMemo(() => statistics.filter((item) => item.is_enabled).sort((a, b) => a.display_order - b.display_order), [statistics]);

  const loadLeagueData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMembers, nextStatistics, nextStandings, nextFixtures, nextRecentResults, nextLeagueSettings] = await Promise.all([
        DatabaseService.getMembers(leaderboard.id),
        LeagueService.getCompetitionStatistics(leaderboard.id),
        LeagueService.getLeagueStandings(leaderboard.id),
        LeagueService.getFixtures(leaderboard.id),
        LeagueService.getRecentResults(leaderboard.id),
        LeagueService.getLeagueSettings(leaderboard.id),
      ]);

      setMembers(nextMembers);
      setStatistics(nextStatistics);
      setStandings(nextStandings);
      setFixtures(nextFixtures);
      setRecentResults(nextRecentResults);
      setLeagueSettings(nextLeagueSettings);
      setHomeMemberId((current) => current || nextMembers[0]?.id || '');
      setAwayMemberId((current) => current || nextMembers[1]?.id || nextMembers[0]?.id || '');

      if (nextLeagueSettings) {
        setPointsForWin(nextLeagueSettings.points_for_win);
        setPointsForDraw(nextLeagueSettings.points_for_draw);
        setPointsForLoss(nextLeagueSettings.points_for_loss);
        setSeasonName(nextLeagueSettings.season_name);
      }
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to load league data.'));
    } finally {
      setLoading(false);
    }
  }, [leaderboard.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadLeagueData();
    });
  }, [loadLeagueData]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAddTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await DatabaseService.addMember(leaderboard.id, {
        name: teamName.trim(),
        email: teamEmail.trim() || null,
        team: teamGroup.trim() || null,
        notes: teamNotes.trim() || null,
        avatar_url: teamLogoUrl || null,
      });
      setTeamName('');
      setTeamEmail('');
      setTeamGroup('');
      setTeamNotes('');
      setTeamLogoUrl('');
      setToast(`${competitionConfig.entity_type === 'team' ? 'Team' : 'Competitor'} added.`);
      await loadLeagueData();
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to add entry.'));
    } finally {
      setSaving(false);
    }
  };

  const handleTeamLogoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setTeamLogoUploading(true);
    try {
      const uploadedImage = await uploadImageAsset(file, 'player-avatar');
      setTeamLogoUrl(uploadedImage);
      setToast(`${competitionConfig.entity_type === 'team' ? 'Team' : 'Competitor'} logo uploaded.`);
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to upload logo.'));
    } finally {
      setTeamLogoUploading(false);
    }
  };

  const handleExistingTeamLogoSelected = async (member: LeaderboardMember, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setTeamLogoUpdatingId(member.id);
    try {
      const uploadedImage = await uploadImageAsset(file, 'player-avatar');
      await DatabaseService.updateMember(member.id, { avatar_url: uploadedImage });
      setToast(`${member.name} logo updated.`);
      await loadLeagueData();
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to update logo.'));
    } finally {
      setTeamLogoUpdatingId(null);
    }
  };

  const handleCreateFixture = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!homeMemberId || !awayMemberId || homeMemberId === awayMemberId) {
      setToast('Choose two different competitors for the fixture.');
      return;
    }

    setSaving(true);
    try {
      await LeagueService.saveFixture({
        leaderboardId: leaderboard.id,
        homeMemberId,
        awayMemberId,
        roundName: roundName.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        status: 'scheduled',
      });
      setToast('Fixture scheduled.');
      await loadLeagueData();
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to schedule fixture.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResult = async (fixtureId: string, homeScore: number, awayScore: number) => {
    setSaving(true);
    try {
      await LeagueService.saveFixtureResult({ fixtureId, homeScore, awayScore });
      setToast('Result saved and standings recalculated.');
      await loadLeagueData();
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
      const updatedLeaderboard = await DatabaseService.updateLeaderboard(leaderboard.id, {
        name: settingsName.trim(),
        description: settingsDescription.trim() || null,
        visibility: settingsVisibility,
        cover_image_url: settingsCover.trim() || null,
      });

      await LeagueService.updateLeagueSettings(leaderboard.id, {
        season_name: seasonName.trim() || 'Season 1',
        points_for_win: pointsForWin,
        points_for_draw: pointsForDraw,
        points_for_loss: pointsForLoss,
      });

      onLeaderboardUpdated(updatedLeaderboard);
      setToast('League settings saved.');
      await loadLeagueData();
    } catch (error) {
      setToast(getErrorMessage(error, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-2xl p-8 text-sm text-neutral-400">Loading league console...</div>;
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
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Format</div>
          <div className="mt-2 text-lg font-bold text-white">{template.label}</div>
          <div className="mt-1 text-xs text-neutral-400">{competitionConfig.entity_type === 'team' ? 'Team league' : 'Individual ladder'}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Entries</div>
          <div className="mt-2 text-lg font-bold text-white">{members.length}</div>
          <div className="mt-1 text-xs text-neutral-400">Active clubs or competitors</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Fixtures</div>
          <div className="mt-2 text-lg font-bold text-white">{fixtures.length}</div>
          <div className="mt-1 text-xs text-neutral-400">{fixtures.filter((item) => item.status === 'completed').length} completed</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Leader</div>
          <div className="mt-2 text-lg font-bold text-white">{standings[0]?.name || 'No table yet'}</div>
          <div className="mt-1 text-xs text-neutral-400">{leagueSettings?.season_name || 'League season'}</div>
        </div>
      </div>

      <div className="flex max-w-2xl gap-2 rounded-2xl border border-neutral-850 bg-neutral-900/40 p-1">
        {(['overview', 'standings', 'fixtures', 'teams', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold capitalize transition-all ${
              activeTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy className="h-4 w-4 text-violet-400" /> Current Table Snapshot
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-white/5 text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Pos</th>
                    <th className="py-2 pr-3">Name</th>
                    {enabledColumns.slice(0, 5).map((column) => (
                      <th key={column.id} className="py-2 pr-3">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 6).map((row) => (
                    <tr key={row.member_id} className="border-b border-white/5">
                      <td className="py-3 pr-3 font-bold text-violet-300">{row.position}</td>
                      <td className="py-3 pr-3 font-semibold text-white">{row.name}</td>
                      {enabledColumns.slice(0, 5).map((column) => (
                        <td key={column.id} className="py-3 pr-3 text-neutral-300">{formatStatValue(row.stats[column.statistic_key] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Shield className="h-4 w-4 text-emerald-400" /> League Rules
              </div>
              <div className="mt-4 space-y-2 text-xs text-neutral-300">
                <div>Win: <span className="font-bold text-white">{pointsForWin}</span></div>
                <div>Draw: <span className="font-bold text-white">{pointsForDraw}</span></div>
                <div>Loss: <span className="font-bold text-white">{pointsForLoss}</span></div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Activity className="h-4 w-4 text-cyan-400" /> Recent Results
              </div>
              <div className="mt-4 space-y-3 text-xs">
                {recentResults.length === 0 ? (
                  <div className="text-neutral-500">No results recorded yet.</div>
                ) : (
                  recentResults.slice(0, 5).map((item) => (
                    <div key={item.fixture.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                      <div className="font-semibold text-white">{item.homeMember?.name} {item.result?.home_score} - {item.result?.away_score} {item.awayMember?.name}</div>
                      <div className="mt-1 text-[11px] text-neutral-500">{item.fixture.round_name || 'Fixture'} </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="glass overflow-x-auto rounded-2xl border border-white/5">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-neutral-950/65 text-neutral-500">
              <tr>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">{competitionConfig.entity_type === 'team' ? 'Team' : 'Competitor'}</th>
                {enabledColumns.map((column) => (
                  <th key={column.id} className="px-4 py-3">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.member_id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-bold text-violet-300">{row.position}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={row.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(row.name)}`}
                        alt={row.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-lg border border-white/5 object-cover"
                      />
                      <div>
                        <div className="font-semibold text-white">{row.name}</div>
                        {row.team && <div className="text-[11px] text-neutral-500">{row.team}</div>}
                      </div>
                    </div>
                  </td>
                  {enabledColumns.map((column) => (
                    <td key={column.id} className="px-4 py-3 text-neutral-300">{formatStatValue(row.stats[column.statistic_key] || 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'fixtures' && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleCreateFixture} className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Swords className="h-4 w-4 text-violet-400" /> Schedule Fixture
            </div>
            <select value={homeMemberId} onChange={(event) => setHomeMemberId(event.target.value)} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white">
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <select value={awayMemberId} onChange={(event) => setAwayMemberId(event.target.value)} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white">
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input value={roundName} onChange={(event) => setRoundName(event.target.value)} placeholder="Round name" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Add fixture
            </button>
          </form>

          <div className="space-y-4">
            {fixtures.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-neutral-500">No fixtures scheduled yet.</div>
            ) : (
              fixtures.map((fixture) => {
                const home = members.find((member) => member.id === fixture.home_member_id);
                const away = members.find((member) => member.id === fixture.away_member_id);
                const existingResult = recentResults.find((item) => item.fixture.id === fixture.id)?.result;

                return (
                  <FixtureCard
                    key={`${fixture.id}-${existingResult?.home_score ?? 'x'}-${existingResult?.away_score ?? 'x'}`}
                    fixture={fixture}
                    homeName={home?.name || 'Home'}
                    awayName={away?.name || 'Away'}
                    existingResult={existingResult || null}
                    onSaveResult={handleSaveResult}
                    disabled={saving}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleAddTeam} className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-violet-400" /> Add {competitionConfig.entity_type === 'team' ? 'Team' : 'Competitor'}
            </div>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder={competitionConfig.entity_type === 'team' ? 'Team name' : 'Competitor name'} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} placeholder="Contact email (optional)" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input value={teamGroup} onChange={(event) => setTeamGroup(event.target.value)} placeholder="Division or conference" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <textarea value={teamNotes} onChange={(event) => setTeamNotes(event.target.value)} rows={3} placeholder="Notes" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <div className="rounded-xl border border-neutral-850 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{competitionConfig.entity_type === 'team' ? 'Team logo' : 'Competitor image'}</div>
                  <div className="mt-1 text-[11px] text-neutral-500">Upload a JPG, PNG, or WebP image up to 2 MB.</div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-neutral-700 hover:text-white">
                  <ImageUp className="h-4 w-4" /> {teamLogoUploading ? 'Uploading...' : 'Upload logo'}
                  <input type="file" accept="image/*" onChange={handleTeamLogoSelected} className="hidden" disabled={teamLogoUploading} />
                </label>
              </div>
              {teamLogoUrl && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-neutral-950/50 p-3">
                  <SafeImage src={teamLogoUrl} alt="Selected team logo" width={48} height={48} className="h-12 w-12 rounded-xl border border-white/5 object-cover" />
                  <div className="text-xs text-neutral-400">Logo ready to save with this {competitionConfig.entity_type === 'team' ? 'team' : 'competitor'}.</div>
                </div>
              )}
            </div>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Save
            </button>
          </form>

          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-cyan-400" /> Registered {competitionConfig.entity_type === 'team' ? 'Teams' : 'Competitors'}
            </div>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={member.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(member.name)}`}
                      alt={member.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-lg border border-white/5 object-cover"
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">{member.name}</div>
                      <div className="text-[11px] text-neutral-500">{member.team || 'No group assigned'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[11px] text-neutral-500">{member.email || 'No email'}</div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:border-neutral-700 hover:text-white">
                      <Upload className="h-3.5 w-3.5" /> {teamLogoUpdatingId === member.id ? 'Uploading...' : 'Change logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={teamLogoUpdatingId === member.id}
                        onChange={(event) => {
                          void handleExistingTeamLogoSelected(member, event);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="glass rounded-2xl p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input value={settingsName} onChange={(event) => setSettingsName(event.target.value)} placeholder="League name" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} placeholder="Season name" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <select value={settingsVisibility} onChange={(event) => setSettingsVisibility(event.target.value as Leaderboard['visibility'])} className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <input value={settingsCover} onChange={(event) => setSettingsCover(event.target.value)} placeholder="Cover image URL" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={settingsDescription} onChange={(event) => setSettingsDescription(event.target.value)} rows={4} placeholder="Description" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />

          <div className="grid gap-4 md:grid-cols-3">
            <input type="number" value={pointsForWin} onChange={(event) => setPointsForWin(Number(event.target.value) || 0)} placeholder="Points for win" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input type="number" value={pointsForDraw} onChange={(event) => setPointsForDraw(Number(event.target.value) || 0)} placeholder="Points for draw" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
            <input type="number" value={pointsForLoss} onChange={(event) => setPointsForLoss(Number(event.target.value) || 0)} placeholder="Points for loss" className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
          </div>

          <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-neutral-300">
            <div className="font-bold text-white">Ranking criteria</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {template.ranking_rules.map((rule, index) => (
                <span key={`${rule.label}-${index}`} className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200">
                  {index + 1}. {rule.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href={`/leaderboards/${leaderboard.slug}`} target="_blank" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
              <ArrowUpRight className="h-4 w-4" /> Open public league page
            </Link>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> Save settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface FixtureCardProps {
  fixture: Fixture;
  homeName: string;
  awayName: string;
  existingResult: { home_score: number; away_score: number } | null;
  onSaveResult: (fixtureId: string, homeScore: number, awayScore: number) => Promise<void>;
  disabled: boolean;
}

function FixtureCard({ fixture, homeName, awayName, existingResult, onSaveResult, disabled }: FixtureCardProps) {
  const [homeScore, setHomeScore] = useState(existingResult?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(existingResult?.away_score ?? 0);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{homeName} vs {awayName}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
            <Calendar className="h-3.5 w-3.5" />
            {fixture.scheduled_at ? new Date(fixture.scheduled_at).toLocaleString() : 'No kickoff scheduled'}
          </div>
        </div>
        <div className="rounded-lg border border-white/5 px-2 py-1 text-[11px] uppercase tracking-widest text-neutral-400">
          {fixture.status}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="number" value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value) || 0)} className="w-20 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
        <span className="text-sm font-bold text-white">-</span>
        <input type="number" value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value) || 0)} className="w-20 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-white" />
        <button type="button" disabled={disabled} onClick={() => void onSaveResult(fixture.id, homeScore, awayScore)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Save result
        </button>
      </div>
    </div>
  );
}