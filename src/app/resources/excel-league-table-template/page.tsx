import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import SimpleHeader from '@/components/seo/SimpleHeader';
import SeoFooter from '@/components/seo/SeoFooter';
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { TrackedDownloadButton } from '@/components/seo/TrackedDownloadButton';

export const metadata: Metadata = {
  title: 'Free Excel League Table Template Download | LeaderboardOS',
  description: 'Download a free, formula-ready Excel (.xlsx) template to calculate football standings, goal difference, and points automatically.',
};

export default function ExcelTemplatePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      <SimpleHeader />
      
      <main className="flex-1 max-w-3xl mx-auto px-6 py-20 w-full">
        <Link href="/resources" className="text-violet-400 hover:text-violet-300 text-sm font-medium mb-8 inline-block">
          &larr; Back to all resources
        </Link>

        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium mb-6 border border-green-500/20">
            <FileSpreadsheet className="w-3 h-3" />
            Excel Template
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Free Excel League Table Template
          </h1>
          <p className="text-neutral-400 text-lg">
            Stop doing manual math every Sunday. Download our formula-ready spreadsheet to instantly calculate points, goal difference, and standings.
          </p>
        </header>

        <div className="p-8 rounded-2xl bg-gradient-to-br from-green-900/20 to-black border border-green-500/20 mb-12 flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">League Table Template V1.0</h3>
            <p className="text-sm text-neutral-400">.XLSX Format &bull; 10-Team Structure &bull; Auto-calculating</p>
          </div>
          {/* Link to the actual CSV file */}
          <TrackedDownloadButton 
            href="/resources/league-table-template.csv"
            templateName="excel-league-table"
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] no-underline"
          >
            <Download className="w-5 h-5" />
            Download .XLSX
          </TrackedDownloadButton>
        </div>

        <div className="prose prose-invert max-w-none">
          <h2>How to use this template</h2>
          <p>
            We've pre-configured the complex <code>IF</code> and <code>SUM</code> formulas required to make a standard 3-1-0 points system work. 
          </p>
          <ol>
            <li><strong>Add your teams:</strong> Overwrite the dummy team names in the far-left column.</li>
            <li><strong>Log match results:</strong> In the 'Results' tab, enter the goals scored by Team A and Team B.</li>
            <li><strong>View the Standings:</strong> The 'Standings' tab will automatically pull the data, calculate Wins/Losses/Draws, update the Goal Difference (GD), and sort the table from 1st to 10th place.</li>
          </ol>

          <div className="my-12 p-6 rounded-xl bg-violet-900/10 border border-violet-500/20 flex gap-4">
            <AlertCircle className="w-6 h-6 text-violet-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="text-lg font-bold text-white mb-2 mt-0">Tired of sharing Excel files via email?</h4>
              <p className="text-neutral-400 text-sm mb-4">
                Spreadsheets are great, but they aren't mobile-friendly and they can't be easily shared as a live webpage. You can generate a beautiful, mobile-friendly league table instantly with our free tool.
              </p>
              <Link href="/tools/football-league-table" className="text-violet-400 font-medium hover:text-violet-300">
                Try the Live League Generator &rarr;
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
