-- Migration 038: GPS RLS Organization Isolation + API Tokens Table
-- Run this in Supabase Dashboard → SQL Editor

-- ─── 1. Table for Organization API Tokens (for Local Agent authentication) ───
CREATE TABLE IF NOT EXISTS organization_api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    label VARCHAR(100) DEFAULT 'Agente GPS Local',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_api_tokens_org ON organization_api_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_api_tokens_token ON organization_api_tokens(token);

ALTER TABLE organization_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow org read api_tokens"
    ON organization_api_tokens FOR SELECT TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow org insert api_tokens"
    ON organization_api_tokens FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow org delete api_tokens"
    ON organization_api_tokens FOR DELETE TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

-- ─── 2. Fix wimu_sessions RLS — restrict to own organization ─────────────────
DROP POLICY IF EXISTS "Allow authenticated read wimu_sessions" ON wimu_sessions;
DROP POLICY IF EXISTS "Allow authenticated insert wimu_sessions" ON wimu_sessions;
DROP POLICY IF EXISTS "Allow authenticated update wimu_sessions" ON wimu_sessions;

CREATE POLICY "Allow org read wimu_sessions"
    ON wimu_sessions FOR SELECT TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow org insert wimu_sessions"
    ON wimu_sessions FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow org update wimu_sessions"
    ON wimu_sessions FOR UPDATE TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
        )
    );

-- ─── 3. Fix session_trimmed_periods RLS — through session ownership ───────────
DROP POLICY IF EXISTS "Allow authenticated read session_trimmed_periods" ON session_trimmed_periods;
DROP POLICY IF EXISTS "Allow authenticated insert session_trimmed_periods" ON session_trimmed_periods;

CREATE POLICY "Allow org read trimmed_periods"
    ON session_trimmed_periods FOR SELECT TO authenticated
    USING (
        session_id IN (
            SELECT id FROM wimu_sessions WHERE organization_id IN (
                SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Allow org insert trimmed_periods"
    ON session_trimmed_periods FOR INSERT TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM wimu_sessions WHERE organization_id IN (
                SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
            )
        )
    );

-- ─── 4. Fix wimu_player_session_metrics RLS ──────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read wimu_player_session_metrics" ON wimu_player_session_metrics;
DROP POLICY IF EXISTS "Allow authenticated insert wimu_player_session_metrics" ON wimu_player_session_metrics;

CREATE POLICY "Allow org read player_metrics"
    ON wimu_player_session_metrics FOR SELECT TO authenticated
    USING (
        session_id IN (
            SELECT id FROM wimu_sessions WHERE organization_id IN (
                SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Allow org insert player_metrics"
    ON wimu_player_session_metrics FOR INSERT TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM wimu_sessions WHERE organization_id IN (
                SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
            )
        )
    );
