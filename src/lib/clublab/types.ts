export type PlayerStatus = "green" | "yellow" | "red";

export type AvailabilityStatus = "available" | "control" | "not_available";

export type PostFeeling = "very_good" | "good" | "loaded" | "very_loaded";

export type SeverityLevel = "low" | "medium" | "high";

export type LoadLevel = "low" | "medium" | "medium_high" | "high" | "recovery";

export type TaskCategory =
  | "strength"
  | "prevention"
  | "recovery"
  | "readaptation"
  | "activation"
  | "nutrition";

export type RecommendationStatus =
  | "suggested"
  | "approved"
  | "modified"
  | "rejected"
  | "completed";

export type AlertType =
  | "fatigue_high"
  | "limited_availability"
  | "localized_discomfort"
  | "new_discomfort"
  | "poor_session_tolerance"
  | "high_weekly_load"
  | "injury_history_risk";

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

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  strength: "Fuerza individual",
  prevention: "Prevención",
  recovery: "Recuperación / descanso",
  readaptation: "Readaptación",
  activation: "Activación",
  nutrition: "Nutrición",
};

export type PriorityLevel = "low" | "medium" | "high";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export type InjuryStatus = "active" | "readaptation" | "resolved";

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
  active: "Activa",
  readaptation: "Readaptación",
  resolved: "Resuelta",
};

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  suggested: "Sugerida",
  approved: "Aprobada",
  modified: "Modificada",
  rejected: "Rechazada",
  completed: "Completada",
};

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  green: "Óptimo",
  yellow: "Control",
  red: "Vigilar",
};

export type TaskStatus = "assigned" | "completed" | "skipped" | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  assigned: "Asignada",
  completed: "Completada",
  skipped: "Omitida",
  cancelled: "Cancelada",
};

export type TestType = {
  id: string;
  team_id: string | null;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type PerformanceTest = {
  id: string;
  player_id: string;
  test_type_id: string;
  test_date: string;
  result_value: number;
  unit: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  test_types?: TestType;
};

export type Session = {
  id: string;
  team_id: string | null;
  session_date: string;
  session_type: string;
  microcycle_day: string | null;
  planned_load: string | null;
  planned_duration_min: number | null;
  planned_intensity: string | null;
  actual_duration_min: number | null;
  actual_intensity: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  match_result?: string | null;
  match_score?: string | null;
};

export type PreSessionCheckin = {
  id: string;
  player_id: string;
  session_id: string | null;
  sleep_quality: number;
  fatigue: number;
  mood: number;
  localized_discomfort: string | null;
  comments?: string | null;
  availability: string;
  created_at: string;
};

export type PostSessionCheckout = {
  id: string;
  player_id: string;
  session_id: string;
  rpe: number;
  post_feeling: string;
  new_discomfort: boolean;
  new_discomfort_detail: string | null;
  comments: string | null;
  created_at: string;
  minutes_played?: number | null;
  is_starter?: boolean | null;
};

export interface ClipPlayerStat {
  player_id: string;
  stat_type: string;
  value: number;
}

export interface KeyframeData {
  time: number; // segundo en el vídeo
  x: number; // coordenada X normalizada (0.0 a 1.0)
  y: number; // coordenada Y normalizada (0.0 a 1.0)
}

export interface VideoAnnotation {
  id: string;
  type: "pencil" | "arrow" | "circle" | "spotlight" | "link" | "offside" | "text" | "header" | "sticker" | "magnifier" | "freeze";
  startTime: number; // segundo inicial
  duration: number; // duración en segundos
  color: string; // código hexadecimal
  points: { x: number; y: number }[]; // coordenadas normalizadas
  text?: string; // para textos y banners
  stickerType?: "ball" | "cone" | "card_yellow" | "card_red" | "shield"; // stickers predefinidos
  lineWidth?: number;
  fontSize?: number;
  size?: number; // radio de círculos, spotlights, etc.
  isTracking?: boolean; // si tiene seguimiento activo
  keyframes?: KeyframeData[]; // lista de posiciones clave en el tiempo
  aspect?: number; // relación de aspecto vertical/horizontal (para ovals/focos)
  feather?: number; // difuminado de bordes del foco (de 0 a 1)
  zoom?: number; // factor de escala para la lupa (magnifier)
  freezeDuration?: number; // duración de la congelación del frame en segundos
}

export interface ClipNotesOverlay {
  text: string;
  showInVideo: boolean;
  position: "bottom" | "top" | "left" | "right" | "center";
}

export interface ClipScoreboardOverlay {
  show: boolean;
  homeTeam?: string;
  awayTeam?: string;
  minute?: number;
  score?: string;
  matchDate?: string;
}

export interface VideoClip {
  id: string;
  title: string;
  start: number; // en segundos
  end: number; // en segundos
  comment: string;
  category?: string; // e.g. "Ataque", "Defensa", "Transición", "Balón Parado"
  categoryColor?: string; // Hex color for badge
  descriptors?: string[]; // e.g. ["Bien", "Mal"], ["Gol a favor"]
  tagged_players: string[]; // player_id
  stats: ClipPlayerStat[];
  annotations?: VideoAnnotation[]; // Anotaciones tácticas de vídeo
  videoUrl?: string;
  matchId?: string;
  matchTitle?: string;
  tacticalConcepts?: string[];
  isSavedInBank?: boolean;
  notesOverlay?: ClipNotesOverlay;
  playbackSpeed?: number; // 0.5, 0.75, 1, 1.25, 1.5, 2
  scoreboardOverlay?: ClipScoreboardOverlay;
}

export interface VideoItem {
  id: string;
  type: "own" | "rival";
  url: string;
  title: string;
  clips: VideoClip[];
  uploadStatus?: string;
  halves?: [number, number][];
  isFinalized?: boolean;
}

export interface VideoMontageItem {
  id: string;
  type: "clip" | "cover";
  clipId?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  bgColor?: string;
  bgImage?: string;
  textColor?: string;
  fontSize?: string;
  position?: "center" | "left" | "right" | "top" | "bottom";
  showBadge?: boolean;
  videoUrl?: string;
  start?: number;
  end?: number;
  playbackSpeed?: number;
  notesOverlay?: ClipNotesOverlay;
  showScoreboard?: boolean;
}

export interface VideoMontage {
  id: string;
  title: string;
  items: VideoMontageItem[];
  associatedRival?: string;
  createdAt: string;
}

export interface ActionTypeSetting {
  name: string;
  color: string;
}

export interface DescriptorSetting {
  name: string;
  isDefault?: boolean;
}

export interface VideoAnalysisSettings {
  actionTypes: ActionTypeSetting[];
  descriptors: DescriptorSetting[];
  defaultCutMode: "manual" | "auto_10s";
  exportSettings: {
    includeSound: boolean;
    resolution: "1080p" | "720p";
  };
}

export const DEFAULT_VIDEO_SETTINGS: VideoAnalysisSettings = {
  actionTypes: [
    { name: "Ataque", color: "#3b82f6" },
    { name: "Defensa", color: "#ef4444" },
    { name: "Transición Ofensiva", color: "#10b981" },
    { name: "Transición Defensiva", color: "#f59e0b" },
    { name: "Balón Parado", color: "#8b5cf6" },
    { name: "Presión", color: "#ec4899" },
    { name: "Salida de Balón", color: "#06b6d4" },
    { name: "Jugada relevante", color: "#6366f1" },
  ],
  descriptors: [
    { name: "Bien", isDefault: true },
    { name: "Mal", isDefault: true },
    { name: "Gol a favor", isDefault: true },
    { name: "Gol en contra", isDefault: true },
  ],
  defaultCutMode: "manual",
  exportSettings: {
    includeSound: true,
    resolution: "1080p",
  },
};

export interface SessionVideoData {
  general_notes: string;
  videos: VideoItem[];
  montages?: VideoMontage[];
  cut_bank?: VideoClip[];
  settings?: VideoAnalysisSettings;
}

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

export type NegotiationStatus =
  | "renewed"
  | "signed"
  | "almost_closed"
  | "doubtful"
  | "difficult";

export interface RosterPlan {
  id: string;
  season: string;
  player_id: string | null;
  known_name: string;
  birth_year: number | null;
  primary_position: PositionKey;
  secondary_position: PositionKey | null;
  tertiary_position: PositionKey | null;
  adjective: string | null;
  negotiation_status: NegotiationStatus;
  notes: string | null;
  position_order: number;
  created_at: string;
  updated_at: string;
  player?: {
    id: string;
    first_name: string;
    last_name: string;
    shirt_number: number | null;
    position: string | null;
  } | null;
}
