-- ============================================================
-- ClubLab v2026.01.02 — Add Sporting Name to Players
-- Migration: 019_add_sporting_name
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS sporting_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS signing_status TEXT DEFAULT 'signed';
