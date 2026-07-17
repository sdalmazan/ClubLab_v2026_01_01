-- ============================================================
-- ClubLab v2026.01.01 — Training Sessions Concepts Columns
-- Migration: 018_add_session_concepts_columns.sql
-- ============================================================

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS tactical_concepts TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muscle_groups TEXT[] DEFAULT '{}';

COMMENT ON COLUMN training_sessions.tactical_concepts IS 'Tactical objectives for the session';
COMMENT ON COLUMN training_sessions.muscle_groups IS 'Physical/muscle objectives for the session';
