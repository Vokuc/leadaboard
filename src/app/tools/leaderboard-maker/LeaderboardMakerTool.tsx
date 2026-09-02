'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import ShareableTable from '@/components/tools/ShareableTable';

interface Participant {
  id: string;
  name: string;
  score: number;
}

export default function LeaderboardMakerTool() {
  const [title, setTitle] = useState('Weekly Sales Leaderboard');
  const [unit, setUnit] = useState('Points');

  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Alex Johnson', score: 2500 },
    { id: '2', name: 'Sam Smith', score: 1850 },
    { id: '3', name: 'Jordan Lee', score: 2100 },
    { id: '4', name: 'Casey Brown', score: 950 },
  ]);

  const handleAddParticipant = () => {
    setParticipants([...participants, { 
      id: crypto.randomUUID(), 
      name: `Participant ${participants.length + 1}`, 
      score: 0 
    }]);
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const updateParticipant = (id: string, field: keyof Participant, value: string) => {
    setParticipants(participants.map(p => {
      if (p.id === id) {
        const newVal = field === 'name' ? value : (parseInt(value) || 0);
        return { ...p, [field]: newVal };
      }
      return p;
    }));
  };

  // Sort descending by score
  const standings = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    }).map((p, idx) => ({ ...p, position: idx + 1 }));
  }, [participants]);

  const columns = [
    { key: 'position', label: 'Rank' },
    { key: 'name', label: 'Name' },
    { key: 'score', label: unit },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent border-none text-2xl font-bold focus:ring-0 p-0 text-white placeholder-neutral-500"
          placeholder="Enter Leaderboard Name..."
        />
        <div className="flex items-center gap-3">
          <ShareableTable data={standings} columns={columns} filename={title.toLowerCase().replace(/\s+/g, '-')} />
        </div>
      </div>

      <div className="flex items-center gap-3 bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 w-max">
        <label className="font-semibold text-neutral-400 text-sm">Score Unit/Label:</label>
        <input 
          type="text" 
          value={unit} 
          onChange={(e) => setUnit(e.target.value)} 
          className="bg-black border border-neutral-700 rounded p-1 text-sm text-white focus:border-violet-500 max-w-[120px]" 
          placeholder="e.g. Points, XP, $"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-900/50 text-neutral-400 border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-semibold w-16 text-center">Rank</th>
              <th className="px-6 py-4 font-semibold">Participant Name</th>
              <th className="px-6 py-4 font-semibold w-40 text-right">{unit}</th>
              <th className="px-4 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    row.position === 1 ? 'bg-amber-500/20 text-amber-400' :
                    row.position === 2 ? 'bg-neutral-400/20 text-neutral-300' :
                    row.position === 3 ? 'bg-orange-600/20 text-orange-400' :
                    'bg-neutral-800 text-neutral-500'
                  }`}>
                    {row.position}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="text" 
                    value={row.name} 
                    onChange={e => updateParticipant(row.id, 'name', e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded px-2 py-1.5 text-white font-medium text-base"
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <input 
                    type="number" 
                    value={row.score} 
                    onChange={e => updateParticipant(row.id, 'score', e.target.value)}
                    className="w-full text-right bg-transparent border border-transparent hover:border-neutral-700 focus:border-violet-500 rounded p-1.5 text-white font-bold text-lg" 
                  />
                </td>
                <td className="px-4 py-4 text-center">
                  <button onClick={() => handleRemoveParticipant(row.id)} className="text-neutral-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button 
        onClick={handleAddParticipant}
        className="flex items-center gap-2 text-sm font-bold text-violet-400 hover:text-violet-300 transition-colors px-2"
      >
        <Plus className="w-4 h-4" /> Add Participant
      </button>

      <div className="mt-8 p-4 bg-violet-900/10 border border-violet-500/20 rounded-xl flex gap-3 text-sm text-neutral-300">
        <HelpCircle className="w-5 h-5 text-violet-400 shrink-0" />
        <p>
          Need to save this for later? When you're ready, click "Create Free Leaderboard" below. 
          Your participants and stats will not transfer automatically, but you'll get a permanent shareable link that updates in real-time, plus advanced scoring rules.
        </p>
      </div>
    </div>
  );
}
