'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Zap, 
  Palette, 
  Users, 
  Settings, 
  Code, 
  Flame, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Gamepad2,
  Activity,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { profile } = useAuth();
  const [activePreviewTab, setActivePreviewTab] = useState<'gaming' | 'sports' | 'workplace'>('gaming');

  // Preview content based on the competition category
  const previewData = {
    gaming: {
      title: "Cyber League - Apex Qualifier",
      themeClass: "border-purple-500/30 text-purple-400 glow-gaming",
      badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accentText: "text-purple-400",
      bgClass: "from-purple-950/20 to-neutral-900/60",
      players: [
        { rank: 1, name: "ViperFPS", score: 2850, details: "Level 48", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=viper", team: "Rogue Gaming" },
        { rank: 2, name: "PxlQueen", score: 2420, details: "Level 41", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=pxl", team: "Team Apex" },
        { rank: 3, name: "ShadowRunner", score: 2190, details: "Level 38", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=shadow", team: "Team Apex" }
      ],
      scoreSuffix: "XP",
      rule: "Win Match (+100 XP) | Headshot (+15 XP)"
    },
    sports: {
      title: "Sunset Club - 5K Challenge",
      themeClass: "border-cyan-500/30 text-cyan-400 glow-sports",
      badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      accentText: "text-cyan-400",
      bgClass: "from-cyan-950/20 to-neutral-900/60",
      players: [
        { rank: 1, name: "Sarah Run", score: 984, details: "16:24 mins", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=sarah", team: "Sunset Sprinters" },
        { rank: 2, name: "John Jogger", score: 1045, details: "17:25 mins", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=john", team: "Sunset Sprinters" },
        { rank: 3, name: "Bob Trail", score: 1112, details: "18:32 mins", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=bob", team: "Sunset Sprinters" }
      ],
      scoreSuffix: "s (Time-based)",
      rule: "Lowest Time Wins | Tracked in Minutes/Seconds"
    },
    workplace: {
      title: "Q3 SDR Performance Race",
      themeClass: "border-emerald-500/30 text-emerald-400 glow-workplace",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accentText: "text-emerald-400",
      bgClass: "from-emerald-950/20 to-neutral-900/60",
      players: [
        { rank: 1, name: "Dwight Schrute", score: 9400, details: "$9,400 Revenue", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=dwight", team: "Sales - North" },
        { rank: 2, name: "Jim Halpert", score: 8100, details: "$8,100 Revenue", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=jim", team: "Sales - North" },
        { rank: 3, name: "Phyllis Vance", score: 6200, details: "$6,200 Revenue", avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=phyllis", team: "Sales - South" }
      ],
      scoreSuffix: "pts ($)",
      rule: "Deal Closed (+100 pts) | Meeting Booked (+15 pts)"
    }
  };

  const activeData = previewData[activePreviewTab];

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col relative text-white">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-violet-600/10 blur-[130px] animate-pulse-glow" />
      <div className="absolute bottom-[20%] left-[-15%] w-[650px] h-[650px] rounded-full bg-indigo-600/10 blur-[140px]" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            LeagueBoard
          </span>
        </div>
        
        <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#preview" className="hover:text-white transition-colors">Interactive Preview</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </nav>

        <div>
          <Link 
            href={profile ? '/dashboard' : '/login'} 
            className="flex items-center gap-2 px-4 py-2 border border-violet-500/30 hover:border-violet-500 bg-violet-600/10 hover:bg-violet-600 text-sm font-semibold rounded-xl text-violet-100 hover:text-white transition-all cursor-pointer glow-primary"
          >
            {profile ? 'Go to Dashboard' : 'Launch Console'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-20 md:py-32 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Introducing Leaderboard-as-a-Service
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Create Real-Time Leaderboards <br />
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            In Under One Minute
          </span>
        </h1>
        
        <p className="mt-6 text-base sm:text-xl text-neutral-400 max-w-3xl leading-relaxed">
          LeagueBoard gives sports leagues, gaming tournaments, fitness clubs, and corporate sales offices a plug-and-play ranking platform. Set scoring rules, invite players, and embed customizable widgets anywhere.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
          <Link 
            href="/login" 
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-base"
          >
            Create a Leaderboard (Free)
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a 
            href="#preview" 
            className="px-6 py-3 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-900 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all text-base"
          >
            View Live Sandbox
          </a>
        </div>

        <div className="mt-6 flex items-center gap-6 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> No Code Required</span>
          <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Supabase Realtime</span>
          <span className="flex items-center gap-1.5"><Code className="w-4 h-4 text-blue-500" /> Developer-first API</span>
        </div>
      </section>

      {/* Interactive Leaderboard Preview Widget */}
      <section id="preview" className="relative z-10 py-16 px-6 md:px-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">Fully Adaptive Layouts</h2>
          <p className="mt-2 text-sm sm:text-base text-neutral-400">Select an audience to preview how the ranking mechanics, scoring suffixes, and layout modules adapt.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-center border-b border-neutral-800 p-1 mb-8 max-w-md mx-auto bg-neutral-900/40 rounded-xl border">
          <button 
            onClick={() => setActivePreviewTab('gaming')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activePreviewTab === 'gaming' 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" /> Gamers
          </button>
          <button 
            onClick={() => setActivePreviewTab('sports')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activePreviewTab === 'sports' 
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" /> Sports / Runners
          </button>
          <button 
            onClick={() => setActivePreviewTab('workplace')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activePreviewTab === 'workplace' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" /> Workplaces
          </button>
        </div>

        {/* Leaderboard Preview Board */}
        <div className={`glass-premium p-6 sm:p-8 rounded-2xl border transition-all duration-300 shadow-2xl bg-gradient-to-b ${activeData.bgClass}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 mb-6 gap-3">
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-2 uppercase tracking-wide ${activeData.badgeClass}`}>
                {activePreviewTab} Tournament
              </span>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{activeData.title}</h3>
            </div>
            
            <div className="text-xs text-neutral-400 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              <Calendar className="w-3.5 h-3.5" /> Starts July 5, 2026
            </div>
          </div>

          <div className="space-y-3">
            {activeData.players.map((p, idx) => (
              <div 
                key={p.name}
                className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-black/40 hover:bg-black/60 transition-all hover:translate-x-1"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    p.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    p.rank === 2 ? 'bg-neutral-300/20 text-neutral-300 border border-neutral-300/30' :
                    'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                  }`}>
                    {p.rank}
                  </span>
                  
                  {/* Avatar */}
                  <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-lg border border-white/10" />

                  {/* Name and Team */}
                  <div>
                    <h4 className="font-bold text-sm sm:text-base">{p.name}</h4>
                    {p.team && <p className="text-xs text-neutral-500 font-medium">{p.team}</p>}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className={`font-bold text-sm sm:text-base ${activeData.accentText}`}>
                    {p.score.toLocaleString()} {activePreviewTab === 'gaming' ? activeData.scoreSuffix : ''}
                  </span>
                  <p className="text-xs text-neutral-400">{p.details}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Scoring Event Rule: <span className="text-white normal-case">{activeData.rule}</span>
            </span>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1" />
              <span className="text-xs text-emerald-400 font-medium">Realtime updates enabled</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="features" className="relative z-10 py-20 px-6 md:px-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Engineered for Competitions</h2>
          <p className="mt-2 text-neutral-400">Everything you need to track standings, reward events, and integrate live leaderboards.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* F1 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Visual Customization</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Modify themes, typography, columns, avatar borders, and colors to matches your organization's brand identity.</p>
          </div>

          {/* F2 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Supabase Realtime</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Score event submissions stream instantly. Visitor dashboards and widget views update without needing browser refreshes.</p>
          </div>

          {/* F3 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Dynamic Members</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Manage competitors, assign them to sub-teams, append metadata notes, and store emails for communication logging.</p>
          </div>

          {/* F4 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Modular Rule Builders</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Set points values for custom accomplishments. Accumulate points over distinct dates using Season rules.</p>
          </div>

          {/* F5 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Integrate Anywhere</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Copy embed iframe code snippets or deploy REST endpoint credentials for gaming and server integrations.</p>
          </div>

          {/* F6 */}
          <div className="glass p-6 rounded-2xl hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all group">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 w-fit group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="mt-5 font-bold text-lg">Immutable Logs</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">Keep a strict, audit-proof history of every score event awarded or deducted, preventing ranking tampering.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-20 px-6 md:px-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Flexible SaaS Pricing</h2>
          <p className="mt-2 text-neutral-400">Launch a leaderboard for free, and unlock premium features as your user base expands.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="glass p-6 sm:p-8 rounded-2xl border-white/5 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg">Hobby</h3>
              <p className="mt-1 text-sm text-neutral-400">Ideal for small clubs or weekend projects</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight">$0</span>
                <span className="ml-1 text-sm text-neutral-500">/ forever</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-sm text-neutral-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1 Active Leaderboard</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 50 Competitors</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dashboard Analytics</li>
              </ul>
            </div>
            <Link 
              href="/login" 
              className="mt-8 w-full py-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 font-semibold rounded-xl text-center text-sm transition-all"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Tier (Highlighted) */}
          <div className="glass-premium p-6 sm:p-8 rounded-2xl border-violet-500/40 glow-primary flex flex-col justify-between relative">
            <div className="absolute top-4 right-4 bg-violet-600 text-white font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Most Popular
            </div>
            <div>
              <h3 className="font-bold text-lg text-violet-400">Pro</h3>
              <p className="mt-1 text-sm text-neutral-400">For active creators and sports centers</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight">$19</span>
                <span className="ml-1 text-sm text-neutral-500">/ month</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-sm text-neutral-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Unlimited Leaderboards</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Unlimited Players</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Customizable Widgets & Embeds</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-violet-400" /> API Access Keys</li>
              </ul>
            </div>
            <Link 
              href="/login" 
              className="mt-8 w-full py-2 bg-violet-600 hover:bg-violet-500 font-semibold rounded-xl text-center text-sm transition-all shadow-lg shadow-violet-500/20"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Enterprise Tier */}
          <div className="glass p-6 sm:p-8 rounded-2xl border-white/5 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg">Enterprise</h3>
              <p className="mt-1 text-sm text-neutral-400">For agencies, portals, and organizations</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight">$99</span>
                <span className="ml-1 text-sm text-neutral-500">/ month</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-sm text-neutral-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> White Label Branding</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Webhooks & Zapier integrations</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Custom Domains</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dedicated Support SLAs</li>
              </ul>
            </div>
            <a 
              href="mailto:sales@leagueboard.com" 
              className="mt-8 w-full py-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 font-semibold rounded-xl text-center text-sm transition-all"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-neutral-950/60 py-8 px-6 md:px-12 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-neutral-500 font-medium">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-violet-400" />
          <span>&copy; {new Date().getFullYear()} LeagueBoard. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-neutral-300">Terms of Service</a>
          <a href="#" className="hover:text-neutral-300">Privacy Policy</a>
          <a href="mailto:support@leagueboard.com" className="hover:text-neutral-300">Support</a>
        </div>
      </footer>
    </div>
  );
}
