'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlignLeft, ArrowUp, ExternalLink } from 'lucide-react';
import { DocHeading } from '@/lib/docs/api';

interface DocsTableOfContentsProps {
  headings: DocHeading[];
}

export default function DocsTableOfContents({ headings }: DocsTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '0px 0px -65% 0px',
        threshold: 0.1,
      }
    );

    headings.forEach((heading) => {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside className="hidden xl:block w-64 shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pl-6 border-l border-white/10 text-xs">
      <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-neutral-400 mb-4">
        <AlignLeft className="w-3.5 h-3.5" />
        On This Page
      </div>

      <nav className="space-y-1">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          return (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              className={`block py-1 transition-colors leading-relaxed ${
                heading.level === 3 ? 'pl-3' : ''
              } ${
                isActive
                  ? 'text-violet-400 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {heading.text}
            </a>
          );
        })}
      </nav>

      <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
        <button
          onClick={scrollToTop}
          type="button"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Back to top
        </button>

        <Link
          href="/dashboard/create"
          className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors font-medium"
        >
          <span>Open Creator Console</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </aside>
  );
}
