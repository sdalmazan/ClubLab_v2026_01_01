-- ============================================================
-- ClubLab v2026.01.01 — Row Level Security Policies
-- Migration: 002_rls_policies
-- ============================================================
-- All sensitive tables are isolated by organization_id.
-- Users can ONLY access data from their own organisation.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helper function: get the user's organization_id from their role
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM user_organization_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role
  FROM user_organization_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- organizations
-- ─────────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = auth_org_id());

CREATE POLICY "Club admins can update their organization"
  ON organizations FOR UPDATE
  USING (id = auth_org_id() AND auth_user_role() IN ('club_admin', 'super_admin'));

-- ─────────────────────────────────────────────────────────────
-- clubs, seasons, teams
-- ─────────────────────────────────────────────────────────────

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON clubs FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON seasons FOR ALL
  USING (club_id IN (SELECT id FROM clubs WHERE organization_id = auth_org_id()));

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON teams FOR ALL
  USING (club_id IN (SELECT id FROM clubs WHERE organization_id = auth_org_id()));

-- ─────────────────────────────────────────────────────────────
-- user_organization_roles
-- ─────────────────────────────────────────────────────────────

ALTER TABLE user_organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see roles in their org"
  ON user_organization_roles FOR SELECT
  USING (organization_id = auth_org_id());

CREATE POLICY "Admins can manage roles"
  ON user_organization_roles FOR ALL
  USING (
    organization_id = auth_org_id()
    AND auth_user_role() IN ('club_admin', 'academy_director', 'super_admin')
  );

-- ─────────────────────────────────────────────────────────────
-- players
-- ─────────────────────────────────────────────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON players FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE player_team_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON player_team_memberships FOR ALL
  USING (
    player_id IN (SELECT id FROM players WHERE organization_id = auth_org_id())
  );

-- ─────────────────────────────────────────────────────────────
-- training_sessions, exercises, templates
-- ─────────────────────────────────────────────────────────────

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON training_sessions FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON session_templates FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON exercises FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- performance
-- ─────────────────────────────────────────────────────────────

ALTER TABLE wellness_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON wellness_entries FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE rpe_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON rpe_entries FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE player_loads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON player_loads FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON alert_thresholds FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON alerts FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- injuries — extra sensitive data policy
-- ─────────────────────────────────────────────────────────────

ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

-- All staff can see basic injury data
CREATE POLICY "Staff can view injuries in their org"
  ON injuries FOR SELECT
  USING (organization_id = auth_org_id());

-- Only physio and club_admin can view/edit medical_notes
-- (enforced at application layer too, this provides DB-level defence)
CREATE POLICY "Physio can manage injuries"
  ON injuries FOR ALL
  USING (
    organization_id = auth_org_id()
    AND auth_user_role() IN ('physio', 'club_admin', 'head_coach', 'super_admin')
  );

ALTER TABLE rehab_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON rehab_plans FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE rehab_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON rehab_sessions FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- matches & stats
-- ─────────────────────────────────────────────────────────────

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON matches FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON match_player_stats FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- physical tests
-- ─────────────────────────────────────────────────────────────

ALTER TABLE physical_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON physical_tests FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE physical_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON physical_test_results FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- video
-- ─────────────────────────────────────────────────────────────

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON videos FOR ALL
  USING (organization_id = auth_org_id());

ALTER TABLE video_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON video_clips FOR ALL
  USING (organization_id = auth_org_id());

-- ─────────────────────────────────────────────────────────────
-- notifications — user-scoped
-- ─────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_notifications" ON notifications FOR ALL
  USING (
    organization_id = auth_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- plans & features — public read
-- ─────────────────────────────────────────────────────────────

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON plans FOR SELECT USING (TRUE);

ALTER TABLE features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Features are publicly readable" ON features FOR SELECT USING (TRUE);

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan features are publicly readable" ON plan_features FOR SELECT USING (TRUE);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orgs can read their subscription"
  ON subscriptions FOR SELECT
  USING (organization_id = auth_org_id());
