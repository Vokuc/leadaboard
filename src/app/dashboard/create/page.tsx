'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DatabaseService } from '@/lib/db';
import { CompetitionType, VisibilityType, ScoringRule, Season } from '@/types';
import { 
  Trophy, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  Info,
  Calendar,
  Sparkles,
  Lock,
  Globe
} from 'lucide-react';
import Link from 'next/link';

interface ScoringRuleInput {
  event_name: string;
  points: number;
  description: string;
}

const coverArtTemplates: Record<CompetitionType, string> = {
  gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
  fitness: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80',
  workplace: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
  reading: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
  education: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=800&q=80',
  custom: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80'
};

const rulePresets: Record<CompetitionType, ScoringRuleInput[]> = {
  gaming: [
    { event_name: 'Win Match', points: 30, description: 'Awarded when the team wins a full match' },
    { event_name: 'Match MVP', points: 15, description: 'Selected as the most valuable player of the round' },
    { event_name: 'Kill Streak (5)', points: 10, description: 'Achieved 5 consecutive eliminations' },
    { event_name: 'Match Loss', points: -10, description: 'Penalty for losing a match' }
  ],
  sports: [
    { event_name: 'Match Won', points: 3, description: 'Team wins a match' },
    { event_name: 'Match Drawn', points: 1, description: 'Team draws a match' },
    { event_name: 'Match Lost', points: 0, description: 'Team loses a match' }
  ],
  fitness: [
    { event_name: 'Activity Completed', points: 50, description: 'Completed a workout session' },
    { event_name: 'New Personal Record', points: 100, description: 'Broke a historical personal milestone' },
    { event_name: 'Daily Streak Milestone', points: 30, description: 'Finished a 5-day active logging streak' }
  ],
  workplace: [
    { event_name: 'Deal Closed', points: 100, description: 'Closed a new enterprise customer contract' },
    { event_name: 'Meeting Booked', points: 15, description: 'Successfully scheduled a qualified demo' },
    { event_name: 'Upsell Landed', points: 50, description: 'Added user seats to existing customer contracts' }
  ],
  reading: [
    { event_name: 'Book Finished', points: 100, description: 'Completed reading a full book' },
    { event_name: 'Chapter Finished', points: 10, description: 'Completed a single chapter' }
  ],
  education: [
    { event_name: 'Test Aced', points: 50, description: 'Achieved a grade of 95% or higher on a test' },
    { event_name: 'Homework Submitted', points: 10, description: 'Submitted coursework assignments on time' }
  ],
  custom: [
    { event_name: 'Gold Achievement', points: 50, description: 'Completed a primary goal' },
    { event_name: 'Silver Achievement', points: 25, description: 'Completed a secondary goal' }
  ]
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to create leaderboard. Please try again.';
}

export default function CreateLeaderboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    }
  }, [profile, authLoading, router]);

  // Wizard Steps: 1 = Basic Info, 2 = Scoring, 3 = Season, 4 = Finish
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [competitionType, setCompetitionType] = useState<CompetitionType>('gaming');
  const [coverImageUrl, setCoverImageUrl] = useState(coverArtTemplates.gaming);
  
  // Scoring rules list
  const [scoringRules, setScoringRules] = useState<ScoringRuleInput[]>([]);
  // Input fields for current rule builder
  const [ruleName, setRuleName] = useState('');
  const [rulePoints, setRulePoints] = useState<number>(10);
  const [ruleDesc, setRuleDesc] = useState('');

  // Season Fields
  const [hasSeason, setHasSeason] = useState(true);
  const [seasonName, setSeasonName] = useState('Season 1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  // Load rules template based on type
  const loadPresetRules = () => {
    setScoringRules(rulePresets[competitionType]);
  };

  const handleCompetitionTypeChange = (nextType: CompetitionType) => {
    setCompetitionType(nextType);
    setCoverImageUrl(coverArtTemplates[nextType]);
  };

  const handleAddRule = () => {
    if (!ruleName.trim()) return;
    const newRule: ScoringRuleInput = {
      event_name: ruleName.trim(),
      points: rulePoints,
      description: ruleDesc.trim()
    };
    setScoringRules([...scoringRules, newRule]);
    setRuleName('');
    setRulePoints(10);
    setRuleDesc('');
  };

  const handleDeleteRule = (idx: number) => {
    setScoringRules(scoringRules.filter((_, i) => i !== idx));
  };

  const handleNextStep = () => {
    if (step === 1 && !name.trim()) {
      setError('Please supply a leaderboard name.');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substr(2, 4);

      const rulesToInsert: Omit<ScoringRule, 'id' | 'leaderboard_id' | 'created_at'>[] = scoringRules.map((r) => ({
        event_name: r.event_name,
        points: r.points,
        description: r.description || null
      }));

      const seasonToInsert: Omit<Season, 'id' | 'leaderboard_id' | 'created_at'> | null = hasSeason ? {
        name: seasonName,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null
      } : null;

      const created = await DatabaseService.createLeaderboard(
        {
          name,
          description: description || null,
          slug,
          visibility,
          competition_type: competitionType,
          cover_image_url: coverImageUrl || null
        },
        rulesToInsert,
        seasonToInsert
      );

      router.push(`/dashboard/leaderboards/${created.id}`);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <Trophy className="w-8 h-8 text-violet-500 animate-bounce" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col text-white pb-16">
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-500" />
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            LeagueBoard
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 mt-10">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center flex-1 last:flex-initial">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === num 
                  ? 'bg-violet-600 border border-violet-500 text-white scale-110 glow-primary' 
                  : step > num 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' 
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-500'
              }`}>
                {step > num ? <Check className="w-4 h-4" /> : num}
              </div>
              {num < 3 && (
                <div className={`h-0.5 flex-1 mx-4 transition-all ${
                  step > num ? 'bg-emerald-500/30' : 'bg-neutral-850'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="glass-premium p-6 sm:p-8 rounded-2xl glow-primary shadow-2xl relative overflow-hidden">
          {/* STEP 1: Basic Info & Visibility */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 1: Competition Identity</h2>
                <p className="text-xs text-neutral-400 mt-1">Provide a name, visibility configurations, and pick a template.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Leaderboard Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyber League - Apex Qualifier"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Summarize rules, tournament structure, or reward schedules..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Competition Type
                  </label>
                  <select
                    value={competitionType}
                    onChange={(e) => handleCompetitionTypeChange(e.target.value as CompetitionType)}
                    className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all cursor-pointer"
                  >
                    <option value="gaming">Gaming / Esports</option>
                    <option value="sports">Sports Tournament</option>
                    <option value="fitness">Fitness / Health Run</option>
                    <option value="workplace">Workplace SDRs / Sales</option>
                    <option value="reading">Reading Marathon</option>
                    <option value="education">Education / Classroom</option>
                    <option value="custom">Custom Tracker</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Privacy Visibility
                  </label>
                  <div className="flex gap-2 p-1 bg-neutral-950/60 border border-neutral-850 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setVisibility('public')}
                      className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        visibility === 'public' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" /> Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        visibility === 'private' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" /> Private
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Cover Image URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/banner.jpg"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all"
                />
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer"
                >
                  Configure Scoring <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Scoring Rules builder */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Step 2: Scoring Rules Engine</h2>
                    <p className="text-xs text-neutral-400 mt-1">Specify how users earn points. Add points for wins or deduct for penatlies.</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={loadPresetRules}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Apply {competitionType} Preset
                  </button>
                </div>
              </div>

              {/* Scoring Event Form Panel */}
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-850 space-y-4">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wide">Add Custom Score Event</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                      Event Action Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Win Match"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      className="block w-full px-3 py-1.5 bg-neutral-950/60 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                      Points Weight
                    </label>
                    <input
                      type="number"
                      value={rulePoints}
                      onChange={(e) => setRulePoints(parseInt(e.target.value) || 0)}
                      className="block w-full px-3 py-1.5 bg-neutral-950/60 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Event Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Briefly state when this points trigger fires..."
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-neutral-950/60 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 rounded-lg text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-400" /> Save Score Rule
                </button>
              </div>

              {/* Rules List Preview */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Configured Score Rules ({scoringRules.length})
                </h4>

                {scoringRules.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-neutral-850 rounded-xl text-neutral-500 text-xs flex flex-col items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>No scoring rules added yet. Standard custom rules can be configured, or click the preset button above.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {scoringRules.map((rule, idx) => (
                      <div 
                        key={idx}
                        className="flex justify-between items-center p-3 rounded-xl bg-neutral-950/60 border border-neutral-850 text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{rule.event_name}</span>
                          {rule.description && (
                            <span className="block text-[10px] text-neutral-500 mt-0.5">{rule.description}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`font-bold px-2 py-0.5 rounded-lg ${
                            rule.points >= 0 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {rule.points >= 0 ? `+${rule.points}` : rule.points}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(idx)}
                            className="p-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-between">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-900 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Identity Details
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer"
                >
                  Configure Season <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Seasons configurations */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Step 3: Season & Timeline</h2>
                <p className="text-xs text-neutral-400 mt-1">Configure competition limits. Season scores reset and archive once final date is reached.</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/40 border border-neutral-850">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-violet-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Schedule Season Limits</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">Define starting dates or run indefinite tracking.</span>
                  </div>
                </div>
                
                <input
                  type="checkbox"
                  checked={hasSeason}
                  onChange={(e) => setHasSeason(e.target.checked)}
                  className="w-4 h-4 accent-violet-600 bg-neutral-950 border border-neutral-800 rounded focus:ring-1 cursor-pointer"
                />
              </div>

              {hasSeason && (
                <div className="space-y-4 animate-pulse-glow/0">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Season Title Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Season 1: Alpha Sprint"
                      value={seasonName}
                      onChange={(e) => setSeasonName(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-neutral-900/60 border border-neutral-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex justify-between">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-900 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Configure Scoring
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer glow-primary"
                >
                  {loading ? 'Compiling Board...' : 'Finish & Generate'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
