-- Migration 037: WIMU GPS Trimmer Engine & Player Metrics Tables

-- 1. Table for GPS Sessions
CREATE TABLE IF NOT EXISTS wimu_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    session_type VARCHAR(50) NOT NULL DEFAULT 'PARTIDO', -- 'PARTIDO' | 'ENTRENAMIENTO'
    detection_mode VARCHAR(100) DEFAULT 'AUTOMATIC_KICKOFF_SIGNATURE',
    folder_path VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table for Trimmed Periods (Exact DDL from specification)
CREATE TABLE IF NOT EXISTS session_trimmed_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES wimu_sessions(id) ON DELETE CASCADE,
    period_name VARCHAR(100) NOT NULL,
    t_start TIME NOT NULL,
    t_end TIME NOT NULL,
    start_min NUMERIC(6, 2),
    end_min NUMERIC(6, 2),
    duration_min NUMERIC(6, 2),
    confidence_score NUMERIC(4, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table for Individual Player GPS Metrics
CREATE TABLE IF NOT EXISTS wimu_player_session_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES wimu_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    distance_km NUMERIC(6, 2) DEFAULT 0,
    hsr_m NUMERIC(8, 2) DEFAULT 0, -- High Speed Running (>19.8 km/h) in meters
    sprints_count INT DEFAULT 0, -- Sprints (>25.2 km/h) count
    max_speed_kmh NUMERIC(5, 2) DEFAULT 0,
    player_load NUMERIC(6, 2) DEFAULT 0,
    player_load_min NUMERIC(5, 2) DEFAULT 0,
    accelerations INT DEFAULT 0,
    decelerations INT DEFAULT 0,
    heatmap_data JSONB DEFAULT '[]'::jsonb, -- Array of {x: number, y: number, value: number}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_wimu_sessions_org ON wimu_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_wimu_sessions_date ON wimu_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_session_trimmed_periods_session ON session_trimmed_periods(session_id);
CREATE INDEX IF NOT EXISTS idx_wimu_player_metrics_session ON wimu_player_session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_wimu_player_metrics_player ON wimu_player_session_metrics(player_id);

-- Enable RLS
ALTER TABLE wimu_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_trimmed_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE wimu_player_session_metrics ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users within their organization
CREATE POLICY "Allow authenticated read wimu_sessions"
    ON wimu_sessions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert wimu_sessions"
    ON wimu_sessions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update wimu_sessions"
    ON wimu_sessions FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read session_trimmed_periods"
    ON session_trimmed_periods FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert session_trimmed_periods"
    ON session_trimmed_periods FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read wimu_player_session_metrics"
    ON wimu_player_session_metrics FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert wimu_player_session_metrics"
    ON wimu_player_session_metrics FOR INSERT
    TO authenticated
    WITH CHECK (true);
