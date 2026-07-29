-- ============================================================
-- Migración 036: Añadir jersey_number a la tabla players
-- Proyecto: ClubLab v2026
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_number INTEGER;
