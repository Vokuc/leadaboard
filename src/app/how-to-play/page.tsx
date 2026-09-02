import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Trophy } from 'lucide-react';

import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'How to Play',
  description:
    'Learn how to set up and publish your first real-time leaderboard with LeagueBoard. Create competitions for gaming, sports, fitness, and the workplace in under a minute.',
  canonical: `${BASE_URL}/how-to-play`,
});



const steps = [
  'Create a leaderboard from your dashboard and pick the competition type that matches your use case.',
  'Add players or teams, then define your scoring rules and season dates.',
  'Share your public leaderboard link and keep results updated in real time.',
  'Upgrade to Pro or Business when you need higher limits and advanced features.',
];

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-black bg-grid text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2 text-violet-300">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">How to Play</h1>
          </div>

          <p className="mt-4 text-sm text-neutral-300 leading-relaxed">
            LeagueBoard lets you run and publish live rankings for sports, gaming, and workplace competitions. Follow this quick flow to get up and running.
          </p>

          <div className="mt-6 space-y-4">
            {steps.map((step) => (
              <div key={step} className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                <p className="text-sm text-neutral-200 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
