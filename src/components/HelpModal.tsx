'use client';

import React, { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpSection {
  heading: string;
  items: string[];
}

interface HelpModalProps {
  title: string;
  description?: string;
  sections: HelpSection[];
  label?: string;
  className?: string;
}

export default function HelpModal({ title, description, sections, label = 'How to use', className }: HelpModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer text-xs font-semibold ${className ?? ''}`}
      >
        <HelpCircle className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative glass-premium w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {description && (
              <p className="text-sm text-neutral-400 mb-5">{description}</p>
            )}

            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.heading}>
                  <h3 className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-2">
                    {section.heading}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, idx) => (
                      <li key={idx} className="text-sm text-neutral-300 flex gap-2 leading-relaxed">
                        <span className="text-violet-500 mt-1 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
