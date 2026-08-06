-- Migration 040: Fix numeric field overflow & add player substitution bounds
-- Converts NUMERIC(p, s) constrained columns to unconstrained NUMERIC to prevent Postgres overflow errors.

-- 1. Relax session_trimmed_periods column constraints
ALTER TABLE session_trimmed_periods
  ALTER COLUMN start_min TYPE NUMERIC,
  ALTER COLUMN end_min TYPE NUMERIC,
  ALTER COLUMN duration_min TYPE NUMERIC,
  ALTER COLUMN confidence_score TYPE NUMERIC;

-- 2. Relax wimu_player_session_metrics column constraints
ALTER TABLE wimu_player_session_metrics
  ALTER COLUMN distance_km TYPE NUMERIC,
  ALTER COLUMN hsr_m TYPE NUMERIC,
  ALTER COLUMN max_speed_kmh TYPE NUMERIC,
  ALTER COLUMN player_load TYPE NUMERIC,
  ALTER COLUMN player_load_min TYPE NUMERIC,
  ALTER COLUMN relative_distance_mmin TYPE NUMERIC,
  ALTER COLUMN explosive_distance_m TYPE NUMERIC,
  ALTER COLUMN acc_dec_ratio TYPE NUMERIC,
  ALTER COLUMN metabolic_power_wkg TYPE NUMERIC,
  ALTER COLUMN hmld_m TYPE NUMERIC,
  ALTER COLUMN equivalent_distance_m TYPE NUMERIC,
  ALTER COLUMN total_kcal TYPE NUMERIC,
  ALTER COLUMN efficiency_ratio_pl_m TYPE NUMERIC,
  ALTER COLUMN stride_asymmetry_lr TYPE NUMERIC,
  ALTER COLUMN dynamic_asymmetry_shift TYPE NUMERIC,
  ALTER COLUMN eccentric_decay_pct TYPE NUMERIC,
  ALTER COLUMN acwr_ratio TYPE NUMERIC;

-- 3. Add player substitution start & end minute columns
ALTER TABLE wimu_player_session_metrics
  ADD COLUMN IF NOT EXISTS player_start_min NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS player_end_min   NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS played_minutes   NUMERIC DEFAULT NULL;
