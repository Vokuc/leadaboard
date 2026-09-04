export interface DiscoveryCategory {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  filter: {
    column: 'competition_type';
    value: string;
  };
  relatedTemplates: string[];
  relatedTools: string[];
}

export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    slug: 'football',
    title: 'Public Football Leaderboards & League Tables | LeaderboardOS',
    description: 'Explore live public football leaderboards and league tables. Track goals, assists, and standings from amateur leagues around the world.',
    h1: 'Football League Tables',
    intro: 'Browse live public football leagues, tournaments, and friendly standings. Discover how other organizers are tracking their seasons.',
    filter: {
      column: 'template_key',
      value: 'football',
    },
    relatedTemplates: ['football-league-table'],
    relatedTools: ['football-league-table', 'league-table-generator'],
  },
  {
    slug: 'gaming',
    title: 'Esports & Gaming Leaderboards | LeaderboardOS',
    description: 'Discover public gaming tournaments, clan wars, and esports leaderboards. Track K/D, wins, and points across your favorite games.',
    h1: 'Gaming & Esports Leaderboards',
    intro: 'From local smash tournaments to global clan wars, explore how competitive gaming communities track their rankings.',
    filter: {
      column: 'competition_type',
      value: 'gaming',
    },
    relatedTemplates: ['gaming-tournament'],
    relatedTools: ['tournament-generator', 'points-calculator'],
  },
  {
    slug: 'basketball',
    title: 'Public Basketball Standings & Tournaments | LeaderboardOS',
    description: 'Explore live public basketball standings. Track points, rebounds, and team performance across organized leagues.',
    h1: 'Basketball Standings',
    intro: 'Browse active basketball leagues and 3v3 tournaments. See how organizers keep score and track team statistics.',
    filter: {
      column: 'template_key',
      value: 'basketball',
    },
    relatedTemplates: [],
    relatedTools: ['league-table-generator'],
  },
  {
    slug: 'fitness',
    title: 'Fitness & Gym Challenges | LeaderboardOS',
    description: 'Public fitness leaderboards, gym challenges, and running groups. See how communities stay motivated through friendly competition.',
    h1: 'Fitness Challenges',
    intro: 'Explore step challenges, weightlifting maxes, and running leaderboards. Join the community of people tracking their physical progress.',
    filter: {
      column: 'competition_type',
      value: 'fitness',
    },
    relatedTemplates: ['fitness-challenge'],
    relatedTools: ['points-calculator'],
  },
  {
    slug: 'business',
    title: 'Business & Sales Leaderboards | LeaderboardOS',
    description: 'Public business and sales leaderboards. See how top teams use gamification to drive performance and motivation.',
    h1: 'Sales & Business Leaderboards',
    intro: 'Discover public KPIs, sales races, and performance metrics. Learn how transparency drives workplace performance.',
    filter: {
      column: 'competition_type',
      value: 'workplace',
    },
    relatedTemplates: ['sales-leaderboard'],
    relatedTools: ['leaderboard-maker'],
  },
  {
    slug: 'education',
    title: 'Education & Classroom Leaderboards | LeaderboardOS',
    description: 'Public educational leaderboards. See how teachers and students use gamified tracking for reading challenges and quizzes.',
    h1: 'Education Leaderboards',
    intro: 'Browse reading challenges, quiz scores, and academic competitions. Gamify the learning experience.',
    filter: {
      column: 'competition_type',
      value: 'education',
    },
    relatedTemplates: ['reading-challenge'],
    relatedTools: ['leaderboard-maker'],
  },
];

export function getDiscoveryCategory(slug: string): DiscoveryCategory | undefined {
  return DISCOVERY_CATEGORIES.find((c) => c.slug === slug);
}
