'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronRight, 
  Crown, 
  Shield, 
  Shirt, 
  UserPlus, 
  RefreshCw, 
  Search, 
  X,
  Upload,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { DatabaseService, generateShortCode } from '@/lib/db';
import { uploadImageAsset } from '@/lib/image-upload';
import { 
  Team, 
  TeamWithRoster, 
  TeamRosterRole, 
  LeaderboardMember 
} from '@/types';

interface TeamRosterManagementProps {
  leaderboardId: string;
  onChanged?: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function TeamRosterManagement({ leaderboardId, onChanged }: TeamRosterManagementProps) {
  const [teamsWithRosters, setTeamsWithRosters] = useState<TeamWithRoster[]>([]);
  const [allMembers, setAllMembers] = useState<LeaderboardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamShortCode, setTeamShortCode] = useState('');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Add Roster Member States
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [rosterRole, setRosterRole] = useState<TeamRosterRole>('player');
  const [jerseyNumber, setJerseyNumber] = useState<string>('');

  // Status & Feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const teamLogoInputId = useId();

  const loadData = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const [teamsData, membersData] = await Promise.all([
        DatabaseService.getTeamsWithRosters(leaderboardId),
        DatabaseService.getMembers(leaderboardId)
      ]);
      setTeamsWithRosters(teamsData);
      setAllMembers(membersData);
    } catch (err: unknown) {
      console.error('Failed to load teams & rosters:', err);
      setFeedback({ message: getErrorMessage(err, 'Failed to load teams'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [leaderboardId]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Find participants not assigned to any team in this competition
  const assignedMemberIds = new Set<string>();
  for (const t of teamsWithRosters) {
    for (const tm of t.members) {
      assignedMemberIds.add(tm.member_id);
    }
  }
  const unassignedMembers = allMembers.filter(m => !assignedMemberIds.has(m.id));

  // Handlers for Team CRUD
  const handleOpenCreateModal = () => {
    setTeamName('');
    setTeamShortCode('');
    setTeamLogoUrl('');
    setEditingTeam(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamShortCode(team.short_code || '');
    setTeamLogoUrl(team.logo_url || '');
    setShowCreateModal(true);
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setIsUploadingLogo(true);
      const url = await uploadImageAsset(file, 'team-logo');
      setTeamLogoUrl(url);
      showToast('Logo uploaded successfully.');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to upload logo'), 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      showToast('Team name is required', 'error');
      return;
    }

    try {
      setActionLoading(true);
      if (editingTeam) {
        await DatabaseService.updateTeam(editingTeam.id, {
          name: teamName.trim(),
          short_code: teamShortCode.trim() || generateShortCode(teamName),
          logo_url: teamLogoUrl.trim() || null,
        });
        showToast(`Team "${teamName.trim()}" updated.`);
      } else {
        const created = await DatabaseService.createTeam(leaderboardId, {
          name: teamName.trim(),
          short_code: teamShortCode.trim() || generateShortCode(teamName),
          logo_url: teamLogoUrl.trim() || null,
        });
        showToast(`Team "${created.name}" created.`);
        setExpandedTeamId(created.id);
      }
      setShowCreateModal(false);
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to save team'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!window.confirm(`Are you sure you want to delete "${team.name}"? This unassigns all roster members without deleting them from the competition.`)) {
      return;
    }

    try {
      setActionLoading(true);
      await DatabaseService.deleteTeam(team.id);
      showToast(`Team "${team.name}" deleted.`);
      if (expandedTeamId === team.id) {
        setExpandedTeamId(null);
      }
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to delete team'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers for Roster Management
  const handleAddRosterMember = async (teamId: string) => {
    if (!selectedMemberId) {
      showToast('Please select a participant to add', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const jNum = jerseyNumber.trim() ? parseInt(jerseyNumber.trim(), 10) : null;
      await DatabaseService.addTeamMember(teamId, selectedMemberId, rosterRole, isNaN(jNum as number) ? null : jNum);
      showToast('Participant added to team roster.');
      setSelectedMemberId('');
      setJerseyNumber('');
      setAddingToTeamId(null);
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to add member to roster'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRosterRole = async (teamId: string, memberId: string, newRole: TeamRosterRole) => {
    try {
      setActionLoading(true);
      await DatabaseService.updateTeamMemberRole(teamId, memberId, newRole);
      showToast(`Updated role to ${newRole}.`);
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to update role'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRosterMember = async (teamId: string, memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from this team?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await DatabaseService.removeTeamMember(teamId, memberId);
      showToast(`Removed ${memberName} from roster.`);
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to remove member'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Backfill Sync
  const handleBackfillTeams = async () => {
    try {
      setActionLoading(true);
      const res = await DatabaseService.backfillTeams(leaderboardId);
      showToast(`Backfill complete: ${res.createdTeams} new teams created, ${res.linkedMembers} members linked to rosters.`);
      await loadData();
      onChanged?.();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to backfill teams'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTeams = teamsWithRosters.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.short_code && t.short_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div className={`p-4 rounded-xl shadow-lg border text-sm flex items-center gap-2.5 transition-all animate-in fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600/10 border border-violet-500/20 rounded-xl text-violet-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Teams & Rosters</h3>
            <p className="text-xs text-neutral-400">
              Normalized team entities with captains, players, substitutes, and roster controls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleBackfillTeams}
            disabled={actionLoading}
            title="Scan participants and auto-convert free-text team names into official teams & rosters"
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} /> Sync Legacy Teams
          </button>
          
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl text-white shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Team
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Filter teams by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-9 pr-3 py-2 bg-neutral-900/60 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
        />
      </div>

      {/* Teams List */}
      {loading ? (
        <div className="py-12 text-center text-neutral-500 text-xs">
          Loading teams & rosters...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center border-dashed border border-neutral-800">
          <Users className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
          <h4 className="font-semibold text-sm text-neutral-300">No teams found</h4>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? 'No teams match your filter query.' 
              : 'Create a new team, or use "Sync Legacy Teams" to automatically import existing team groups into first-class teams.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer"
            >
              Create Team
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            const captains = team.members.filter(m => m.role === 'captain');
            const players = team.members.filter(m => m.role === 'player');
            const substitutes = team.members.filter(m => m.role === 'substitute');

            return (
              <div 
                key={team.id}
                className="glass rounded-2xl border border-white/5 overflow-hidden transition-all duration-200"
              >
                {/* Team Card Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      type="button"
                      className="p-1 text-neutral-400 hover:text-white transition-colors"
                      aria-label={isExpanded ? 'Collapse team roster' : 'Expand team roster'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <SafeImage
                      src={team.logo_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(team.name)}`}
                      alt={team.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-xl border border-white/5 object-cover shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{team.name}</span>
                        {team.short_code && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[10px] font-mono font-bold text-violet-400 uppercase">
                            {team.short_code}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <span>{team.member_count} {team.member_count === 1 ? 'member' : 'members'}</span>
                        {captains.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-400/90">
                            • <Crown className="w-3 h-3 inline" /> {captains.map(c => c.member.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(team)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Edit team details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(team)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Roster Area */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-black/30 p-4 space-y-4">
                    {/* Roster Controls & Summary */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                      <div className="flex items-center gap-3 text-neutral-400">
                        <span>Role breakdown:</span>
                        <span className="text-amber-400 font-semibold">{captains.length} Captains</span>
                        <span>•</span>
                        <span className="text-violet-400 font-semibold">{players.length} Players</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-semibold">{substitutes.length} Substitutes</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAddingToTeamId(addingToTeamId === team.id ? null : team.id);
                          setSelectedMemberId(unassignedMembers[0]?.id || '');
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                        {addingToTeamId === team.id ? 'Cancel' : 'Assign Participant'}
                      </button>
                    </div>

                    {/* Assign Participant Sub-Form */}
                    {addingToTeamId === team.id && (
                      <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-3">
                        <div className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                          Assign Competition Participant to {team.name}
                        </div>

                        {unassignedMembers.length === 0 ? (
                          <div className="text-xs text-neutral-500 py-1">
                            All participants in this competition are already assigned to teams. To add a new participant, add them in the Players tab first.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Select Participant</label>
                              <select
                                value={selectedMemberId}
                                onChange={(e) => setSelectedMemberId(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                              >
                                {unassignedMembers.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Role</label>
                              <select
                                value={rosterRole}
                                onChange={(e) => setRosterRole(e.target.value as TeamRosterRole)}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                              >
                                <option value="captain">Captain</option>
                                <option value="player">Player</option>
                                <option value="substitute">Substitute</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Jersey # (Optional)</label>
                              <input
                                type="number"
                                placeholder="e.g. 10"
                                value={jerseyNumber}
                                onChange={(e) => setJerseyNumber(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                              />
                            </div>
                          </div>
                        )}

                        {unassignedMembers.length > 0 && (
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setAddingToTeamId(null)}
                              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddRosterMember(team.id)}
                              disabled={actionLoading || !selectedMemberId}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer disabled:opacity-50"
                            >
                              Confirm Assignment
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Roster Members Table */}
                    {team.members.length === 0 ? (
                      <div className="py-6 text-center text-xs text-neutral-500 bg-neutral-950/30 rounded-xl">
                        No roster members assigned to this team yet. Click &quot;Assign Participant&quot; above to add one.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-neutral-500">
                              <th className="py-2 px-3">Participant</th>
                              <th className="py-2 px-3">Role</th>
                              <th className="py-2 px-3">Jersey #</th>
                              <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {team.members.map((tm) => (
                              <tr key={tm.id} className="hover:bg-white/[0.01]">
                                <td className="py-2.5 px-3 flex items-center gap-2.5">
                                  <SafeImage
                                    src={tm.member.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(tm.member.name)}`}
                                    alt={tm.member.name}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 rounded-full border border-white/5 object-cover"
                                  />
                                  <div>
                                    <span className="font-semibold text-white block">{tm.member.name}</span>
                                    {tm.member.email && (
                                      <span className="text-[10px] text-neutral-500 block">{tm.member.email}</span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <select
                                    value={tm.role}
                                    onChange={(e) => handleUpdateRosterRole(team.id, tm.member_id, e.target.value as TeamRosterRole)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                                      tm.role === 'captain'
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                        : tm.role === 'substitute'
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                        : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                                    }`}
                                  >
                                    <option value="captain" className="bg-neutral-900 text-white">Captain</option>
                                    <option value="player" className="bg-neutral-900 text-white">Player</option>
                                    <option value="substitute" className="bg-neutral-900 text-white">Substitute</option>
                                  </select>
                                </td>

                                <td className="py-2.5 px-3 font-mono text-neutral-300">
                                  {tm.jersey_number ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                                      <Shirt className="w-2.5 h-2.5 text-neutral-500" />
                                      #{tm.jersey_number}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">-</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRosterMember(team.id, tm.member_id, tm.member.name)}
                                    className="p-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Remove from roster"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" />
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] uppercase font-bold text-neutral-400 mb-1.5">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rogue Warriors"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    if (!editingTeam && !teamShortCode) {
                      setTeamShortCode(generateShortCode(e.target.value));
                    }
                  }}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-neutral-400 mb-1.5">
                  Short Code (2-4 uppercase characters)
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. ROG"
                  value={teamShortCode}
                  onChange={(e) => setTeamShortCode(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-neutral-400 mb-1.5">
                  Logo (Optional)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={teamLogoUrl}
                      onChange={(e) => setTeamLogoUrl(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <label 
                      htmlFor={teamLogoInputId}
                      className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition-all text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Uploading...' : 'Upload'}</span>
                    </label>
                    <input
                      id={teamLogoInputId}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingLogo}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoUpload(file);
                      }}
                    />
                  </div>

                  {teamLogoUrl && (
                    <div className="flex items-center gap-3 p-2 bg-neutral-950/60 border border-neutral-850 rounded-xl">
                      <SafeImage
                        src={teamLogoUrl}
                        alt="Team logo preview"
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-lg border border-white/10 object-cover"
                      />
                      <span className="text-[11px] text-neutral-400 truncate">Logo preview ready</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !teamName.trim()}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
