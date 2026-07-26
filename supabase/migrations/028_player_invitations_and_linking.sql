-- ============================================================
-- Migración 028: Invitaciones de Jugadores, Vinculación y RGPD
-- Proyecto: ClubLab v2026
-- Propósito: Gestión de invitaciones por email, vinculación de perfil de jugador y RGPD
-- ============================================================

-- 1. Añadir campos email y user_id a la tabla players si no existen
ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índices para búsquedas rápidas por correo y user_id en players
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);

-- 2. Tabla player_invitations (tokens de invitación por email)
CREATE TABLE IF NOT EXISTS player_invitations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT          NOT NULL,
  full_name       TEXT          NOT NULL,
  role            TEXT          NOT NULL DEFAULT 'player',
  player_id       UUID          REFERENCES players(id) ON DELETE CASCADE,
  token           TEXT          UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ
);

-- Índices para validación de token y correo
CREATE INDEX IF NOT EXISTS idx_player_invitations_token ON player_invitations(token);
CREATE INDEX IF NOT EXISTS idx_player_invitations_email ON player_invitations(email);

-- Habilitar RLS en player_invitations
ALTER TABLE player_invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para player_invitations
CREATE POLICY "users_manage_org_invitations" ON player_invitations
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

CREATE POLICY "public_read_invitation_by_token" ON player_invitations
  FOR SELECT TO anon, authenticated
  USING (true);
