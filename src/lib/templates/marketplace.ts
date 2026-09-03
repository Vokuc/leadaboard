import { CompetitionTemplateKey, CompetitionType, CompetitionEngine } from '@/types';

export type MarketplaceCategory = 'Sports' | 'Fitness' | 'Business' | 'Education' | 'Community';

export interface MarketplaceTemplate {
  slug: string;
  category: MarketplaceCategory;
  title: string;
  description: string;
  h1: string;
  explanation: string;
  features: string[];
  faqs: { q: string; a: string }[];
  useCases: { title: string; desc: string }[];
  creationConfig: {
    name: string;
    type: CompetitionType;
    engine: CompetitionEngine;
    template: CompetitionTemplateKey;
    rulesUrlString?: string; // Format: "Rule Name:Points,Another Rule:Points" (e.g. "Deal Closed:100,Meeting:10")
  };
}

export const MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  // 1. SPORTS
  {
    slug: 'football-league-table',
    category: 'Sports',
    title: 'Football League Table Template | LeaderboardOS',
    description: 'Create a professional football league table to track wins, draws, losses, and goal difference. Perfect for amateur leagues, Sunday leagues, and 5-a-side.',
    h1: 'Football League Table',
    explanation: 'A fully-automated football (soccer) league standings template. It uses the standard 3-1-0 points system and automatically calculates goal difference to break ties. As you input match results, the table instantly re-ranks teams in real-time.',
    features: [
      'Standard 3-points for a win, 1 for a draw, 0 for a loss',
      'Automatic Goal Difference calculation',
      'Track matches played and form',
      'Shareable public link for teams to view'
    ],
    faqs: [
      { q: 'How is goal difference calculated?', a: 'Goal difference is automatically calculated by subtracting Goals Against from Goals For.' },
      { q: 'Can I change the points system?', a: 'Yes, after creating the template, you can customize the points awarded for a win or draw.' }
    ],
    useCases: [
      { title: 'Sunday League', desc: 'Manage your local weekend football league standings.' },
      { title: '5-a-side Tournaments', desc: 'Track performance across a rapid 5-a-side season.' }
    ],
    creationConfig: {
      name: 'My Football League',
      type: 'sports',
      engine: 'league_table',
      template: 'football'
    }
  },
  
  // 2. BUSINESS
  {
    slug: 'sales-leaderboard',
    category: 'Business',
    title: 'Sales Leaderboard Template | LeaderboardOS',
    description: 'Motivate your sales team with a real-time sales leaderboard. Track deals closed, meetings booked, and calls made to drive performance.',
    h1: 'Sales Team Leaderboard',
    explanation: 'Gamify your sales floor with a live ranking board. This template uses a points-based system to reward specific sales activities like closing deals or booking demos. Display it on a TV in the office or share it via a secure link to keep reps motivated.',
    features: [
      'Points-based scoring for different activities',
      'Live updates (Supabase Realtime) perfect for office TVs',
      'Track individual or regional team performance',
      'Immutable activity logs for transparent scoring'
    ],
    faqs: [
      { q: 'Can I add custom sales metrics?', a: 'Yes, this template starts with standard metrics (Deals, Meetings), but you can add any custom metric you want.' },
      { q: 'Can I display this on an office TV?', a: 'Absolutely. The public view automatically updates in real-time without needing a page refresh.' }
    ],
    useCases: [
      { title: 'SDR Outbound Race', desc: 'Reward reps for cold calls and meetings booked.' },
      { title: 'Quarterly Closers', desc: 'Track top revenue generators over a 3-month season.' }
    ],
    creationConfig: {
      name: 'Q3 Sales Race',
      type: 'workplace',
      engine: 'simple_points',
      template: 'custom',
      rulesUrlString: 'Deal Closed:100,Meeting Booked:15,Upsell:50'
    }
  },

  // 3. FITNESS
  {
    slug: 'fitness-challenge',
    category: 'Fitness',
    title: 'Gym & Fitness Challenge Template | LeaderboardOS',
    description: 'Run a gym attendance or workout challenge. A customizable leaderboard for tracking workouts, lifting milestones, or cardio goals.',
    h1: 'Gym & Fitness Challenge',
    explanation: 'Engage your gym members or fitness community with a points-based challenge. Reward members for checking in, hitting personal bests, or completing weekly workouts. It creates a sense of community and friendly competition.',
    features: [
      'Flexible points scoring for different workout types',
      'Season support to run 30-day or 60-day challenges',
      'Mobile-friendly design for members checking on the go',
      'Assign members to teams (e.g. Morning Crew vs Evening Crew)'
    ],
    faqs: [
      { q: 'Can I run a 30-day challenge?', a: 'Yes, you can configure Season dates to automatically scope the leaderboard to a specific time period.' },
      { q: 'Is it suitable for corporate wellness?', a: 'Definitely! It is widely used by HR teams to run step challenges or workout streaks.' }
    ],
    useCases: [
      { title: 'CrossFit Box Challenge', desc: 'Track WOD completions and PRs.' },
      { title: 'Corporate Wellness', desc: 'Encourage employees to stay active with a month-long fitness drive.' }
    ],
    creationConfig: {
      name: '30-Day Fitness Challenge',
      type: 'fitness',
      engine: 'simple_points',
      template: 'custom',
      rulesUrlString: 'Workout Logged:10,Gym Check-in:5,Personal Best:20'
    }
  },

  // 4. EDUCATION
  {
    slug: 'reading-challenge',
    category: 'Education',
    title: 'Reading Challenge Leaderboard Template | LeaderboardOS',
    description: 'Track books read or pages completed with a fun, interactive reading challenge leaderboard for schools, classes, and book clubs.',
    h1: 'Reading Challenge Leaderboard',
    explanation: 'Encourage literacy and consistent reading habits. This template ranks participants based on books finished, pages read, or daily reading streaks. It is visually engaging and simple for teachers or organizers to manage.',
    features: [
      'Point tracking for books, chapters, or pages',
      'Simple interface for rapid score entry',
      'Safe public viewing mode for students',
      'Historical logs to verify reading milestones'
    ],
    faqs: [
      { q: 'How do students submit their scores?', a: 'Currently, the organizer (teacher) inputs the scores, ensuring accuracy and validation.' },
      { q: 'Can I track by pages instead of books?', a: 'Yes, just change the scoring rule to "Pages Read: 1 point" instead of Books.' }
    ],
    useCases: [
      { title: 'Classroom Competition', desc: 'Motivate a specific grade or classroom to hit a reading target.' },
      { title: 'Summer Reading Program', desc: 'Keep kids engaged with reading during the summer holidays.' }
    ],
    creationConfig: {
      name: 'Summer Reading Challenge',
      type: 'education',
      engine: 'simple_points',
      template: 'custom',
      rulesUrlString: 'Book Finished:50,Chapter Read:5'
    }
  },

  // 5. COMMUNITY
  {
    slug: 'gaming-tournament',
    category: 'Community',
    title: 'Gaming Tournament Leaderboard Template | LeaderboardOS',
    description: 'Manage your esports and gaming tournaments with a live scoring leaderboard. Track match wins, kills, and objectives.',
    h1: 'Gaming & Esports Tournament',
    explanation: 'A professional-grade tracking system for gaming events. Whether you are running a casual Smash Bros night or an online Apex Legends qualifier, this template tracks the metrics that matter.',
    features: [
      'Track custom in-game metrics (e.g. Kills, Headshots, Survivals)',
      'Dark-mode, gamer-aesthetic layouts',
      'Live stream friendly (easily embeddable via OBS browser source)',
      'Handles large participant pools'
    ],
    faqs: [
      { q: 'Can I embed this on my Twitch stream?', a: 'Yes, you can use the public URL as a Browser Source in OBS or Streamlabs.' },
      { q: 'Can I do team vs team?', a: 'Yes, you can assign players to teams and the system will track both individual and team standings.' }
    ],
    useCases: [
      { title: 'Battle Royale Customs', desc: 'Track placement points and kill points across multiple games.' },
      { title: 'Local LAN Party', desc: 'A quick and easy way to keep score at a weekend gaming event.' }
    ],
    creationConfig: {
      name: 'Weekend LAN Tournament',
      type: 'gaming',
      engine: 'simple_points',
      template: 'custom',
      rulesUrlString: 'Match Win:100,Kill:10,Objective Secured:25'
    }
  }
];

export function getMarketplaceTemplate(slug: string): MarketplaceTemplate | undefined {
  return MARKETPLACE_TEMPLATES.find(t => t.slug === slug);
}

export function getMarketplaceCategories(): { category: MarketplaceCategory, templates: MarketplaceTemplate[] }[] {
  const categories: Record<MarketplaceCategory, MarketplaceTemplate[]> = {
    Sports: [],
    Fitness: [],
    Business: [],
    Education: [],
    Community: []
  };

  for (const template of MARKETPLACE_TEMPLATES) {
    categories[template.category].push(template);
  }

  return Object.keys(categories)
    .filter(key => categories[key as MarketplaceCategory].length > 0)
    .map(key => ({
      category: key as MarketplaceCategory,
      templates: categories[key as MarketplaceCategory]
    }));
}
