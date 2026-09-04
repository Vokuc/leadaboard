import React from 'react';
import { SeoPageContent } from '@/lib/seo/content';
import { Sparkles, Zap, Shield } from 'lucide-react';

interface SeoBenefitsProps {
  content: SeoPageContent;
}

export default function SeoBenefits({ content }: SeoBenefitsProps) {
  if (!content.benefits || content.benefits.length === 0) return null;

  const icons = [Sparkles, Zap, Shield];

  return (
    <section className="py-20 px-6 bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Why use LeaderboardOS?
            </h2>
            <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
              We've built the most robust platform for managing live standings, giving you peace of mind while your users get a flawless experience.
            </p>
            
            <div className="space-y-8">
              {content.benefits.map((benefit, idx) => {
                const Icon = icons[idx % icons.length];
                return (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center border border-neutral-800">
                      <Icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                      <p className="text-neutral-400">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/20 to-cyan-500/20 blur-3xl rounded-full" />
            <div className="glass p-2 rounded-3xl border-white/10 relative z-10">
              <img 
                src="/og-default.jpg" 
                alt="LeaderboardOS Dashboard Preview" 
                className="w-full h-auto rounded-2xl border border-white/5 opacity-90"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
