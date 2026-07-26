/**
 * ClubLab v2026.01.01 — RBAC Permission System
 * Centralised permission checker: can(user, action, resource?)
 *
 * NEVER use role checks scattered across components.
 * ALWAYS use can() from this module.
 */

import type { UserRole, AuthUser } from "@/types";

// ============================================================
// PERMISSION DEFINITIONS
// ============================================================

export type Permission =
  // Organization management
  | "manage_organization"
  | "manage_billing"
  | "invite_users"
  | "manage_roles"
  // Team management
  | "manage_team"
  | "view_all_teams"
  | "create_team"
  // Players
  | "view_player_list"
  | "create_player"
  | "edit_player"
  | "delete_player"
  | "view_player_data"
  | "view_player_health"
  | "view_injury_medical_notes" // physio-only sensitive data
  // Training & Planning
  | "create_session"
  | "edit_session"
  | "delete_session"
  | "view_session_library"
  | "create_exercise"
  | "manage_shared_library" // academy shared content
  // Performance & Loads
  | "view_team_loads"
  | "view_player_loads"
  | "manage_alert_thresholds"
  | "view_alerts"
  | "manage_alerts"
  // Performance Center
  | "access_performance_center"
  | "view_performance_dashboard"
  | "manage_performance_settings"
  | "manage_performance_rules"
  | "evaluate_recommendations"
  | "manage_gym_programs"
  | "manage_testing_center"
  | "manage_physical_routines"
  // Injuries
  | "view_injuries"
  | "create_injury"
  | "edit_injury"
  | "validate_injury" // physio validates player-reported injuries
  // Matches & Stats
  | "view_matches"
  | "create_match"
  | "edit_match_stats"
  | "view_analytics"
  | "view_scouting"
  // Academy
  | "access_academy_dashboard"
  | "view_academy_overview"
  | "manage_academy_teams"
  // Physical Tests
  | "view_physical_tests"
  | "create_physical_test"
  // Admin
  | "access_admin_panel"
  | "manage_all_organizations"; // super_admin only

// ============================================================
// ROLE → PERMISSIONS MAP
// ============================================================

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "manage_organization",
    "manage_billing",
    "invite_users",
    "manage_roles",
    "manage_team",
    "view_all_teams",
    "create_team",
    "view_player_list",
    "create_player",
    "edit_player",
    "delete_player",
    "view_player_data",
    "view_player_health",
    "view_injury_medical_notes",
    "create_session",
    "edit_session",
    "delete_session",
    "view_session_library",
    "create_exercise",
    "manage_shared_library",
    "view_team_loads",
    "view_player_loads",
    "manage_alert_thresholds",
    "view_alerts",
    "manage_alerts",
    "view_injuries",
    "create_injury",
    "edit_injury",
    "validate_injury",
    "view_matches",
    "create_match",
    "edit_match_stats",
    "view_analytics",
    "view_scouting",
    "access_academy_dashboard",
    "view_academy_overview",
    "manage_academy_teams",
    "view_physical_tests",
    "create_physical_test",
    "access_performance_center",
    "view_performance_dashboard",
    "manage_performance_settings",
    "manage_performance_rules",
    "evaluate_recommendations",
    "manage_gym_programs",
    "manage_testing_center",
    "manage_physical_routines",
    "access_admin_panel",
    "manage_all_organizations",
  ],

  club_admin: [
    "manage_organization",
    "manage_billing",
    "invite_users",
    "manage_roles",
    "manage_team",
    "view_all_teams",
    "create_team",
    "view_player_list",
    "create_player",
    "edit_player",
    "delete_player",
    "view_player_data",
    "view_player_health",
    "view_injury_medical_notes",
    "create_session",
    "edit_session",
    "delete_session",
    "view_session_library",
    "create_exercise",
    "manage_shared_library",
    "view_team_loads",
    "view_player_loads",
    "manage_alert_thresholds",
    "view_alerts",
    "manage_alerts",
    "view_injuries",
    "create_injury",
    "edit_injury",
    "validate_injury",
    "view_matches",
    "create_match",
    "edit_match_stats",
    "view_analytics",
    "view_scouting",
    "access_academy_dashboard",
    "view_academy_overview",
    "manage_academy_teams",
    "view_physical_tests",
    "create_physical_test",
    "access_performance_center",
    "view_performance_dashboard",
    "manage_performance_settings",
    "manage_performance_rules",
    "evaluate_recommendations",
    "manage_gym_programs",
    "manage_testing_center",
    "manage_physical_routines",
  ],

  academy_director: [
    "invite_users",
    "view_all_teams",
    "view_player_list",
    "view_player_data",
    "view_player_health",
    "view_session_library",
    "manage_shared_library",
    "view_team_loads",
    "view_player_loads",
    "view_alerts",
    "view_injuries",
    "view_matches",
    "view_analytics",
    "access_academy_dashboard",
    "view_academy_overview",
    "manage_academy_teams",
    "view_physical_tests",
  ],

  academy_coordinator: [
    "view_player_list",
    "create_player",
    "edit_player",
    "view_player_data",
    "view_player_health",
    "create_session",
    "edit_session",
    "delete_session",
    "view_session_library",
    "create_exercise",
    "view_team_loads",
    "view_player_loads",
    "view_alerts",
    "view_injuries",
    "create_injury",
    "view_matches",
    "create_match",
    "edit_match_stats",
    "view_analytics",
    "access_academy_dashboard",
    "view_physical_tests",
    "create_physical_test",
  ],

  head_coach: [
    "invite_users",
    "manage_team",
    "view_player_list",
    "create_player",
    "edit_player",
    "view_player_data",
    "view_player_health",
    "create_session",
    "edit_session",
    "delete_session",
    "view_session_library",
    "create_exercise",
    "view_team_loads",
    "view_player_loads",
    "manage_alert_thresholds",
    "view_alerts",
    "manage_alerts",
    "view_injuries",
    "create_injury",
    "edit_injury",
    "view_matches",
    "create_match",
    "edit_match_stats",
    "view_analytics",
    "view_scouting",
    "view_physical_tests",
    "create_physical_test",
    "access_performance_center",
    "view_performance_dashboard",
    "manage_performance_settings",
    "manage_performance_rules",
    "evaluate_recommendations",
    "manage_gym_programs",
    "manage_testing_center",
    "manage_physical_routines",
  ],

  coach: [
    "invite_users",
    "manage_team",
    "view_player_list",
    "create_player",
    "edit_player",
    "view_player_data",
    "view_player_health",
    "create_session",
    "edit_session",
    "delete_session",
    "view_session_library",
    "create_exercise",
    "view_team_loads",
    "view_player_loads",
    "manage_alert_thresholds",
    "view_alerts",
    "manage_alerts",
    "view_injuries",
    "create_injury",
    "edit_injury",
    "view_matches",
    "create_match",
    "edit_match_stats",
    "view_analytics",
    "view_scouting",
    "view_physical_tests",
    "create_physical_test",
    "access_performance_center",
    "view_performance_dashboard",
    "manage_performance_settings",
    "manage_performance_rules",
    "evaluate_recommendations",
    "manage_gym_programs",
    "manage_testing_center",
    "manage_physical_routines",
  ],

  physical_coach: [
    "view_player_list",
    "view_player_data",
    "view_player_health",
    "create_session",
    "edit_session",
    "view_session_library",
    "create_exercise",
    "view_team_loads",
    "view_player_loads",
    "manage_alert_thresholds",
    "view_alerts",
    "manage_alerts",
    "view_injuries",
    "view_physical_tests",
    "create_physical_test",
    "access_performance_center",
    "view_performance_dashboard",
    "manage_performance_settings",
    "manage_performance_rules",
    "evaluate_recommendations",
    "manage_gym_programs",
    "manage_testing_center",
    "manage_physical_routines",
  ],

  physio: [
    "view_player_health",
    "view_injury_medical_notes", // ONLY physio has this
    "view_injuries",
    "create_injury",
    "edit_injury",
    "validate_injury",
    "view_matches", // physio can see matches
    "view_session_library", // physio can see training schedule
    "view_alerts",
    "view_physical_tests",
  ],

  sporting_director: [
    "view_player_list",
    "view_player_data",
    "view_player_health",
    "view_session_library",
    "view_team_loads",
    "view_player_loads",
    "view_alerts",
    "view_matches",
    "view_analytics",
    "view_scouting",
    "view_academy_overview",
    "view_physical_tests",
  ],

  player: [
    "view_player_data", // only their own (enforced by RLS)
    "view_player_health", // only their own
    "view_session_library",
    "view_injuries", // only their own
    "view_physical_tests", // only their own
    "view_matches",
  ],
};

// ============================================================
// PERMISSION CHECKER
// ============================================================

/**
 * Central permission checker for ClubLab.
 *
 * @param user - The authenticated user with role and org context
 * @param permission - The permission to check
 * @returns boolean — whether the user has the permission
 *
 * @example
 * if (!can(user, 'view_injury_medical_notes')) {
 *   return <AccessDenied />;
 * }
 */
export function can(user: AuthUser, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[user.role];
  if (!rolePerms) return false;
  return rolePerms.includes(permission);
}

/**
 * Checks if a user has ALL of the listed permissions.
 */
export function canAll(user: AuthUser, permissions: Permission[]): boolean {
  return permissions.every((p) => can(user, p));
}

/**
 * Checks if a user has ANY of the listed permissions.
 */
export function canAny(user: AuthUser, permissions: Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

/**
 * Returns the list of permissions for a given role (useful for UI).
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Determines if a role is a staff-level role (not a player).
 */
export function isStaffRole(role: UserRole): boolean {
  return role !== "player";
}

/**
 * Determines if a role has organization-wide access.
 */
export function hasOrgWideAccess(role: UserRole): boolean {
  return (
    role === "super_admin" ||
    role === "club_admin" ||
    role === "academy_director" ||
    role === "sporting_director"
  );
}
