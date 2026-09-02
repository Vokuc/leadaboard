import React from 'react';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import LeagueTableTool from './LeagueTableTool';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Free League Table Generator',
  description: 'Create and calculate league standings online. Enter wins, draws, and losses to automatically generate a league table with points and goal difference.',
  canonical: `${BASE_URL}/tools/league-table-generator`,
});

export default function LeagueTableGeneratorPage() {
  const faqs = [
    {
      q: 'How does the league table generator work?',
      a: 'Simply enter your team names and their match results (Wins, Draws, Losses, Goals For, Goals Against). The tool instantly calculates their Points (Pts) and Goal Difference (GD), then automatically sorts the table according to standard league rules.',
    },
    {
      q: 'Can I change the points system?',
      a: 'Yes! Click the gear icon next to the Share button to adjust how many points are awarded for a Win, Draw, or Loss. The standard is 3 for a win and 1 for a draw, but you can customize it for your specific sport or competition.',
    },
    {
      q: 'How is Goal Difference (GD) calculated?',
      a: 'Goal Difference is calculated by subtracting Goals Against (GA) from Goals For (GF). It is the most common tie-breaker in league formats when teams have the same number of points.',
    },
    {
      q: 'How do I save my league table?',
      a: 'You can use the "Copy Text" or "Download CSV" buttons to export your standings instantly. If you want a permanent, shareable webpage that updates in real-time, click "Create Free Leaderboard" at the bottom to sign up for LeaderboardOS.',
    },
    {
      q: 'Is this tool completely free?',
      a: 'Yes, this league table generator is 100% free to use with no signup required. You only need an account if you want to host your leaderboard permanently on LeaderboardOS.',
    },
  ];

  const relatedTools = [
    {
      name: 'Football League Table Generator',
      href: '/tools/football-league-table',
      desc: 'A pre-configured version specifically optimized for football/soccer standings.',
    },
    {
      name: 'Points Calculator',
      href: '/tools/points-calculator',
      desc: 'Quickly calculate total league points from W/D/L records.',
    },
    {
      name: 'Online Leaderboard Maker',
      href: '/tools/leaderboard-maker',
      desc: 'Create a custom event-based leaderboard for gaming, fitness, or sales.',
    },
  ];

  return (
    <ToolPageWrapper
      title="League Table Generator"
      description="Instantly generate, calculate, and sort league standings. Perfect for sports leagues, gaming tournaments, and office competitions."
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <LeagueTableTool />
    </ToolPageWrapper>
  );
}
