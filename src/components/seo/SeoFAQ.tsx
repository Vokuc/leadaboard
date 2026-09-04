'use client';
import React, { useState } from 'react';
import { SeoPageContent } from '@/lib/seo/content';
import { ChevronDown } from 'lucide-react';

interface SeoFAQProps {
  content: SeoPageContent;
}

export default function SeoFAQ({ content }: SeoFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!content.faq || content.faq.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-black">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-neutral-400 text-lg">
            Everything you need to know about setting up your {content.slug.replace(/-/g, ' ')}.
          </p>
        </div>

        <div className="space-y-4">
          {content.faq.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx} 
                className={`glass border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-violet-500/50 bg-violet-900/5' : 'border-white/5 hover:border-white/20'}`}
              >
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                >
                  <span className="text-lg font-semibold text-white">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-neutral-400 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
