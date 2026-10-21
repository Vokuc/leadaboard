-- Migration: 202610250001_registration_and_notifications.sql
-- Description: Participant registration, waitlist, invite/claim workflows, and multi-channel in-app notifications.

-- 1. Create competition_registration_configs table
CREATE TABLE IF NOT EXISTS public.competition_registration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL UNIQUE REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  allow_waitlist BOOLEAN NOT NULL DEFAULT true,
  allow_team_registration BOOLEAN NOT NULL DEFAULT false,
  eligibility_rules JSONB NOT NULL DEFAULT '{"allowed_domains": [], "min_age": null, "notes": ""}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_reg_configs_leaderboard ON public.competition_registration_configs(leaderboard_id);

-- 2. Create competition_registrations table
CREATE TABLE IF NOT EXISTS public.competition_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  claim_token TEXT UNIQUE,
  claimed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_registrations
  DROP CONSTRAINT IF EXISTS competition_registrations_status_check;

ALTER TABLE public.competition_registrations
  ADD CONSTRAINT competition_registrations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'confirmed'));

CREATE INDEX IF NOT EXISTS idx_comp_reg_leaderboard ON public.competition_registrations(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_user ON public.competition_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_status ON public.competition_registrations(leaderboard_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_reg_claim_token ON public.competition_registrations(claim_token) WHERE claim_token IS NOT NULL;

-- 3. Additive column to leaderboard_members linking to user profile
ALTER TABLE public.leaderboard_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leaderboard_members_user ON public.leaderboard_members(user_id);

-- 4. Create competition_notifications table
CREATE TABLE IF NOT EXISTS public.competition_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email TEXT,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'delivered',
  idempotency_key TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_notifications
  DROP CONSTRAINT IF EXISTS competition_notifications_delivery_status_check;

ALTER TABLE public.competition_notifications
  ADD CONSTRAINT competition_notifications_delivery_status_check
  CHECK (delivery_status IN ('queued', 'delivered', 'read', 'failed'));

CREATE INDEX IF NOT EXISTS idx_comp_notif_user ON public.competition_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_notif_status ON public.competition_notifications(user_id, delivery_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_notif_idempotency ON public.competition_notifications(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 5. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  in_app_opt_in BOOLEAN NOT NULL DEFAULT true,
  match_reminders BOOLEAN NOT NULL DEFAULT true,
  result_updates BOOLEAN NOT NULL DEFAULT true,
  announcements BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, leaderboard_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON public.notification_preferences(user_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.competition_registration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 7. Policies for competition_registration_configs
DROP POLICY IF EXISTS "Anyone can view registration config for accessible leaderboards" ON public.competition_registration_configs;
CREATE POLICY "Anyone can view registration config for accessible leaderboards" ON public.competition_registration_configs
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage registration config" ON public.competition_registration_configs;
CREATE POLICY "Owners and admins can manage registration config" ON public.competition_registration_configs
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 8. Policies for competition_registrations
DROP POLICY IF EXISTS "Participants and admins can view registrations" ON public.competition_registrations;
CREATE POLICY "Participants and admins can view registrations" ON public.competition_registrations
  FOR SELECT USING (
    public.can_manage_leaderboard(leaderboard_id, auth.uid()) OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Authenticated users and admins can register" ON public.competition_registrations;
CREATE POLICY "Authenticated users and admins can register" ON public.competition_registrations
  FOR INSERT WITH CHECK (
    public.can_manage_leaderboard(leaderboard_id, auth.uid()) OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can update own registration and admins can manage" ON public.competition_registrations;
CREATE POLICY "Users can update own registration and admins can manage" ON public.competition_registrations
  FOR UPDATE USING (
    public.can_manage_leaderboard(leaderboard_id, auth.uid()) OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.competition_registrations;
CREATE POLICY "Admins can delete registrations" ON public.competition_registrations
  FOR DELETE USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 9. Policies for competition_notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.competition_notifications;
CREATE POLICY "Users can view own notifications" ON public.competition_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.competition_notifications;
CREATE POLICY "Users can update own notifications" ON public.competition_notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System and admins can insert notifications" ON public.competition_notifications;
CREATE POLICY "System and admins can insert notifications" ON public.competition_notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 10. Policies for notification_preferences
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage own notification preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 11. Add to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_notifications;
