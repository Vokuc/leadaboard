import React from 'react';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import LeagueTableTool from '../league-table-generator/LeagueTableTool';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Football League Table Generator',
  description: 'Create a football/soccer league standings table. Automatically calculates points (3 for a win, 1 for a draw) and Goal Difference based on match results.',
  canonical: `${BASE_URL}/tools/football-league-table`,
});

export default function FootballLeagueTablePage() {
  const faqs = [
    {
      q: 'How does the football league table calculator work?',
      a: 'Enter the number of matches each team has Played, Won, Drawn, and Lost, along with Goals For and Goals Against. The calculator automatically applies the standard 3-points-for-a-win system and sorts teams by Points, then Goal Difference, then Goals Scored.',
    },
    {
      q: 'What is the standard football points system?',
      a: 'In modern football (soccer), teams are awarded 3 points for a win, 1 point for a draw, and 0 points for a loss. This tool uses this exact scoring format by default.',
    },
    {
      q: 'How is Goal Difference calculated in football?',
      a: 'Goal Difference (GD) is calculated by taking the number of goals a team has scored (Goals For) and subtracting the number of goals they have conceded (Goals Against). A positive GD means a team has scored more than they have conceded.',
    },
    {
      q: 'What happens if teams are tied on points?',
      a: 'If two or more teams have the same number of points, the tie is broken by Goal Difference (GD). If the GD is also identical, the team with the most Goals For (GF) is placed higher.',
    },
    {
      q: 'How can I host a real football league?',
      a: 'This tool is great for quick calculations. If you want to run a real league with automated fixtures, match logging, player stats, and a shareable public page, click "Create Free Leaderboard" at the bottom to use LeaderboardOS.',
    },
  ];

  const relatedTools = [
    {
      name: 'League Table Generator',
      href: '/tools/league-table-generator',
      desc: 'A generic league table calculator with customizable points per win/draw/loss.',
    },
    {
      name: 'Points Calculator',
      href: '/tools/points-calculator',
      desc: 'Quickly calculate total league points from W/D/L records.',
    },
    {
      name: 'Tournament Bracket Generator',
      href: '/tools/tournament-generator',
      desc: 'Build and track a single-elimination tournament bracket.',
    },
  ];

  return (
    <ToolPageWrapper
      title="Football League Table Generator"
      description="Create a custom football standings table. Uses the standard 3-points-for-a-win system to automatically calculate and sort team rankings."
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <LeagueTableTool initialTitle="Premier League Standings" preset="football" />
    </ToolPageWrapper>
  );
}
