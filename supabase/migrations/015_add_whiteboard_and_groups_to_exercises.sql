-- ============================================================
-- ClubLab v2026.01.01 — Whiteboard and Group configurations for Exercises Library
-- Migration: 015_add_whiteboard_and_groups_to_exercises.sql
-- ============================================================

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS whiteboard_data JSONB,
  ADD COLUMN IF NOT EXISTS whiteboard_zone TEXT,
  ADD COLUMN IF NOT EXISTS space_dimensions TEXT,
  ADD COLUMN IF NOT EXISTS needs_groups BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN exercises.whiteboard_data IS 'Default tactical drawing strokes, arrows, and circles for this exercise template.';
COMMENT ON COLUMN exercises.whiteboard_zone IS 'The default pitch zone/view used for the whiteboard (e.g. full_field, penalty_area).';
COMMENT ON COLUMN exercises.space_dimensions IS 'The default dimensions of the space required for the exercise (e.g. 30x20m).';
COMMENT ON COLUMN exercises.needs_groups IS 'Whether this exercise by default requires group/team distribution.';
