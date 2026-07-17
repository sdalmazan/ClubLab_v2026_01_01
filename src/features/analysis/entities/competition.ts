import { EntityConfig } from "./index";

export const CompetitionConfig: EntityConfig = {
  type: "competition",
  label: "Competición",
  metrics: [
    "goalsPerMatch",
    "cardsPerMatch",
    "homeStrength",
    "awayStrength",
  ],
  filters: [
    "season",
    "competition",
    "match_date",
  ],
  charts: [
    { id: "goals_cards_line", label: "Goles vs Tarjetas por Jornada", type: "line" },
    { id: "strength_comparison", label: "Fortaleza Local vs Visitante", type: "bar" },
  ],
  rankings: [
    { id: "most_scoring_competition", label: "Competición con más Goles (Goles/Partido)", metricId: "goalsPerMatch" },
    { id: "cleanest_competition", label: "Liga con menos Tarjetas (Tarjetas/Partido)", metricId: "cardsPerMatch", order: "asc" },
  ],
  reports: [
    {
      id: "competition_wrap",
      label: "Resumen de Competición",
      sections: ["Estadísticas de la Liga", "Equipos Destacados", "Ranking Fair Play", "Récords y Tendencias"],
    },
  ],
};
