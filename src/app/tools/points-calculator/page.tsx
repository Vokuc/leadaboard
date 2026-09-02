import React from 'react';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import PointsCalculatorTool from './PointsCalculatorTool';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'League Points Calculator',
  description: 'Instantly calculate total sports league points based on wins, draws, and losses. Customize the points awarded for each result.',
  canonical: `${BASE_URL}/tools/points-calculator`,
});

export default function PointsCalculatorPage() {
  const faqs = [
    {
      q: 'How are league points calculated?',
      a: 'League points are calculated by multiplying the number of matches won, drawn, and lost by their respective point values, then adding those totals together. The standard formula is: (Wins × 3) + (Draws × 1) + (Losses × 0).',
    },
    {
      q: 'Can I change the points awarded for a win?',
      a: 'Yes, this calculator allows you to adjust the points system. While 3 points for a win is standard in modern football, some leagues use 2 points for a win, or offer bonus points for losses in certain sports (like rugby).',
    },
    {
      q: 'How do I calculate points for multiple teams?',
      a: 'This specific tool calculates points for a single team. If you want to calculate and sort points for an entire league of teams, use our free League Table Generator tool linked below.',
    },
    {
      q: 'What does the maximum possible points percentage mean?',
      a: 'The maximum possible points percentage shows how well a team is performing relative to perfection. If a team wins every single match they play, they will have 100% of the maximum possible points.',
    },
  ];

  const relatedTools = [
    {
      name: 'Football League Table Generator',
      href: '/tools/football-league-table',
      desc: 'Create a full standings table with the standard 3-points-for-a-win system.',
    },
    {
      name: 'League Table Generator',
      href: '/tools/league-table-generator',
      desc: 'A generic league table calculator with customizable points per win/draw/loss.',
    },
    {
      name: 'Online Leaderboard Maker',
      href: '/tools/leaderboard-maker',
      desc: 'Create a custom event-based leaderboard for gaming, fitness, or sales.',
    },
  ];

  return (
    <ToolPageWrapper
      title="Points Calculator"
      description="Quickly calculate total league points based on match results. Perfect for checking points scenarios for sports like football, rugby, and cricket."
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <PointsCalculatorTool />
    </ToolPageWrapper>
  );
}
