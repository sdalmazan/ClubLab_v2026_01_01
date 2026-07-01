-- ============================================================
-- ClubLab v2026.01.01 — Concept Tracking & Alert Settings
-- Migration: 014_concept_tracking.sql
-- ============================================================

-- Concept alert settings per organization
CREATE TABLE IF NOT EXISTS org_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  concept_inactive_days_threshold INTEGER NOT NULL DEFAULT 21, -- alert if concept not worked in X days
  concept_overuse_weekly_threshold INTEGER NOT NULL DEFAULT 4, -- alert if concept worked > X times in a week
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_alert_settings FOR ALL USING (organization_id = auth_org_id());

-- Dismissed concept alerts
CREATE TABLE IF NOT EXISTS concept_alert_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  concept_key TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('inactive', 'overuse')),
  dismissed_by UUID REFERENCES auth.users(id),
  dismissed_until DATE, -- NULL = dismissed forever, DATE = snoozed until this date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE concept_alert_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON concept_alert_dismissals FOR ALL USING (organization_id = auth_org_id());
CREATE INDEX IF NOT EXISTS idx_concept_dismissals_org_team ON concept_alert_dismissals(organization_id, team_id);

-- Helper view: concept minutes by week per team
CREATE OR REPLACE VIEW concept_minutes_by_week AS
SELECT
  se.organization_id,
  ts.team_id,
  ts.season_id,
  DATE_TRUNC('week', ts.date::timestamptz) AS week_start,
  EXTRACT(YEAR FROM ts.date::timestamptz) AS year,
  EXTRACT(WEEK FROM ts.date::timestamptz) AS week_number,
  unnest(se.tactical_concepts) AS concept_key,
  SUM(se.duration_min) AS total_minutes,
  COUNT(*) AS session_count
FROM session_exercises se
JOIN training_sessions ts ON ts.id = se.session_id
WHERE ts.session_type = 'training'
  AND se.tactical_concepts IS NOT NULL
  AND array_length(se.tactical_concepts, 1) > 0
GROUP BY se.organization_id, ts.team_id, ts.season_id, week_start, year, week_number, concept_key;

-- Note: RLS on view is enforced through the underlying table RLS
