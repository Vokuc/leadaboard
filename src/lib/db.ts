import { createBrowserClient } from '@supabase/ssr';
import { 
  Profile, 
  Leaderboard, 
  Season, 
  ScoringRule, 
  LeaderboardMember, 
  ScoreEvent, 
  ActivityLog, 
  Ranking 
} from '../types';

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

const DEFAULT_PROFILE: Profile = {
  id: SEED_CREATOR_ID,
  email: 'creator@leagueboard.com',
  full_name: 'Alex Mercer',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_LEADERBOARDS: Leaderboard[] = [
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

const DEFAULT_SEASONS: Season[] = [
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

const DEFAULT_MEMBERS: LeaderboardMember[] = [
  // Gaming Members
  { id: 'mem-g1', leaderboard_id: 'lb-gaming-1', name: 'NinjaCoder', email: 'ninja@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=100&q=80', team: 'Team Rogue', notes: 'Top fragger', is_active: true, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g2', leaderboard_id: 'lb-gaming-1', name: 'CyberKnight', email: 'knight@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80', team: 'Team Rogue', notes: 'Tank specialist', is_active: true, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g3', leaderboard_id: 'lb-gaming-1', name: 'PxlQueen', email: 'pxl@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80', team: 'Team Apex', notes: 'Support strategist', is_active: true, created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g4', leaderboard_id: 'lb-gaming-1', name: 'ShadowRunner', email: 'shadow@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80', team: 'Team Apex', notes: 'Stealth DPS', is_active: true, created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-g5', leaderboard_id: 'lb-gaming-1', name: 'L33tGamer', email: 'l33t@gaming.com', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80', team: null, notes: 'Freelancer', is_active: true, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },

  // Workplace Members
  { id: 'mem-w1', leaderboard_id: 'lb-workplace-1', name: 'Sarah Jenkins', email: 'sjenkins@company.com', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', notes: 'SDR MVP', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w2', leaderboard_id: 'lb-workplace-1', name: 'Michael Scott', email: 'mscott@company.com', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', notes: 'Regional Director', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w3', leaderboard_id: 'lb-workplace-1', name: 'Dwight Schrute', email: 'dschrute@company.com', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', notes: 'Assistant Regional Manager', is_active: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w4', leaderboard_id: 'lb-workplace-1', name: 'Jim Halpert', email: 'jhalpert@company.com', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80', team: 'Sales - NA', notes: 'Senior Representative', is_active: true, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-w5', leaderboard_id: 'lb-workplace-1', name: 'Pam Beesly', email: 'pbeesly@company.com', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80', team: 'Sales - Support', notes: 'Admin coordinator', is_active: true, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },

  // Sports Members
  { id: 'mem-s1', leaderboard_id: 'lb-sports-1', name: 'John Runner', email: 'john@sports.com', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80', team: 'Sprinters Club', notes: null, is_active: true, created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s2', leaderboard_id: 'lb-sports-1', name: 'Alice Smith', email: 'alice@sports.com', avatar_url: 'https://images.unsplash.com/photo-1534751516642-a131fed10495?auto=format&fit=crop&w=100&q=80', team: 'Sprinters Club', notes: 'Marathon trainee', is_active: true, created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s3', leaderboard_id: 'lb-sports-1', name: 'Bob Athletic', email: 'bob@sports.com', avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=100&q=80', team: 'Trail Blazers', notes: null, is_active: true, created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'mem-s4', leaderboard_id: 'lb-sports-1', name: 'Emma Jogger', email: 'emma@sports.com', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80', team: 'Trail Blazers', notes: 'Runs in the mornings', is_active: true, created_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }
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

// LocalStorage Helper
class LocalDb {
  private get<T>(key: string, defaults: T): T {
    if (typeof window === 'undefined') return defaults;
    const val = localStorage.getItem(`leagueboard_${key}`);
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

  private set(key: string, val: unknown): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`leagueboard_${key}`, JSON.stringify(val));
  }

  init(): void {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('leagueboard_initialized')) {
      this.set('profile', DEFAULT_PROFILE);
      this.set('leaderboards', DEFAULT_LEADERBOARDS);
      this.set('seasons', DEFAULT_SEASONS);
      this.set('scoring_rules', DEFAULT_SCORING_RULES);
      this.set('members', DEFAULT_MEMBERS);
      this.set('score_events', DEFAULT_SCORE_EVENTS);
      this.set('activity_logs', DEFAULT_ACTIVITY_LOGS);
      localStorage.setItem('leagueboard_initialized', 'true');
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
}

const mockDb = new LocalDb();

// ==========================================
// UNIFIED DATABASE SERVICE EXPORT
// ==========================================

export const DatabaseService = {
  initialize() {
    mockDb.init();
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

  async mockLogin(email: string, fullName: string): Promise<Profile> {
    const profile: Profile = {
      id: SEED_CREATOR_ID,
      email,
      full_name: fullName,
      avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.setProfile(profile);
    return profile;
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

  async createLeaderboard(lb: Omit<Leaderboard, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'status'>, rules: Omit<ScoringRule, 'id' | 'leaderboard_id' | 'created_at'>[], season: Omit<Season, 'id' | 'leaderboard_id' | 'created_at'> | null): Promise<Leaderboard> {
    const profile = await this.getCurrentProfile();
    const owner_id = profile?.id || SEED_CREATOR_ID;
    
    if (isSupabaseConfigured && supabase) {
      const { data: newLb, error: lbErr } = await supabase
        .from('leaderboards')
        .insert([{ ...lb, owner_id, status: 'active' }])
        .select()
        .single();
      
      if (lbErr) throw lbErr;

      if (rules.length > 0) {
        const rulesToInsert = rules.map(r => ({ ...r, leaderboard_id: newLb.id }));
        const { error: rErr } = await supabase.from('scoring_rules').insert(rulesToInsert);
        if (rErr) throw rErr;
      }

      if (season) {
        const { error: sErr } = await supabase
          .from('seasons')
          .insert([{ ...season, leaderboard_id: newLb.id }]);
        if (sErr) throw sErr;
      }

      return newLb;
    }

    // Local Storage Flow
    const newId = `lb-${Math.random().toString(36).substr(2, 9)}`;
    const createdLb: Leaderboard = {
      ...lb,
      id: newId,
      owner_id,
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

  async addMember(leaderboardId: string, member: Omit<LeaderboardMember, 'id' | 'leaderboard_id' | 'created_at' | 'updated_at' | 'is_active'>): Promise<LeaderboardMember> {
    const avatar = member.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(member.name)}`;
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .insert([{ ...member, avatar_url: avatar, leaderboard_id: leaderboardId, is_active: true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const currentMembers = mockDb.getMembers();
    // Check uniqueness constraint
    const duplicate = currentMembers.find(m => m.leaderboard_id === leaderboardId && m.name.toLowerCase() === member.name.toLowerCase());
    if (duplicate) {
      throw new Error(`A player named "${member.name}" already exists on this leaderboard.`);
    }

    const newMember: LeaderboardMember = {
      ...member,
      avatar_url: avatar,
      id: `mem-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.setMembers([...currentMembers, newMember]);
    return newMember;
  },

  async updateMember(id: string, updates: Partial<LeaderboardMember>): Promise<LeaderboardMember> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_members')
        .update({ ...updates, updated_at: new Date().toISOString() })
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
      ...updates,
      updated_at: new Date().toISOString()
    };
    currentMembers[idx] = updated;
    mockDb.setMembers(currentMembers);
    return updated;
  },

  async removeMember(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('leaderboard_members').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    // Cascading deletes manually in local storage
    const currentMembers = mockDb.getMembers();
    const currentEvents = mockDb.getScoreEvents();
    
    mockDb.setMembers(currentMembers.filter(m => m.id !== id));
    mockDb.setScoreEvents(currentEvents.filter(ev => ev.member_id !== id));
  },

  // Score Events
  async addScoreEvent(leaderboardId: string, memberId: string, event: Omit<ScoreEvent, 'id' | 'leaderboard_id' | 'member_id' | 'created_at'>): Promise<ScoreEvent> {
    const timestamp = new Date().toISOString();
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('score_events')
        .insert([{ ...event, leaderboard_id: leaderboardId, member_id: memberId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // Local storage flow
    const newEvent: ScoreEvent = {
      ...event,
      id: `ev-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      member_id: memberId,
      created_at: timestamp
    };

    const currentEvents = mockDb.getScoreEvents();
    mockDb.setScoreEvents([...currentEvents, newEvent]);

    // Handle immutable activity log trigger manually in mock mode
    const currentLogs = mockDb.getActivityLogs();
    const members = mockDb.getMembers();
    const player = members.find(m => m.id === memberId);
    const pName = player ? player.name : 'Unknown Player';
    const ptsStr = event.points >= 0 ? `+${event.points}` : `${event.points}`;
    const logMessage = `${pName} score adjusted by ${ptsStr} points: ${event.reason}`;

    const newLog: ActivityLog = {
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      leaderboard_id: leaderboardId,
      message: logMessage,
      created_at: timestamp
    };
    mockDb.setActivityLogs([newLog, ...currentLogs]);

    return newEvent;
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

  // Dynamic Rankings logic (ordered by sum points descending, then tie-breaker: last_score_at ascending)
  async getRankings(leaderboardId: string): Promise<Ranking[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard_rankings')
        .select('*')
        .eq('leaderboard_id', leaderboardId);
      if (error) throw error;

      // PostgreSQL View returns ungrouped items, let's sort them appropriately
      return (data || []).sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return new Date(a.last_score_at).getTime() - new Date(b.last_score_at).getTime();
      });
    }

    // Local Storage logic replicating views
    const members = mockDb.getMembers().filter(m => m.leaderboard_id === leaderboardId);
    const events = mockDb.getScoreEvents().filter(e => e.leaderboard_id === leaderboardId);

    const rankings: Ranking[] = members.map(m => {
      const playerEvents = events.filter(e => e.member_id === m.id);
      const total_points = playerEvents.reduce((sum, e) => sum + e.points, 0);
      
      let last_score_at = m.created_at;
      if (playerEvents.length > 0) {
        // Find latest event timestamp
        const times = playerEvents.map(e => new Date(e.created_at).getTime());
        last_score_at = new Date(Math.max(...times)).toISOString();
      }

      return {
        member_id: m.id,
        leaderboard_id: m.leaderboard_id,
        player_name: m.name,
        player_email: m.email,
        avatar_url: m.avatar_url,
        team: m.team,
        notes: m.notes,
        is_active: m.is_active,
        total_points,
        last_score_at,
        joined_at: m.created_at
      };
    });

    // Sort: Points DESC, last score time ASC (earlier score achieved wins)
    return rankings.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return new Date(a.last_score_at).getTime() - new Date(b.last_score_at).getTime();
    });
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
  }
};
