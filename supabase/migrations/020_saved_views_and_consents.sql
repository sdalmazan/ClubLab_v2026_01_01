-- ============================================================
-- Migración 020: saved_views y user_data_consents
-- Proyecto: ClubLab v2026
-- Propósito: Persistencia de vistas de búsqueda y control de GDPR
-- ============================================================

-- ==========================================
-- 1. TABLA: saved_views (Vistas Guardadas)
-- ==========================================
CREATE TABLE IF NOT EXISTS saved_views (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  description     TEXT,
  icon            TEXT          DEFAULT 'layout',
  entity_type     TEXT          NOT NULL CHECK (entity_type IN ('player', 'team', 'coach', 'competition')),
  filters         JSONB         NOT NULL DEFAULT '{}'::jsonb,
  metrics         TEXT[]        NOT NULL DEFAULT '{}'::text[],
  sort_by         TEXT,
  sort_order      TEXT          CHECK (sort_order IN ('asc', 'desc')),
  is_favorite     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Habilitar RLS para saved_views
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Acceso solo a miembros de la misma organización
CREATE POLICY "users_manage_own_org_views" ON saved_views
  FOR ALL TO authenticated
  USING (
    organization_id = (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

-- ==========================================
-- 2. TABLA: user_data_consents (Consentimientos GDPR)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_data_consents (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type   TEXT          NOT NULL, -- e.g., 'birth_date_analysis'
  version        TEXT          NOT NULL, -- e.g., '1.0'
  accepted       BOOLEAN       NOT NULL DEFAULT FALSE,
  accepted_at    TIMESTAMPTZ,
  withdrawn_at   TIMESTAMPTZ,
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, consent_type, version)
);

-- Habilitar RLS para user_data_consents
ALTER TABLE user_data_consents ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Un usuario solo puede ver/gestionar su propio consentimiento
CREATE POLICY "users_manage_own_consent" ON user_data_consents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
