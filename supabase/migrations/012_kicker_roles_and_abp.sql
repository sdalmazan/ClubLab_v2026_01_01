-- ============================================================
-- ClubLab v2026.01.01 — Kicker Roles & ABP (Set Piece) Plays
-- Migration: 012_kicker_roles_and_abp.sql
-- ============================================================

-- Add kicker roles to player_team_memberships
ALTER TABLE player_team_memberships
  ADD COLUMN IF NOT EXISTS kicker_roles TEXT[] DEFAULT '{}';
-- Valid kicker role values:
-- 'far_free_kick_left', 'far_free_kick_right', 'close_free_kick_left', 'close_free_kick_right',
-- 'corner_left', 'corner_right', 'penalty', 'throw_in_left', 'throw_in_right', 'area_rival'

COMMENT ON COLUMN player_team_memberships.kicker_roles IS 'Set-piece kicker roles for this player in this team/season. Values: far_free_kick_left, far_free_kick_right, close_free_kick_left, close_free_kick_right, corner_left, corner_right, penalty, throw_in_left, throw_in_right, area_rival';

-- ABP (Set Piece) plays library
CREATE TABLE IF NOT EXISTS abp_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('corner', 'free_kick_lateral', 'free_kick_frontal', 'throw_in', 'kickoff', 'penalty', 'goal_kick')),
  is_offensive BOOLEAN NOT NULL DEFAULT TRUE,
  whiteboard_data JSONB, -- {strokes, shapes, texts, chips}
  whiteboard_image TEXT, -- base64 PNG thumbnail
  scope TEXT NOT NULL DEFAULT 'coach' CHECK (scope IN ('global', 'academy', 'coach')),
  created_by UUID REFERENCES auth.users(id),
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE abp_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON abp_plays FOR ALL USING (organization_id = auth_org_id());
CREATE INDEX IF NOT EXISTS idx_abp_plays_org ON abp_plays(organization_id);
CREATE INDEX IF NOT EXISTS idx_abp_plays_type ON abp_plays(type);
