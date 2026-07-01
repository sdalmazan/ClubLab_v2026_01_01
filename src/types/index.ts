/**
 * ClubLab v2026.01.01 — TypeScript Types
 * Global domain types shared across the platform
 */

// ============================================================
// ROLES & PERMISSIONS
// ============================================================

export type UserRole =
  | "super_admin"
  | "club_admin"
  | "academy_director"
  | "academy_coordinator"
  | "head_coach"
  | "coach"
  | "physical_coach"
  | "physio"
  | "sporting_director"
  | "player";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  club_admin: "Admin del Club",
  academy_director: "Director de Academia",
  academy_coordinator: "Coordinador de Academia",
  head_coach: "Primer Entrenador",
  coach: "Entrenador",
  physical_coach: "Preparador Físico",
  physio: "Fisioterapeuta",
  sporting_director: "Director Deportivo",
  player: "Jugador",
};

// ============================================================
// ORGANIZATIONS
// ============================================================

export type OrganizationType = "club" | "academy" | "independent_coach";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
}

export interface Club {
  id: string;
  organization_id: string;
  name: string;
  founded_year: number | null;
  country: string | null;
  city: string | null;
  logo_url: string | null;
}

export interface Season {
  id: string;
  club_id: string;
  name: string; // e.g. "2026/27"
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Team {
  id: string;
  club_id: string;
  season_id: string;
  name: string;
  category: string | null;
  gender: "male" | "female" | "mixed" | null;
  color: string | null;
}

// ============================================================
// PLAYERS
// ============================================================

export type PlayerStatus = "green" | "yellow" | "red";
export type AvailabilityStatus = "available" | "control" | "not_available";
export type DominantFoot = "right" | "left" | "both";

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  green: "Óptimo",
  yellow: "Control",
  red: "Vigilar",
};

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: "Disponible",
  control: "Con control",
  not_available: "No disponible",
};

export interface Player {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  dominant_foot: DominantFoot | null;
  height_cm: number | null;
  weight_kg: number | null;
  avatar_url: string | null;
  anonymized_id: string | null;
  data_sharing_consent: boolean;
  consent_date: string | null;
  physical_status: PlayerStatus;
  availability_status: AvailabilityStatus;
  availability_notes: string | null;
  adjective: string | null;
  created_at: string;
}

export interface PlayerTeamMembership {
  id: string;
  player_id: string;
  team_id: string;
  season_id: string;
  jersey_number: number | null;
  positions: PositionKey[];
  status: "active" | "loaned" | "transferred" | "inactive";
  joined_date: string;
  left_date: string | null;
  player_type?: "main" | "reserve" | "youth" | "other";
  player_type_label?: string | null;
  kicker_roles?: string[];
}

// ============================================================
// POSITIONS
// ============================================================

export type PositionKey =
  | "goalkeeper"
  | "right_back"
  | "right_center_back"
  | "left_center_back"
  | "left_back"
  | "defensive_midfielder"
  | "playmaker_midfielder"
  | "attacking_midfielder"
  | "left_winger"
  | "right_winger"
  | "striker";

export const POSITION_LABELS: Record<PositionKey, string> = {
  goalkeeper: "Portero",
  right_back: "Lateral Derecho",
  right_center_back: "Central Derecho",
  left_center_back: "Central Izquierdo",
  left_back: "Lateral Izquierdo",
  defensive_midfielder: "Mediocentro Defensivo",
  playmaker_midfielder: "Mediocentro",
  attacking_midfielder: "Mediapunta",
  left_winger: "Extremo Izquierdo",
  right_winger: "Extremo Derecho",
  striker: "Delantero Centro",
};

// ============================================================
// PERFORMANCE
// ============================================================

export type PostFeeling = "very_good" | "good" | "loaded" | "very_loaded";
export type LoadLevel = "low" | "medium" | "medium_high" | "high" | "recovery";
export type AlertType =
  | "fatigue_high"
  | "limited_availability"
  | "localized_discomfort"
  | "new_discomfort"
  | "poor_session_tolerance"
  | "high_weekly_load"
  | "injury_history_risk";
export type SeverityLevel = "low" | "medium" | "high";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  fatigue_high: "Fatiga alta",
  limited_availability: "Disponibilidad limitada",
  localized_discomfort: "Molestia localizada",
  new_discomfort: "Nueva molestia",
  poor_session_tolerance: "Mala tolerancia a la sesión",
  high_weekly_load: "Carga semanal alta",
  injury_history_risk: "Riesgo por historial lesional",
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const LOAD_LEVEL_LABELS: Record<LoadLevel, string> = {
  low: "Baja",
  medium: "Media",
  medium_high: "Media-alta",
  high: "Alta",
  recovery: "Recuperación",
};

export interface WellnessEntry {
  id: string;
  player_id: string;
  team_id: string;
  date: string;
  sleep_quality: number; // 1-5
  fatigue: number; // 1-5
  mood: number; // 1-5
  muscle_soreness: number | null; // 1-5
  overall_score: number | null;
  localized_discomfort: string | null;
  notes: string | null;
  created_at: string;
}

export interface RPEEntry {
  id: string;
  player_id: string;
  session_id: string;
  rpe: number; // 1-10
  post_feeling: PostFeeling;
  new_discomfort: boolean;
  new_discomfort_detail: string | null;
  minutes_played: number | null;
  is_starter: boolean | null;
  comments: string | null;
  created_at: string;
}

// ============================================================
// SESSIONS & TRAINING
// ============================================================

export type SessionType = "training" | "individual" | "match";

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  training: "Entrenamiento Grupal",
  individual: "Entrenamiento Individual",
  match: "Partido",
};

export type MicrocycleDay =
  | "MD-4"
  | "MD-3"
  | "MD-2"
  | "MD-1"
  | "MD"
  | "MD+1"
  | "MD+2";

export interface TrainingSession {
  id: string;
  organization_id: string;
  team_id: string;
  season_id: string;
  created_by: string;
  title: string | null;
  date: string;
  duration_min: number | null;
  session_type: SessionType;
  microcycle_day: MicrocycleDay | null;
  planned_load: LoadLevel | null;
  planned_intensity: string | null;
  objectives: string[];
  notes: string | null;
  template_id: string | null;
  status: "planned" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface SessionAttendance {
  id: string;
  organization_id: string;
  session_id: string;
  player_id: string;
  status: "present" | "absent" | "injured" | "rest" | "other";
  notes: string | null;
  created_at: string;
}

export interface SessionExercise {
  id: string;
  organization_id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  duration_min: number;
  recovery_min: number;
  pitch_zones: string[];
  equipment: Array<{ name: string; quantity: number }>;
  group_setup: {
    groups?: Array<{ name: string; players: string[] }>;
  };
  created_at: string;
  exercise?: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string | null;
  };
}

export interface TemplateExercise {
  id: string;
  organization_id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  duration_min: number;
  recovery_min: number;
  pitch_zones: string[];
  equipment: Array<{ name: string; quantity: number }>;
  group_setup: {
    groups?: Array<{ name: string }>;
  };
  created_at: string;
  exercise?: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string | null;
  };
}

export interface SessionTemplate {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  duration_min: number | null;
  session_type: SessionType;
  objectives: string[];
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// INJURIES
// ============================================================

export type InjuryStatus = "active" | "readaptation" | "resolved";

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
  active: "Activa",
  readaptation: "Readaptación",
  resolved: "Resuelta",
};

export interface Injury {
  id: string;
  organization_id: string;
  player_id: string;
  team_id: string;
  injury_type: string;
  body_part: string;
  body_side: "left" | "right" | "central" | null;
  severity: SeverityLevel;
  status: InjuryStatus;
  occurred_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  mechanism: string | null;
  notes: string | null;
  // Sensitive — only visible to physio
  medical_notes: string | null;
  treatment_plan: string | null;
  created_by: string;
  created_at: string;
}

// ============================================================
// LICENSING
// ============================================================

export type PlanSlug = "free" | "coach_pro" | "performance" | "academy";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "manual";

export interface Plan {
  id: string;
  name: string;
  slug: PlanSlug;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
}

// ============================================================
// AUTH CONTEXT
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  organization_id: string;
  organization_slug: string;
  role: UserRole;
  team_id: string | null; // null = access to all teams in org
  plan_slug: PlanSlug;
  club_name?: string;
  club_logo_url?: string;
  club_primary_color?: string;
  club_secondary_color?: string;
}

// ============================================================
// PHYSICAL TESTS & TASKS
// ============================================================

export interface PhysicalTest {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  higher_is_better: boolean;
  reference_values: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface PhysicalTestResult {
  id: string;
  organization_id: string;
  player_id: string;
  test_id: string;
  team_id: string | null;
  date: string;
  value: number;
  percentile: number | null;
  notes: string | null;
  conducted_by: string | null;
  created_at: string;
  physical_tests?: PhysicalTest;
}

export interface PlayerTask {
  id: string;
  organization_id: string;
  player_id: string;
  exercise_id: string;
  status: "assigned" | "completed" | "skipped" | "cancelled";
  staff_comment: string | null;
  created_at: string;
  exercises?: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string | null;
  };
}

