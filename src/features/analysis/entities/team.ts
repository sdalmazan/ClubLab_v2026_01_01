import { EntityConfig } from "./index";

export const TeamConfig: EntityConfig = {
  type: "team",
  label: "Equipo",
  metrics: [
    "attackIndex",
    "defenseIndex",
    "resilience",
    "chaosIndex",
  ],
  filters: [
    "season",
    "competition",
    "is_home",
    "team_result",
    "match_date",
  ],
  charts: [
    { id: "radar_tactical", label: "Perfil Táctico (Radar)", type: "radar" },
    { id: "dynamics_clusters", label: "Goles a favor y en contra (Distribución por tiempo)", type: "bar" },
  ],
  rankings: [
    { id: "top_attacks", label: "Mejores Ataques (Goles/Partido)", metricId: "attackIndex" },
    { id: "top_defenses", label: "Mejores Defensas (Menos Goles Encajados/Partido)", metricId: "defenseIndex", order: "asc" },
    { id: "highest_resilience", label: "Mayor Resiliencia (Remontadas)", metricId: "resilience" },
  ],
  reports: [
    {
      id: "match_prep",
      label: "Preparación de Partido (Rival)",
      sections: ["Resumen Ejecutivo", "Once Estable y Rotación", "Ataque y Dependencia", "Dinámicas y Caos", "Disciplina"],
    },
    {
      id: "season_review",
      label: "Balance de Temporada",
      sections: ["Rendimiento General", "Fortaleza Local/Visitante", "Evolución por Jornada"],
    },
  ],
};
