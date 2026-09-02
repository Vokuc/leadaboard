import React from 'react';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import TournamentGeneratorTool from './TournamentGeneratorTool';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Free Tournament Bracket Generator',
  description: 'Create and visualize a single-elimination tournament bracket for up to 32 players or teams. Generate matchups instantly.',
  canonical: `${BASE_URL}/tools/tournament-generator`,
});

export default function TournamentGeneratorPage() {
  const faqs = [
    {
      q: 'How does the tournament bracket generator work?',
      a: 'Add your players or teams to the participant list. The tool automatically calculates the required bracket size (next power of 2) and generates the first-round matchups. If you have an odd number of players, it will automatically assign "Byes" to balance the bracket.',
    },
    {
      q: 'What is a "Bye" in a tournament?',
      a: 'A "Bye" means a participant automatically advances to the next round without having to play a match. This happens when the number of players is not exactly a power of 2 (e.g., 4, 8, 16, 32).',
    },
    {
      q: 'How do I advance players to the next round?',
      a: 'This free visualizer is designed to help you quickly build and plan your initial Round 1 matchups. To actually track scores and advance players through the tournament rounds, sign up for a free LeaderboardOS account and select the "Tournament" mode.',
    },
    {
      q: 'What is the maximum number of participants?',
      a: 'This visualizer supports up to 32 participants (which creates a 5-round tournament including the final). For larger tournaments, use the full LeaderboardOS application.',
    },
  ];

  const relatedTools = [
    {
      name: 'Online Leaderboard Maker',
      href: '/tools/leaderboard-maker',
      desc: 'Create a custom event-based leaderboard for gaming, fitness, or sales.',
    },
    {
      name: 'League Table Generator',
      href: '/tools/league-table-generator',
      desc: 'Generate a league standings table with automated points, goal difference, and win percentage.',
    },
  ];

  return (
    <ToolPageWrapper
      title="Tournament Bracket Generator"
      description="Build a single-elimination tournament bracket instantly. Add up to 32 players and visualize your first-round matchups."
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <TournamentGeneratorTool />
    </ToolPageWrapper>
  );
}
