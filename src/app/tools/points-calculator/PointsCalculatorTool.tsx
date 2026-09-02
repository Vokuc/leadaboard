'use client';

import React, { useState } from 'react';
import { Calculator, HelpCircle } from 'lucide-react';

export default function PointsCalculatorTool() {
  const [wins, setWins] = useState(10);
  const [draws, setDraws] = useState(4);
  const [losses, setLosses] = useState(2);

  const [ptsWin, setPtsWin] = useState(3);
  const [ptsDraw, setPtsDraw] = useState(1);
  const [ptsLoss, setPtsLoss] = useState(0);

  const totalPoints = (wins * ptsWin) + (draws * ptsDraw) + (losses * ptsLoss);
  const totalMatches = wins + draws + losses;
  const maxPossiblePoints = totalMatches * Math.max(ptsWin, ptsDraw, ptsLoss);
  const pointPercentage = maxPossiblePoints > 0 ? Math.round((totalPoints / maxPossiblePoints) * 100) : 0;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Total Score Display */}
      <div className="bg-gradient-to-br from-violet-900/50 to-neutral-900 border border-violet-500/20 rounded-2xl p-8 text-center shadow-lg shadow-violet-900/20">
        <h3 className="text-violet-400 font-bold uppercase tracking-widest text-xs mb-2">Total League Points</h3>
        <div className="text-6xl md:text-8xl font-black text-white tracking-tight glow-text flex items-center justify-center gap-4">
          <Calculator className="w-10 h-10 md:w-16 md:h-16 text-violet-500 opacity-50" />
          {totalPoints}
        </div>
        <div className="mt-4 text-neutral-400 font-medium">
          from {totalMatches} matches played ({pointPercentage}% of maximum possible points)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Match Results Input */}
        <div className="space-y-4">
          <h4 className="font-bold text-white flex items-center gap-2">
            Match Results
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
              <label className="font-semibold text-neutral-300">Wins</label>
              <input type="number" value={wins} onChange={(e) => setWins(parseInt(e.target.value) || 0)} className="w-20 bg-black border border-neutral-700 rounded-lg p-2 text-center text-white font-bold focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </div>
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
              <label className="font-semibold text-neutral-300">Draws</label>
              <input type="number" value={draws} onChange={(e) => setDraws(parseInt(e.target.value) || 0)} className="w-20 bg-black border border-neutral-700 rounded-lg p-2 text-center text-white font-bold focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </div>
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
              <label className="font-semibold text-neutral-300">Losses</label>
              <input type="number" value={losses} onChange={(e) => setLosses(parseInt(e.target.value) || 0)} className="w-20 bg-black border border-neutral-700 rounded-lg p-2 text-center text-white font-bold focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </div>
          </div>
        </div>

        {/* Scoring Settings Input */}
        <div className="space-y-4">
          <h4 className="font-bold text-white flex items-center gap-2">
            Points System
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 opacity-80">
              <label className="font-semibold text-emerald-400 text-sm">Points per Win</label>
              <input type="number" value={ptsWin} onChange={(e) => setPtsWin(parseInt(e.target.value) || 0)} className="w-16 bg-black border border-neutral-700 rounded p-1.5 text-center text-white font-mono focus:border-violet-500" />
            </div>
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 opacity-80">
              <label className="font-semibold text-amber-400 text-sm">Points per Draw</label>
              <input type="number" value={ptsDraw} onChange={(e) => setPtsDraw(parseInt(e.target.value) || 0)} className="w-16 bg-black border border-neutral-700 rounded p-1.5 text-center text-white font-mono focus:border-violet-500" />
            </div>
            <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 opacity-80">
              <label className="font-semibold text-red-400 text-sm">Points per Loss</label>
              <input type="number" value={ptsLoss} onChange={(e) => setPtsLoss(parseInt(e.target.value) || 0)} className="w-16 bg-black border border-neutral-700 rounded p-1.5 text-center text-white font-mono focus:border-violet-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-violet-900/10 border border-violet-500/20 rounded-xl flex gap-3 text-sm text-neutral-300">
        <HelpCircle className="w-5 h-5 text-violet-400 shrink-0" />
        <p>
          This calculator uses standard multiplication to determine your league standing points. 
          To track points for an entire league of teams, use the <strong>League Table Generator</strong> tool, 
          or click below to create an official LeaderboardOS league.
        </p>
      </div>
    </div>
  );
}
