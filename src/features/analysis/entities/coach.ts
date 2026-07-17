import { EntityConfig } from "./index";

export const CoachConfig: EntityConfig = {
  type: "coach",
  label: "Entrenador",
  metrics: [
    "rotationIndex",
    "benchUsage",
    "reactionTime",
    "winRate",
  ],
  filters: [
    "season",
    "competition",
    "team_name",
    "match_date",
  ],
  charts: [
    { id: "radar_coaching", label: "Perfil del Entrenador (Radar)", type: "radar" },
    { id: "win_rate_history", label: "Evolución Histórica de Victorias", type: "line" },
  ],
  rankings: [
    { id: "highest_win_rate", label: "Mayor Porcentaje de Victorias", metricId: "winRate" },
    { id: "highest_rotator", label: "Mayor Índice de Rotación (IRC)", metricId: "rotationIndex" },
    { id: "fastest_reaction", label: "Reacción más Rápida (Primer Cambio)", metricId: "reactionTime", order: "asc" },
  ],
  reports: [
    {
      id: "coach_profile",
      label: "Perfil Táctico del Entrenador",
      sections: ["Trayectoria y Rendimiento", "Gestión de Plantilla", "Tiempos de Cambio y Revulsivos"],
    },
  ],
};
