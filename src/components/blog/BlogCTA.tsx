import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface BlogCTAProps {
  title?: string;
  description?: string;
  buttonText?: string;
  href?: string;
}

export default function BlogCTA({
  title = "Ready to create your own leaderboard?",
  description = "Join thousands of users building real-time leaderboards, league tables, and tournament brackets in minutes.",
  buttonText = "Start Building for Free",
  href = "/dashboard"
}: BlogCTAProps) {
  return (
    <div className="my-12 p-8 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/30 text-center flex flex-col items-center">
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-neutral-400 mb-6 max-w-lg">{description}</p>
      <Link
        href={href}
        className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all cursor-pointer glow-primary"
      >
        {buttonText}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
