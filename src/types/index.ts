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
  sporting_name: string | null;
  signing_status: "signed" | "close" | "difficult";
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

export function getPositionLabel(key: string): string {
  if (typeof window !== "undefined" && (window as any).cl_custom_positions) {
    const custom = (window as any).cl_custom_positions.find((p: any) => p.key === key);
    if (custom) return custom.label;
  }
  const broadPositions: Record<string, string> = {
    back: "Defensa",
    midfielder: "Centrocampista",
    winger: "Extremo",
  };
  if (broadPositions[key]) {
    return broadPositions[key];
  }
  return POSITION_LABELS[key as PositionKey] || key;
}

export function resolveCampogramaSlot(key: string): PositionKey {
  if (typeof window !== "undefined" && (window as any).cl_custom_positions) {
    const custom = (window as any).cl_custom_positions.find((p: any) => p.key === key);
    if (custom && custom.campogramaSlot) return custom.campogramaSlot as PositionKey;
  }
  return key as PositionKey;
}

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
  tactical_concepts?: string[];
  muscle_groups?: string[];
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
  library_scope?: "global" | "academy" | "coach" | null;
  microcycle_day?: "MD-4" | "MD-3" | "MD-2" | "MD-1" | "MD" | "MD+1" | "MD+2" | null;
  exercises?: any[];
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

export const NATIONALITIES = [
  { value: "Española", label: "Española" },
  { value: "Afgana", label: "Afgana" },
  { value: "Albana", label: "Albana" },
  { value: "Alemana", label: "Alemana" },
  { value: "Andorrana", label: "Andorrana" },
  { value: "Angoleña", label: "Angoleña" },
  { value: "Argelina", label: "Argelina" },
  { value: "Argentina", label: "Argentina" },
  { value: "Armenia", label: "Armenia" },
  { value: "Australiana", label: "Australiana" },
  { value: "Austríaca", label: "Austríaca" },
  { value: "Azerbaiyana", label: "Azerbaiyana" },
  { value: "Bahameña", label: "Bahameña" },
  { value: "Bangladesí", label: "Bangladesí" },
  { value: "Barbadense", label: "Barbadense" },
  { value: "Belga", label: "Belga" },
  { value: "Beliceña", label: "Beliceña" },
  { value: "Beninesa", label: "Beninesa" },
  { value: "Bielorrusa", label: "Bielorrusa" },
  { value: "Birmana", label: "Birmana" },
  { value: "Boliviana", label: "Boliviana" },
  { value: "Bosnia", label: "Bosnia" },
  { value: "Botsuana", label: "Botsuana" },
  { value: "Brasileña", label: "Brasileña" },
  { value: "Británica", label: "Británica" },
  { value: "Bruneana", label: "Bruneana" },
  { value: "Búlgara", label: "Búlgara" },
  { value: "Burkinesa", label: "Burkinesa" },
  { value: "Burundesa", label: "Burundesa" },
  { value: "Butanesa", label: "Butanesa" },
  { value: "Caboverdiana", label: "Caboverdiana" },
  { value: "Camboyana", label: "Camboyana" },
  { value: "Camerunesa", label: "Camerunesa" },
  { value: "Canadiense", label: "Canadiense" },
  { value: "Qatarí", label: "Qatarí" },
  { value: "Centroafricana", label: "Centroafricana" },
  { value: "Chadrí", label: "Chadrí" },
  { value: "Checa", label: "Checa" },
  { value: "Chilena", label: "Chilena" },
  { value: "China", label: "China" },
  { value: "Chipriota", label: "Chipriota" },
  { value: "Colombiana", label: "Colombiana" },
  { value: "Comorense", label: "Comorense" },
  { value: "Congoleña", label: "Congoleña" },
  { value: "Costarricense", label: "Costarricense" },
  { value: "Croata", label: "Croata" },
  { value: "Cubana", label: "Cubana" },
  { value: "Danesa", label: "Danesa" },
  { value: "Dominiquesa", label: "Dominiquesa" },
  { value: "Ecuatoriana", label: "Ecuatoriana" },
  { value: "Egipcia", label: "Egipcia" },
  { value: "Salvadoreña", label: "Salvadoreña" },
  { value: "Emiratí", label: "Emiratí" },
  { value: "Eslovaca", label: "Eslovaca" },
  { value: "Eslovena", label: "Eslovena" },
  { value: "Estadounidense", label: "Estadounidense" },
  { value: "Estonia", label: "Estonia" },
  { value: "Etíope", label: "Etíope" },
  { value: "Filipina", label: "Filipina" },
  { value: "Finlandesa", label: "Finlandesa" },
  { value: "Fiyiana", label: "Fiyiana" },
  { value: "Francesa", label: "Francesa" },
  { value: "Gabonesa", label: "Gabonesa" },
  { value: "Gambiana", label: "Gambiana" },
  { value: "Georgiana", label: "Georgiana" },
  { value: "Ghanesa", label: "Ghanesa" },
  { value: "Granadina", label: "Granadina" },
  { value: "Griega", label: "Griega" },
  { value: "Guatemalteca", label: "Guatemalteca" },
  { value: "Guineana", label: "Guineana" },
  { value: "Haitiana", label: "Haitiana" },
  { value: "Hondureña", label: "Hondureña" },
  { value: "Húngara", label: "Húngara" },
  { value: "India", label: "India" },
  { value: "Indonesia", label: "Indonesia" },
  { value: "Iraní", label: "Iraní" },
  { value: "Iraquí", label: "Iraquí" },
  { value: "Irlandesa", label: "Irlandesa" },
  { value: "Islandesa", label: "Islandesa" },
  { value: "Israelí", label: "Israelí" },
  { value: "Italiana", label: "Italiana" },
  { value: "Jamaicana", label: "Jamaicana" },
  { value: "Japonesa", label: "Japonesa" },
  { value: "Jordana", label: "Jordana" },
  { value: "Kazaja", label: "Kazaja" },
  { value: "Keniata", label: "Keniata" },
  { value: "Kirguís", label: "Kirguís" },
  { value: "Kuwaití", label: "Kuwaití" },
  { value: "Laosiana", label: "Laosiana" },
  { value: "Lesotense", label: "Lesotense" },
  { value: "Letona", label: "Letona" },
  { value: "Libanesa", label: "Libanesa" },
  { value: "Liberiana", label: "Liberiana" },
  { value: "Libia", label: "Libia" },
  { value: "Liechtensteiniana", label: "Liechtensteiniana" },
  { value: "Lituana", label: "Lituana" },
  { value: "Luxemburguesa", label: "Luxemburguesa" },
  { value: "Macedonia", label: "Macedonia" },
  { value: "Madagascurense", label: "Madagascurense" },
  { value: "Malasia", label: "Malasia" },
  { value: "Malauí", label: "Malauí" },
  { value: "Maldiva", label: "Maldiva" },
  { value: "Maliense", label: "Maliense" },
  { value: "Maltesa", label: "Maltesa" },
  { value: "Marroquí", label: "Marroquí" },
  { value: "Mauriciana", label: "Mauriciana" },
  { value: "Mauritana", label: "Mauritana" },
  { value: "Mexicana", label: "Mexicana" },
  { value: "Micronesia", label: "Micronesia" },
  { value: "Moldava", label: "Moldava" },
  { value: "Monegasca", label: "Monegasca" },
  { value: "Mongola", label: "Mongola" },
  { value: "Montenegrina", label: "Montenegrina" },
  { value: "Mozambiqueña", label: "Mozambiqueña" },
  { value: "Namibia", label: "Namibia" },
  { value: "Nauruana", label: "Nauruana" },
  { value: "Nepalesa", label: "Nepalesa" },
  { value: "Nicaragüense", label: "Nicaragüense" },
  { value: "Nígerina", label: "Nígerina" },
  { value: "Nigeriana", label: "Nigeriana" },
  { value: "Noruega", label: "Noruega" },
  { value: "Neozelandesa", label: "Neozelandesa" },
  { value: "Omaní", label: "Omaní" },
  { value: "Neerlandesa", label: "Neerlandesa" },
  { value: "Pakistaní", label: "Pakistaní" },
  { value: "Palauana", label: "Palauana" },
  { value: "Panameña", label: "Panameña" },
  { value: "Paraguaya", label: "Paraguaya" },
  { value: "Peruana", label: "Peruana" },
  { value: "Polaca", label: "Polaca" },
  { value: "Portuguesa", label: "Portuguesa" },
  { value: "Ruandesa", label: "Ruandesa" },
  { value: "Rumana", label: "Rumana" },
  { value: "Rusa", label: "Rusa" },
  { value: "Samoana", label: "Samoana" },
  { value: "Sanmarinense", label: "Sanmarinense" },
  { value: "Saudi", label: "Saudi" },
  { value: "Senegalesa", label: "Senegalesa" },
  { value: "Serbia", label: "Serbia" },
  { value: "Seychellense", label: "Seychellense" },
  { value: "Singapurense", label: "Singapurense" },
  { value: "Siria", label: "Siria" },
  { value: "Somalí", label: "Somalí" },
  { value: "Sri Lanqués", label: "Sri Lanqués" },
  { value: "Suazi", label: "Suazi" },
  { value: "Sudafricana", label: "Sudafricana" },
  { value: "Sudanesa", label: "Sudanesa" },
  { value: "Sueca", label: "Sueca" },
  { value: "Suiza", label: "Suiza" },
  { value: "Surinamesa", label: "Surinamesa" },
  { value: "Tailandesa", label: "Tailandesa" },
  { value: "Tanzana", label: "Tanzana" },
  { value: "Tayika", label: "Tayika" },
  { value: "Togolesa", label: "Togolesa" },
  { value: "Tongana", label: "Tongana" },
  { value: "Tunecina", label: "Tunecina" },
  { value: "Turca", label: "Turca" },
  { value: "Ucraniana", label: "Ucraniana" },
  { value: "Ugandesa", label: "Ugandesa" },
  { value: "Uruguaya", label: "Uruguaya" },
  { value: "Uzbeka", label: "Uzbeka" },
  { value: "Vanuatuense", label: "Vanuatuense" },
  { value: "Venezolana", label: "Venezolana" },
  { value: "Vietnamita", label: "Vietnamita" },
  { value: "Yibutiana", label: "Yibutiana" },
  { value: "Zambiana", label: "Zambiana" },
  { value: "Zimbabuense", label: "Zimbabuense" }
];

export const NATIONALITY_TO_COUNTRY_CODE: Record<string, string> = {
  "Española": "es",
  "Afgana": "af",
  "Albana": "al",
  "Alemana": "de",
  "Andorrana": "ad",
  "Angoleña": "ao",
  "Argelina": "dz",
  "Argentina": "ar",
  "Armenia": "am",
  "Australiana": "au",
  "Austríaca": "at",
  "Azerbaiyana": "az",
  "Bahameña": "bs",
  "Bangladesí": "bd",
  "Barbadense": "bb",
  "Belga": "be",
  "Beliceña": "bz",
  "Beninesa": "bj",
  "Bielorrusa": "by",
  "Birmana": "mm",
  "Boliviana": "bo",
  "Bosnia": "ba",
  "Botsuana": "bw",
  "Brasileña": "br",
  "Británica": "gb",
  "Bruneana": "bn",
  "Búlgara": "bg",
  "Burkinesa": "bf",
  "Burundesa": "bi",
  "Butanesa": "bt",
  "Caboverdiana": "cv",
  "Camboyana": "kh",
  "Camerunesa": "cm",
  "Canadiense": "ca",
  "Qatarí": "qa",
  "Centroafricana": "cf",
  "Chadrí": "td",
  "Checa": "cz",
  "Chilena": "cl",
  "China": "cn",
  "Chipriota": "cy",
  "Colombiana": "co",
  "Comorense": "km",
  "Congoleña": "cg",
  "Costarricense": "cr",
  "Croata": "hr",
  "Cubana": "cu",
  "Danesa": "dk",
  "Dominiquesa": "dm",
  "Ecuatoriana": "ec",
  "Egipcia": "eg",
  "Salvadoreña": "sv",
  "Emiratí": "ae",
  "Eslovaca": "sk",
  "Eslovena": "si",
  "Estadounidense": "us",
  "Estonia": "ee",
  "Etíope": "et",
  "Filipina": "ph",
  "Finlandesa": "fi",
  "Fiyiana": "fj",
  "Francesa": "fr",
  "Gabonesa": "ga",
  "Gambiana": "gm",
  "Georgiana": "ge",
  "Ghanesa": "gh",
  "Granadina": "gd",
  "Griega": "gr",
  "Guatemalteca": "gt",
  "Guineana": "gn",
  "Haitiana": "ht",
  "Hondureña": "hn",
  "Húngara": "hu",
  "India": "in",
  "Indonesia": "id",
  "Iraní": "ir",
  "Iraquí": "iq",
  "Irlandesa": "ie",
  "Islandesa": "is",
  "Israelí": "il",
  "Italiana": "it",
  "Jamaicana": "jm",
  "Japonesa": "jp",
  "Jordana": "jo",
  "Kazaja": "kz",
  "Keniata": "ke",
  "Kirguís": "kg",
  "Kuwaití": "kw",
  "Laosiana": "la",
  "Lesotense": "ls",
  "Letona": "lv",
  "Libanesa": "lb",
  "Liberiana": "lr",
  "Libia": "ly",
  "Liechtensteiniana": "li",
  "Lituana": "lt",
  "Luxemburguesa": "lu",
  "Macedonia": "mk",
  "Madagascurense": "mg",
  "Malasia": "my",
  "Malauí": "mw",
  "Maldiva": "mv",
  "Maliense": "ml",
  "Maltesa": "mt",
  "Marroquí": "ma",
  "Mauriciana": "mu",
  "Mauritana": "mr",
  "Mexicana": "mx",
  "Micronesia": "fm",
  "Moldava": "md",
  "Monegasca": "mc",
  "Mongola": "mn",
  "Montenegrina": "me",
  "Mozambiqueña": "mz",
  "Namibia": "na",
  "Nauruana": "nr",
  "Nepalesa": "np",
  "Nicaragüense": "ni",
  "Nígerina": "ne",
  "Nigeriana": "ng",
  "Noruega": "no",
  "Neozelandesa": "nz",
  "Omaní": "om",
  "Neerlandesa": "nl",
  "Pakistaní": "pk",
  "Palauana": "pw",
  "Panameña": "pa",
  "Paraguaya": "py",
  "Peruana": "pe",
  "Polaca": "pl",
  "Portuguesa": "pt",
  "Ruandesa": "rw",
  "Rumana": "ro",
  "Rusa": "ru",
  "Samoana": "ws",
  "Sanmarinense": "sm",
  "Saudi": "sa",
  "Senegalesa": "sn",
  "Serbia": "rs",
  "Seychellense": "sc",
  "Singapurense": "sg",
  "Siria": "sy",
  "Somalí": "so",
  "Sri Lanqués": "lk",
  "Suazi": "sz",
  "Sudafricana": "za",
  "Sudanesa": "sd",
  "Sueca": "se",
  "Suiza": "ch",
  "Surinamesa": "sr",
  "Tailandesa": "th",
  "Tanzana": "tz",
  "Tayika": "tj",
  "Togolesa": "tg",
  "Tongana": "to",
  "Tunecina": "tn",
  "Turca": "tr",
  "Ucraniana": "ua",
  "Ugandesa": "ug",
  "Uruguaya": "uy",
  "Uzbeka": "uz",
  "Vanuatuense": "vu",
  "Venezolana": "ve",
  "Vietnamita": "vn",
  "Yibutiana": "dj",
  "Zambiana": "zm",
  "Zimbabuense": "zw"
};

