/**
 * ClubLab v2026.01.02 — Analysis Framework Types
 * Core type-safe contracts for filters, metrics, comparisons, and entities.
 */

export type EntityType = "player" | "team" | "coach" | "competition";

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "in"
  | "between"
  | "ieq";

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: any; // Can be string, number, boolean, array, or [min, max]
}

export interface FilterGroup {
  condition: "AND" | "OR";
  rules: (FilterRule | FilterGroup)[];
}

export type MetricCategory =
  | "attack"
  | "defense"
  | "discipline"
  | "dynamics"
  | "coach"
  | "squad"
  | "scouting"
  | "history"
  | "ranking"
  | "general";

// ============================================================
// METRIC INPUT TYPES — typed inputs for each entity's compute functions
// ============================================================

/** Data row from stat_player_match_influence — input for player metrics */
export interface PlayerInfluenceRecord {
  player_name: string;
  main_db_player_id?: string | null;
  team_name: string;
  season: string;
  match_date?: string | null;
  is_starter: boolean;
  minutes_on: number;
  substituted_in_min: number;
  substituted_out_min: number;
  goals_scored: number;
  own_goals: number;
  penalties_scored: number;
  yellow_cards: number;
  red_cards: number;
  goals_for_while_on: number;
  goals_against_while_on: number;
  goal_diff_while_on: number;
  goals_for_while_off: number;
  goals_against_while_off: number;
  team_result: 'win' | 'draw' | 'loss';
  team_goals_scored: number;
  team_goals_conceded: number;
  // allow extra fields from DB without breaking
  [key: string]: unknown;
}

/** Normalized team perspective on a match — input for team metrics */
export interface TeamMatchRecord {
  id?: string;
  season: string;
  competition?: string;
  match_date?: string | null;
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  // perspective fields (added by ExplorerEngine)
  is_home: boolean;
  goals_for: number;
  goals_against: number;
  result: 'win' | 'draw' | 'loss';
  // allow extra fields
  [key: string]: unknown;
}

/** Pre-computed stats object passed to coach metric compute functions */
export interface CoachStatsRecord {
  matchesPlayed: number;
  wins: number;
  reactionWindow: number; // avg minute of first substitution
  benchUsage: number;     // avg substitutions per match
  irc: number;            // índice de rotación de once (Índice de Rotación del Cuerpo técnico)
  [key: string]: unknown;
}

/** Competition-level input: matches array + events array */
export interface CompetitionDataRecord {
  matches: Array<{
    id?: string;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    season: string;
    competition?: string;
    [key: string]: unknown;
  }>;
  events: Array<{
    match_id: string;
    event_type: string;
    team_name: string;
    player_name: string;
    minute: number;
    [key: string]: unknown;
  }>;
}

/** Convenience union: any valid metric input */
export type AnyMetricInput =
  | PlayerInfluenceRecord[]
  | TeamMatchRecord[]
  | CoachStatsRecord
  | CompetitionDataRecord
  | any; // fallback for legacy metrics

// ============================================================
// METRIC DEFINITION
// ============================================================

export interface MetricDefinition<T = any> {
  id: string;
  name: string;
  description: string;
  entityType: EntityType;
  category: MetricCategory;
  unit?: string;
  aggregation?: "sum" | "avg" | "custom";
  formatType: "number" | "percentage" | "rate" | "duration" | "text";
  precision?: number;
  chartType?: "radar" | "bar" | "line" | "none";
  isComparable: boolean;
  isTrendable: boolean;
  requiresManualData?: boolean;
  requiresPosition?: boolean;
  /**
   * Metric IDs that must be computed before this one.
   * Used by the engine to resolve computation order for derived metrics.
   * Leave undefined for independent metrics (the vast majority).
   */
  dependsOn?: string[];
  compute: (data: T, context?: Record<string, any>) => number | string;
  formatter?: (value: number | string) => string;
}

// Typed convenience aliases for registering metrics by entity
export type PlayerMetricDefinition = MetricDefinition<PlayerInfluenceRecord[]>;
export type TeamMetricDefinition = MetricDefinition<TeamMatchRecord[]>;
export type CoachMetricDefinition = MetricDefinition<CoachStatsRecord>;
export type CompetitionMetricDefinition = MetricDefinition<CompetitionDataRecord>;

export interface SavedView {
  id?: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string;
  icon?: string;
  entityType: EntityType;
  filters: FilterGroup;
  metrics: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isFavorite: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserDataConsent {
  id?: string;
  userId: string;
  consentType: string;
  version: string;
  accepted: boolean;
  acceptedAt?: string;
  withdrawnAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExplorerQuery {
  entityType: EntityType;
  filters: FilterGroup;
  metrics: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  organizationId?: string;
}

export interface ExplorerRow {
  id: string;
  name: string;
  entityType: EntityType;
  details: Record<string, any>; // position, jersey number, current team, etc.
  metrics: Record<string, number | string>;
}

export interface ExplorerResult {
  entityType: EntityType;
  rows: ExplorerRow[];
  totalCount: number;
  averages: Record<string, number>;
}

export interface ComparisonResult {
  entityType: EntityType;
  entities: {
    id: string;
    name: string;
    metrics: Record<string, number | string>;
  }[];
  metrics: {
    id: string;
    name: string;
    formatType: string;
    bestValue?: number | string;
  }[];
  averages: Record<string, number>;
}

export interface TrendPoint {
  period: string; // e.g. "Jornada 1", "2025/2026", "2026-07-16"
  metrics: Record<string, number | string>;
}

export interface TrendResult {
  entityId: string;
  entityType: EntityType;
  points: TrendPoint[];
  metricIds: string[];
}

export interface ReportWidget {
  id: string;
  type: "kpi" | "table" | "chart" | "comparison" | "text";
  title: string;
  width: "full" | "half";
  config: {
    entityType: EntityType;
    entityIds?: string[];
    metrics?: string[];
    filters?: FilterGroup;
    chartType?: "radar" | "bar" | "line";
  };
}

export interface ReportSection {
  id: string;
  title: string;
  widgets: ReportWidget[];
}

export interface ReportConfig {
  title: string;
  description?: string;
  sections: ReportSection[];
}

export interface EntityInsight {
  id: string;
  priority: "high" | "medium" | "low";
  category: string;
  summary: string;
  details: string;
  relatedMetrics: string[];
  promptTemplate?: string;
}
