-- ============================================================
-- ClubLab v2026.01.01 — Extended fields for Exercise Library (Groups configuration, Video/Image links)
-- Migration: 016_add_exercise_library_fields.sql
-- ============================================================

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS num_groups INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS players_per_group TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE session_exercises
  ADD COLUMN IF NOT EXISTS needs_groups BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS num_groups INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS players_per_group TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS needs_groups BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS num_groups INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS players_per_group TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN exercises.num_groups IS 'Default number of groups/teams to pre-create in the planner.';
COMMENT ON COLUMN exercises.players_per_group IS 'Recommended player distribution descriptive text (e.g. "5" or "4v4+2").';
COMMENT ON COLUMN exercises.image_url IS 'Optional image link for strength or physical exercises.';
COMMENT ON COLUMN exercises.video_url IS 'Optional demonstration video link (YouTube, Vimeo, etc.).';
