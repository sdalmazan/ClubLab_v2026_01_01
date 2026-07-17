-- ============================================================
-- Statistics DB — Migration: entity_aliases table
-- Proyecto: ClubLab v2026 — Statistics_DB (Supabase Federation Project)
-- Propósito: Resolución canónica de nombres de equipos y jugadores.
--
-- Problema que resuelve:
--   Los actas oficiales de la RFCYLF son inconsistentes en la grafía de
--   nombres de equipos y jugadores. Por ejemplo, el mismo club aparece
--   como "S.D. Almazán" en algunos actas y "C.D. Almazán" en otros.
--   Sin esta tabla, el mismo equipo aparece como dos entidades distintas
--   en las métricas de análisis.
--
-- Cómo funciona:
--   El scraper consulta esta tabla al ingerir un acta. Si encuentra un alias,
--   sustituye el nombre por el canonical_name antes de insertar en stat_lineups
--   y stat_events. Los datos siempre se almacenan con el nombre canónico.
--
-- EJECUTAR EN: Supabase Federation Project (Statistics_DB)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- ya instalada, pero incluimos por seguridad

CREATE TABLE IF NOT EXISTS entity_aliases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  TEXT        NOT NULL,
  alias           TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('team', 'player')),
  confidence      NUMERIC     NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE entity_aliases IS
  'Tabla de resolución de identidades para equipos y jugadores. '
  'Permite unificar distintas grafías del mismo nombre (ej: "S.D. Almazán" → "C.D. Almazán"). '
  'El scraper consulta esta tabla antes de insertar datos, usando siempre el canonical_name. '
  'confidence=1.0 = certeza total (entrada manual). confidence<1.0 = sugerencia automática pendiente de revisión.';

COMMENT ON COLUMN entity_aliases.canonical_name IS
  'El nombre oficial/canónico con el que se almacenan los datos en la DB.';
COMMENT ON COLUMN entity_aliases.alias IS
  'La variante del nombre tal como aparece en el PDF del acta.';
COMMENT ON COLUMN entity_aliases.confidence IS
  'Nivel de confianza de la correspondencia. 1.0 = confirmado manualmente.';

-- Índice único en alias: cada grafía sólo puede mapear a un canónico
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_aliases_alias_unique
  ON entity_aliases(lower(alias), entity_type);

-- Índice GIN para búsqueda difusa de aliases (útil en el scraper y en admin UI)
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias_trgm
  ON entity_aliases USING GIN (lower(alias) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_type
  ON entity_aliases(entity_type);

-- ============================================================
-- RLS — Lectura pública, escritura solo service_role (scraper/admin)
-- ============================================================

ALTER TABLE entity_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_entity_aliases"
  ON entity_aliases FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "service_role_write_entity_aliases"
  ON entity_aliases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- SEED INICIAL — aliases conocidos
-- ============================================================
-- Reemplaza el hardcode en providers/core.ts:
--   const mappedTeams = options.teamNames.map(t => t === "S.D. Almazán" ? "C.D. Almazán" : t);
-- Ver TAREA 3.1 en el plan de implementación.

INSERT INTO entity_aliases (canonical_name, alias, entity_type, confidence, notes)
VALUES
  ('C.D. Almazán', 'S.D. Almazán', 'team', 1.0, 'Grafía inconsistente detectada en actas de temporada 2025/2026')
ON CONFLICT (lower(alias), entity_type) DO NOTHING;
