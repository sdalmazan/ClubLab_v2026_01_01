-- ============================================================
-- ClubLab — Control de Grasa y Antropometría ISAK
-- Migration: 041_body_fat_and_anthropometry.sql
-- ============================================================

-- 1. Tabla de Registros de Control de Grasa
CREATE TABLE IF NOT EXISTS player_body_fat_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  
  -- 6 Pliegues cutáneos (ISAK) en milímetros (mm)
  triceps_mm NUMERIC(5,2) DEFAULT 0,
  subescapular_mm NUMERIC(5,2) DEFAULT 0,
  biceps_mm NUMERIC(5,2) DEFAULT 0,
  abdominal_mm NUMERIC(5,2) DEFAULT 0,
  iliaco_mm NUMERIC(5,2) DEFAULT 0,
  pierna_mm NUMERIC(5,2) DEFAULT 0,
  
  -- Valores calculados
  sumatorio_mm NUMERIC(6,2) DEFAULT 0,
  fat_percentage_6 NUMERIC(5,2) DEFAULT 0,
  fat_percentage_4 NUMERIC(5,2) DEFAULT 0,
  
  notes TEXT,
  conducted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Configuración de Pliegues por Equipo / Organización
CREATE TABLE IF NOT EXISTS team_body_fat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  active_skinfolds JSONB DEFAULT '["triceps", "subescapular", "biceps", "abdominal", "iliaco", "pierna"]'::jsonb,
  target_fat_min NUMERIC(4,1) DEFAULT 8.0,
  target_fat_max NUMERIC(4,1) DEFAULT 12.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_body_fat_settings UNIQUE (organization_id, team_id)
);

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_body_fat_player_date ON player_body_fat_entries(player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_fat_org ON player_body_fat_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_body_fat_team ON player_body_fat_entries(team_id);

-- 4. Políticas de Seguridad (RLS)
ALTER TABLE player_body_fat_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_body_fat_settings ENABLE ROW LEVEL SECURITY;

-- Acceso total a usuarios autenticados dentro de su organización
CREATE POLICY "Users can access body fat entries of their org"
  ON player_body_fat_entries
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access team body fat settings of their org"
  ON team_body_fat_settings
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
  );
