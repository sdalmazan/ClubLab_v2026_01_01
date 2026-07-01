-- ============================================================
-- ClubLab v2026.01.01 — Exercise Library Enhancements
-- Migration: 013_exercise_library_enhancements.sql
-- ============================================================

-- Add library scope, tactical concepts, and muscle groups to exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS library_scope TEXT DEFAULT 'coach' CHECK (library_scope IN ('global', 'academy', 'coach')),
  ADD COLUMN IF NOT EXISTS tactical_concepts TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muscle_groups TEXT[] DEFAULT '{}';

-- Update existing shared exercises to 'academy' scope if org-specific, 'global' if is_shared
-- (this will be handled by super_admin manually)

COMMENT ON COLUMN exercises.library_scope IS 'global=all orgs (super_admin), academy=org academy, coach=personal';
COMMENT ON COLUMN exercises.tactical_concepts IS 'Tactical concepts worked. E.g.: salida_balon, presion_tras_perdida, contraataque';
COMMENT ON COLUMN exercises.muscle_groups IS 'Muscle groups targeted. E.g.: isquiotibiales, cuadriceps, gemelos';

-- Also add tactical concepts and muscle groups to session_exercises (what was actually worked in a session)
ALTER TABLE session_exercises
  ADD COLUMN IF NOT EXISTS tactical_concepts TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muscle_groups TEXT[] DEFAULT '{}';
