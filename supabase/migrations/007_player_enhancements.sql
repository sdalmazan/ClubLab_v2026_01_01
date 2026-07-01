-- ============================================================
-- ClubLab v2026.01.01 — Player Enhancements
-- Migration: 007_player_enhancements
-- ============================================================

-- 1. Add descriptive adjective to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS adjective TEXT;

-- 2. Add player_type and player_type_label to player_team_memberships
ALTER TABLE player_team_memberships ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'main' CHECK (player_type IN ('main', 'reserve', 'youth', 'other'));
ALTER TABLE player_team_memberships ADD COLUMN IF NOT EXISTS player_type_label TEXT;

-- 3. Add match_game_plan, start_time and timing columns to training_sessions
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS match_game_plan JSONB DEFAULT '{}'::jsonb;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '10:00:00';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS checkin_hours_before INTEGER DEFAULT 8;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS checkin_close_mins_before INTEGER DEFAULT 15;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS checkout_mins_after INTEGER DEFAULT 30;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS checkout_close_hours_after INTEGER DEFAULT 16;

-- 4. Drop legacy check constraint on session_type if exists to prevent DB crashes with new session types
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;
