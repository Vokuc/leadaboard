import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import SimpleHeader from '@/components/seo/SimpleHeader';
import SeoFooter from '@/components/seo/SeoFooter';
import { Download, FileImage, LayoutList } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free Printable Tournament Brackets (PDF) | LeaderboardOS',
  description: 'Download high-resolution, blank printable tournament brackets for 8-team, 16-team, and 32-team competitions. Perfect for office pools and local events.',
};

export default function PrintableBracketsPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      <SimpleHeader />
      
      <main className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
        <Link href="/resources" className="text-violet-400 hover:text-violet-300 text-sm font-medium mb-8 inline-block">
          &larr; Back to all resources
        </Link>

        <header className="mb-12 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium mb-6 border border-blue-500/20">
            <FileImage className="w-3 h-3" />
            Printable Assets
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Printable Tournament Brackets
          </h1>
          <p className="text-neutral-400 text-lg">
            Running a local beer pong tournament or an office pool? Download our clean, high-resolution blank bracket PDFs.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* 8 Team */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-2xl font-black">8</span>
            </div>
            <h3 className="font-bold mb-2">8-Team Bracket</h3>
            <p className="text-xs text-neutral-400 mb-6">Standard 3-round knockout bracket.</p>
            <a href="/resources/8-team-bracket.svg" download className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 no-underline">
              <Download className="w-4 h-4" /> Download SVG
            </a>
          </div>

          {/* 16 Team */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-2xl font-black">16</span>
            </div>
            <h3 className="font-bold mb-2">16-Team Bracket</h3>
            <p className="text-xs text-neutral-400 mb-6">Standard 4-round knockout bracket.</p>
            <a href="/resources/16-team-bracket.svg" download className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 no-underline">
              <Download className="w-4 h-4" /> Download SVG
            </a>
          </div>

          {/* 32 Team */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-2xl font-black">32</span>
            </div>
            <h3 className="font-bold mb-2">32-Team Bracket</h3>
            <p className="text-xs text-neutral-400 mb-6">Standard 5-round knockout bracket.</p>
            <a href="/resources/32-team-bracket.svg" download className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 no-underline">
              <Download className="w-4 h-4" /> Download SVG
            </a>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-br from-violet-900/20 to-black border border-violet-500/30 text-center flex flex-col items-center">
          <LayoutList className="w-10 h-10 text-violet-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Go Digital Instantly</h2>
          <p className="text-neutral-400 max-w-lg mb-6">
            Paper brackets get lost and ruined. Generate a beautiful, live digital tournament bracket that your friends can check on their phones.
          </p>
          <Link href="/tools/tournament-generator" className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-colors glow-primary">
            Use the Live Bracket Generator
          </Link>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
