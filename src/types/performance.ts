/**
 * ClubLab v2026.01.01 — Performance Center & Rule Engine Domain Types
 */

import type { UserRole } from "./index";

// ============================================================
// PLAYER PERFORMANCE STATES (Player State Engine)
// ============================================================

export type PlayerPerformanceState =
  | "ready"
  | "ready_with_restrictions"
  | "monitor"
  | "reduced_load"
  | "recovery"
  | "return_to_play"
  | "unavailable";

export const PLAYER_STATE_LABELS: Record<PlayerPerformanceState, { label: string; color: string; badgeBg: string }> = {
  ready: { label: "Listo (100%)", color: "text-emerald-400", badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  ready_with_restrictions: { label: "Listo c/ Restricciones", color: "text-amber-400", badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  monitor: { label: "Bajo Monitoreo", color: "text-yellow-400", badgeBg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" },
  reduced_load: { label: "Carga Reducida", color: "text-orange-400", badgeBg: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  recovery: { label: "Recuperación / Regenerativo", color: "text-blue-400", badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  return_to_play: { label: "Return to Play (RTP)", color: "text-purple-400", badgeBg: "bg-purple-500/10 border-purple-500/30 text-purple-300" },
  unavailable: { label: "No Disponible (Baja)", color: "text-rose-400", badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-300" },
};

// ============================================================
// PERFORMANCE THRESHOLDS & SETTINGS
// ============================================================

export interface PerformanceThresholds {
  id: string;
  organization_id: string;
  wellness_warning_score: number;
  wellness_critical_score: number;
  soreness_critical_level: number;
  acwr_warning_ratio: number;
  acwr_critical_ratio: number;
  max_minutes_7days: number;
  max_minutes_14days: number;
  is_gps_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// RULE ENGINE SCHEMAS
// ============================================================

export type RuleCategory =
  | "disponibilidad"
  | "carga"
  | "wellness"
  | "recuperacion"
  | "prevencion"
  | "rtp"
  | "testing"
  | "gimnasio";

export type RuleMetric =
  | "wellness_score"
  | "soreness_level"
  | "sleep_quality"
  | "rpe_last_session"
  | "acwr_ratio"
  | "minutes_last_7days"
  | "player_state"
  | "cmj_drop_pct";

export interface RuleCondition {
  metric: RuleMetric;
  operator: "<" | "<=" | ">" | ">=" | "==" | "!=";
  value: number | string;
}

export type ActionType =
  | "change_player_state"
  | "assign_routine"
  | "modify_session_task"
  | "create_alert"
  | "notify_staff";

export interface RuleAction {
  type: ActionType;
  target: "player" | "physical_coach" | "head_coach";
  payload: {
    new_state?: PlayerPerformanceState;
    routine_id?: string;
    task_modification?: string;
    alert_message?: string;
  };
}

export interface PerformanceRule {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string;
  category: RuleCategory;
  priority: 1 | 2 | 3 | 4 | 5;
  is_enabled: boolean;
  logical_operator: "AND" | "OR";
  conditions: RuleCondition[];
  actions: RuleAction[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// RECOMMENDATIONS
// ============================================================

export type RecommendationStatus = "pending" | "accepted" | "modified" | "dismissed";

export interface PerformanceRecommendation {
  id: string;
  organization_id: string;
  player_id: string;
  player_name?: string;
  triggered_rule_id?: string;
  rule_code?: string;
  rule_name?: string;
  reasons: string[];
  actions: RuleAction[];
  status: RecommendationStatus;
  handled_by?: string;
  handled_at?: string;
  created_at: string;
}

// ============================================================
// ROUTINES & TESTING
// ============================================================

export interface PerformanceRoutine {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  category: "warmup" | "cooldown" | "strength" | "activation" | "preventive" | "rehab" | "recovery";
  target_muscle_groups: string[];
  injury_risk_mitigated: string[];
  intensity_level: "low" | "moderate" | "high" | "maximal";
  estimated_duration_min: number;
  environment: "gym" | "pitch" | "indoor" | "pool" | "hotel";
  equipment_needed: string[];
  frequency?: string;
  suggested_days?: string;
  recommended_timing?: string;
  scope?: "coach" | "academy" | "global";
  exercises: {
    name: string;
    sets?: number;
    reps?: string;
    tempo?: string;
    video_url?: string;
    notes?: string;
  }[];
  created_at?: string;
}

export interface PerformanceTestRecord {
  id: string;
  organization_id: string;
  player_id: string;
  test_type: "cmj" | "sprint_10m" | "vbt" | "isak" | "nordic_hamstring" | "yoyo_ir1";
  metrics: Record<string, number | string>;
  tested_at: string;
  evaluator_id?: string;
}
