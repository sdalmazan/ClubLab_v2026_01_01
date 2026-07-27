-- ============================================================
-- Migración 035: Asistencia por Peso y RLS de Lesiones Confidenciales
-- Proyecto: ClubLab v2026
-- ============================================================

-- 1. Añadir columnas a session_attendance y player_wellness_checkins
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);

ALTER TABLE player_wellness_checkins
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);

-- 2. Añadir is_confidential a injuries
ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT FALSE;

-- 3. RLS para lesiones confidenciales
-- Eliminar política anterior si existía para renovar la seguridad
DROP POLICY IF EXISTS "Staff can view injuries in their org" ON injuries;

-- Nueva política: Todos ven lesiones no confidenciales de la org.
-- Las lesiones confidenciales SOLO las ven el propio jugador o el personal médico/fisio (physio, doctor, club_admin, super_admin).
CREATE POLICY "confidential_injuries_view_policy" ON injuries
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
    AND (
      is_confidential = FALSE
      OR player_id IN (
        SELECT id FROM players WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
      )
      OR EXISTS (
        SELECT 1 FROM user_organization_roles
        WHERE user_id = auth.uid()
        AND role IN ('physio', 'doctor', 'club_admin', 'super_admin')
      )
    )
  );
