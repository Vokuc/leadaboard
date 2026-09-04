import { ReactNode } from 'react';

export interface SeoPageContent {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  benefits: { title: string; description: string }[];
  features: { title: string; description: string }[];
  useCases: string[];
  faq: { question: string; answer: string }[];
  relatedCategory: string; // Used for "Explore examples" linking
}

export const seoContent: Record<string, SeoPageContent> = {
  'leaderboard-software': {
    slug: 'leaderboard-software',
    title: 'Leaderboard Software | LeaderboardOS',
    metaDescription: 'The most powerful leaderboard software for managing competitions, tracking scores, and displaying live rankings for any event.',
    h1: 'Professional Leaderboard Software',
    subtitle: 'Create, manage, and display live rankings for any competition in minutes with LeaderboardOS.',
    benefits: [
      { title: 'Easy Setup', description: 'No coding required. Launch your leaderboard instantly.' },
      { title: 'Live Updates', description: 'Changes reflect in real-time across all connected devices.' },
      { title: 'Embed Anywhere', description: 'Add the leaderboard widget directly to your website.' }
    ],
    features: [
      { title: 'Custom Scoring Rules', description: 'Define points for wins, losses, and specific actions.' },
      { title: 'Mobile Responsive', description: 'Looks perfect on desktop, tablets, and phones.' },
      { title: 'QR Code Sharing', description: 'Players can join by scanning a quick QR code.' }
    ],
    useCases: ['Corporate Events', 'Esports Tournaments', 'Sports Leagues', 'School Competitions'],
    faq: [
      { question: 'Is it free to start?', answer: 'Yes! You can create a leaderboard completely free.' },
      { question: 'Can I embed it?', answer: 'Yes, every leaderboard comes with a custom iframe snippet.' }
    ],
    relatedCategory: 'all'
  },
  'leaderboard-maker': {
    slug: 'leaderboard-maker',
    title: 'Free Leaderboard Maker | LeaderboardOS',
    metaDescription: 'Build beautiful, customizable leaderboards in seconds with the ultimate leaderboard maker. No sign-up required to test the tools.',
    h1: 'The Ultimate Leaderboard Maker',
    subtitle: 'Design stunning ranking boards with custom colors, logos, and real-time score tracking.',
    benefits: [
      { title: 'Instant Preview', description: 'See your leaderboard take shape as you build it.' },
      { title: 'Custom Branding', description: 'Add your own logo and team colors.' },
      { title: 'Export & Share', description: 'Share links instantly with your community.' }
    ],
    features: [
      { title: 'Drag & Drop Teams', description: 'Easily reorder players if manual ranking is needed.' },
      { title: 'Automatic Sorting', description: 'Input scores and let the system handle the math.' },
      { title: 'Dark Mode Support', description: 'Beautiful native dark themes for any display.' }
    ],
    useCases: ['Sales Teams', 'Gaming Clans', 'Friendly Bets'],
    faq: [
      { question: 'Do I need technical skills?', answer: 'None at all. Our maker is completely visual and intuitive.' },
      { question: 'Can multiple people update it?', answer: 'Yes, you can share admin access with organizers.' }
    ],
    relatedCategory: 'all'
  },
  'online-leaderboard': {
    slug: 'online-leaderboard',
    title: 'Create an Online Leaderboard | LeaderboardOS',
    metaDescription: 'Connect remote teams, players, and communities with a beautiful, real-time online leaderboard.',
    h1: 'Connect Your Community Online',
    subtitle: 'Host your rankings on the cloud. Share a simple link and let anyone view the live standings from anywhere.',
    benefits: [
      { title: 'Always Online', description: 'Hosted securely in the cloud, available 24/7.' },
      { title: 'Instant Sync', description: 'When you update a score, everyone sees it immediately.' },
      { title: 'Public or Private', description: 'Keep it open to the world or lock it down with a passcode.' }
    ],
    features: [
      { title: 'Unique URLs', description: 'Every board gets a clean, shareable web address.' },
      { title: 'Realtime Subscriptions', description: 'Powered by WebSockets for zero-delay updates.' },
      { title: 'SEO Friendly', description: 'Public leaderboards can be indexed by Google if you choose.' }
    ],
    useCases: ['Remote Sales Teams', 'Global Gaming Tournaments', 'Online Hackathons'],
    faq: [
      { question: 'Do my players need to download an app?', answer: 'No, they just click your link and view it in their web browser.' },
      { question: 'Can I restrict who sees the board?', answer: 'Yes, you can set visibility to Private.' }
    ],
    relatedCategory: 'all'
  },
  'competition-leaderboard': {
    slug: 'competition-leaderboard',
    title: 'Competition Leaderboard Software | LeaderboardOS',
    metaDescription: 'Manage high-stakes competitions with advanced ranking rules, brackets, and live scoring.',
    h1: 'Built for Serious Competitions',
    subtitle: 'Run your event smoothly with professional-grade competition management software.',
    benefits: [
      { title: 'Fair Play Rules', description: 'Strict, configurable ranking criteria to break ties fairly.' },
      { title: 'Audit Logs', description: 'See exactly who updated a score and when.' },
      { title: 'Scalable', description: 'Handles events ranging from 10 to 10,000 participants.' }
    ],
    features: [
      { title: 'Multi-stage Events', description: 'Move from group stages into knockout brackets.' },
      { title: 'Registration Links', description: 'Let participants sign up themselves.' },
      { title: 'Live Admin Panel', description: 'Update scores rapidly during live events.' }
    ],
    useCases: ['CrossFit Competitions', 'Major Esports Events', 'Trivia Nights'],
    faq: [
      { question: 'Can I have multiple admins?', answer: 'Yes, you can invite co-organizers to help input scores.' },
      { question: 'Is there an activity log?', answer: 'Yes, all score changes are logged for transparency.' }
    ],
    relatedCategory: 'all'
  },
  'sports-leaderboard': {
    slug: 'sports-leaderboard',
    title: 'Sports Leaderboard App | LeaderboardOS',
    metaDescription: 'Track goals, points, and standings for your sports league or athletic club.',
    h1: 'Live Sports Leaderboards',
    subtitle: 'Track your local league, intramural team, or fantasy sports group with professional-grade standings.',
    benefits: [
      { title: 'League Tables', description: 'Built-in support for round-robin tables.' },
      { title: 'Win/Loss Tracking', description: 'Automatic point calculations for standard sports formats.' },
      { title: 'Season History', description: 'Keep track of past seasons and hall of fame.' }
    ],
    features: [
      { title: 'Goal Difference', description: 'Advanced tie-breaking using GD and points.' },
      { title: 'Match Logging', description: 'Record individual fixture results.' },
      { title: 'Player Profiles', description: 'Track stats for individual athletes.' }
    ],
    useCases: ['Amateur Football Leagues', 'Tennis Clubs', 'Intramural Basketball'],
    faq: [
      { question: 'Does it support standard league points?', answer: 'Yes, you can configure 3 points for a win, 1 for a draw, etc.' },
      { question: 'Can players submit scores?', answer: 'Yes, players can submit results for admin approval.' }
    ],
    relatedCategory: 'sports'
  },
  'football-leaderboard': {
    slug: 'football-leaderboard',
    title: 'Football League Table Generator | LeaderboardOS',
    metaDescription: 'Create a live football league table. Track points, goal difference, goals scored, and live fixtures.',
    h1: 'Football League Table Creator',
    subtitle: 'Run your Sunday League, 5-a-side tournament, or FIFA group stage with a proper football standings board.',
    benefits: [
      { title: 'Automatic Maths', description: 'Input match results and we calculate P, W, D, L, GF, GA, GD, and Pts.' },
      { title: 'Live Match Updates', description: 'The table updates dynamically as you update a live score.' },
      { title: 'Team Logos', description: 'Upload badges for every team.' }
    ],
    features: [
      { title: 'Standard FIFA Rules', description: 'Ties broken by GD, then GF natively.' },
      { title: 'Fixture Generation', description: 'Automatically pair teams for a full season.' },
      { title: 'Embeddable', description: 'Put the league table on your club\'s website.' }
    ],
    useCases: ['5-a-side Leagues', 'FIFA Esports', 'Sunday League Football'],
    faq: [
      { question: 'Can I change the points system?', answer: 'Yes, while 3 points for a win is default, you can edit this in settings.' },
      { question: 'Does it support knockout stages?', answer: 'Yes, you can transition a league into a tournament bracket.' }
    ],
    relatedCategory: 'sports'
  },
  'sales-leaderboard': {
    slug: 'sales-leaderboard',
    title: 'Sales Leaderboard Software for Teams | LeaderboardOS',
    metaDescription: 'Boost team motivation and track KPIs with a live sales leaderboard. Perfect for TVs in the office or remote teams.',
    h1: 'Motivate Your Sales Team',
    subtitle: 'Gamify your workplace. Display live KPIs, deals closed, and revenue goals on a beautiful digital leaderboard.',
    benefits: [
      { title: 'Boost Morale', description: 'Friendly competition drives better performance.' },
      { title: 'TV Display Mode', description: 'Cast it to the office TV seamlessly.' },
      { title: 'Remote Friendly', description: 'Remote reps can see live updates from home.' }
    ],
    features: [
      { title: 'Multiple Metrics', description: 'Track calls made, deals closed, and revenue simultaneously.' },
      { title: 'Target Lines', description: 'Set visual thresholds for quotas.' },
      { title: 'Celebration Effects', description: 'Trigger confetti when someone hits their target.' }
    ],
    useCases: ['SDR Teams', 'Real Estate Agencies', 'Retail Floor Staff'],
    faq: [
      { question: 'Can I cast this to an Office TV?', answer: 'Absolutely. The UI scales perfectly for large 1080p and 4K displays.' },
      { question: 'Is the data secure?', answer: 'Yes, you can set the leaderboard to Private so only your team can view it.' }
    ],
    relatedCategory: 'workplace'
  },
  'gaming-leaderboard': {
    slug: 'gaming-leaderboard',
    title: 'Gaming & Esports Leaderboards | LeaderboardOS',
    metaDescription: 'The ultimate tool for gaming clans, speedrunners, and esports tournaments to track rankings.',
    h1: 'Esports & Gaming Leaderboards',
    subtitle: 'Track your clan\'s stats, manage your local Smash tournament, or host speedrunning events.',
    benefits: [
      { title: 'Gamer Aesthetics', description: 'Beautiful dark mode and neon accents.' },
      { title: 'Flexible Scoring', description: 'Points for kills, wins, placements, and more.' },
      { title: 'Twitch Friendly', description: 'Embed it directly into your stream overlay via OBS browser source.' }
    ],
    features: [
      { title: 'Tournament Brackets', description: 'Single and double elimination bracket generation.' },
      { title: 'Custom Avatars', description: 'Upload team logos or player avatars.' },
      { title: 'Live Sync', description: 'Updates push instantly without viewers refreshing.' }
    ],
    useCases: ['Esports Events', 'Speedrunning Communities', 'Discord Server Rankings'],
    faq: [
      { question: 'Can I use this in OBS?', answer: 'Yes, just grab the embed link and add it as a browser source.' },
      { question: 'Does it support brackets?', answer: 'Yes! The tournament engine handles full bracket routing.' }
    ],
    relatedCategory: 'gaming'
  },
  'fitness-leaderboard': {
    slug: 'fitness-leaderboard',
    title: 'Fitness & Gym Leaderboards | LeaderboardOS',
    metaDescription: 'Track workouts, run times, and gym challenges. Gamify your fitness community.',
    h1: 'Fitness Challenge Leaderboards',
    subtitle: 'Perfect for CrossFit boxes, run clubs, and workplace wellness challenges.',
    benefits: [
      { title: 'Community Engagement', description: 'Keep your gym members engaged and competitive.' },
      { title: 'Flexible Metrics', description: 'Track time, reps, weight, or distance.' },
      { title: 'Mobile Accessible', description: 'Members can check rankings on their phones post-workout.' }
    ],
    features: [
      { title: 'Time Tracking', description: 'Input times (MM:SS) for race formats.' },
      { title: 'Multi-category', description: 'Separate Male/Female or Scaled/Rx divisions.' },
      { title: 'Progress Tracking', description: 'See how athletes improve over the season.' }
    ],
    useCases: ['CrossFit Open tracking', 'Company Step Challenges', 'Local 5K Runs'],
    faq: [
      { question: 'Can I track both time and reps?', answer: 'Yes, you can configure custom columns for different workout styles.' },
      { question: 'Can I keep it private to my gym?', answer: 'Yes, private links ensure only members see the board.' }
    ],
    relatedCategory: 'sports'
  },
  'gym-leaderboard': {
    slug: 'gym-leaderboard',
    title: 'Gym Leaderboard Software | LeaderboardOS',
    metaDescription: 'Run PR tracking, attendance challenges, and WOD rankings for your gym.',
    h1: 'The Ultimate Gym Leaderboard',
    subtitle: 'Motivate your members by tracking personal bests, WOD times, and attendance on a digital board.',
    benefits: [
      { title: 'Digital Whiteboard', description: 'Replace your messy dry-erase board with a sleek digital alternative.' },
      { title: 'Member Retention', description: 'Gamification is proven to keep members coming back.' },
      { title: 'Easy to Read', description: 'High contrast design is readable from across the gym floor.' }
    ],
    features: [
      { title: 'PR Tracking', description: 'Keep a permanent record of club records.' },
      { title: 'Daily WODs', description: 'Create a new leaderboard for each day\'s workout.' },
      { title: 'Filter by Division', description: 'Instantly filter by Rx, Scaled, Male, or Female.' }
    ],
    useCases: ['Boutique Gyms', 'Powerlifting Clubs', 'CrossFit Affiliates'],
    faq: [
      { question: 'Can members add their own scores?', answer: 'Yes, members can submit their times from their phone.' },
      { question: 'Can I project this on a wall?', answer: 'Yes, any browser-enabled TV or projector works perfectly.' }
    ],
    relatedCategory: 'sports'
  },
  'school-leaderboard': {
    slug: 'school-leaderboard',
    title: 'School & Classroom Leaderboards | LeaderboardOS',
    metaDescription: 'Gamify your classroom. Track house points, reading challenges, and student achievements.',
    h1: 'Engage Your Students',
    subtitle: 'Track house points, reading goals, and classroom behavior with a fun, interactive leaderboard.',
    benefits: [
      { title: 'Fun & Engaging', description: 'Bright colors and smooth animations keep kids excited.' },
      { title: 'Positive Reinforcement', description: 'Reward good behavior instantly with points.' },
      { title: 'Safe & Private', description: 'Keep student data completely hidden from the public web.' }
    ],
    features: [
      { title: 'House Points', description: 'Group students into teams (e.g., Gryffindor) and track total team score.' },
      { title: 'Custom Icons', description: 'Assign fun emojis or avatars to each student.' },
      { title: 'Audit History', description: 'See a log of exactly why points were awarded.' }
    ],
    useCases: ['House Point Systems', 'Summer Reading Challenges', 'Mathletics Tournaments'],
    faq: [
      { question: 'Is it safe for students?', answer: 'Yes, leaderboards can be set to private so only people with the link (or passcode) can view it.' },
      { question: 'Can I group players into teams?', answer: 'Yes! The team clustering feature is perfect for House points.' }
    ],
    relatedCategory: 'all'
  },
  'tournament-leaderboard': {
    slug: 'tournament-leaderboard',
    title: 'Tournament Brackets & Leaderboards | LeaderboardOS',
    metaDescription: 'Manage any tournament from start to finish. Brackets, groups, and final standings all in one place.',
    h1: 'Tournament Management Software',
    subtitle: 'From local pub quizzes to global esports events, manage your brackets and groups effortlessly.',
    benefits: [
      { title: 'Automated Progression', description: 'Winners automatically advance to the next round.' },
      { title: 'Group Stages', description: 'Round-robin group stages that feed into knockouts.' },
      { title: 'Public Sharing', description: 'Fans can follow the bracket live.' }
    ],
    features: [
      { title: 'Seed Management', description: 'Easily shuffle or manually seed participants.' },
      { title: 'Match Scheduling', description: 'Set times and locations for specific matches.' },
      { title: 'Live Match Updates', description: 'Update scores mid-match for live tracking.' }
    ],
    useCases: ['Ping Pong Tournaments', 'Gaming Majors', 'Chess Clubs'],
    faq: [
      { question: 'Does it support double elimination?', answer: 'Currently we focus on single elimination and group stages, with more formats coming.' },
      { question: 'How many players can join?', answer: 'Tournaments can scale to hundreds of participants.' }
    ],
    relatedCategory: 'all'
  },
  'league-table-maker': {
    slug: 'league-table-maker',
    title: 'League Table Maker | LeaderboardOS',
    metaDescription: 'Generate professional sports league tables instantly. Track goals, points, wins, and losses.',
    h1: 'Professional League Table Maker',
    subtitle: 'The easiest way to generate and maintain a standings table for your sports league.',
    benefits: [
      { title: 'Math Handled', description: 'We calculate points, goal difference, and games played automatically.' },
      { title: 'Embeddable', description: 'Put the live table right on your league website.' },
      { title: 'Print Ready', description: 'Clean layouts that look great exported or printed.' }
    ],
    features: [
      { title: 'Custom Points', description: 'Set your own rules (e.g. 3 for win, 1 for draw).' },
      { title: 'Fixture Generator', description: 'Automatically pair teams for the season.' },
      { title: 'Result Submission', description: 'Captains can submit results for verification.' }
    ],
    useCases: ['Sunday League Football', 'Fantasy Premier League mini-leagues', 'Pool Leagues'],
    faq: [
      { question: 'Can I embed the table in WordPress?', answer: 'Yes, the iframe embed code works on any modern website platform.' },
      { question: 'How are ties broken?', answer: 'By default, we use Goal Difference, then Goals Scored, but this is customizable.' }
    ],
    relatedCategory: 'sports'
  }
};
