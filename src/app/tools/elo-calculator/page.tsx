'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SimpleHeader from '@/components/seo/SimpleHeader';
import SeoFooter from '@/components/seo/SeoFooter';
import { ArrowRight, Calculator, Info } from 'lucide-react';

export default function EloCalculatorPage() {
  const [playerA, setPlayerA] = useState(1200);
  const [playerB, setPlayerB] = useState(1200);
  const [kFactor, setKFactor] = useState(32);
  const [outcome, setOutcome] = useState<'A' | 'B' | 'Draw'>('A');

  // Elo Calculation Logic
  const expectedA = 1 / (1 + Math.pow(10, (playerB - playerA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (playerA - playerB) / 400));

  let actualA = 0.5;
  let actualB = 0.5;
  if (outcome === 'A') {
    actualA = 1;
    actualB = 0;
  } else if (outcome === 'B') {
    actualA = 0;
    actualB = 1;
  }

  const newPlayerA = Math.round(playerA + kFactor * (actualA - expectedA));
  const newPlayerB = Math.round(playerB + kFactor * (actualB - expectedB));

  const changeA = newPlayerA - playerA;
  const changeB = newPlayerB - playerB;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      <SimpleHeader />
      
      <main className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 text-violet-400 mb-6 border border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <Calculator className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Elo Rating Calculator
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Instantly calculate rating changes for chess, esports, or competitive matchmaking using the official Elo formula.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Inputs */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-6">Match Details</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Player A Current Rating</label>
                <input 
                  type="number" 
                  value={playerA}
                  onChange={(e) => setPlayerA(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Player B Current Rating</label>
                <input 
                  type="number" 
                  value={playerB}
                  onChange={(e) => setPlayerB(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2 flex items-center justify-between">
                  <span>K-Factor (Volatility)</span>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-neutral-500 cursor-help" />
                    <div className="absolute right-0 w-64 p-3 bg-neutral-900 border border-white/10 rounded-lg text-xs text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 -top-2 translate-y-[-100%] shadow-xl">
                      Higher K-Factors cause larger rating swings. Common values: 32 (Novice), 24 (Intermediate), 16 (Master).
                    </div>
                  </div>
                </label>
                <select 
                  value={kFactor}
                  onChange={(e) => setKFactor(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors appearance-none"
                >
                  <option value={16}>16 (Pro / Grandmaster)</option>
                  <option value={24}>24 (Intermediate)</option>
                  <option value={32}>32 (Default / Novice)</option>
                  <option value={40}>40 (High Volatility)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Match Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setOutcome('A')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${outcome === 'A' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-black/50 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'}`}
                  >
                    A Wins
                  </button>
                  <button 
                    onClick={() => setOutcome('Draw')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${outcome === 'Draw' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-black/50 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'}`}
                  >
                    Draw
                  </button>
                  <button 
                    onClick={() => setOutcome('B')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${outcome === 'B' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-black/50 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'}`}
                  >
                    B Wins
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-gradient-to-br from-violet-900/20 to-black border border-violet-500/20 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] pointer-events-none" />
            
            <h2 className="text-xl font-bold mb-8 relative z-10 text-center">New Ratings</h2>
            
            <div className="space-y-6 relative z-10">
              <div className="bg-black/40 border border-white/5 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-400 font-medium mb-1">Player A</div>
                  <div className="text-3xl font-bold">{newPlayerA}</div>
                </div>
                <div className={`text-lg font-bold px-3 py-1 rounded-full ${changeA >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {changeA >= 0 ? '+' : ''}{changeA}
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-400 font-medium mb-1">Player B</div>
                  <div className="text-3xl font-bold">{newPlayerB}</div>
                </div>
                <div className={`text-lg font-bold px-3 py-1 rounded-full ${changeB >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {changeB >= 0 ? '+' : ''}{changeB}
                </div>
              </div>
              
              <div className="pt-4 text-center">
                <p className="text-xs text-neutral-500 mb-1">Expected Win Probabilities</p>
                <div className="flex justify-between text-xs font-medium text-neutral-400">
                  <span>Player A: {(expectedA * 100).toFixed(1)}%</span>
                  <span>Player B: {(expectedB * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEO Content / CTA */}
        <div className="prose prose-invert prose-violet max-w-none">
          <h2>How does the Elo calculation work?</h2>
          <p>
            The Elo rating system, originally invented by Arpad Elo for chess, calculates the relative skill levels of players in competitive games. After every match, the winning player takes points from the losing player. The number of points transferred depends entirely on the difference in their initial ratings.
          </p>
          <p>
            If a high-rated player defeats a low-rated player, only a few points are exchanged, because the system <em>expected</em> that outcome. However, if a low-rated player pulls off an upset against a grandmaster, a massive amount of points are transferred to reward the underdog.
          </p>

          <div className="my-12 p-8 rounded-2xl bg-white/5 border border-white/10 text-center flex flex-col items-center">
            <h3 className="text-2xl font-bold mt-0 mb-3">Tired of calculating rankings manually?</h3>
            <p className="text-neutral-400 mb-6 max-w-xl">
              LeaderboardOS provides an automated, API-driven ranking engine. Build a custom leaderboard for your game or community in minutes, complete with automatic score recalculations.
            </p>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all cursor-pointer glow-primary no-underline"
            >
              Start Building for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
