'use client';

import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { CompetitionRules } from '@/types';
import { explainRankingRules } from '@/lib/competition/rules/evaluator';

interface RulesExplainerCardProps {
  rules: CompetitionRules | null;
  compact?: boolean;
}

export function RulesExplainerCard({ rules, compact = false }: RulesExplainerCardProps) {
  if (!rules) return null;

  const explanations = explainRankingRules(rules);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        <span className="font-semibold text-neutral-300">Rules (v{rules.version}):</span>
        {explanations.map((exp, idx) => (
          <span key={idx} className="rounded bg-white/5 px-2 py-0.5 text-neutral-300">
            {exp}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-white/5 p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          Scoring & Tie-Breaking Rules
        </div>
        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-violet-300">
          Version {rules.version}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-xs">
        {explanations.map((exp, idx) => (
          <div key={idx} className="flex items-start gap-2 text-neutral-300">
            <Info className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{exp}</span>
          </div>
        ))}
      </div>

      {rules.tie_breakers && rules.tie_breakers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">
            Tie-Break Hierarchy
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {rules.tie_breakers.map((tb, idx) => (
              <React.Fragment key={`${tb.type}-${idx}`}>
                <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[11px] font-medium text-neutral-200">
                  <span className="font-bold text-violet-400">{idx + 1}.</span> {tb.label}
                  {tb.direction === 'asc' && <span className="text-[9px] text-neutral-500">(low)</span>}
                </span>
                {idx < rules.tie_breakers.length - 1 && (
                  <span className="text-neutral-600 text-xs">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
