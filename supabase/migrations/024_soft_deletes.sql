-- ============================================================
-- ClubLab — Migration 024: Soft-deletes on critical entities
-- Añade columna deleted_at a players, injuries, training_sessions y matches.
-- Esto permite recuperar registros eliminados por error y soporta auditoría RGPD.
--
-- Estrategia de implementación:
--   1. Esta migración añade la columna (no rompe nada).
--   2. Los servicios de la aplicación filtran WHERE deleted_at IS NULL.
--   3. Una UI de "papelera" permite la recuperación en < 30 días.
--   4. Un job de limpieza puede eliminar definitivamente tras el período de retención.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PLAYERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_players_deleted_at
  ON players(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN players.deleted_at IS
  'NULL = jugador activo. NOT NULL = eliminado (soft-delete). '
  'Todos los queries deben filtrar WHERE deleted_at IS NULL salvo el admin de papelera.';

-- ────────────────────────────────────────────────────────────
-- INJURIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_injuries_deleted_at
  ON injuries(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN injuries.deleted_at IS
  'NULL = lesión activa/histórica. NOT NULL = eliminada (soft-delete).';

-- ────────────────────────────────────────────────────────────
-- TRAINING_SESSIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_training_sessions_deleted_at
  ON training_sessions(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN training_sessions.deleted_at IS
  'NULL = sesión activa. NOT NULL = sesión eliminada (soft-delete).';

-- ────────────────────────────────────────────────────────────
-- MATCHES
-- ────────────────────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_deleted_at
  ON matches(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN matches.deleted_at IS
  'NULL = partido activo. NOT NULL = partido eliminado (soft-delete).';

-- ────────────────────────────────────────────────────────────
-- NOTA IMPORTANTE PARA EL EQUIPO DE DESARROLLO
-- ────────────────────────────────────────────────────────────
-- Después de aplicar esta migración, los servicios de la aplicación deben
-- añadir .is("deleted_at", null) o .eq("deleted_at", null) a todas las
-- queries de SELECT en las tablas afectadas.
--
-- Los DELETE deben convertirse en UPDATE { deleted_at: new Date().toISOString() }.
--
-- El módulo de administración (src/app/api/admin/manage/route.ts) puede
-- seguir usando DELETE físico con el admin client para operaciones de limpieza.
-- ────────────────────────────────────────────────────────────
