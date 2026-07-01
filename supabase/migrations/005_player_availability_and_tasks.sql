-- ============================================================
-- ClubLab v2026.01.01 — Player Availability & Tasks
-- Migration: 005_player_availability_and_tasks
-- ============================================================

-- Alter players table to add physical status and availability
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS physical_status TEXT CHECK (physical_status IN ('green', 'yellow', 'red')) DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS availability_status TEXT CHECK (availability_status IN ('available', 'control', 'not_available')) DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_notes TEXT;

-- Create player_tasks table for assigned tasks/exercises
CREATE TABLE IF NOT EXISTS player_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'skipped', 'cancelled')),
  staff_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on player_tasks
ALTER TABLE player_tasks ENABLE ROW LEVEL SECURITY;

-- Create policy for multi-tenant isolation
CREATE POLICY "org_isolation" ON player_tasks FOR ALL
  USING (organization_id = auth_org_id());

-- Create index on player_tasks
CREATE INDEX IF NOT EXISTS idx_player_tasks_player ON player_tasks(player_id);
