-- ============================================================
-- ClubLab v2026.01.01 — Session Templates Library Fields
-- Migration: 017_add_session_template_library_fields.sql
-- ============================================================

ALTER TABLE session_templates
  ADD COLUMN IF NOT EXISTS library_scope TEXT DEFAULT 'coach' CHECK (library_scope IN ('global', 'academy', 'coach')),
  ADD COLUMN IF NOT EXISTS microcycle_day TEXT CHECK (microcycle_day IN ('MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1', 'MD+2'));

COMMENT ON COLUMN session_templates.library_scope IS 'global=all orgs, academy=org academy, coach=personal';
COMMENT ON COLUMN session_templates.microcycle_day IS 'Associated microcycle day for filtering templates';
