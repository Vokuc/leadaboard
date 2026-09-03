import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Trophy, Zap, LayoutTemplate } from 'lucide-react';
import { MarketplaceTemplate } from '@/lib/templates/marketplace';

interface TemplatePageWrapperProps {
  template: MarketplaceTemplate;
  children: ReactNode;
}

export default function TemplatePageWrapper({ template, children }: TemplatePageWrapperProps) {
  // Convert config to URL parameters
  const params = new URLSearchParams();
  params.set('name', template.creationConfig.name);
  params.set('type', template.creationConfig.type);
  params.set('engine', template.creationConfig.engine);
  params.set('template', template.creationConfig.template);
  if (template.creationConfig.rulesUrlString) {
    params.set('rules', template.creationConfig.rulesUrlString);
  }
  
  const createUrl = `/dashboard/create?${params.toString()}`;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header/Nav */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-all">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white group-hover:text-violet-400 transition-colors">
              LeaderboardOS
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/templates" className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block">
              Templates
            </Link>
            <Link
              href="/dashboard/create"
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-16">
        
        {/* Breadcrumb & Header */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Link href="/templates" className="hover:text-white transition-colors">Templates</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-violet-400">{template.category}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">{template.h1}</span>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
                {template.h1}
              </h1>
              <p className="text-xl text-neutral-400 leading-relaxed">
                {template.explanation}
              </p>
            </div>
            
            <div className="shrink-0 w-full md:w-auto p-6 rounded-2xl border border-violet-500/20 bg-violet-950/20 text-center space-y-4 shadow-xl">
              <LayoutTemplate className="w-12 h-12 text-violet-400 mx-auto" />
              <div>
                <h3 className="font-bold text-lg text-white">Ready to deploy?</h3>
                <p className="text-sm text-neutral-400 max-w-xs mt-1">Start tracking scores in under 60 seconds with this pre-configured template.</p>
              </div>
              <Link
                href={createUrl}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 mt-4"
              >
                Use this Template <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {children}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/5">
          {/* Features */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Key Features</h2>
            <ul className="space-y-4">
              {template.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3 text-neutral-300">
                  <div className="mt-1 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                  </div>
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Use Cases */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Popular Use Cases</h2>
            <div className="grid gap-4">
              {template.useCases.map((useCase, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                  <h4 className="font-bold text-white text-lg">{useCase.title}</h4>
                  <p className="text-neutral-400 mt-1">{useCase.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* FAQs */}
        {template.faqs.length > 0 && (
          <section className="pt-12 border-t border-white/5 space-y-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {template.faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden open:bg-neutral-900/80 transition-colors"
                >
                  <summary className="flex items-center justify-between p-5 font-semibold cursor-pointer select-none">
                    {faq.q}
                    <ChevronRight className="w-5 h-5 text-neutral-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-5 pb-5 text-neutral-400 text-sm leading-relaxed border-t border-neutral-800/50 pt-4 mt-1">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-auto bg-black text-center text-neutral-500 text-sm">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
