import Link from 'next/link';
import { Trophy, Home, Search } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found on LeaderboardOS.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col items-center justify-center text-white px-6">
      <div className="text-center max-w-lg mx-auto">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full" />
          <Trophy className="w-20 h-20 text-violet-500 relative animate-pulse" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">404</h1>
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-300 mb-6">
          You've stepped out of bounds
        </h2>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          The page or leaderboard you're looking for doesn't exist. It might have been deleted, made private by the organizer, or the URL is incorrect.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all w-full sm:w-auto justify-center"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            href="/how-to-play"
            className="flex items-center gap-2 px-6 py-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-bold rounded-xl transition-all w-full sm:w-auto justify-center"
          >
            <Search className="w-4 h-4" />
            Help & Resources
          </Link>
        </div>
      </div>
    </div>
  );
}
