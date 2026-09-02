import React from 'react';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import LeaderboardMakerTool from './LeaderboardMakerTool';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Free Online Leaderboard Maker',
  description: 'Create a custom online leaderboard instantly. Add participants, assign scores, and generate a ranked standings board for any competition or event.',
  canonical: `${BASE_URL}/tools/leaderboard-maker`,
});

export default function LeaderboardMakerPage() {
  const faqs = [
    {
      q: 'How do I create a custom leaderboard?',
      a: 'Simply type a name for your leaderboard, add your participants, and enter their scores. The leaderboard will automatically sort itself from highest score to lowest in real-time.',
    },
    {
      q: 'Can I change the score label?',
      a: 'Yes, you can change the score unit label to anything you want — "Points", "XP", "Sales ($)", or "Goals".',
    },
    {
      q: 'Is there a limit to how many participants I can add?',
      a: 'There is no hard limit in this tool, but for leaderboards with dozens or hundreds of participants, we highly recommend signing up for LeaderboardOS to manage them properly with real-time updates and multiple scoring events.',
    },
    {
      q: 'How do I share the leaderboard?',
      a: 'You can export your leaderboard as text to paste into Discord/Slack, or download it as a CSV. If you want a live URL to share with your group, use the LeaderboardOS app by clicking "Create Free Leaderboard" at the bottom of the page.',
    },
    {
      q: 'What types of competitions can I use this for?',
      a: 'This generic leaderboard maker is perfect for sales teams, fitness challenges, reading goals, classroom points, or custom gaming tournaments.',
    },
  ];

  const relatedTools = [
    {
      name: 'League Table Generator',
      href: '/tools/league-table-generator',
      desc: 'Generate a league standings table with automated points, goal difference, and win percentage.',
    },
    {
      name: 'Tournament Bracket Generator',
      href: '/tools/tournament-generator',
      desc: 'Build and track a single-elimination tournament bracket.',
    },
  ];

  return (
    <ToolPageWrapper
      title="Online Leaderboard Maker"
      description="Create, rank, and share a custom leaderboard online instantly. Perfect for sales teams, fitness challenges, and custom gaming events."
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <LeaderboardMakerTool />
    </ToolPageWrapper>
  );
}
