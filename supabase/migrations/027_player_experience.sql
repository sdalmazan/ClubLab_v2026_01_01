-- ============================================================
-- Migración 027: Tablas para la Experiencia del Jugador (ClubLab Player)
-- Proyecto: ClubLab v2026
-- Propósito: Registro de Check-ins de Wellness, Recomendaciones del Staff y Solicitudes RGPD
-- ============================================================

-- 1. TABLA: player_wellness_checkins
CREATE TABLE IF NOT EXISTS player_wellness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 5),
  fatigue INT CHECK (fatigue BETWEEN 1 AND 5),
  mood INT CHECK (mood BETWEEN 1 AND 5),
  muscle_soreness INT CHECK (muscle_soreness BETWEEN 1 AND 5),
  stress INT CHECK (stress BETWEEN 1 AND 5),
  has_discomfort BOOLEAN DEFAULT FALSE,
  discomfort_body_part TEXT,
  discomfort_intensity INT CHECK (discomfort_intensity BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, date)
);

ALTER TABLE player_wellness_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_manage_own_wellness_checkins" ON player_wellness_checkins
  FOR ALL TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- 2. TABLA: player_recommendations
CREATE TABLE IF NOT EXISTS player_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('fuerza', 'prevencion', 'activacion', 'recuperacion')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason_context TEXT,
  exercise_routine_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  estimated_minutes INT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_org_recommendations" ON player_recommendations
  FOR ALL TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- 3. TABLA: player_privacy_requests
CREATE TABLE IF NOT EXISTS player_privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export_data', 'delete_account', 'rectify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_privacy_requests" ON player_privacy_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
