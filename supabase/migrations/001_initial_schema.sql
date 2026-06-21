-- ============================================================
-- ClubLab v2026.01.01 — Database Schema
-- Migration: 001_initial_schema
-- Created: 2026-01-01
-- ============================================================
-- Run this in Supabase SQL Editor or via CLI.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy player name search

-- ============================================================
-- LICENSING — Plans, Features, Subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- 'free' | 'coach_pro' | 'performance' | 'academy'
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0, -- cents
  price_yearly INTEGER NOT NULL DEFAULT 0,  -- cents
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  limit_value INTEGER, -- NULL = unlimited
  UNIQUE (plan_id, feature_id)
);

-- ============================================================
-- MULTI-TENANT CORE — Organizations, Clubs, Seasons, Teams
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('club', 'academy', 'independent_coach')),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'manual')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 year',
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id) -- one active subscription per org
);

CREATE TABLE IF NOT EXISTS organization_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  limit_override INTEGER,
  enabled_override BOOLEAN,
  UNIQUE (organization_id, feature_id)
);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  founded_year INTEGER,
  country TEXT,
  city TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "2026/27"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT, -- 'Senior', 'Juvenil', 'Cadete', etc.
  gender TEXT CHECK (gender IN ('male', 'female', 'mixed')),
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS & ROLES — RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS user_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL, -- NULL = all teams in org
  role TEXT NOT NULL CHECK (role IN (
    'super_admin', 'club_admin', 'academy_director', 'academy_coordinator',
    'head_coach', 'coach', 'physical_coach', 'physio', 'sporting_director', 'player'
  )),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

-- ============================================================
-- PLAYERS — Portable across teams/clubs
-- ============================================================

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  dominant_foot TEXT CHECK (dominant_foot IN ('right', 'left', 'both')),
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  avatar_url TEXT,
  -- Anonymized ID for AI data pipelines (approved orgs only)
  anonymized_id TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  data_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  jersey_number INTEGER,
  positions TEXT[] DEFAULT '{}', -- ['goalkeeper', 'right_back']
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'loaned', 'transferred', 'inactive')),
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRAINING — Sessions, Templates, Exercises
-- ============================================================

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  title TEXT,
  date DATE NOT NULL,
  duration_min INTEGER,
  session_type TEXT NOT NULL DEFAULT 'training'
    CHECK (session_type IN ('training', 'match', 'recovery', 'gym', 'physical_test', 'rest')),
  microcycle_day TEXT CHECK (microcycle_day IN ('MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1', 'MD+2')),
  planned_load TEXT CHECK (planned_load IN ('low', 'medium', 'medium_high', 'high', 'recovery')),
  planned_intensity TEXT,
  objectives TEXT[] DEFAULT '{}',
  notes TEXT,
  template_id UUID, -- FK to session_templates (added later)
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed', 'cancelled')),
  -- Match fields (when session_type = 'match')
  match_opponent TEXT,
  match_is_home BOOLEAN,
  match_competition TEXT,
  match_score TEXT,
  match_result TEXT CHECK (match_result IN ('win', 'draw', 'loss')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER,
  session_type TEXT NOT NULL DEFAULT 'training',
  objectives TEXT[] DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT FALSE, -- shared across academy
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for template_id
ALTER TABLE training_sessions
  ADD CONSTRAINT fk_session_template
  FOREIGN KEY (template_id) REFERENCES session_templates(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE — Wellness, RPE, Loads, Availability
-- ============================================================

CREATE TABLE IF NOT EXISTS wellness_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  fatigue INTEGER NOT NULL CHECK (fatigue BETWEEN 1 AND 5),
  mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  muscle_soreness INTEGER CHECK (muscle_soreness BETWEEN 1 AND 5),
  localized_discomfort TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, session_id, date)
);

CREATE TABLE IF NOT EXISTS rpe_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  rpe INTEGER NOT NULL CHECK (rpe BETWEEN 1 AND 10),
  post_feeling TEXT CHECK (post_feeling IN ('very_good', 'good', 'loaded', 'very_loaded')),
  new_discomfort BOOLEAN NOT NULL DEFAULT FALSE,
  new_discomfort_detail TEXT,
  minutes_played INTEGER,
  is_starter BOOLEAN,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, session_id)
);

CREATE TABLE IF NOT EXISTS player_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_load INTEGER,      -- minutes × RPE
  acute_load INTEGER,        -- rolling 7-day sum
  chronic_load INTEGER,      -- rolling 28-day sum
  acwr NUMERIC(4,2),
  monotony NUMERIC(4,2),
  strain NUMERIC(8,2),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, date)
);

CREATE TABLE IF NOT EXISTS alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  fatigue_medium_threshold INTEGER NOT NULL DEFAULT 4,
  fatigue_high_threshold INTEGER NOT NULL DEFAULT 5,
  fatigue_consecutive_days INTEGER NOT NULL DEFAULT 3,
  fatigue_consecutive_threshold INTEGER NOT NULL DEFAULT 4,
  sleep_quality_low_threshold INTEGER NOT NULL DEFAULT 2,
  sleep_quality_consecutive_days INTEGER NOT NULL DEFAULT 2,
  rpe_warning_threshold INTEGER NOT NULL DEFAULT 8,
  rpe_danger_threshold INTEGER NOT NULL DEFAULT 9,
  weekly_load_medium_threshold INTEGER NOT NULL DEFAULT 1800,
  weekly_load_high_threshold INTEGER NOT NULL DEFAULT 2300,
  UNIQUE (organization_id, team_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INJURIES & REHAB
-- ============================================================

CREATE TABLE IF NOT EXISTS injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  injury_type TEXT NOT NULL,
  body_part TEXT NOT NULL,
  body_side TEXT CHECK (body_side IN ('left', 'right', 'central')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'readaptation', 'resolved')),
  occurred_date DATE NOT NULL,
  expected_return_date DATE,
  actual_return_date DATE,
  mechanism TEXT,
  notes TEXT,
  -- Sensitive data — RLS restricts to physio role only
  medical_notes TEXT,
  treatment_plan TEXT,
  validation_status TEXT NOT NULL DEFAULT 'validated'
    CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rehab_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  injury_id UUID NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  goals TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rehab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rehab_plan_id UUID NOT NULL REFERENCES rehab_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INTEGER,
  exercises_done TEXT,
  progress_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MATCHES & STATISTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  opponent TEXT NOT NULL,
  date DATE NOT NULL,
  competition TEXT,
  competition_type TEXT CHECK (competition_type IN ('official', 'friendly', 'cup')),
  is_home BOOLEAN NOT NULL DEFAULT TRUE,
  home_score INTEGER,
  away_score INTEGER,
  result TEXT CHECK (result IN ('win', 'draw', 'loss')),
  is_official BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  minutes_played INTEGER NOT NULL DEFAULT 0,
  is_starter BOOLEAN NOT NULL DEFAULT FALSE,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  substituted_in_min INTEGER,
  substituted_out_min INTEGER,
  rating NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

-- ============================================================
-- PHYSICAL TESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS physical_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  category TEXT,
  higher_is_better BOOLEAN NOT NULL DEFAULT TRUE,
  reference_values JSONB DEFAULT '{}', -- benchmarks by category/age
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS physical_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES physical_tests(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  date DATE NOT NULL,
  value NUMERIC NOT NULL,
  percentile NUMERIC(5,2),
  notes TEXT,
  conducted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIDEO (references only — no file storage in Phase 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('own', 'rival', 'training')),
  url TEXT NOT NULL, -- external URL reference
  upload_status TEXT DEFAULT 'ready',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_sec NUMERIC NOT NULL,
  end_sec NUMERIC NOT NULL,
  category TEXT,
  comment TEXT,
  tagged_players UUID[] DEFAULT '{}',
  annotations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_injuries_updated_at
  BEFORE UPDATE ON injuries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_players_org ON players(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_player ON player_team_memberships(player_id);
CREATE INDEX IF NOT EXISTS idx_memberships_team ON player_team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_wellness_player_date ON wellness_entries(player_id, date);
CREATE INDEX IF NOT EXISTS idx_rpe_player ON rpe_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_loads_player_date ON player_loads(player_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_player ON alerts(player_id, status);
CREATE INDEX IF NOT EXISTS idx_injuries_player ON injuries(player_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_team_date ON training_sessions(team_id, date);
CREATE INDEX IF NOT EXISTS idx_user_org_roles ON user_organization_roles(user_id, organization_id);

-- Full-text search on player names
CREATE INDEX IF NOT EXISTS idx_players_name_trgm
  ON players USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);
