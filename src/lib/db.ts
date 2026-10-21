import { createBrowserClient } from '@supabase/ssr';
import { 
  Profile, 
  Leaderboard, 
  Season, 
  ScoringRule, 
  LeaderboardMember, 
  ScoreEvent, 
  ActivityLog, 
  Ranking,
  LeaderboardAdmin,
  Team,
  TeamMember,
  TeamWithRoster,
  TeamRosterRole,
  CompetitionConfig,
  CompetitionRegistrationConfig,
  ParticipantProfile,
  ParticipantClaim,
  ParticipantCorrection,
  ParticipantTeamHistory,
  AchievementDefinition,
  ParticipantAchievement,
  CompetitionRating,
  RatingHistoryEntry,
  RatingEntityType
} from '../types';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { validateScoreAdjustment } from '@/lib/competition/rules/validation';
import { evaluatePointsRankings } from '@/lib/competition/rules/evaluator';

// Detect environment keys
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id'));

export const supabase = isSupabaseConfigured 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey) 
  : null;

// ==========================================
// HIGH FIDELITY MOCK DATABASE ENGINE (localStorage)
// ==========================================

const SEED_CREATOR_ID = 'creator-user-id';

export const DEFAULT_PROFILE: Profile = {
  id: SEED_CREATOR_ID,
  email: 'creator@leaderboardos.com',
  full_name: 'Alex Mercer',
  role: 'super_admin',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEFAULT_LEADERBOARDS: Leaderboard[] = [
  {
    id: 'lb-gaming-1',
    owner_id: SEED_CREATOR_ID,
    name: 'Cyber Arena - Apex Season',
    description: 'Weekly gaming tournament for FPS players. Compete, score, and dominate the ranks!',
    slug: 'cyber-arena',
    visibility: 'public',
    competition_type: 'gaming',
    cover_image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lb-workplace-1',
    owner_id: SEED_CREATOR_ID,
    name: 'Q3 Enterprise Sales Race',
    description: 'Track deals closed, client calls, and monthly pipeline metrics for our global teams.',
    slug: 'q3-sales',
    visibility: 'public',
    competition_type: 'workplace',
    cover_image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'lb-sports-1',
    owner_id: SEED_CREATOR_ID,
    name: 'Sunset Club - 5K Challenge',
    description: 'Summer fitness runs for members of the Sunset Athletic Club.',
    slug: 'sunset-5k',
    visibility: 'public',
    competition_type: 'fitness',
    cover_image_url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const DEFAULT_SEASONS: Season[] = [
  {
    id: 'season-gaming-1',
    leaderboard_id: 'lb-gaming-1',
    name: 'Season 4: Neon Cyberpunk',
    start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'season-workplace-1',
    leaderboard_id: 'lb-workplace-1',
    name: 'Q3 Sprint',
    start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const DEFAULT_SCORING_RULES: ScoringRule[] = [
  // Gaming Rules
  { id: 'rule-g1', leaderboard_id: 'lb-gaming-1', event_name: 'Win Match', points: 30, description: 'Earned when the team wins a full match', created_at: new Date().toISOString() },
  { id: 'rule-g2', leaderboard_id: 'lb-gaming-1', event_name: 'Kill Streak (5)', points: 10, description: 'Awarded for achieving 5 consecutive kills without dying', created_at: new Date().toISOString() },
  { id: 'rule-g3', leaderboard_id: 'lb-gaming-1', event_name: 'Match MVP', points: 15, description: 'Selected as the most valuable player of the round', created_at: new Date().toISOString() },
  { id: 'rule-g4', leaderboard_id: 'lb-gaming-1', event_name: 'Team Defeat', points: -10, description: 'Penalty for losing a match', created_at: new Date().toISOString() },
  
  // Workplace Rules
  { id: 'rule-w1', leaderboard_id: 'lb-workplace-1', event_name: 'Deal Closed', points: 100, description: 'Closed a new enterprise customer contract', created_at: new Date().toISOString() },
  { id: 'rule-w2', leaderboard_id: 'lb-workplace-1', event_name: 'Meeting Booked', points: 15, description: 'Successfully scheduled a qualified demo meeting', created_at: new Date().toISOString() },
  { id: 'rule-w3', leaderboard_id: 'lb-workplace-1', event_name: 'Upsell Landed', points: 50, description: 'Added new user licenses to an existing client account', created_at: new Date().toISOString() },
  { id: 'rule-w4', leaderboard_id: 'lb-workplace-1', event_name: 'Lost Account', points: -150, description: 'Contract churned or client canceled', created_at: new Date().toISOString() },
  
  // Sports Rules
  { id: 'rule-s1', leaderboard_id: 'lb-sports-1', event_name: 'Run Logged (5K)', points: 50, description: 'Logged a completed 5K session', created_at: new Date().toISOString() },
  { id: 'rule-s2', leaderboard_id: 'lb-sports-1', event_name: 'New PR Time', points: 100, description: 'Set a new personal record time for the distance', created_at: new Date().toISOString() },
  { id: 'rule-s3', leaderboard_id: 'lb-sports-1', event_name: 'Podium Finish', points: 75, description: 'Finished in the top 3 overall positions in a club race', created_at: new Date().toISOString() }
];

export function generateShortCode(name: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const acronym = words.map(w => w[0]).join('').toUpperCase();
    return acronym.slice(0, 4);
  }
  if (clean.length <= 4) {
    return clean.toUpperCase() || 'TEAM';
  }
  return clean.slice(0, 4).toUpperCase();
}

export const DEFAULT_TEAMS: Team[] = [
  // Gaming Teams
  {
    id: 'team-g1',
    leaderboard_id: 'lb-gaming-1',
    name: 'Team Rogue',
    short_code: 'TR',
    logo_url: null,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'team-g2',
    leaderboard_id: 'lb-gaming-1',
    name: 'Team Apex',
    short_code: 'TA',
    logo_url: null,
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Workplace Teams
  {
    id: 'team-w1',
    leaderboard_id: 'lb-workplace-1',
    name: 'Sales - NA',
    short_code: 'SNA',
    logo_url: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'team-w2',
    leaderboard_id: 'lb-workplace-1',
    name: 'Sales - Support',
    short_code: 'SSUP',
    logo_url: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Sports Teams
  {
    id: 'team-s1',
    leaderboard_id: 'lb-sports-1',
    name: 'Sprinters Club',
    short_code: 'SC',
    logo_url: null,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'team-s2',
    leaderboard_id: 'lb-sports-1',
    name: 'Trail Blazers',
    short_code: 'TB',
    logo_url: null,
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  // Team Rogue (Gaming)
  {
    id: 'tm-g1',
    team_id: 'team-g1',
    leaderboard_id: 'lb-gaming-1',
    member_id: 'mem-g1',
    role: 'captain',
    jersey_number: 1,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-g2',
    team_id: 'team-g1',
    leaderboard_id: 'lb-gaming-1',
    member_id: 'mem-g2',
    role: 'player',
    jersey_number: 7,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Team Apex (Gaming)
  {
    id: 'tm-g3',
    team_id: 'team-g2',
    leaderboard_id: 'lb-gaming-1',
    member_id: 'mem-g3',
    role: 'captain',
    jersey_number: 10,
    created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-g4',
    team_id: 'team-g2',
    leaderboard_id: 'lb-gaming-1',
    member_id: 'mem-g4',
    role: 'substitute',
    jersey_number: 12,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Workplace
  {
    id: 'tm-w1',
    team_id: 'team-w1',
    leaderboard_id: 'lb-workplace-1',
    member_id: 'mem-w2',
    role: 'captain',
    jersey_number: 1,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-w2',
    team_id: 'team-w1',
    leaderboard_id: 'lb-workplace-1',
    member_id: 'mem-w1',
    role: 'player',
    jersey_number: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-w3',
    team_id: 'team-w1',
    leaderboard_id: 'lb-workplace-1',
    member_id: 'mem-w3',
    role: 'player',
    jersey_number: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-w4',
    team_id: 'team-w1',
    leaderboard_id: 'lb-workplace-1',
    member_id: 'mem-w4',
    role: 'player',
    jersey_number: null,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-w5',
    team_id: 'team-w2',
    leaderboard_id: 'lb-workplace-1',
    member_id: 'mem-w5',
    role: 'captain',
    jersey_number: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Sports
  {
    id: 'tm-s1',
    team_id: 'team-s1',
    leaderboard_id: 'lb-sports-1',
    member_id: 'mem-s1',
    role: 'captain',
    jersey_number: 9,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-s2',
    team_id: 'team-s1',
    leaderboard_id: 'lb-sports-1',
    member_id: 'mem-s2',
    role: 'player',
    jersey_number: 11,
    created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-s3',
    team_id: 'team-s2',
    leaderboard_id: 'lb-sports-1',
    member_id: 'mem-s3',
    role: 'captain',
    jersey_number: 3,
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-s4',
    team_id: 'team-s2',
    leaderboard_id: 'lb-sports-1',
    member_id: 'mem-s4',
    role: 'player',
    jersey_number: 4,
    created_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEFAULT_MEMBERS: LeaderboardMember[] = [
  // Gaming Members
  { id: 'mem-g1', leaderboard_id: 'lb-gaming-1', name: 'NinjaCoder', email: 'ninja@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=100&q=80', team: 'Team Rogue', team_id: 'team-g1', notes: 'Top fragger', is_active: true, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g2', leaderboard_id: 'lb-gaming-1', name: 'CyberKnight', email: 'knight@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80', team: 'Team Rogue', team_id: 'team-g1', notes: 'Tank specialist', is_active: true, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g3', leaderboard_id: 'lb-gaming-1', name: 'PxlQueen', email: 'pxl@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80', team: 'Team Apex', team_id: 'team-g2', notes: 'Support strategist', is_active: true, created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g4', leaderboard_id: 'lb-gaming-1', name: 'ShadowRunner', email: 'shadow@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80', team: 'Team Apex', team_id: 'team-g2', notes: 'Stealth DPS', is_active: true, created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g5', leaderboard_id: 'lb-gaming-1', name: 'L33tGamer', email: 'l33t@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80', team: null, team_id: null, notes: 'Freelancer', is_active: true, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },

  // Workplace Members
  { id: 'mem-w1', leaderboard_id: 'lb-workplace-1', name: 'Sarah Jenkins', email: 'sjenkins@company.com', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', team_id: 'team-w1', notes: 'SDR MVP', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w2', leaderboard_id: 'lb-workplace-1', name: 'Michael Scott', email: 'mscott@company.com', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', team_id: 'team-w1', notes: 'Regional Director', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w3', leaderboard_id: 'lb-workplace-1', name: 'Dwight Schrute', email: 'dschrute@company.com', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', team_id: 'team-w1', notes: 'Assistant Regional Manager', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w4', leaderboard_id: 'lb-workplace-1', name: 'Jim Halpert', email: 'jhalpert@company.com', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', team_id: 'team-w1', notes: 'Senior Representative', is_active: true, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w5', leaderboard_id: 'lb-workplace-1', name: 'Pam Beesly', email: 'pbeesly@company.com', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80', team: 'Sales - Support', team_id: 'team-w2', notes: 'Admin coordinator', is_active: true, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },

  // Sports Members
  { id: 'mem-s1', leaderboard_id: 'lb-sports-1', name: 'John Runner', email: 'john@sports.com', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80', team: 'Sprinters Club', team_id: 'team-s1', notes: null, is_active: true, created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s2', leaderboard_id: 'lb-sports-1', name: 'Alice Smith', email: 'alice@sports.com', avatar_url: 'https://images.unsplash.com/photo-1534751516642-a131fed10495?auto=format&fit=crop&w=100&q=80', team: 'Sprinters Club', team_id: 'team-s1', notes: 'Marathon trainee', is_active: true, created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s3', leaderboard_id: 'lb-sports-1', name: 'Bob Athletic', email: 'bob@sports.com', avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=100&q=80', team: 'Trail Blazers', team_id: 'team-s2', notes: null, is_active: true, created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s4', leaderboard_id: 'lb-sports-1', name: 'Emma Jogger', email: 'emma@sports.com', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80', team: 'Trail Blazers', team_id: 'team-s2', notes: 'Runs in the mornings', is_active: true, created_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }
];

const DEFAULT_SCORE_EVENTS: ScoreEvent[] = [
  // Gaming Score Events
  { id: 'ev-g1', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g1', rule_id: 'rule-g1', points: 30, reason: 'Win Match', created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g2', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g1', rule_id: 'rule-g2', points: 10, reason: 'Kill Streak (5)', created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g3', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g2', rule_id: 'rule-g1', points: 30, reason: 'Win Match', created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g4', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g3', rule_id: 'rule-g1', points: 30, reason: 'Win Match', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g5', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g3', rule_id: 'rule-g3', points: 15, reason: 'Match MVP', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g6', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g4', rule_id: 'rule-g4', points: -10, reason: 'Team Defeat', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g7', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g5', rule_id: 'rule-g1', points: 30, reason: 'Win Match', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g8', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g1', rule_id: 'rule-g1', points: 30, reason: 'Win Match', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g9', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g2', rule_id: 'rule-g3', points: 15, reason: 'Match MVP', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-g10', leaderboard_id: 'lb-gaming-1', member_id: 'mem-g3', rule_id: 'rule-g2', points: 10, reason: 'Kill Streak (5)', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },

  // Workplace Score Events
  { id: 'ev-w1', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w3', rule_id: 'rule-w1', points: 100, reason: 'Deal Closed', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w2', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w3', rule_id: 'rule-w1', points: 100, reason: 'Deal Closed', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w3', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w1', rule_id: 'rule-w1', points: 100, reason: 'Deal Closed', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w4', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w1', rule_id: 'rule-w2', points: 15, reason: 'Meeting Booked', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w5', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w4', rule_id: 'rule-w1', points: 100, reason: 'Deal Closed', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w6', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w2', rule_id: 'rule-w4', points: -150, reason: 'Lost Account', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-w7', leaderboard_id: 'lb-workplace-1', member_id: 'mem-w3', rule_id: 'rule-w3', points: 50, reason: 'Upsell Landed', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },

  // Sports Score Events
  { id: 'ev-s1', leaderboard_id: 'lb-sports-1', member_id: 'mem-s1', rule_id: 'rule-s1', points: 50, reason: 'Run Logged (5K)', created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-s2', leaderboard_id: 'lb-sports-1', member_id: 'mem-s2', rule_id: 'rule-s1', points: 50, reason: 'Run Logged (5K)', created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-s3', leaderboard_id: 'lb-sports-1', member_id: 'mem-s2', rule_id: 'rule-s2', points: 100, reason: 'New PR Time', created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-s4', leaderboard_id: 'lb-sports-1', member_id: 'mem-s3', rule_id: 'rule-s1', points: 50, reason: 'Run Logged (5K)', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-s5', leaderboard_id: 'lb-sports-1', member_id: 'mem-s4', rule_id: 'rule-s1', points: 50, reason: 'Run Logged (5K)', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'ev-s6', leaderboard_id: 'lb-sports-1', member_id: 'mem-s1', rule_id: 'rule-s3', points: 75, reason: 'Podium Finish', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
];

const DEFAULT_ACTIVITY_LOGS: ActivityLog[] = [
  { id: 'log-1', leaderboard_id: 'lb-gaming-1', message: 'NinjaCoder score adjusted by +30 points: Win Match', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'log-2', leaderboard_id: 'lb-gaming-1', message: 'CyberKnight score adjusted by +15 points: Match MVP', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'log-3', leaderboard_id: 'lb-gaming-1', message: 'PxlQueen score adjusted by +10 points: Kill Streak (5)', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'log-4', leaderboard_id: 'lb-workplace-1', message: 'Sarah Jenkins score adjusted by +15 points: Meeting Booked', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'log-5', leaderboard_id: 'lb-workplace-1', message: 'Michael Scott score adjusted by -150 points: Lost Account', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'log-6', leaderboard_id: 'lb-workplace-1', message: 'Dwight Schrute score adjusted by +50 points: Upsell Landed', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }
];

export const DEFAULT_COMPETITION_CONFIGS: CompetitionConfig[] = [
  {
    leaderboard_id: 'lb-gaming-1',
    engine_type: 'tournament',
    template_key: 'esports',
    entity_type: 'individual',
    operational_status: 'registration_open',
    participation_type: 'online',
    location_name: 'Online (Twitch & Discord)',
    entry_fee: 0,
    currency: 'USD',
    rules_summary: 'Single-elimination FPS tournament bracket with seeding based on seasonal score.',
    is_featured: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    leaderboard_id: 'lb-workplace-1',
    engine_type: 'simple_points',
    template_key: 'custom',
    entity_type: 'team',
    operational_status: 'in_progress',
    participation_type: 'online',
    location_name: 'Global Enterprise HQ',
    entry_fee: 0,
    currency: 'USD',
    rules_summary: 'Enterprise quarterly sales performance and qualified account bookings.',
    is_featured: false,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    leaderboard_id: 'lb-sports-1',
    engine_type: 'league_table',
    template_key: 'football',
    entity_type: 'individual',
    operational_status: 'in_progress',
    participation_type: 'in_person',
    location_name: 'Sunset Athletic Track, Bay Area',
    entry_fee: 10,
    currency: 'USD',
    rules_summary: 'Weekly circuit running league with 3-1-0 standings and age-graded tie breakers.',
    is_featured: true,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_REGISTRATION_CONFIGS: CompetitionRegistrationConfig[] = [
  {
    id: 'reg-cfg-gaming-1',
    leaderboard_id: 'lb-gaming-1',
    is_enabled: true,
    capacity: 16,
    opens_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    closes_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    require_approval: false,
    allow_waitlist: true,
    allow_team_registration: false,
    eligibility_rules: { min_age: 16, notes: 'Open community tournament' },
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'reg-cfg-workplace-1',
    leaderboard_id: 'lb-workplace-1',
    is_enabled: true,
    capacity: 20,
    opens_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    closes_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    require_approval: true,
    allow_waitlist: true,
    allow_team_registration: true,
    eligibility_rules: { allowed_domains: ['company.com'], notes: 'Verified company employees only' },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'reg-cfg-sports-1',
    leaderboard_id: 'lb-sports-1',
    is_enabled: true,
    capacity: 10,
    opens_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    closes_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    require_approval: true,
    allow_waitlist: true,
    allow_team_registration: false,
    eligibility_rules: { notes: 'Club membership or guest day pass required' },
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first_competition',
    name: 'Debutant',
    description: 'Completed your first competitive tournament or league match.',
    category: 'participation',
    badge_icon: 'award',
    badge_color: '#38bdf8',
    rarity: 'common',
    points_reward: 10,
    criteria: { type: 'first_competition' },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'first_win',
    name: 'First Blood',
    description: 'Claimed your first victory in official or community competition.',
    category: 'victory',
    badge_icon: 'trophy',
    badge_color: '#10b981',
    rarity: 'common',
    points_reward: 15,
    criteria: { type: 'first_win' },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'champion',
    name: 'Undisputed Champion',
    description: 'Finished in 1st place in an official competition or tournament.',
    category: 'mastery',
    badge_icon: 'crown',
    badge_color: '#f59e0b',
    rarity: 'legendary',
    points_reward: 100,
    criteria: { type: 'champion' },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'win_streak_3',
    name: 'On Fire',
    description: 'Won 3 competitive matches in a row.',
    category: 'streak',
    badge_icon: 'flame',
    badge_color: '#ec4899',
    rarity: 'rare',
    points_reward: 30,
    criteria: { type: 'win_streak', min_streak: 3 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'win_streak_5',
    name: 'Unstoppable',
    description: 'Won 5 competitive matches in a row.',
    category: 'streak',
    badge_icon: 'zap',
    badge_color: '#8b5cf6',
    rarity: 'epic',
    points_reward: 60,
    criteria: { type: 'win_streak', min_streak: 5 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'matches_10',
    name: 'Veteran Contender',
    description: 'Competed in 10 or more competitive matches.',
    category: 'milestone',
    badge_icon: 'shield',
    badge_color: '#6366f1',
    rarity: 'uncommon',
    points_reward: 25,
    criteria: { type: 'matches_count', min_matches: 10 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'matches_25',
    name: 'Seasoned Gladiator',
    description: 'Competed in 25 or more competitive matches.',
    category: 'milestone',
    badge_icon: 'star',
    badge_color: '#d946ef',
    rarity: 'rare',
    points_reward: 50,
    criteria: { type: 'matches_count', min_matches: 25 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'competitions_5',
    name: 'Cross-Arena Veteran',
    description: 'Competed across 5 or more distinct competitions.',
    category: 'milestone',
    badge_icon: 'globe',
    badge_color: '#06b6d4',
    rarity: 'epic',
    points_reward: 75,
    criteria: { type: 'competitions_count', min_competitions: 5 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'clean_sheet',
    name: 'Iron Defense',
    description: 'Won a match while conceding zero points or goals.',
    category: 'mastery',
    badge_icon: 'shield-check',
    badge_color: '#14b8a6',
    rarity: 'rare',
    points_reward: 35,
    criteria: { type: 'clean_sheet' },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'podium_triple',
    name: 'Podium Regular',
    description: 'Finished in the top 3 on the podium in 3 distinct competitions.',
    category: 'mastery',
    badge_icon: 'medal',
    badge_color: '#eab308',
    rarity: 'epic',
    points_reward: 80,
    criteria: { type: 'podium_count', min_podiums: 3 },
    is_active: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// LocalStorage Helper
class LocalDb {
  public get<T>(key: string, defaults: T): T {
    if (typeof window === 'undefined') return defaults;
    const val = localStorage.getItem(`leaderboardos_${key}`);
    if (!val) {
      this.set(key, defaults);
      return defaults;
    }
    try {
      return JSON.parse(val);
    } catch {
      return defaults;
    }
  }

  public set(key: string, val: unknown): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`leaderboardos_${key}`, JSON.stringify(val));
  }

  init(): void {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('leaderboardos_initialized')) {
      this.set('profile', DEFAULT_PROFILE);
      this.set('leaderboards', DEFAULT_LEADERBOARDS);
      this.set('seasons', DEFAULT_SEASONS);
      this.set('scoring_rules', DEFAULT_SCORING_RULES);
      this.set('teams', DEFAULT_TEAMS);
      this.set('team_members', DEFAULT_TEAM_MEMBERS);
      this.set('members', DEFAULT_MEMBERS);
      this.set('score_events', DEFAULT_SCORE_EVENTS);
      this.set('activity_logs', DEFAULT_ACTIVITY_LOGS);
      localStorage.setItem('leaderboardos_initialized', 'true');
    }
  }

  getProfile(): Profile {
    return this.get<Profile>('profile', DEFAULT_PROFILE);
  }

  setProfile(p: Profile): void {
    this.set('profile', p);
  }

  getLeaderboards(): Leaderboard[] {
    return this.get<Leaderboard[]>('leaderboards', DEFAULT_LEADERBOARDS);
  }

  setLeaderboards(lbs: Leaderboard[]): void {
    this.set('leaderboards', lbs);
  }

  getSeasons(): Season[] {
    return this.get<Season[]>('seasons', DEFAULT_SEASONS);
  }

  setSeasons(s: Season[]): void {
    this.set('seasons', s);
  }

  getScoringRules(): ScoringRule[] {
    return this.get<ScoringRule[]>('scoring_rules', DEFAULT_SCORING_RULES);
  }

  setScoringRules(sr: ScoringRule[]): void {
    this.set('scoring_rules', sr);
  }

  getTeams(): Team[] {
    return this.get<Team[]>('teams', DEFAULT_TEAMS);
  }

  setTeams(t: Team[]): void {
    this.set('teams', t);
  }

  getTeamMembers(): TeamMember[] {
    return this.get<TeamMember[]>('team_members', DEFAULT_TEAM_MEMBERS);
  }

  setTeamMembers(tm: TeamMember[]): void {
    this.set('team_members', tm);
  }

  getMembers(): LeaderboardMember[] {
    return this.get<LeaderboardMember[]>('members', DEFAULT_MEMBERS);
  }

  setMembers(m: LeaderboardMember[]): void {
    this.set('members', m);
  }

  getScoreEvents(): ScoreEvent[] {
    return this.get<ScoreEvent[]>('score_events', DEFAULT_SCORE_EVENTS);
  }

  setScoreEvents(se: ScoreEvent[]): void {
    this.set('score_events', se);
  }

  getActivityLogs(): ActivityLog[] {
    return this.get<ActivityLog[]>('activity_logs', DEFAULT_ACTIVITY_LOGS);
  }

  setActivityLogs(logs: ActivityLog[]): void {
    this.set('activity_logs', logs);
  }

  getParticipantProfiles(): ParticipantProfile[] {
    return this.get<ParticipantProfile[]>('participant_profiles', []);
  }

  setParticipantProfiles(profiles: ParticipantProfile[]): void {
    this.set('participant_profiles', profiles);
  }

  getParticipantClaims(): ParticipantClaim[] {
    return this.get<ParticipantClaim[]>('participant_claims', []);
  }

  setParticipantClaims(claims: ParticipantClaim[]): void {
    this.set('participant_claims', claims);
  }

  getParticipantCorrections(): ParticipantCorrection[] {
    return this.get<ParticipantCorrection[]>('participant_corrections', []);
  }

  setParticipantCorrections(corrections: ParticipantCorrection[]): void {
    this.set('participant_corrections', corrections);
  }

  getParticipantTeamHistory(): ParticipantTeamHistory[] {
    return this.get<ParticipantTeamHistory[]>('participant_team_history', []);
  }

  setParticipantTeamHistory(history: ParticipantTeamHistory[]): void {
    this.set('participant_team_history', history);
  }

  getAchievementDefinitions(): AchievementDefinition[] {
    return this.get<AchievementDefinition[]>('achievement_definitions', DEFAULT_ACHIEVEMENT_DEFINITIONS);
  }

  setAchievementDefinitions(defs: AchievementDefinition[]): void {
    this.set('achievement_definitions', defs);
  }

  getParticipantAchievements(): ParticipantAchievement[] {
    return this.get<ParticipantAchievement[]>('participant_achievements', []);
  }

  setParticipantAchievements(achievements: ParticipantAchievement[]): void {
    this.set('participant_achievements', achievements);
  }

  getCompetitionRatings(): CompetitionRating[] {
    return this.get<CompetitionRating[]>('competition_ratings', []);
  }

  setCompetitionRatings(ratings: CompetitionRating[]): void {
    this.set('competition_ratings', ratings);
  }

  getRatingHistory(): RatingHistoryEntry[] {
    return this.get<RatingHistoryEntry[]>('rating_history', []);
  }

  setRatingHistory(history: RatingHistoryEntry[]): void {
    this.set('rating_history', history);
  }
}

export const mockDb = new LocalDb();

// ==========================================
// UNIFIED DATABASE SERVICE EXPORT
// ==========================================

export const DatabaseService = {
  initialize() {
    if (!isSupabaseConfigured) {
      mockDb.init();
    }
  },

  // Auth/Profiles
  async getCurrentProfile(): Promise<Profile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    }
    return mockDb.getProfile();
  },

  async getProfile(id: string): Promise<Profile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return null;
      return data;
    }
    const current = mockDb.getProfile();
    if (current && current.id === id) return current;
    // Check if user has an entry in profile mock
    const allUsers = mockDb.get<Profile[]>('mock_all_profiles', []);
    const found = allUsers.find((p) => p.id === id);
    if (found) return found;
    return current;
  },

  async mockLogin(email: string, fullName: string): Promise<Profile> {
    const profile: Profile = {
      id: SEED_CREATOR_ID,
      email,
      full_name: fullName,
      role: 'super_admin',
      avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.setProfile(profile);
    return profile;
  },

  async getProfileByEmail(email: string): Promise<Profile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (error) return null;
      return data;
    }
    const currentProfile = mockDb.getProfile();
    if (currentProfile.email === email) return currentProfile;
    if (email.includes('@')) {
      return {
        id: `user-${email.split('@')[0]}`,
        email,
        full_name: email.split('@')[0].toUpperCase(),
        role: 'member',
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(email)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return null;
  },

  // Permission Guards & Helpers
  async getAdmins(leaderboardId: string): Promise<LeaderboardAdmin[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_admins')
        .select('*, profile:profiles(*)')
        .eq('leaderboard_id', leaderboardId);
      if (error) throw error;
      return (data || []).map((la: LeaderboardAdmin) => ({
        leaderboard_id: la.leaderboard_id,
        user_id: la.user_id,
        created_at: la.created_at,
        profile: la.profile
      }));
    }
    const list = mockDb.get<LeaderboardAdmin[]>('leaderboard_admins', []);
    const filtered = list.filter(la => la.leaderboard_id === leaderboardId);
    return filtered.map(la => {
      const profile = mockDb.getProfile().id === la.user_id ? mockDb.getProfile() : {
        id: la.user_id,
        email: `${la.user_id}@leaderboardos.com`,
        full_name: la.user_id.toUpperCase(),
        role: 'member' as const,
        avatar_url: null,
        created_at: la.created_at,
        updated_at: la.created_at
      };
      return { ...la, profile };
    });
  },

  async addAdmin(leaderboardId: string, userId: string): Promise<LeaderboardAdmin> {
    await this.requireOwnerPermission(leaderboardId);
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_admins')
        .insert([{ leaderboard_id: leaderboardId, user_id: userId }])
        .select('*, profile:profiles(*)')
        .single();
      if (error) throw error;
      return {
        leaderboard_id: data.leaderboard_id,
        user_id: data.user_id,
        created_at: data.created_at,
        profile: data.profile
      };
    }
    const currentAdmins = mockDb.get<LeaderboardAdmin[]>('leaderboard_admins', []);
    const alreadyExists = currentAdmins.some(la => la.leaderboard_id === leaderboardId && la.user_id === userId);
    if (alreadyExists) throw new Error('User is already an admin of this leaderboard.');
    
    const newAdmin: LeaderboardAdmin = {
      leaderboard_id: leaderboardId,
      user_id: userId,
      created_at: new Date().toISOString()
    };
    mockDb.set('leaderboard_admins', [...currentAdmins, newAdmin]);
    
    const profile = mockDb.getProfile().id === userId ? mockDb.getProfile() : {
      id: userId,
      email: `${userId}@leaderboardos.com`,
      full_name: userId.toUpperCase(),
      role: 'member' as const,
      avatar_url: null,
      created_at: newAdmin.created_at,
      updated_at: newAdmin.created_at
    };
    return { ...newAdmin, profile };
  },

  async removeAdmin(leaderboardId: string, userId: string): Promise<void> {
    await this.requireOwnerPermission(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('leaderboard_admins')
        .delete()
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }
    const currentAdmins = mockDb.get<LeaderboardAdmin[]>('leaderboard_admins', []);
    mockDb.set('leaderboard_admins', currentAdmins.filter(la => !(la.leaderboard_id === leaderboardId && la.user_id === userId)));
  },

  async canManageLeaderboard(userId: string | undefined, leaderboardId: string): Promise<boolean> {
    if (!userId) return false;
    const leaderboard = await this.getLeaderboardById(leaderboardId);
    if (!leaderboard) return false;
    if (leaderboard.owner_id === userId) return true;
    
    const admins = await this.getAdmins(leaderboardId);
    return admins.some(la => la.user_id === userId);
  },

  async requireAdminPermission(leaderboardId: string): Promise<string> {
    const profile = await this.getCurrentProfile();
    if (!profile) {
      throw new Error('Unauthenticated: You must be logged in.');
    }
    const hasPermission = await this.canManageLeaderboard(profile.id, leaderboardId);
    if (!hasPermission) {
      throw new Error('Permission denied: You do not have permission to manage this leaderboard.');
    }
    return profile.id;
  },

  async requireOwnerPermission(leaderboardId: string): Promise<string> {
    const profile = await this.getCurrentProfile();
    if (!profile) {
      throw new Error('Unauthenticated: You must be logged in.');
    }
    const leaderboard = await this.getLeaderboardById(leaderboardId);
    if (!leaderboard) {
      throw new Error('Leaderboard not found.');
    }
    if (leaderboard.owner_id !== profile.id) {
      throw new Error('Permission denied: Only the leaderboard owner can perform this action.');
    }
    return profile.id;
  },

  async getLeaderboardIdFromScoringRule(ruleId: string): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('leaderboard_id')
        .eq('id', ruleId)
        .maybeSingle();
      if (error) return null;
      return data?.leaderboard_id || null;
    }
    const rule = mockDb.getScoringRules().find(r => r.id === ruleId);
    return rule?.leaderboard_id || null;
  },

  async getLeaderboardIdFromMember(memberId: string): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .select('leaderboard_id')
        .eq('id', memberId)
        .maybeSingle();
      if (error) return null;
      return data?.leaderboard_id || null;
    }
    const member = mockDb.getMembers().find(m => m.id === memberId);
    return member?.leaderboard_id || null;
  },

  async getLeaderboardIdFromTeam(teamId: string): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('teams')
        .select('leaderboard_id')
        .eq('id', teamId)
        .maybeSingle();
      if (error) return null;
      return data?.leaderboard_id || null;
    }
    const team = mockDb.getTeams().find(t => t.id === teamId);
    return team?.leaderboard_id || null;
  },


  // Leaderboards
  async getLeaderboards(): Promise<Leaderboard[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getLeaderboards().filter(lb => lb.status === 'active');
  },

  async getArchivedLeaderboards(): Promise<Leaderboard[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('status', 'archived')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getLeaderboards().filter(lb => lb.status === 'archived');
  },

  async getLeaderboardBySlug(slug: string): Promise<Leaderboard | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
    const found = mockDb.getLeaderboards().find(lb => lb.slug === slug);
    return found || null;
  },

  async getLeaderboardById(id: string): Promise<Leaderboard | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
    const found = mockDb.getLeaderboards().find(lb => lb.id === id);
    return found || null;
  },

  async getLeaderboard(id: string): Promise<Leaderboard | null> {
    return this.getLeaderboardById(id);
  },

  async getCompetitionConfig(leaderboardId: string): Promise<CompetitionConfig | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_configs')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();
      if (error) return null;
      return data as CompetitionConfig;
    }
    const configs = mockDb.get<CompetitionConfig[]>('competition_configs', DEFAULT_COMPETITION_CONFIGS);
    return configs.find(c => c.leaderboard_id === leaderboardId) || null;
  },

  async saveCompetitionConfig(config: CompetitionConfig): Promise<CompetitionConfig> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_configs')
        .upsert(config, { onConflict: 'leaderboard_id' })
        .select()
        .single();
      if (error) throw error;
      return data as CompetitionConfig;
    }
    const configs = mockDb.get<CompetitionConfig[]>('competition_configs', DEFAULT_COMPETITION_CONFIGS);
    const existingIdx = configs.findIndex(c => c.leaderboard_id === config.leaderboard_id);
    const updated = { ...config, updated_at: new Date().toISOString() };
    if (existingIdx >= 0) {
      configs[existingIdx] = updated;
    } else {
      configs.push(updated);
    }
    mockDb.set('competition_configs', configs);
    return updated;
  },

  async getAllCompetitionConfigs(): Promise<CompetitionConfig[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('competition_configs').select('*');
      if (error) return [];
      return (data || []) as CompetitionConfig[];
    }
    return mockDb.get<CompetitionConfig[]>('competition_configs', DEFAULT_COMPETITION_CONFIGS);
  },

  async getAllRegistrationConfigs(): Promise<CompetitionRegistrationConfig[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('competition_registration_configs').select('*');
      if (error) return [];
      return (data || []) as CompetitionRegistrationConfig[];
    }
    return mockDb.get<CompetitionRegistrationConfig[]>('competition_registration_configs', DEFAULT_REGISTRATION_CONFIGS);
  },

  async createLeaderboard(
    lb: Omit<Leaderboard, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'status'>,
    rules: Omit<ScoringRule, 'id' | 'leaderboard_id' | 'created_at'>[] = [],
    season: Omit<Season, 'id' | 'leaderboard_id' | 'created_at'> | null = null
  ): Promise<Leaderboard> {
    const profile = await this.getCurrentProfile();
    const owner_id = profile?.id;
    
    if (isSupabaseConfigured && supabase) {
      if (!owner_id) {
        throw new Error('You must be logged in to create a leaderboard.');
      }

      const response = await fetch('/api/leaderboards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderboard: { ...lb },
          rules,
          season,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create leaderboard.');
      }

      return result.data;
    }

    // Local Storage Flow
    const safeOwnerId = owner_id || SEED_CREATOR_ID;
    const newId = `lb-${Math.random().toString(36).substr(2, 9)}`;
    const createdLb: Leaderboard = {
      ...lb,
      id: newId,
      owner_id: safeOwnerId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const currentLbs = mockDb.getLeaderboards();
    mockDb.setLeaderboards([createdLb, ...currentLbs]);

    if (rules.length > 0) {
      const currentRules = mockDb.getScoringRules();
      const rulesWithIds = rules.map(r => ({
        ...r,
        id: `rule-${Math.random().toString(36).substr(2, 9)}`,
        leaderboard_id: newId,
        created_at: new Date().toISOString()
      }));
      mockDb.setScoringRules([...currentRules, ...rulesWithIds]);
    }

    if (season) {
      const currentSeasons = mockDb.getSeasons();
      mockDb.setSeasons([
        ...currentSeasons,
        {
          ...season,
          id: `season-${Math.random().toString(36).substr(2, 9)}`,
          leaderboard_id: newId,
          created_at: new Date().toISOString()
        }
      ]);
    }

    return createdLb;
  },

  async updateLeaderboard(id: string, updates: Partial<Leaderboard>): Promise<Leaderboard> {
    await this.requireAdminPermission(id);
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const currentLbs = mockDb.getLeaderboards();
    const idx = currentLbs.findIndex(lb => lb.id === id);
    if (idx === -1) throw new Error('Leaderboard not found');
    
    const updated = {
      ...currentLbs[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    currentLbs[idx] = updated;
    mockDb.setLeaderboards(currentLbs);
    return updated;
  },

  async duplicateLeaderboard(id: string): Promise<Leaderboard> {
    await this.requireAdminPermission(id);

    const original = await this.getLeaderboardById(id);
    if (!original) throw new Error('Original leaderboard not found');

    const originalRules = await this.getScoringRules(id);
    const originalSeasons = await this.getSeasons(id);
    const originalMembers = await this.getMembers(id);

    const dupName = `${original.name} (Copy)`;
    const dupSlug = `${original.slug}-copy-${Math.random().toString(36).substr(2, 4)}`;

    const duplicated = await this.createLeaderboard(
      {
        name: dupName,
        description: original.description,
        slug: dupSlug,
        visibility: original.visibility,
        competition_type: original.competition_type,
        cover_image_url: original.cover_image_url
      },
      originalRules.map(r => ({ event_name: r.event_name, points: r.points, description: r.description })),
      originalSeasons.length > 0 ? { name: originalSeasons[0].name, start_date: originalSeasons[0].start_date, end_date: originalSeasons[0].end_date } : null
    );

    // Duplicate members as well to make copying extremely useful
    if (originalMembers.length > 0) {
      for (const m of originalMembers) {
        await this.addMember(duplicated.id, {
          name: m.name,
          email: m.email,
          avatar_url: m.avatar_url,
          team: m.team,
          notes: m.notes
        });
      }
    }

    return duplicated;
  },

  async deleteLeaderboard(id: string): Promise<void> {
    await this.requireOwnerPermission(id);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('leaderboards').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    const currentLbs = mockDb.getLeaderboards();
    mockDb.setLeaderboards(currentLbs.filter(lb => lb.id !== id));
  },

  // Seasons
  async getSeasons(leaderboardId: string): Promise<Season[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('leaderboard_id', leaderboardId);
      if (error) throw error;
      return data || [];
    }
    return mockDb.getSeasons().filter(s => s.leaderboard_id === leaderboardId);
  },

  // Scoring Rules
  async getScoringRules(leaderboardId: string): Promise<ScoringRule[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getScoringRules().filter(r => r.leaderboard_id === leaderboardId);
  },

  async addScoringRule(leaderboardId: string, rule: Omit<ScoringRule, 'id' | 'leaderboard_id' | 'created_at'>): Promise<ScoringRule> {
    await this.requireAdminPermission(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('scoring_rules')
        .insert([{ ...rule, leaderboard_id: leaderboardId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const currentRules = mockDb.getScoringRules();
    const newRule: ScoringRule = {
      ...rule,
      id: `rule-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      created_at: new Date().toISOString()
    };
    mockDb.setScoringRules([...currentRules, newRule]);
    return newRule;
  },

  async deleteScoringRule(id: string): Promise<void> {
    const leaderboardId = await this.getLeaderboardIdFromScoringRule(id);
    if (!leaderboardId) throw new Error('Scoring rule not found.');
    await this.requireAdminPermission(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('scoring_rules').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    const currentRules = mockDb.getScoringRules();
    mockDb.setScoringRules(currentRules.filter(r => r.id !== id));
  },

  // Members (Players)
  async getMembers(leaderboardId: string): Promise<LeaderboardMember[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getMembers().filter(m => m.leaderboard_id === leaderboardId);
  },

  async addMember(
    leaderboardId: string,
    member: Omit<LeaderboardMember, 'id' | 'leaderboard_id' | 'created_at' | 'updated_at' | 'is_active'>,
    options?: { skipAdminCheck?: boolean }
  ): Promise<LeaderboardMember> {
    if (!options?.skipAdminCheck) {
      await this.requireAdminPermission(leaderboardId);
    }
    const avatar = member.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(member.name)}`;
    
    // Resolve team & team_id
    let resolvedTeamId = member.team_id || null;
    let resolvedTeamName = member.team?.trim() || null;

    if (resolvedTeamId) {
      const team = await this.getTeam(resolvedTeamId);
      if (team && team.leaderboard_id === leaderboardId) {
        resolvedTeamName = team.name;
      } else {
        resolvedTeamId = null;
      }
    } else if (resolvedTeamName) {
      const teams = await this.getTeams(leaderboardId);
      const matched = teams.find(t => t.name.toLowerCase() === resolvedTeamName!.toLowerCase());
      if (matched) {
        resolvedTeamId = matched.id;
        resolvedTeamName = matched.name;
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .insert([{ 
          ...member, 
          avatar_url: avatar, 
          leaderboard_id: leaderboardId, 
          team: resolvedTeamName,
          team_id: resolvedTeamId,
          is_active: true 
        }])
        .select()
        .single();
      if (error) throw error;

      if (resolvedTeamId) {
        await supabase
          .from('team_members')
          .insert([{
            team_id: resolvedTeamId,
            leaderboard_id: leaderboardId,
            member_id: data.id,
            role: 'player'
          }])
          .select()
          .maybeSingle();
      }

      return data;
    }

    const currentMembers = mockDb.getMembers();
    // Check uniqueness constraint
    const duplicate = currentMembers.find(m => m.leaderboard_id === leaderboardId && m.name.toLowerCase() === member.name.toLowerCase());
    if (duplicate) {
      throw new Error(`A player named "${member.name}" already exists on this leaderboard.`);
    }

    const newMemberId = `mem-${Math.random().toString(36).substr(2, 9)}`;
    const newMember: LeaderboardMember = {
      ...member,
      avatar_url: avatar,
      id: newMemberId,
      leaderboard_id: leaderboardId,
      team: resolvedTeamName,
      team_id: resolvedTeamId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.setMembers([...currentMembers, newMember]);

    if (resolvedTeamId) {
      const currentRoster = mockDb.getTeamMembers();
      mockDb.setTeamMembers([...currentRoster, {
        id: `tm-${Math.random().toString(36).substr(2, 9)}`,
        team_id: resolvedTeamId,
        leaderboard_id: leaderboardId,
        member_id: newMemberId,
        role: 'player',
        jersey_number: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        member: newMember,
      }]);
    }

    return newMember;
  },

  async updateMember(
    id: string,
    updates: Partial<LeaderboardMember>,
    options?: { skipAdminCheck?: boolean }
  ): Promise<LeaderboardMember> {
    const leaderboardId = await this.getLeaderboardIdFromMember(id);
    if (!leaderboardId) throw new Error('Player not found.');
    if (!options?.skipAdminCheck) {
      await this.requireAdminPermission(leaderboardId);
    }

    let resolvedUpdates = { ...updates };
    if ('team_id' in updates || 'team' in updates) {
      let nextTeamId = updates.team_id !== undefined ? updates.team_id : null;
      let nextTeamName = updates.team !== undefined ? updates.team?.trim() || null : undefined;

      if (nextTeamId) {
        const team = await this.getTeam(nextTeamId);
        if (team && team.leaderboard_id === leaderboardId) {
          nextTeamName = team.name;
        } else {
          nextTeamId = null;
        }
      } else if (nextTeamName) {
        const teams = await this.getTeams(leaderboardId);
        const matched = teams.find(t => t.name.toLowerCase() === nextTeamName!.toLowerCase());
        if (matched) {
          nextTeamId = matched.id;
          nextTeamName = matched.name;
        }
      }

      resolvedUpdates = {
        ...resolvedUpdates,
        team_id: nextTeamId,
        team: nextTeamName !== undefined ? nextTeamName : null,
      };

      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('team_members')
          .delete()
          .eq('leaderboard_id', leaderboardId)
          .eq('member_id', id);

        if (nextTeamId) {
          await supabase
            .from('team_members')
            .insert([{
              team_id: nextTeamId,
              leaderboard_id: leaderboardId,
              member_id: id,
              role: 'player'
            }]);
        }
      } else {
        const roster = mockDb.getTeamMembers().filter(tm => !(tm.leaderboard_id === leaderboardId && tm.member_id === id));
        if (nextTeamId) {
          const m = mockDb.getMembers().find(mem => mem.id === id);
          roster.push({
            id: `tm-${Math.random().toString(36).substr(2, 9)}`,
            team_id: nextTeamId,
            leaderboard_id: leaderboardId,
            member_id: id,
            role: 'player',
            jersey_number: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            member: m,
          });
        }
        mockDb.setTeamMembers(roster);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .update({ ...resolvedUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const currentMembers = mockDb.getMembers();
    const idx = currentMembers.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('Player not found');

    const updated = {
      ...currentMembers[idx],
      ...resolvedUpdates,
      updated_at: new Date().toISOString()
    };
    currentMembers[idx] = updated;
    mockDb.setMembers(currentMembers);
    return updated;
  },

  async removeMember(id: string): Promise<void> {
    const leaderboardId = await this.getLeaderboardIdFromMember(id);
    if (!leaderboardId) throw new Error('Player not found.');
    await this.requireAdminPermission(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('team_members').delete().eq('member_id', id);
      const { error } = await supabase.from('leaderboard_members').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    // Cascading deletes manually in local storage
    const currentMembers = mockDb.getMembers();
    const currentEvents = mockDb.getScoreEvents();
    const currentRoster = mockDb.getTeamMembers();
    
    mockDb.setMembers(currentMembers.filter(m => m.id !== id));
    mockDb.setScoreEvents(currentEvents.filter(ev => ev.member_id !== id));
    mockDb.setTeamMembers(currentRoster.filter(tm => tm.member_id !== id));
  },

  // ==========================================
  // TEAMS & ROSTERS
  // ==========================================
  async getTeams(leaderboardId: string): Promise<Team[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getTeams()
      .filter(t => t.leaderboard_id === leaderboardId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getTeam(teamId: string): Promise<Team | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    }
    const found = mockDb.getTeams().find(t => t.id === teamId);
    return found || null;
  },

  async createTeam(
    leaderboardId: string, 
    input: { name: string; short_code?: string | null; logo_url?: string | null }
  ): Promise<Team> {
    await this.requireAdminPermission(leaderboardId);
    const name = input.name.trim();
    if (!name) {
      throw new Error('Team name is required.');
    }
    const short_code = input.short_code?.trim() || generateShortCode(name);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('teams')
        .insert([{
          leaderboard_id: leaderboardId,
          name,
          short_code,
          logo_url: input.logo_url || null,
        }])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new Error(`A team named "${name}" already exists in this competition.`);
        }
        throw error;
      }
      await this.addActivityLog(leaderboardId, `Created team "${name}" (${short_code})`);
      return data;
    }

    const currentTeams = mockDb.getTeams();
    const exists = currentTeams.some(
      t => t.leaderboard_id === leaderboardId && t.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      throw new Error(`A team named "${name}" already exists in this competition.`);
    }

    const newTeam: Team = {
      id: `team-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      name,
      short_code,
      logo_url: input.logo_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDb.setTeams([...currentTeams, newTeam]);
    await this.addActivityLog(leaderboardId, `Created team "${name}" (${short_code})`);
    return newTeam;
  },

  async updateTeam(
    teamId: string, 
    updates: Partial<Pick<Team, 'name' | 'short_code' | 'logo_url'>>
  ): Promise<Team> {
    const leaderboardId = await this.getLeaderboardIdFromTeam(teamId);
    if (!leaderboardId) throw new Error('Team not found.');
    await this.requireAdminPermission(leaderboardId);

    const name = updates.name !== undefined ? updates.name.trim() : undefined;
    if (name === '') {
      throw new Error('Team name cannot be empty.');
    }

    if (isSupabaseConfigured && supabase) {
      const payload: Partial<Team> & { updated_at: string } = { ...updates, updated_at: new Date().toISOString() };
      if (name !== undefined) payload.name = name;
      
      const { data, error } = await supabase
        .from('teams')
        .update(payload)
        .eq('id', teamId)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new Error(`A team named "${name}" already exists in this competition.`);
        }
        throw error;
      }

      // Sync member legacy team text if name changed
      if (name !== undefined) {
        await supabase
          .from('leaderboard_members')
          .update({ team: name })
          .eq('team_id', teamId);
      }

      await this.addActivityLog(leaderboardId, `Updated team "${data.name}"`);
      return data;
    }

    const currentTeams = mockDb.getTeams();
    const idx = currentTeams.findIndex(t => t.id === teamId);
    if (idx === -1) throw new Error('Team not found');

    if (name !== undefined && name.toLowerCase() !== currentTeams[idx].name.toLowerCase()) {
      const exists = currentTeams.some(
        t => t.leaderboard_id === leaderboardId && t.id !== teamId && t.name.toLowerCase() === name.toLowerCase()
      );
      if (exists) {
        throw new Error(`A team named "${name}" already exists in this competition.`);
      }
    }

    const updatedTeam: Team = {
      ...currentTeams[idx],
      ...updates,
      ...(name !== undefined ? { name } : {}),
      updated_at: new Date().toISOString(),
    };
    currentTeams[idx] = updatedTeam;
    mockDb.setTeams(currentTeams);

    // Sync member legacy team text
    if (name !== undefined) {
      const members = mockDb.getMembers();
      let changed = false;
      const updatedMembers = members.map(m => {
        if (m.team_id === teamId) {
          changed = true;
          return { ...m, team: name, updated_at: new Date().toISOString() };
        }
        return m;
      });
      if (changed) {
        mockDb.setMembers(updatedMembers);
      }
    }

    await this.addActivityLog(leaderboardId, `Updated team "${updatedTeam.name}"`);
    return updatedTeam;
  },

  async deleteTeam(teamId: string): Promise<void> {
    const leaderboardId = await this.getLeaderboardIdFromTeam(teamId);
    if (!leaderboardId) throw new Error('Team not found.');
    await this.requireAdminPermission(leaderboardId);

    const team = await this.getTeam(teamId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
      if (team) {
        await this.addActivityLog(leaderboardId, `Deleted team "${team.name}"`);
      }
      return;
    }

    const currentTeams = mockDb.getTeams();
    mockDb.setTeams(currentTeams.filter(t => t.id !== teamId));

    // Cascade remove from team_members and unassign from members
    const currentRoster = mockDb.getTeamMembers();
    mockDb.setTeamMembers(currentRoster.filter(tm => tm.team_id !== teamId));

    const currentMembers = mockDb.getMembers();
    mockDb.setMembers(currentMembers.map(m => m.team_id === teamId ? { ...m, team_id: null } : m));

    if (team) {
      await this.addActivityLog(leaderboardId, `Deleted team "${team.name}"`);
    }
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, member:leaderboard_members(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown as Array<TeamMember & { member: LeaderboardMember }>).map((row) => ({
        id: row.id,
        team_id: row.team_id,
        leaderboard_id: row.leaderboard_id,
        member_id: row.member_id,
        role: row.role,
        jersey_number: row.jersey_number,
        created_at: row.created_at,
        updated_at: row.updated_at,
        member: row.member,
      }));
    }

    const allMembers = mockDb.getMembers();
    return mockDb.getTeamMembers()
      .filter(tm => tm.team_id === teamId)
      .map(tm => ({
        ...tm,
        member: allMembers.find(m => m.id === tm.member_id),
      }));
  },

  async addTeamMember(
    teamId: string, 
    memberId: string, 
    role: TeamRosterRole = 'player', 
    jerseyNumber?: number | null
  ): Promise<TeamMember> {
    const leaderboardId = await this.getLeaderboardIdFromTeam(teamId);
    if (!leaderboardId) throw new Error('Team not found.');
    await this.requireAdminPermission(leaderboardId);

    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found.');

    // Check member
    const memberLeaderboardId = await this.getLeaderboardIdFromMember(memberId);
    if (!memberLeaderboardId || memberLeaderboardId !== leaderboardId) {
      throw new Error('Participant does not belong to this competition.');
    }

    // Check if participant is already assigned in this competition
    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase
        .from('team_members')
        .select('id, team_id')
        .eq('leaderboard_id', leaderboardId)
        .eq('member_id', memberId)
        .maybeSingle();

      if (existing) {
        if (existing.team_id === teamId) {
          throw new Error('Participant is already a member of this team roster.');
        } else {
          throw new Error('Participant is already assigned to another team in this competition.');
        }
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          leaderboard_id: leaderboardId,
          member_id: memberId,
          role,
          jersey_number: jerseyNumber ?? null,
        }])
        .select('*, member:leaderboard_members(*)')
        .single();
      if (error) throw error;

      // Sync member's team_id and legacy team name
      await supabase
        .from('leaderboard_members')
        .update({ team_id: teamId, team: team.name })
        .eq('id', memberId);

      const memberName = data?.member?.name || 'Participant';
      await this.addActivityLog(leaderboardId, `Added ${memberName} to team "${team.name}" as ${role}`);
      return data;
    }

    const currentRoster = mockDb.getTeamMembers();
    const existing = currentRoster.find(tm => tm.leaderboard_id === leaderboardId && tm.member_id === memberId);
    if (existing) {
      if (existing.team_id === teamId) {
        throw new Error('Participant is already a member of this team roster.');
      } else {
        throw new Error('Participant is already assigned to another team in this competition.');
      }
    }

    const allMembers = mockDb.getMembers();
    const member = allMembers.find(m => m.id === memberId);
    if (!member) throw new Error('Participant not found.');

    const newRosterEntry: TeamMember = {
      id: `tm-${Math.random().toString(36).substr(2, 9)}`,
      team_id: teamId,
      leaderboard_id: leaderboardId,
      member_id: memberId,
      role,
      jersey_number: jerseyNumber ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      member,
    };

    mockDb.setTeamMembers([...currentRoster, newRosterEntry]);

    // Sync member's team_id and legacy team name
    const updatedMembers = allMembers.map(m => {
      if (m.id === memberId) {
        return { ...m, team_id: teamId, team: team.name, updated_at: new Date().toISOString() };
      }
      return m;
    });
    mockDb.setMembers(updatedMembers);

    // Record team history affiliation
    const teamHistoryEntry: ParticipantTeamHistory = {
      id: `pth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: member.user_id || null,
      member_id: memberId,
      leaderboard_id: leaderboardId,
      team_id: teamId,
      team_name: team.name,
      role,
      jersey_number: jerseyNumber ?? null,
      joined_at: new Date().toISOString(),
      left_at: null,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured && supabase) {
      await supabase.from('participant_team_history').insert([teamHistoryEntry]);
    } else {
      const hist = mockDb.getParticipantTeamHistory();
      hist.push(teamHistoryEntry);
      mockDb.setParticipantTeamHistory(hist);
    }

    await this.addActivityLog(leaderboardId, `Added ${member.name} to team "${team.name}" as ${role}`);
    return newRosterEntry;
  },

  async updateTeamMemberRole(
    teamId: string, 
    memberId: string, 
    role: TeamRosterRole, 
    jerseyNumber?: number | null
  ): Promise<TeamMember> {
    const leaderboardId = await this.getLeaderboardIdFromTeam(teamId);
    if (!leaderboardId) throw new Error('Team not found.');
    await this.requireAdminPermission(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .update({
          role,
          jersey_number: jerseyNumber !== undefined ? jerseyNumber : null,
          updated_at: new Date().toISOString(),
        })
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .select('*, member:leaderboard_members(*)')
        .single();
      if (error) throw error;
      return data;
    }

    const currentRoster = mockDb.getTeamMembers();
    const idx = currentRoster.findIndex(tm => tm.team_id === teamId && tm.member_id === memberId);
    if (idx === -1) throw new Error('Roster entry not found');

    const updated: TeamMember = {
      ...currentRoster[idx],
      role,
      jersey_number: jerseyNumber !== undefined ? jerseyNumber : currentRoster[idx].jersey_number,
      updated_at: new Date().toISOString(),
    };
    currentRoster[idx] = updated;
    mockDb.setTeamMembers(currentRoster);

    const member = mockDb.getMembers().find(m => m.id === memberId);
    return { ...updated, member };
  },

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    const leaderboardId = await this.getLeaderboardIdFromTeam(teamId);
    if (!leaderboardId) throw new Error('Team not found.');
    await this.requireAdminPermission(leaderboardId);

    const team = await this.getTeam(teamId);
    const member = (await this.getMembers(leaderboardId)).find(m => m.id === memberId);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId);
      if (error) throw error;

      await supabase
        .from('leaderboard_members')
        .update({ team_id: null, team: null })
        .eq('id', memberId);

      await supabase
        .from('participant_team_history')
        .update({ left_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .is('left_at', null);

      if (team && member) {
        await this.addActivityLog(leaderboardId, `Removed ${member.name} from team "${team.name}"`);
      }
      return;
    }

    const currentRoster = mockDb.getTeamMembers();
    mockDb.setTeamMembers(currentRoster.filter(tm => !(tm.team_id === teamId && tm.member_id === memberId)));

    const currentMembers = mockDb.getMembers();
    mockDb.setMembers(currentMembers.map(m => m.id === memberId ? { ...m, team_id: null, team: null } : m));

    // Close out team history in mock
    const hist = mockDb.getParticipantTeamHistory();
    const active = hist.find((h) => h.team_id === teamId && h.member_id === memberId && !h.left_at);
    if (active) {
      active.left_at = new Date().toISOString();
      mockDb.setParticipantTeamHistory(hist);
    }

    if (team && member) {
      await this.addActivityLog(leaderboardId, `Removed ${member.name} from team "${team.name}"`);
    }
  },

  async getTeamWithRoster(teamId: string): Promise<TeamWithRoster | null> {
    const team = await this.getTeam(teamId);
    if (!team) return null;
    const members = await this.getTeamMembers(teamId);
    const validMembers = members.filter((m): m is TeamMember & { member: LeaderboardMember } => !!m.member);
    return {
      ...team,
      members: validMembers,
      member_count: validMembers.length,
    };
  },

  async getTeamsWithRosters(leaderboardId: string): Promise<TeamWithRoster[]> {
    const teams = await this.getTeams(leaderboardId);
    if (teams.length === 0) return [];

    let allRoster: TeamMember[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, member:leaderboard_members(*)')
        .eq('leaderboard_id', leaderboardId);
      if (!error && data) {
        allRoster = ((data || []) as unknown as Array<TeamMember & { member: LeaderboardMember }>).map((row) => ({
          id: row.id,
          team_id: row.team_id,
          leaderboard_id: row.leaderboard_id,
          member_id: row.member_id,
          role: row.role,
          jersey_number: row.jersey_number,
          created_at: row.created_at,
          updated_at: row.updated_at,
          member: row.member,
        }));
      }
    } else {
      const members = mockDb.getMembers().filter(m => m.leaderboard_id === leaderboardId);
      allRoster = mockDb.getTeamMembers()
        .filter(tm => tm.leaderboard_id === leaderboardId)
        .map(tm => ({
          ...tm,
          member: members.find(m => m.id === tm.member_id),
        }));
    }

    return teams.map(team => {
      const members = allRoster
        .filter(tm => tm.team_id === team.id && !!tm.member)
        .map(tm => tm as TeamMember & { member: LeaderboardMember });
      return {
        ...team,
        members,
        member_count: members.length,
      };
    });
  },

  async backfillTeams(leaderboardId: string): Promise<{ createdTeams: number; linkedMembers: number }> {
    await this.requireAdminPermission(leaderboardId);
    const members = await this.getMembers(leaderboardId);
    const existingTeams = await this.getTeams(leaderboardId);

    const teamMap = new Map<string, Team>();
    for (const t of existingTeams) {
      teamMap.set(t.name.toLowerCase().trim(), t);
    }

    let createdTeams = 0;
    let linkedMembers = 0;

    for (const member of members) {
      const rawName = member.team?.trim();
      if (!rawName) continue;

      let team = teamMap.get(rawName.toLowerCase());
      if (!team) {
        const short_code = generateShortCode(rawName);
        team = await this.createTeam(leaderboardId, {
          name: rawName,
          short_code,
        });
        teamMap.set(rawName.toLowerCase(), team);
        createdTeams++;
      }

      // If member doesn't have team_id set or it differs
      if (member.team_id !== team.id) {
        await this.updateMember(member.id, {
          team_id: team.id,
          team: team.name,
        });
        linkedMembers++;
      }
    }

    return { createdTeams, linkedMembers };
  },

  // Score Events
  async addScoreEvent(leaderboardId: string, memberId: string, event: Omit<ScoreEvent, 'id' | 'leaderboard_id' | 'member_id' | 'created_at'>): Promise<ScoreEvent> {
    await this.requireAdminPermission(leaderboardId);
    
    // Validate score adjustment against competition rules
    const rules = await CompetitionRulesService.getRules(leaderboardId);
    const validation = validateScoreAdjustment(rules, { points: event.points, reason: event.reason });
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const timestamp = new Date().toISOString();
    
    let createdEvent: ScoreEvent;
    let participantName = 'Unknown Player';

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('score_events')
        .insert([{ ...event, leaderboard_id: leaderboardId, member_id: memberId }])
        .select('*, leaderboard_members(name)')
        .single();
      if (error) throw error;
      createdEvent = data as ScoreEvent;
      participantName = (data.leaderboard_members as { name?: string })?.name || 'Unknown Player';
    } else {
      const newEvent: ScoreEvent = {
        ...event,
        id: `ev-${Math.random().toString(36).substr(2, 9)}`,
        leaderboard_id: leaderboardId,
        member_id: memberId,
        created_at: timestamp
      };

      const currentEvents = mockDb.getScoreEvents();
      mockDb.setScoreEvents([...currentEvents, newEvent]);

      const members = mockDb.getMembers();
      const player = members.find(m => m.id === memberId);
      participantName = player ? player.name : 'Unknown Player';
      const ptsStr = event.points >= 0 ? `+${event.points}` : `${event.points}`;
      const logMessage = `${participantName} score adjusted by ${ptsStr} points: ${event.reason}`;
      await this.logActivity(leaderboardId, logMessage);

      createdEvent = newEvent;
    }

    // Log initial result submission to immutable audit trail
    try {
      const { ResultAuditService } = await import('@/lib/competition/audit/service');
      const profile = await this.getCurrentProfile();
      await ResultAuditService.logAuditEntry({
        leaderboard_id: leaderboardId,
        entity_type: 'score_event',
        entity_id: createdEvent.id,
        previous_payload: null,
        proposed_payload: { points: event.points, reason: event.reason },
        actor_id: profile?.id || null,
        actor_email: profile?.email || null,
        actor_name: profile?.full_name || 'Admin',
        actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
        participant_id: memberId,
        participant_name: participantName,
        action: 'submit',
        status: 'approved',
        reason: event.reason || 'Initial score submission',
        evidence_urls: [],
      });
    } catch (auditErr) {
      console.warn('Could not record initial audit entry for score event:', auditErr);
    }

    return createdEvent;
  },

  // Activity Logs
  async getActivityLogs(leaderboardId: string): Promise<ActivityLog[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getActivityLogs().filter(log => log.leaderboard_id === leaderboardId);
  },

  async addActivityLog(leaderboardId: string, message: string): Promise<ActivityLog> {
    return this.logActivity(leaderboardId, message);
  },

  async logActivity(leaderboardId: string, message: string): Promise<ActivityLog> {
    const timestamp = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert([{ leaderboard_id: leaderboardId, message, created_at: timestamp }])
        .select()
        .single();
      if (error) {
        console.error('Failed to insert activity log:', error);
        return {
          id: `log-${Date.now()}`,
          leaderboard_id: leaderboardId,
          message,
          created_at: timestamp,
        };
      }
      return data;
    }

    const newLog: ActivityLog = {
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      message,
      created_at: timestamp,
    };
    const currentLogs = mockDb.getActivityLogs();
    mockDb.setActivityLogs([newLog, ...currentLogs]);
    return newLog;
  },

  // Dynamic Rankings logic using configurable competition rules
  async getRankings(leaderboardId: string): Promise<Ranking[]> {
    const rules = await CompetitionRulesService.getRules(leaderboardId);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_rankings')
        .select('*')
        .eq('leaderboard_id', leaderboardId);
      if (error) throw error;

      const rawRankings: Ranking[] = ((data || []) as Record<string, unknown>[]).map((row) => ({
        member_id: String(row.member_id || ''),
        leaderboard_id: String(row.leaderboard_id || ''),
        player_name: String(row.player_name || ''),
        player_email: (row.player_email as string) || null,
        avatar_url: (row.avatar_url as string) || null,
        team: (row.team as string) || null,
        notes: (row.notes as string) || null,
        is_active: Boolean(row.is_active),
        total_points: Number(row.total_points) || 0,
        last_score_at: String(row.last_score_at || ''),
        joined_at: String(row.created_at || row.last_score_at || ''),
      }));

      const rankingOrder = rules.ranking_order || 'desc';
      const tieBreakers = rules.tie_breakers && rules.tie_breakers.length > 0
        ? rules.tie_breakers
        : [
            { type: 'points' as const, label: 'Points', direction: rankingOrder },
            { type: 'earliest_score' as const, label: 'Earliest Achieved', direction: 'asc' as const },
            { type: 'alphabetical' as const, label: 'Alphabetical', direction: 'asc' as const },
          ];

      const compareRanks = (a: Ranking, b: Ranking): { diff: number; reason?: string } => {
        for (const rule of tieBreakers) {
          if (rule.type === 'points') {
            if (a.total_points !== b.total_points) {
              const dir = rule.direction || rankingOrder;
              const diff = dir === 'asc' ? a.total_points - b.total_points : b.total_points - a.total_points;
              return { diff, reason: `Points (${a.total_points} vs ${b.total_points})` };
            }
            continue;
          }
          if (rule.type === 'earliest_score') {
            const timeA = new Date(a.last_score_at).getTime();
            const timeB = new Date(b.last_score_at).getTime();
            if (timeA !== timeB) {
              const dir = rule.direction || 'asc';
              const diff = dir === 'asc' ? timeA - timeB : timeB - timeA;
              return { diff, reason: 'Earlier score achievement' };
            }
            continue;
          }
          if (rule.type === 'latest_score') {
            const timeA = new Date(a.last_score_at).getTime();
            const timeB = new Date(b.last_score_at).getTime();
            if (timeA !== timeB) {
              const dir = rule.direction || 'desc';
              const diff = dir === 'desc' ? timeB - timeA : timeA - timeB;
              return { diff, reason: 'Latest score achievement' };
            }
            continue;
          }
          if (rule.type === 'alphabetical') {
            const comp = a.player_name.localeCompare(b.player_name);
            if (comp !== 0) {
              const dir = rule.direction || 'asc';
              const diff = dir === 'desc' ? -comp : comp;
              return { diff, reason: 'Alphabetical order' };
            }
            continue;
          }
        }
        return { diff: a.player_name.localeCompare(b.player_name), reason: 'Alphabetical order' };
      };

      rawRankings.sort((a, b) => compareRanks(a, b).diff);
      rawRankings.forEach((r, idx) => {
        r.position = idx + 1;
        if (idx > 0) {
          r.tie_break_explanation = compareRanks(rawRankings[idx - 1], r).reason;
        } else {
          r.tie_break_explanation = 'Leader';
        }
      });

      return rawRankings;
    }

    // Local Storage logic replicating views with rules
    const members = mockDb.getMembers().filter(m => m.leaderboard_id === leaderboardId);
    const events = mockDb.getScoreEvents().filter(e => e.leaderboard_id === leaderboardId);
    return evaluatePointsRankings(members, events, rules);
  },

  async getPlayerHistory(memberId: string): Promise<ScoreEvent[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('score_events')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return mockDb.getScoreEvents()
      .filter(e => e.member_id === memberId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getParticipantTeamHistory(memberIdOrUserId: string): Promise<ParticipantTeamHistory[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_team_history')
        .select('*')
        .or(`member_id.eq.${memberIdOrUserId},user_id.eq.${memberIdOrUserId}`)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ParticipantTeamHistory[];
    }
    return mockDb.getParticipantTeamHistory()
      .filter((h) => h.member_id === memberIdOrUserId || h.user_id === memberIdOrUserId)
      .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
  },

  async getParticipantCorrections(userId: string): Promise<ParticipantCorrection[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_corrections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ParticipantCorrection[];
    }
    return mockDb.getParticipantCorrections()
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getFixtures(leaderboardId: string): Promise<Array<Record<string, unknown>>> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('fixtures')
        .select('*')
        .eq('leaderboard_id', leaderboardId);
      const { data: compFixtures } = await supabase
        .from('competition_fixtures')
        .select('*')
        .eq('leaderboard_id', leaderboardId);
      const combined = [
        ...((data || []) as Array<Record<string, unknown>>),
        ...((compFixtures || []) as Array<Record<string, unknown>>),
      ];
      return combined;
    }
    const state = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('lb_mock_league_state') || '{"fixtures":[]}') as { fixtures: Array<Record<string, unknown>> }) : { fixtures: [] };
    const leagueFix = (state.fixtures || []).filter((f) => f.leaderboard_id === leaderboardId);
    const compFix = mockDb.get<Array<Record<string, unknown>>>('competition_fixtures', []).filter((f) => f.leaderboard_id === leaderboardId);
    const combined = [...leagueFix, ...compFix.filter((cf) => !leagueFix.some((lf) => lf.id === cf.id))];
    return combined;
  },

  // ==========================================
  // ACHIEVEMENTS DATABASE API
  // ==========================================

  async getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('achievement_definitions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AchievementDefinition[];
    }
    return mockDb.getAchievementDefinitions().filter((d) => d.is_active);
  },

  async saveAchievementDefinition(def: AchievementDefinition): Promise<AchievementDefinition> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('achievement_definitions')
        .upsert([def])
        .select()
        .single();
      if (error) throw error;
      return data as AchievementDefinition;
    }
    const current = mockDb.getAchievementDefinitions();
    const idx = current.findIndex((d) => d.id === def.id);
    if (idx >= 0) {
      current[idx] = def;
    } else {
      current.push(def);
    }
    mockDb.setAchievementDefinitions(current);
    return def;
  },

  async getParticipantAchievements(userId: string, includeRevoked = false): Promise<ParticipantAchievement[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('participant_achievements')
        .select('*, achievement:achievement_definitions(*)')
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });
      if (!includeRevoked) {
        query = query.eq('is_revoked', false);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ParticipantAchievement[];
    }
    const defs = mockDb.getAchievementDefinitions();
    const defMap = new Map(defs.map((d) => [d.id, d]));
    return mockDb
      .getParticipantAchievements()
      .filter((a) => a.user_id === userId && (includeRevoked || !a.is_revoked))
      .map((a) => ({
        ...a,
        achievement: defMap.get(a.achievement_id),
      }))
      .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
  },

  async awardParticipantAchievement(award: ParticipantAchievement): Promise<ParticipantAchievement> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_achievements')
        .insert([award])
        .select('*, achievement:achievement_definitions(*)')
        .single();
      if (error) {
        // Idempotency: if unique constraint conflict, fetch existing active
        const existing = await supabase
          .from('participant_achievements')
          .select('*, achievement:achievement_definitions(*)')
          .eq('achievement_id', award.achievement_id)
          .eq('user_id', award.user_id)
          .maybeSingle();
        if (existing.data) return existing.data as ParticipantAchievement;
        throw error;
      }
      return data as ParticipantAchievement;
    }

    const current = mockDb.getParticipantAchievements();
    const existing = current.find(
      (a) =>
        a.achievement_id === award.achievement_id &&
        a.user_id === award.user_id &&
        (a.leaderboard_id || null) === (award.leaderboard_id || null) &&
        !a.is_revoked
    );
    if (existing) {
      const defs = mockDb.getAchievementDefinitions();
      return { ...existing, achievement: defs.find((d) => d.id === existing.achievement_id) };
    }

    current.push(award);
    mockDb.setParticipantAchievements(current);
    const defs = mockDb.getAchievementDefinitions();
    return { ...award, achievement: defs.find((d) => d.id === award.achievement_id) };
  },

  async updateParticipantAchievement(
    id: string,
    updates: Partial<ParticipantAchievement>
  ): Promise<ParticipantAchievement> {
    const timestamp = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_achievements')
        .update({ ...updates, updated_at: timestamp })
        .eq('id', id)
        .select('*, achievement:achievement_definitions(*)')
        .single();
      if (error) throw error;
      return data as ParticipantAchievement;
    }
    const current = mockDb.getParticipantAchievements();
    const index = current.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Participant achievement not found.');
    const updated = { ...current[index], ...updates, updated_at: timestamp };
    current[index] = updated;
    mockDb.setParticipantAchievements(current);
    const defs = mockDb.getAchievementDefinitions();
    return { ...updated, achievement: defs.find((d) => d.id === updated.achievement_id) };
  },

  // ==========================================
  // COMPETITION RATINGS DATABASE API
  // ==========================================

  async getCompetitionRatings(entityId: string, entityType: RatingEntityType = 'individual'): Promise<CompetitionRating[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_ratings')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('current_rating', { ascending: false });
      if (error) throw error;
      return (data || []) as CompetitionRating[];
    }
    return mockDb
      .getCompetitionRatings()
      .filter((r) => r.entity_id === entityId && r.entity_type === entityType)
      .sort((a, b) => b.current_rating - a.current_rating);
  },

  async getRatingByScope(
    entityId: string,
    entityType: RatingEntityType,
    scopeKey: string
  ): Promise<CompetitionRating | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_ratings')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .eq('scope_key', scopeKey)
        .maybeSingle();
      if (error) throw error;
      return data ? (data as CompetitionRating) : null;
    }
    const found = mockDb
      .getCompetitionRatings()
      .find((r) => r.entity_id === entityId && r.entity_type === entityType && r.scope_key === scopeKey);
    return found || null;
  },

  async saveCompetitionRating(rating: CompetitionRating): Promise<CompetitionRating> {
    const timestamp = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_ratings')
        .upsert({ ...rating, updated_at: timestamp }, { onConflict: 'entity_type,entity_id,scope_key' })
        .select()
        .single();
      if (error) throw error;
      return data as CompetitionRating;
    }

    const current = mockDb.getCompetitionRatings();
    const index = current.findIndex(
      (r) => r.entity_id === rating.entity_id && r.entity_type === rating.entity_type && r.scope_key === rating.scope_key
    );
    const updated = { ...rating, updated_at: timestamp };
    if (index >= 0) {
      current[index] = updated;
    } else {
      current.push(updated);
    }
    mockDb.setCompetitionRatings(current);
    return updated;
  },

  async getRatingHistory(entityId?: string, scopeKey?: string): Promise<RatingHistoryEntry[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('rating_history').select('*').order('created_at', { ascending: false });
      if (entityId) query = query.eq('entity_id', entityId);
      if (scopeKey) query = query.eq('scope_key', scopeKey);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RatingHistoryEntry[];
    }
    return mockDb
      .getRatingHistory()
      .filter((h) => (!entityId || h.entity_id === entityId) && (!scopeKey || h.scope_key === scopeKey))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async addRatingHistoryEntry(entry: RatingHistoryEntry): Promise<RatingHistoryEntry> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rating_history')
        .insert([entry])
        .select()
        .single();
      if (error) throw error;
      return data as RatingHistoryEntry;
    }
    const current = mockDb.getRatingHistory();
    current.push(entry);
    mockDb.setRatingHistory(current);
    return entry;
  },

  async updateRatingHistoryEntry(
    id: string,
    updates: Partial<RatingHistoryEntry>
  ): Promise<RatingHistoryEntry> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rating_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RatingHistoryEntry;
    }
    const current = mockDb.getRatingHistory();
    const index = current.findIndex((h) => h.id === id);
    if (index === -1) throw new Error('Rating history entry not found.');
    const updated = { ...current[index], ...updates };
    current[index] = updated;
    mockDb.setRatingHistory(current);
    return updated;
  }
};
