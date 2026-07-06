import type { CompetitionConfig } from "./types";

/**
 * Configuración de temporadas de la RFCYLF.
 *
 * Los códigos CodCompeticion, CodGrupo y CodTemporada son los identificadores
 * internos que usa el portal web rfcylf.es en sus URLs de jornada/partido.
 *
 * Para añadir una nueva temporada:
 * 1. Entra en rfcylf.es, navega a Tercera Federación → Grupo 8 → jornada 1
 * 2. Copia los parámetros de la URL: CodCompeticion, CodGrupo, CodTemporada
 * 3. Añade la entrada aquí.
 */

export const DEFAULT_COMPETITION_NAME = "Tercera Federación - Grupo 8";
export const DEFAULT_REGION = "Castilla y León";

export const SEASON_CONFIGS: Record<
  string,
  Omit<CompetitionConfig, "season" | "competitionName">
> = {
  // ── Tercera Federación (desde 2021/2022) ──────────────────
  "2025/2026": { competicion: "22911126", grupo: "22911127", temporada: "21", region: DEFAULT_REGION },
  "2024/2025": { competicion: "11379751", grupo: "11379752", temporada: "20", region: DEFAULT_REGION },
  "2023/2024": { competicion: "10088896", grupo: "10088897", temporada: "19", region: DEFAULT_REGION },
  "2022/2023": { competicion: "11386",    grupo: "43749",    temporada: "18", region: DEFAULT_REGION },
  "2021/2022": { competicion: "10239",    grupo: "36978",    temporada: "17", region: DEFAULT_REGION },
  // ── Tercera División (antes de la reestructuración de 2021) ─
  "2020/2021": { competicion: "9551",     grupo: "34376",    temporada: "16", region: DEFAULT_REGION },
  "2019/2020": { competicion: "7723",     grupo: "25626",    temporada: "15", region: DEFAULT_REGION },
  "2018/2019": { competicion: "6958",     grupo: "22836",    temporada: "14", region: DEFAULT_REGION },
  "2017/2018": { competicion: "5163",     grupo: "16846",    temporada: "13", region: DEFAULT_REGION },
  "2016/2017": { competicion: "3446",     grupo: "11497",    temporada: "12", region: DEFAULT_REGION },
  "2015/2016": { competicion: "2252",     grupo: "8375",     temporada: "11", region: DEFAULT_REGION },
};

export function getSeasonConfig(season: string): CompetitionConfig | null {
  const codes = SEASON_CONFIGS[season];
  if (!codes) return null;
  return {
    season,
    competitionName: DEFAULT_COMPETITION_NAME,
    ...codes,
  };
}

/** Todas las temporadas configuradas, en orden cronológico descendente */
export function getAllConfiguredSeasons(): string[] {
  return Object.keys(SEASON_CONFIGS).sort().reverse();
}
