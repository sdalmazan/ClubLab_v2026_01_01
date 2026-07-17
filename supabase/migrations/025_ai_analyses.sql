-- ============================================================
-- ClubLab — Migration 025: AI Analyses table
-- Persiste el historial de análisis generados por IA para evitar
-- regeneraciones innecesarias, construir un histórico de insights
-- y como paso previo a la integración de pgvector (búsqueda semántica).
--
-- TAREA 6.2 del plan de implementación arquitectónica.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analyses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by        UUID          REFERENCES auth.users(id),

  -- Qué se analizó
  entity_type       TEXT          NOT NULL CHECK (entity_type IN ('player', 'team', 'coach', 'competition', 'session')),
  entity_id         TEXT          NOT NULL, -- UUID o clave compuesta (player_name|season)
  entity_name       TEXT,                   -- nombre legible en cache, no es source of truth

  -- Tipo de análisis
  analysis_type     TEXT          NOT NULL DEFAULT 'insights'
                                  CHECK (analysis_type IN ('insights', 'scouting', 'match_preview', 'session_debrief', 'trend')),

  -- Input y output del análisis
  input_context     JSONB         NOT NULL DEFAULT '{}',  -- métricas, filtros aplicados, periodo
  result_text       TEXT          NOT NULL,               -- texto generado por el LLM
  result_structured JSONB         DEFAULT '{}',           -- versión parseada si el LLM devuelve JSON

  -- Metadatos del modelo
  model             TEXT          NOT NULL DEFAULT 'gemini-2.0-flash',
  prompt_version    TEXT          NOT NULL DEFAULT 'v1',  -- versión del template de prompt usado
  tokens_used       INTEGER,

  -- Calidad y feedback
  quality_rating    SMALLINT      CHECK (quality_rating BETWEEN 1 AND 5),
  is_pinned         BOOLEAN       NOT NULL DEFAULT FALSE, -- el usuario marcó como favorito
  feedback_notes    TEXT,

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ   GENERATED ALWAYS AS (created_at + INTERVAL '90 days') STORED
);

COMMENT ON TABLE ai_analyses IS
  'Historial de análisis generados por IA (Gemini). '
  'Permite reutilizar análisis recientes, evitar LLM calls innecesarios y construir '
  'un histórico de insights por entidad. Los análisis expiran a los 90 días automáticamente.';

COMMENT ON COLUMN ai_analyses.entity_id IS
  'Identificador de la entidad analizada. Para jugadores puede ser UUID de Main_DB '
  'o clave compuesta player_name|season si no hay match con Main_DB.';

COMMENT ON COLUMN ai_analyses.input_context IS
  'Snapshot del contexto de entrada: métricas calculadas, filtros activos, '
  'temporada, etc. Permite reproducir el análisis o detectar si hay datos nuevos.';

COMMENT ON COLUMN ai_analyses.prompt_version IS
  'Versión del template de prompt usado. Permite invalidar análisis antiguos '
  'cuando se actualiza el prompt engineering.';

-- Índices para los patrones de query más frecuentes
CREATE INDEX IF NOT EXISTS idx_ai_analyses_org_entity
  ON ai_analyses(organization_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_org_recent
  ON ai_analyses(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_pinned
  ON ai_analyses(organization_id, is_pinned) WHERE is_pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_ai_analyses_expires
  ON ai_analyses(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their org analyses"
  ON ai_analyses FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "Org members can insert analyses for their org"
  ON ai_analyses FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "Authors can update their own analyses (feedback, pin)"
  ON ai_analyses FOR UPDATE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND (created_by = auth.uid() OR auth_user_role() IN ('club_admin', 'super_admin'))
  );

CREATE POLICY "Admins can delete analyses"
  ON ai_analyses FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_user_role() IN ('club_admin', 'super_admin')
  );
