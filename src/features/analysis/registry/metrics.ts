import { MetricDefinition, EntityType, MetricCategory } from "../types";

/**
 * MetricRegistry — Central source of truth for all metric calculations.
 * Avoids hardcoding calculations in UI files. Every metric exposes metadata,
 * formatting, and a compute function that operates on raw data records.
 */
export class MetricRegistry {
  private static metrics = new Map<string, MetricDefinition>();

  /**
   * Register a new metric definition
   */
  static register(definition: MetricDefinition) {
    this.metrics.set(definition.id, definition);
  }

  /**
   * Get a registered metric definition by ID
   */
  static get(id: string): MetricDefinition | undefined {
    return this.metrics.get(id);
  }

  /**
   * List all metrics, optionally filtered by Entity Type
   */
  static list(entityType?: EntityType): MetricDefinition[] {
    const list = Array.from(this.metrics.values());
    if (entityType) {
      return list.filter((m) => m.entityType === entityType);
    }
    return list;
  }

  /**
   * List metrics by Category and Entity Type
   */
  static listByCategory(category: MetricCategory, entityType?: EntityType): MetricDefinition[] {
    return this.list(entityType).filter((m) => m.category === category);
  }
}

// ============================================================
// PLAYER METRICS (Compute takes an array of stat_player_match_influence rows)
// ============================================================

MetricRegistry.register({
  id: "goals",
  name: "Goles",
  description: "Total de goles marcados (incluye penaltis, excluye propia puerta)",
  entityType: "player",
  category: "attack",
  formatType: "number",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.reduce((sum, r) => sum + (r.goals_scored || 0), 0);
  },
});

MetricRegistry.register({
  id: "goals90",
  name: "Goles por 90'",
  description: "Frecuencia goleadora media por cada 90 minutos de juego",
  entityType: "player",
  category: "attack",
  formatType: "rate",
  precision: 2,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const mins = records.reduce((sum, r) => sum + (r.minutes_on || 0), 0);
    const goals = records.reduce((sum, r) => sum + (r.goals_scored || 0), 0);
    if (mins === 0) return 0;
    return parseFloat(((goals / mins) * 90).toFixed(2));
  },
});

MetricRegistry.register({
  id: "minutes",
  name: "Minutos",
  description: "Minutos acumulados jugados en campo",
  entityType: "player",
  category: "general",
  unit: "min",
  formatType: "duration",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.reduce((sum, r) => sum + (r.minutes_on || 0), 0);
  },
});

MetricRegistry.register({
  id: "starts",
  name: "Titularidades",
  description: "Número de partidos jugados como titular",
  entityType: "player",
  category: "general",
  formatType: "number",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.filter((r) => r.is_starter).length;
  },
});

MetricRegistry.register({
  id: "matches",
  name: "Partidos",
  description: "Partidos jugados",
  entityType: "player",
  category: "general",
  formatType: "number",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.length;
  },
});

MetricRegistry.register({
  id: "impact",
  name: "Índice de Impacto (+/-)",
  description: "Diferencia neta de goles de su equipo mientras el jugador estuvo en el terreno de juego",
  entityType: "player",
  category: "dynamics",
  formatType: "number",
  precision: 0,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.reduce((sum, r) => sum + (r.goal_diff_while_on || 0), 0);
  },
});

MetricRegistry.register({
  id: "dependency",
  name: "Dependencia de Gol",
  description: "Porcentaje de los goles de su equipo anotados por este jugador",
  entityType: "player",
  category: "scouting",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const teamGoals = records.reduce((sum, r) => sum + (r.team_goals_scored || 0), 0);
    const goals = records.reduce((sum, r) => sum + (r.goals_scored || 0), 0);
    if (teamGoals === 0) return 0;
    return parseFloat(((goals / teamGoals) * 100).toFixed(1));
  },
});

MetricRegistry.register({
  id: "yellowCards",
  name: "Amarillas",
  description: "Tarjetas amarillas recibidas",
  entityType: "player",
  category: "discipline",
  formatType: "number",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.reduce((sum, r) => sum + (r.yellow_cards || 0), 0);
  },
});

MetricRegistry.register({
  id: "redCards",
  name: "Rojas",
  description: "Tarjetas rojas recibidas (directas y doble amarilla)",
  entityType: "player",
  category: "discipline",
  formatType: "number",
  precision: 0,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    return records.reduce((sum, r) => sum + (r.red_cards || 0), 0);
  },
});

MetricRegistry.register({
  id: "cleanSheetRatio",
  name: "Ratio Portería a Cero",
  description: "Porcentaje de minutos jugados en los que el equipo no encajó ningún gol",
  entityType: "player",
  category: "defense",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const mins = records.reduce((sum, r) => sum + (r.minutes_on || 0), 0);
    const csMins = records.reduce((sum, r) => sum + ((r.team_goals_conceded || 0) === 0 ? (r.minutes_on || 0) : 0), 0);
    if (mins === 0) return 0;
    return parseFloat(((csMins / mins) * 100).toFixed(1));
  },
});

MetricRegistry.register({
  id: "goalsConceded90",
  name: "Goles Encajados / 90'",
  description: "Promedio de goles encajados por el equipo por cada 90 minutos del jugador en campo",
  entityType: "player",
  category: "defense",
  formatType: "rate",
  precision: 2,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const mins = records.reduce((sum, r) => sum + (r.minutes_on || 0), 0);
    const conceded = records.reduce((sum, r) => sum + (r.goals_against_while_on || 0), 0);
    if (mins === 0) return 0;
    return parseFloat(((conceded / mins) * 90).toFixed(2));
  },
});

MetricRegistry.register({
  id: "revulsiveImpact",
  name: "Impacto Revulsivo (+/-)",
  description: "Promedio de la diferencia neta de goles del equipo mientras el jugador estuvo en el campo cuando entró desde el banquillo",
  entityType: "player",
  category: "dynamics",
  formatType: "number",
  precision: 2,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const subs = records.filter((r) => !r.is_starter && r.minutes_on > 0);
    if (subs.length === 0) return 0;
    const sum = subs.reduce((acc, r) => acc + ((r.goals_for_while_on || 0) - (r.goals_against_while_on || 0)), 0);
    return parseFloat((sum / subs.length).toFixed(2));
  },
});

MetricRegistry.register({
  id: "concededGoalsRatio",
  name: "% Goles Encajados",
  description: "Porcentaje de los goles encajados totales del equipo que ocurrieron mientras el jugador estaba en cancha",
  entityType: "player",
  category: "defense",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (records: any[]) => {
    const teamConceded = records.reduce((sum, r) => sum + (r.team_goals_conceded || 0), 0);
    const playerOnConceded = records.reduce((sum, r) => sum + (r.goals_against_while_on || 0), 0);
    if (teamConceded === 0) return 0;
    return parseFloat(((playerOnConceded / teamConceded) * 100).toFixed(1));
  },
});

// ============================================================
// COACH METRICS (Compute takes an object containing coach stats / match reviews)
// ============================================================

MetricRegistry.register({
  id: "rotationIndex",
  name: "Índice de Rotación (IRC)",
  description: "Promedio de cambios en el once titular respecto a la jornada anterior",
  entityType: "coach",
  category: "coach",
  formatType: "number",
  precision: 2,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (coachStats: any) => {
    return coachStats.irc ?? 0;
  },
});

MetricRegistry.register({
  id: "benchUsage",
  name: "Uso del Banquillo",
  description: "Promedio de sustituciones realizadas por partido",
  entityType: "coach",
  category: "coach",
  unit: "cambios",
  formatType: "rate",
  precision: 1,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (coachStats: any) => {
    return coachStats.benchUsage ?? 0;
  },
});

MetricRegistry.register({
  id: "reactionTime",
  name: "Minuto de Reacción",
  description: "Minuto de partido promedio en el que el entrenador realiza su primer cambio",
  entityType: "coach",
  category: "coach",
  unit: "'",
  formatType: "number",
  precision: 0,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (coachStats: any) => {
    return coachStats.reactionWindow ?? 0;
  },
});

MetricRegistry.register({
  id: "winRate",
  name: "Porcentaje de Victorias",
  description: "Porcentaje de partidos oficiales ganados",
  entityType: "coach",
  category: "general",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (coachStats: any) => {
    const matches = coachStats.matchesPlayed || 0;
    if (matches === 0) return 0;
    return parseFloat(((coachStats.wins / matches) * 100).toFixed(1));
  },
});

// ============================================================
// TEAM METRICS (Compute takes an array of team match results)
// ============================================================

MetricRegistry.register({
  id: "attackIndex",
  name: "Índice Ofensivo",
  description: "Promedio de goles marcados por partido",
  entityType: "team",
  category: "attack",
  formatType: "rate",
  precision: 2,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (matches: any[]) => {
    if (matches.length === 0) return 0;
    const goals = matches.reduce((sum, m) => sum + (m.goals_for || 0), 0);
    return parseFloat((goals / matches.length).toFixed(2));
  },
});

MetricRegistry.register({
  id: "defenseIndex",
  name: "Índice Defensivo",
  description: "Promedio de goles encajados por partido",
  entityType: "team",
  category: "defense",
  formatType: "rate",
  precision: 2,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (matches: any[]) => {
    if (matches.length === 0) return 0;
    const goals = matches.reduce((sum, m) => sum + (m.goals_against || 0), 0);
    return parseFloat((goals / matches.length).toFixed(2));
  },
});

MetricRegistry.register({
  id: "resilience",
  name: "Resiliencia Ofensiva",
  description: "Porcentaje de puntos sumados después de encajar el primer gol del partido",
  entityType: "team",
  category: "dynamics",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "radar",
  isComparable: true,
  isTrendable: true,
  compute: (teamStats: any) => {
    // teamStats can be either raw array of matches or precomputed statistics object
    if (Array.isArray(teamStats)) {
      // In-memory calculation from matches
      let gamesConcededFirst = 0;
      let pointsWonConcededFirst = 0;
      
      for (const m of teamStats) {
        if (m.conceded_first) {
          gamesConcededFirst++;
          pointsWonConcededFirst += m.result === "win" ? 3 : m.result === "draw" ? 1 : 0;
        }
      }
      if (gamesConcededFirst === 0) return 0;
      return parseFloat(((pointsWonConcededFirst / (gamesConcededFirst * 3)) * 100).toFixed(1));
    }
    return teamStats.resilienceIndex ?? 0;
  },
});

MetricRegistry.register({
  id: "chaosIndex",
  name: "Índice de Caos Tardío",
  description: "Nivel de agitación y volumen de incidencias (goles, tarjetas, cambios) en el tramo final del partido (minutos 75+)",
  entityType: "team",
  category: "dynamics",
  formatType: "number",
  precision: 1,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (teamStats: any) => {
    if (Array.isArray(teamStats)) {
      if (teamStats.length === 0) return 0;
      const sum = teamStats.reduce((acc, m) => acc + (m.chaosIndex || 0), 0);
      return parseFloat((sum / teamStats.length).toFixed(1));
    }
    // If it's a pre-calculated index from events
    if (teamStats.chaosIndex !== undefined) return teamStats.chaosIndex;
    // Fallback: if we have dynamics events, we can extract the events after minute 75
    return teamStats.dynamics?.goalClusters?.scored[5] + teamStats.dynamics?.goalClusters?.conceded[5] || 0;
  },
});

// ============================================================
// COMPETITION METRICS (Compute takes all matches/events of a competition)
// ============================================================

MetricRegistry.register({
  id: "goalsPerMatch",
  name: "Goles por Partido",
  description: "Promedio de goles marcados por partido en toda la competición",
  entityType: "competition",
  category: "attack",
  formatType: "rate",
  precision: 2,
  chartType: "line",
  isComparable: true,
  isTrendable: true,
  compute: (matches: any[]) => {
    if (matches.length === 0) return 0;
    const totalGoals = matches.reduce((sum, m) => sum + (m.home_score || 0) + (m.away_score || 0), 0);
    return parseFloat((totalGoals / matches.length).toFixed(2));
  },
});

MetricRegistry.register({
  id: "cardsPerMatch",
  name: "Tarjetas por Partido",
  description: "Promedio de amonestaciones (tarjetas amarillas y rojas) mostradas por encuentro",
  entityType: "competition",
  category: "discipline",
  formatType: "rate",
  precision: 2,
  chartType: "line",
  isComparable: true,
  isTrendable: true,
  compute: (data: { matches: any[]; events: any[] }) => {
    const matchesCount = data.matches?.length || 1;
    const cardsCount = data.events?.filter((e) =>
      ["yellow_card", "red_card", "yellow_red_card"].includes(e.event_type)
    ).length || 0;
    return parseFloat((cardsCount / matchesCount).toFixed(2));
  },
});

MetricRegistry.register({
  id: "homeStrength",
  name: "Fortaleza Local",
  description: "Porcentaje de partidos ganados por el equipo que juega en casa",
  entityType: "competition",
  category: "history",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (matches: any[]) => {
    const played = matches.filter((m) => m.home_score !== null && m.away_score !== null).length;
    if (played === 0) return 0;
    const homeWins = matches.filter((m) => m.home_score > m.away_score).length;
    return parseFloat(((homeWins / played) * 100).toFixed(1));
  },
});

MetricRegistry.register({
  id: "awayStrength",
  name: "Fortaleza Visitante",
  description: "Porcentaje de puntos o victorias obtenidas por los equipos que juegan a domicilio",
  entityType: "competition",
  category: "history",
  unit: "%",
  formatType: "percentage",
  precision: 1,
  chartType: "bar",
  isComparable: true,
  isTrendable: true,
  compute: (matches: any[]) => {
    const played = matches.filter((m) => m.home_score !== null && m.away_score !== null).length;
    if (played === 0) return 0;
    const awayWins = matches.filter((m) => m.away_score > m.home_score).length;
    return parseFloat(((awayWins / played) * 100).toFixed(1));
  },
});
