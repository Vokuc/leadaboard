'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, GitMerge, HelpCircle } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
}

export default function TournamentGeneratorTool() {
  const [title, setTitle] = useState('Championship Bracket');
  
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Player 1' },
    { id: '2', name: 'Player 2' },
    { id: '3', name: 'Player 3' },
    { id: '4', name: 'Player 4' },
    { id: '5', name: 'Player 5' },
    { id: '6', name: 'Player 6' },
    { id: '7', name: 'Player 7' },
    { id: '8', name: 'Player 8' },
  ]);

  const handleAddParticipant = () => {
    if (participants.length >= 32) return;
    setParticipants([...participants, { 
      id: crypto.randomUUID(), 
      name: `Player ${participants.length + 1}`
    }]);
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const updateParticipant = (id: string, name: string) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, name } : p));
  };

  // Determine bracket size (next power of 2)
  const bracketSize = useMemo(() => {
    let size = 2;
    while (size < participants.length) size *= 2;
    return Math.max(2, size);
  }, [participants.length]);

  const numRounds = Math.log2(bracketSize);

  // Pad bracket with Byes
  const seededBracket = useMemo(() => {
    const bracket = [...participants];
    while (bracket.length < bracketSize) {
      bracket.push({ id: `bye-${bracket.length}`, name: '(Bye)' });
    }
    return bracket;
  }, [participants, bracketSize]);

  // Generate match pairs for round 1
  const round1Matches = useMemo(() => {
    const matches = [];
    for (let i = 0; i < seededBracket.length; i += 2) {
      matches.push({
        home: seededBracket[i],
        away: seededBracket[i + 1],
      });
    }
    return matches;
  }, [seededBracket]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent border-none text-2xl font-bold focus:ring-0 p-0 text-white placeholder-neutral-500"
          placeholder="Enter Tournament Name..."
        />
        <div className="text-sm font-semibold text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
          {participants.length} / 32 Players
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Participants Setup */}
        <div className="lg:col-span-1 space-y-4 border-r border-white/5 pr-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-white text-sm">Participants</h3>
            {participants.length < 32 && (
              <button onClick={handleAddParticipant} className="text-violet-400 hover:text-violet-300 p-1">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 group">
                <span className="text-xs text-neutral-600 font-mono w-4">{i + 1}</span>
                <input
                  type="text"
                  value={p.name}
                  onChange={e => updateParticipant(p.id, e.target.value)}
                  className="flex-1 bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 focus:border-violet-500 rounded px-2 py-1.5 text-sm text-white"
                />
                <button onClick={() => handleRemoveParticipant(p.id)} className="text-neutral-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {participants.length === 0 && (
              <div className="text-sm text-neutral-500 text-center py-4">Add participants to build bracket</div>
            )}
          </div>
        </div>

        {/* Bracket Preview */}
        <div className="lg:col-span-3 overflow-x-auto custom-scrollbar pb-4">
          <div className="min-w-max flex gap-12">
            
            {/* Round 1 (Dynamic based on inputs) */}
            <div className="flex flex-col justify-around gap-4 w-48">
              <h4 className="text-xs font-bold text-neutral-500 text-center mb-4 uppercase tracking-widest">Round 1</h4>
              {round1Matches.map((match, i) => (
                <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col relative z-10">
                  <div className="px-3 py-2 text-sm text-white border-b border-neutral-800 bg-neutral-800/30 truncate">
                    {match.home.name}
                  </div>
                  <div className="px-3 py-2 text-sm text-white truncate">
                    {match.away.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Subsequent Rounds (Visual Only) */}
            {Array.from({ length: numRounds - 1 }).map((_, roundIdx) => (
              <div key={roundIdx} className="flex flex-col justify-around gap-4 w-48">
                <h4 className="text-xs font-bold text-neutral-500 text-center mb-4 uppercase tracking-widest">
                  {roundIdx === numRounds - 2 ? 'Final' : `Round ${roundIdx + 2}`}
                </h4>
                {Array.from({ length: bracketSize / Math.pow(2, roundIdx + 2) }).map((_, matchIdx) => (
                  <div key={matchIdx} className="bg-neutral-900 border border-neutral-800/50 rounded-lg overflow-hidden flex flex-col relative opacity-50">
                    <div className="px-3 py-2 text-sm text-neutral-500 border-b border-neutral-800/50 italic bg-neutral-800/10">TBD</div>
                    <div className="px-3 py-2 text-sm text-neutral-500 italic">TBD</div>
                  </div>
                ))}
              </div>
            ))}

            {/* Champion */}
            <div className="flex flex-col justify-around w-48">
              <h4 className="text-xs font-bold text-amber-500/50 text-center mb-4 uppercase tracking-widest">Champion</h4>
              <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-lg p-4 text-center">
                <TrophyIcon className="w-8 h-8 text-amber-500/30 mx-auto mb-2" />
                <span className="text-amber-500/50 text-sm font-bold italic">TBD</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-violet-900/10 border border-violet-500/20 rounded-xl flex gap-3 text-sm text-neutral-300">
        <HelpCircle className="w-5 h-5 text-violet-400 shrink-0" />
        <p>
          This is a preview of your Round 1 matchups. To actually play through the tournament, advance winners, and save results, click "Create Free Leaderboard" below and select the "Tournament" mode in LeaderboardOS.
        </p>
      </div>
    </div>
  );
}

function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
