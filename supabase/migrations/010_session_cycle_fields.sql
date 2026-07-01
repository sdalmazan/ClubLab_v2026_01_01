-- ============================================================
-- ClubLab v2026.01.01 — Session Cycle Fields (Mesocycle & Sequence)
-- Migration: 010_session_cycle_fields.sql
-- ============================================================

-- Add mesocycle and session sequence fields to training_sessions, and add facility support
ALTER TABLE training_sessions 
  ADD COLUMN IF NOT EXISTS mesocycle TEXT,
  ADD COLUMN IF NOT EXISTS session_week_seq INTEGER, -- session number within the week (only training type)
  ADD COLUMN IF NOT EXISTS session_total_seq INTEGER, -- cumulative session number in the season (only training type)
  ADD COLUMN IF NOT EXISTS facility_ids UUID[] DEFAULT '{}'; -- assigned facility IDs
