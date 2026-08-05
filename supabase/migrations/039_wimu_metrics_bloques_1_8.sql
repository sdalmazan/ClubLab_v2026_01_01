-- Migration 039: Add Bloques 1-8 extended GPS metric columns to wimu_player_session_metrics
-- Also adds sprint_vectors & heatmap columns for spatial analysis

-- Bloque 1 extras
ALTER TABLE wimu_player_session_metrics
  ADD COLUMN IF NOT EXISTS distance_m                INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relative_distance_mmin    NUMERIC(7,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS speed_bands               JSONB DEFAULT '{}'::jsonb,

-- Bloque 2: Acc/Dec Profile & COD
  ADD COLUMN IF NOT EXISTS explosive_distance_m      NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acc_bands                 JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dec_bands                 JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS acc_dec_ratio             NUMERIC(5,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_count                 JSONB DEFAULT '{}'::jsonb,

-- Bloque 3: Neuromuscular
  ADD COLUMN IF NOT EXISTS impacts_count             JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS jumps                     JSONB DEFAULT '{}'::jsonb,

-- Bloque 4: Metabolic Power (Osgnach / Di Prampero)
  ADD COLUMN IF NOT EXISTS metabolic_power_wkg       NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hmld_m                    NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equivalent_distance_m     NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_kcal                NUMERIC(8,2) DEFAULT 0,

-- Bloque 5: Biomechanics & Intra-Session Fatigue
  ADD COLUMN IF NOT EXISTS efficiency_ratio_pl_m     NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stride_asymmetry_lr       NUMERIC(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS dynamic_asymmetry_shift   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eccentric_decay_pct       NUMERIC(5,2) DEFAULT 0,

-- Bloque 6: Worst-Case Scenarios (rolling windows)
  ADD COLUMN IF NOT EXISTS worst_case_scenarios      JSONB DEFAULT '{}'::jsonb,

-- Bloque 7: Heart Rate Zones
  ADD COLUMN IF NOT EXISTS hr_metrics                JSONB DEFAULT '{}'::jsonb,

-- Bloque 8: EWMA / ACWR
  ADD COLUMN IF NOT EXISTS acwr_ratio                NUMERIC(5,3) DEFAULT 0,

-- Spatial assets
  ADD COLUMN IF NOT EXISTS sprint_vectors            JSONB DEFAULT '[]'::jsonb;

-- Indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_wimu_metrics_hmld ON wimu_player_session_metrics(hmld_m);
CREATE INDEX IF NOT EXISTS idx_wimu_metrics_acwr ON wimu_player_session_metrics(acwr_ratio);
