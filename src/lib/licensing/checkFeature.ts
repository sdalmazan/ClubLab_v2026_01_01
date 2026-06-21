/**
 * ClubLab v2026.01.01 — Licensing Engine
 * Feature gating based on organisation subscription plan.
 *
 * NEVER hardcode plan checks in components.
 * ALWAYS use checkFeature() from this module.
 */

import type { PlanSlug, AuthUser } from "@/types";

// ============================================================
// FEATURE KEYS
// ============================================================

export type FeatureKey =
  // Core
  | "unlimited_players"
  | "multiple_teams"
  | "full_season_history"
  | "collaborators"
  // Planning
  | "session_templates"
  | "advanced_planning"
  | "microcycle_view"
  | "shared_library" // academy
  // Performance
  | "wellness_checkin"
  | "rpe_tracking"
  | "load_calculation"
  | "acwr_monitoring"
  | "performance_alerts"
  | "configurable_thresholds"
  // Health
  | "injury_tracking"
  | "rehab_plans"
  | "physio_access"
  | "medical_notes"
  // Tests
  | "physical_tests"
  | "test_history"
  // Matches & Stats
  | "match_stats"
  | "season_analytics"
  | "federation_import"
  // Video
  | "video_references"
  | "video_clips"
  | "video_analysis"
  // Academy
  | "academy_dashboard"
  | "cross_team_analytics"
  | "methodology_library"
  | "coordinator_roles"
  // AI
  | "ai_reports"
  | "ai_planning_assistant"
  // Admin
  | "admin_panel"
  | "data_export"
  | "api_access";

// ============================================================
// PLAN → FEATURES MAP
// ============================================================

const PLAN_FEATURES: Record<PlanSlug, FeatureKey[]> = {
  free: [
    "wellness_checkin",
    "rpe_tracking",
    "injury_tracking",
    "match_stats",
    "physical_tests",
    "video_references",
  ],

  coach_pro: [
    "unlimited_players",
    "full_season_history",
    "session_templates",
    "advanced_planning",
    "microcycle_view",
    "wellness_checkin",
    "rpe_tracking",
    "load_calculation",
    "acwr_monitoring",
    "performance_alerts",
    "configurable_thresholds",
    "injury_tracking",
    "rehab_plans",
    "physio_access",
    "physical_tests",
    "test_history",
    "match_stats",
    "season_analytics",
    "video_references",
    "video_clips",
    "data_export",
  ],

  performance: [
    "unlimited_players",
    "full_season_history",
    "collaborators",
    "session_templates",
    "advanced_planning",
    "microcycle_view",
    "wellness_checkin",
    "rpe_tracking",
    "load_calculation",
    "acwr_monitoring",
    "performance_alerts",
    "configurable_thresholds",
    "injury_tracking",
    "rehab_plans",
    "physio_access",
    "medical_notes",
    "physical_tests",
    "test_history",
    "match_stats",
    "season_analytics",
    "federation_import",
    "video_references",
    "video_clips",
    "video_analysis",
    "ai_reports",
    "data_export",
    "api_access",
  ],

  academy: [
    "unlimited_players",
    "multiple_teams",
    "full_season_history",
    "collaborators",
    "session_templates",
    "advanced_planning",
    "microcycle_view",
    "shared_library",
    "wellness_checkin",
    "rpe_tracking",
    "load_calculation",
    "acwr_monitoring",
    "performance_alerts",
    "configurable_thresholds",
    "injury_tracking",
    "rehab_plans",
    "physio_access",
    "medical_notes",
    "physical_tests",
    "test_history",
    "match_stats",
    "season_analytics",
    "federation_import",
    "video_references",
    "video_clips",
    "video_analysis",
    "academy_dashboard",
    "cross_team_analytics",
    "methodology_library",
    "coordinator_roles",
    "ai_reports",
    "ai_planning_assistant",
    "admin_panel",
    "data_export",
    "api_access",
  ],
};

// ============================================================
// PLAN LIMITS
// ============================================================

export interface PlanLimits {
  maxTeams: number; // -1 = unlimited
  maxPlayersPerTeam: number; // -1 = unlimited
  maxCollaborators: number; // -1 = unlimited
  historyMonths: number; // -1 = unlimited
}

const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free: {
    maxTeams: 1,
    maxPlayersPerTeam: 25,
    maxCollaborators: 0,
    historyMonths: 3,
  },
  coach_pro: {
    maxTeams: 1,
    maxPlayersPerTeam: -1,
    maxCollaborators: 2,
    historyMonths: -1,
  },
  performance: {
    maxTeams: 3,
    maxPlayersPerTeam: -1,
    maxCollaborators: 10,
    historyMonths: -1,
  },
  academy: {
    maxTeams: -1,
    maxPlayersPerTeam: -1,
    maxCollaborators: -1,
    historyMonths: -1,
  },
};

// ============================================================
// FEATURE CHECKER
// ============================================================

/**
 * Checks if the current user's organisation plan includes a feature.
 *
 * @param user - The authenticated user with plan context
 * @param feature - The feature key to check
 * @returns boolean — whether the feature is available
 *
 * @example
 * if (!checkFeature(user, 'academy_dashboard')) {
 *   return <UpgradePrompt feature="academy_dashboard" />;
 * }
 */
export function checkFeature(user: AuthUser, feature: FeatureKey): boolean {
  const planFeatures = PLAN_FEATURES[user.plan_slug];
  if (!planFeatures) return false;
  return planFeatures.includes(feature);
}

/**
 * Returns the plan limits for the user's current subscription.
 */
export function getPlanLimits(user: AuthUser): PlanLimits {
  return PLAN_LIMITS[user.plan_slug] ?? PLAN_LIMITS.free;
}

/**
 * Checks if the user's plan supports multiple teams.
 */
export function canUseMultipleTeams(user: AuthUser): boolean {
  return checkFeature(user, "multiple_teams");
}

/**
 * Returns all features available for a given plan (useful for pricing page).
 */
export function getFeaturesForPlan(plan: PlanSlug): FeatureKey[] {
  return PLAN_FEATURES[plan] ?? [];
}

/**
 * Returns the upgrade path from the current plan.
 */
export function getUpgradePath(current: PlanSlug): PlanSlug | null {
  const order: PlanSlug[] = ["free", "coach_pro", "performance", "academy"];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
}
