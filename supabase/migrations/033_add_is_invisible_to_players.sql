-- ============================================================
-- Migración 033: Añadir campo is_invisible a la tabla players
-- Proyecto: ClubLab v2026
-- Propósito: Permitir cuentas de prueba/testing invisibles que no salgan en plantillas ni estadísticas
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_invisible BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para acelerar las consultas filtradas por visibilidad
CREATE INDEX IF NOT EXISTS idx_players_is_invisible ON players(is_invisible);
