import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import SimpleHeader from '@/components/seo/SimpleHeader';
import SeoFooter from '@/components/seo/SeoFooter';
import { Download, FileSpreadsheet, FileImage } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free Templates & Resources | LeaderboardOS',
  description: 'Download free tournament brackets, excel league table templates, and scoring checklists to organize your next competition.',
};

export default function ResourcesIndex() {
  const resources = [
    {
      title: 'Excel League Table Template',
      description: 'A pre-formatted, formula-ready .xlsx file to instantly calculate points, goal difference, and standings for a 10-team league.',
      href: '/resources/excel-league-table-template',
      icon: <FileSpreadsheet className="w-8 h-8 text-green-400" />,
      type: 'Spreadsheet'
    },
    {
      title: 'Printable Tournament Brackets',
      description: 'High-resolution, blank 8-team, 16-team, and 32-team tournament brackets. Perfect for office pools and pub games.',
      href: '/resources/printable-tournament-brackets',
      icon: <FileImage className="w-8 h-8 text-blue-400" />,
      type: 'PDF / Image'
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      <SimpleHeader />
      
      <main className="flex-1 max-w-5xl mx-auto px-6 py-24 w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Free Templates & Resources
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            High-quality downloads to help you organize your next competition. No email required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.map((resource, i) => (
            <Link 
              key={i}
              href={resource.href}
              className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-violet-500/30 transition-all flex flex-col items-start"
            >
              <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {resource.icon}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                {resource.type}
              </div>
              <h2 className="text-2xl font-bold mb-3 group-hover:text-violet-300 transition-colors">
                {resource.title}
              </h2>
              <p className="text-neutral-400 mb-6 flex-1">
                {resource.description}
              </p>
              <div className="flex items-center gap-2 text-violet-400 font-medium group-hover:text-violet-300">
                <Download className="w-4 h-4" /> Download Now
              </div>
            </Link>
          ))}
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
