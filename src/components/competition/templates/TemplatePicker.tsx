'use client';

import React, { useState } from 'react';
import {
  CompetitionTemplateDefinition,
  REUSABLE_COMPETITION_TEMPLATES,
} from '@/lib/competition/templates/registry';
import {
  Trophy,
  Swords,
  RotateCw,
  Flame,
  GraduationCap,
  Sparkles,
  Check,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface TemplatePickerProps {
  onSelectTemplate: (template: CompetitionTemplateDefinition) => void;
  selectedTemplateKey?: string;
}

export function TemplatePicker({ onSelectTemplate, selectedTemplateKey }: TemplatePickerProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'league_table' | 'tournament' | 'simple_points'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<CompetitionTemplateDefinition | null>(null);

  const filteredTemplates = REUSABLE_COMPETITION_TEMPLATES.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.engine === activeFilter;
  });

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'league':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'knockout':
        return <Swords className="w-5 h-5 text-violet-400" />;
      case 'round_robin':
        return <RotateCw className="w-5 h-5 text-blue-400" />;
      case 'points_race':
        return <Layers className="w-5 h-5 text-emerald-400" />;
      case 'fitness':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'quiz':
        return <GraduationCap className="w-5 h-5 text-cyan-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Pills */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Competition Templates
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Choose a verified, pre-configured competition blueprint or start from scratch.
          </p>
        </div>

        {/* Engine Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900/80 rounded-xl border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'all'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Formats
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('league_table')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'league_table'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Leagues
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('tournament')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'tournament'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Tournaments
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('simple_points')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'simple_points'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Points
          </button>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((item) => {
          const isSelected = selectedTemplateKey === item.key;
          return (
            <div
              key={item.key}
              className={`group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 text-left bg-gradient-to-b from-neutral-900/90 to-neutral-950/90 backdrop-blur-sm ${
                isSelected
                  ? 'border-violet-500 shadow-xl shadow-violet-500/10 ring-2 ring-violet-500/30'
                  : 'border-white/10 hover:border-white/20 hover:shadow-lg'
              }`}
            >
              <div>
                {/* Header: Icon, Format, Version */}
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:scale-105 transition-transform">
                    {getFormatIcon(item.format)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-neutral-400">
                      v{item.version}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                      {item.format.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Name & Description */}
                <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                  {item.name}
                </h4>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                {/* Quick Rules Summary */}
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2 text-[11px] text-neutral-300">
                  {item.engine === 'league_table' && (
                    <span className="px-2 py-0.5 rounded bg-neutral-800/80 border border-white/5">
                      Win: <strong className="text-white">{item.rules.points_for_win} pts</strong> &bull; Draw:{' '}
                      <strong className="text-white">{item.rules.points_for_draw} pts</strong>
                    </span>
                  )}
                  {item.engine === 'tournament' && (
                    <span className="px-2 py-0.5 rounded bg-neutral-800/80 border border-white/5">
                      Knockout Bracket &bull; {item.fixture_settings.default_bracket_size} Teams
                    </span>
                  )}
                  {item.engine === 'simple_points' && item.rules.scoring_rules && (
                    <span className="px-2 py-0.5 rounded bg-neutral-800/80 border border-white/5">
                      {item.rules.scoring_rules.length} Scoring Presets
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-neutral-800/80 border border-white/5 capitalize">
                    {item.entity_type}s
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(item)}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-white/5"
                >
                  <Info className="w-3.5 h-3.5" />
                  Details
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTemplate(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Selected
                    </>
                  ) : (
                    <>
                      Use Template <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Details Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30">
                  {getFormatIcon(previewTemplate.format)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{previewTemplate.name}</h3>
                  <p className="text-xs text-neutral-400">
                    Version {previewTemplate.version} &bull; Engine: {previewTemplate.engine}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">{previewTemplate.description}</p>

            <div className="space-y-3 bg-neutral-950/60 p-4 rounded-xl border border-white/5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400">Competition Type</span>
                <span className="text-white capitalize">{previewTemplate.competition_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400">Participant Entity</span>
                <span className="text-white capitalize">{previewTemplate.entity_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400">Tie Breakers</span>
                <span className="text-white">{previewTemplate.tie_breakers.join(' &rarr; ')}</span>
              </div>
              {previewTemplate.fixture_settings.match_duration_minutes > 0 && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Match Duration</span>
                  <span className="text-white">
                    {previewTemplate.fixture_settings.match_duration_minutes} mins (+
                    {previewTemplate.fixture_settings.buffer_minutes}m buffer)
                  </span>
                </div>
              )}
            </div>

            {/* Scoring Rules if simple_points */}
            {previewTemplate.rules.scoring_rules && previewTemplate.rules.scoring_rules.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-neutral-300">Preset Scoring Rules:</h5>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {previewTemplate.rules.scoring_rules.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 border border-white/5 text-xs"
                    >
                      <span className="text-neutral-200">{r.event_name}</span>
                      <span className="font-mono font-bold text-violet-400">
                        {r.points > 0 ? `+${r.points}` : r.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 transition-all flex items-center gap-1.5"
              >
                Apply Blueprint <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
