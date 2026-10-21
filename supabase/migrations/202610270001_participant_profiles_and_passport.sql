-- Migration: 202610270001_participant_profiles_and_passport.sql
-- Description: Participant Profiles, Competition Passport, Claims, Team History & Disputes

-- 1. Additive column on leaderboards for verification status
ALTER TABLE public.leaderboards
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leaderboards_verified ON public.leaderboards(is_verified);

-- 2. Participant Profiles Table (Passport Identity)
CREATE TABLE IF NOT EXISTS public.participant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  headline TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  privacy_settings JSONB NOT NULL DEFAULT '{
    "is_public": true,
    "show_email": false,
    "show_unverified_results": true,
    "show_stats": true,
    "show_match_history": true,
    "show_teams": true,
    "show_trophy_case": true
  }'::jsonb,
  pinned_competition_ids TEXT[] NOT NULL DEFAULT '{}',
  hidden_entity_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_profiles_user ON public.participant_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_profiles_username_lower ON public.participant_profiles(LOWER(username));

-- 3. Participant Claims Table (Linking Member Records with Verified Authorization)
CREATE TABLE IF NOT EXISTS public.participant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_token TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'verified')) DEFAULT 'pending',
  verification_method TEXT NOT NULL CHECK (verification_method IN ('email_match', 'token', 'organizer_approved')),
  claim_notes TEXT,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_claims_user ON public.participant_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_claims_leaderboard ON public.participant_claims(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_participant_claims_member ON public.participant_claims(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_claims_token ON public.participant_claims(claim_token) WHERE claim_token IS NOT NULL;

-- 4. Participant Result Disputes & Corrections
CREATE TABLE IF NOT EXISTS public.participant_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('membership_link', 'fixture_result', 'tournament_match', 'score_event')),
  entity_id TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('wrongly_linked', 'wrong_score', 'wrong_team', 'duplicate_profile', 'remove_from_passport')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')) DEFAULT 'pending',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_corrections_user ON public.participant_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_corrections_leaderboard ON public.participant_corrections(leaderboard_id);

-- 5. Participant Historical Team Affiliations
CREATE TABLE IF NOT EXISTS public.participant_team_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  jersey_number INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_history_member ON public.participant_team_history(member_id);
CREATE INDEX IF NOT EXISTS idx_team_history_user ON public.participant_team_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_history_team ON public.participant_team_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_history_leaderboard ON public.participant_team_history(leaderboard_id);

-- Enable RLS
ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_team_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public participant profiles are viewable by everyone"
  ON public.participant_profiles FOR SELECT
  USING (
    (privacy_settings->>'is_public')::boolean = true
    OR (auth.uid() = user_id)
  );

CREATE POLICY "Users can create their own participant profile"
  ON public.participant_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant profile"
  ON public.participant_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Claims policies
CREATE POLICY "Users can view their own claims"
  ON public.participant_claims FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = leaderboard_id AND la.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own claims"
  ON public.participant_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can update claims"
  ON public.participant_claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = leaderboard_id AND la.user_id = auth.uid()
    )
  );

-- Corrections policies
CREATE POLICY "Users and organizers can view corrections"
  ON public.participant_corrections FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = leaderboard_id AND la.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can submit corrections"
  ON public.participant_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can update corrections"
  ON public.participant_corrections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = leaderboard_id AND la.user_id = auth.uid()
    )
  );

-- Team history policies
CREATE POLICY "Team history is viewable by everyone"
  ON public.participant_team_history FOR SELECT
  USING (true);
