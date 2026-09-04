import React from 'react';
import Link from 'next/link';
import { DiscoveryLeaderboard } from '@/lib/discovery/queries';
import { Users, Calendar, Trophy } from 'lucide-react';
import Image from 'next/image';

interface Props {
  leaderboard: DiscoveryLeaderboard;
}

export default function LeaderboardCard({ leaderboard }: Props) {
  const date = new Date(leaderboard.updated_at);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);

  return (
    <Link 
      href={`/leaderboards/${leaderboard.slug}`}
      className="group glass p-5 rounded-2xl border border-white/5 hover:border-violet-500/30 hover:bg-neutral-900/60 transition-all flex flex-col h-full overflow-hidden relative"
    >
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/0 via-violet-600/0 to-violet-600/5 group-hover:to-violet-600/10 transition-colors pointer-events-none" />

      {leaderboard.cover_image_url && (
        <div className="w-full h-32 rounded-xl overflow-hidden mb-4 relative bg-neutral-900">
          <Image
            src={leaderboard.cover_image_url}
            alt={`${leaderboard.name} cover`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      {!leaderboard.cover_image_url && (
        <div className="w-full h-32 rounded-xl mb-4 relative bg-violet-900/20 border border-violet-500/10 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-violet-500/50" />
        </div>
      )}

      <h3 className="text-xl font-bold text-white group-hover:text-violet-300 transition-colors mb-2 line-clamp-1">
        {leaderboard.name}
      </h3>
      
      {leaderboard.description ? (
        <p className="text-sm text-neutral-400 leading-relaxed flex-1 line-clamp-2 mb-4">
          {leaderboard.description}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5 bg-neutral-900/50 px-2 py-1 rounded-md border border-neutral-800">
          <Users className="w-3.5 h-3.5" />
          <span>{leaderboard.rankings_count} entries</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 font-medium">
          <span className="capitalize">{leaderboard.engine.replace('_', ' ')}</span>
        </div>
      </div>
    </Link>
  );
}
