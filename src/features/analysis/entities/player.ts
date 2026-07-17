import { EntityConfig } from "./index";

export const PlayerConfig: EntityConfig = {
  type: "player",
  label: "Jugador",
  metrics: [
    "goals",
    "goals90",
    "minutes",
    "starts",
    "matches",
    "impact",
    "dependency",
    "yellowCards",
    "redCards",
    "cleanSheetRatio",
    "goalsConceded90",
    "revulsiveImpact",
    "concededGoalsRatio",
  ],
  filters: [
    "season",
    "competition",
    "team_name",
    "position",
    "minutes_on",
    "is_starter",
    "goals_scored",
    "yellow_cards",
    "red_cards",
    "team_result",
    "match_date",
  ],
  charts: [
    { id: "radar_pct", label: "Perfil de percentiles (Radar)", type: "radar" },
    { id: "goals_evolution", label: "Evolución goleadora", type: "line" },
    { id: "minutes_bar", label: "Reparto de minutos", type: "bar" },
  ],
  rankings: [
    { id: "top_scorers", label: "Máximos Goleadores", metricId: "goals" },
    { id: "highest_impact", label: "Mayor Impacto (+/-)", metricId: "impact" },
    { id: "most_penalized", label: "Más Amonestados (Tarjetas)", metricId: "yellowCards" },
  ],
  reports: [
    {
      id: "scouting",
      label: "Informe de Scouting Individual",
      sections: ["Resumen Ejecutivo", "Perfil de Rendimiento", "Evolución", "Comparativa"],
    },
    {
      id: "season_stats",
      label: "Resumen de Temporada",
      sections: ["Estadísticas Totales", "Historial de Partidos", "Tarjetas y Disciplina"],
    },
  ],
};
