'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Settings2, HelpCircle } from 'lucide-react';
import ShareableTable from '@/components/tools/ShareableTable';

interface TeamRow {
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface LeagueTableToolProps {
  initialTitle?: string;
  preset?: 'football' | 'generic';
}

export default function LeagueTableTool({ initialTitle = 'League Table', preset = 'generic' }: LeagueTableToolProps) {
  const [title, setTitle] = useState(initialTitle);
  const [ptsWin, setPtsWin] = useState(preset === 'football' ? 3 : 3);
  const [ptsDraw, setPtsDraw] = useState(preset === 'football' ? 1 : 1);
  const [ptsLoss, setPtsLoss] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const [teams, setTeams] = useState<TeamRow[]>([
    { id: '1', name: 'Team Alpha', played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 2 },
    { id: '2', name: 'Team Beta', played: 3, wins: 1, draws: 1, losses: 1, goalsFor: 4, goalsAgainst: 4 },
    { id: '3', name: 'Team Gamma', played: 3, wins: 0, draws: 0, losses: 3, goalsFor: 1, goalsAgainst: 8 },
  ]);

  const handleAddTeam = () => {
    setTeams([...teams, { 
      id: crypto.randomUUID(), 
      name: `Team ${teams.length + 1}`, 
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 
    }]);
  };

  const handleRemoveTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const updateTeam = (id: string, field: keyof TeamRow, value: string) => {
    setTeams(teams.map(t => {
      if (t.id === id) {
        const newVal = field === 'name' ? value : (parseInt(value) || 0);
        return { ...t, [field]: newVal };
      }
      return t;
    }));
  };

  // Calculate and sort
  const standings = useMemo(() => {
    return teams.map(t => {
      const pts = (t.wins * ptsWin) + (t.draws * ptsDraw) + (t.losses * ptsLoss);
      const gd = t.goalsFor - t.goalsAgainst;
      return { ...t, pts, gd };
    }).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    }).map((t, idx) => ({ ...t, position: idx + 1 }));
  }, [teams, ptsWin, ptsDraw, ptsLoss]);

  const columns = [
    { key: 'position', label: 'Pos' },
    { key: 'name', label: 'Team' },
    { key: 'played', label: 'P' },
    { key: 'wins', label: 'W' },
    { key: 'draws', label: 'D' },
    { key: 'losses', label: 'L' },
    { key: 'goalsFor', label: 'GF' },
    { key: 'goalsAgainst', label: 'GA' },
    { key: 'gd', label: 'GD' },
    { key: 'pts', label: 'Pts' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent border-none text-2xl font-bold focus:ring-0 p-0 text-white placeholder-neutral-500"
          placeholder="Enter Table Name..."
        />
        <div className="flex items-center gap-3">
          <ShareableTable data={standings} columns={columns} filename={title.toLowerCase().replace(/\s+/g, '-')} />
          {preset === 'generic' && (
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-colors"
              title="Scoring Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {showSettings && preset === 'generic' && (
        <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Pts for Win</label>
            <input type="number" value={ptsWin} onChange={e => setPtsWin(parseInt(e.target.value)||0)} className="w-full bg-black border border-neutral-800 rounded p-2 text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Pts for Draw</label>
            <input type="number" value={ptsDraw} onChange={e => setPtsDraw(parseInt(e.target.value)||0)} className="w-full bg-black border border-neutral-800 rounded p-2 text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Pts for Loss</label>
            <input type="number" value={ptsLoss} onChange={e => setPtsLoss(parseInt(e.target.value)||0)} className="w-full bg-black border border-neutral-800 rounded p-2 text-white" />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-900/50 text-neutral-400 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
              <th className="px-4 py-3 font-semibold min-w-[200px]">Team Name</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Played">P</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Wins">W</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Draws">D</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Losses">L</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Goals For">GF</th>
              <th className="px-3 py-3 font-semibold w-16 text-center" title="Goals Against">GA</th>
              <th className="px-3 py-3 font-semibold w-16 text-center text-neutral-300" title="Goal Difference">GD</th>
              <th className="px-4 py-3 font-bold w-16 text-center text-white" title="Points">Pts</th>
              <th className="px-3 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-center font-bold text-neutral-500">{row.position}</td>
                <td className="px-4 py-3">
                  <input 
                    type="text" 
                    value={row.name} 
                    onChange={e => updateTeam(row.id, 'name', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded px-2 py-1 text-white font-medium"
                  />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.played} onChange={e => updateTeam(row.id, 'played', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.wins} onChange={e => updateTeam(row.id, 'wins', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.draws} onChange={e => updateTeam(row.id, 'draws', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.losses} onChange={e => updateTeam(row.id, 'losses', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.goalsFor} onChange={e => updateTeam(row.id, 'goalsFor', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-2 py-3 text-center">
                  <input type="number" value={row.goalsAgainst} onChange={e => updateTeam(row.id, 'goalsAgainst', e.target.value)} className="w-12 text-center bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1 text-white" />
                </td>
                <td className="px-3 py-3 text-center font-medium text-neutral-300">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td className="px-4 py-3 text-center font-bold text-white bg-neutral-900/30">{row.pts}</td>
                <td className="px-3 py-3 text-center">
                  <button onClick={() => handleRemoveTeam(row.id)} className="text-neutral-600 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button 
        onClick={handleAddTeam}
        className="flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors px-2"
      >
        <Plus className="w-4 h-4" /> Add Team
      </button>

      <div className="mt-8 p-4 bg-violet-900/10 border border-violet-500/20 rounded-xl flex gap-3 text-sm text-neutral-300">
        <HelpCircle className="w-5 h-5 text-violet-400 shrink-0" />
        <p>
          Need to save this for later? When you're ready, click "Create Free Leaderboard" below. 
          Your teams and stats will not be transferred automatically, but you'll get a permanent shareable link that updates in real-time.
        </p>
      </div>
    </div>
  );
}
