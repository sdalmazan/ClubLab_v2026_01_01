-- ============================================================
-- ClubLab v2026.01.01 — PreSeason Planning Sessions
-- Migration: 009_preseason_sessions.sql
-- ============================================================

-- PreSeason planning sessions
CREATE TABLE IF NOT EXISTS preseason_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME,
  type TEXT NOT NULL DEFAULT 'training' CHECK (type IN ('training', 'rest', 'friendly', 'league')),
  opponent TEXT, -- for friendly/league matches
  location TEXT, -- match location/venue
  field_type TEXT, -- 'natural' | 'artificial' | 'indoor'
  field_dimensions TEXT, -- e.g. '45/45'
  comments TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, date, type)
);

ALTER TABLE preseason_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON preseason_sessions FOR ALL USING (organization_id = auth_org_id());
CREATE INDEX IF NOT EXISTS idx_preseason_sessions_team ON preseason_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_preseason_sessions_date ON preseason_sessions(date);
