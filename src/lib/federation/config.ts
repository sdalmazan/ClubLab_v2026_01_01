import type { CompetitionConfig } from "./types";

/**
 * Configuración de temporadas de la RFCYLF.
 *
 * Los códigos CodCompeticion, CodGrupo y CodTemporada son los identificadores
 * internos que usa el portal web rfcylf.es en sus URLs de jornada/partido.
 */

export const DEFAULT_COMPETITION_NAME = "Tercera Federación - Grupo 8";
export const DEFAULT_REGION = "Castilla y León";

export const SEASON_CONFIGS: Record<
  string, // Season (e.g. "2025/2026")
  Record<
    string, // Competition Name
    Omit<CompetitionConfig, "season" | "competitionName">
  >
> = {
  "2026/2027": {
    "Tercera Federación - Grupo 8": { competicion: "24218932", grupo: "24218933", temporada: "22", region: DEFAULT_REGION },
  },
  "2025/2026": {
    "Tercera Federación - Grupo 8": { competicion: "22911126", grupo: "22911127", temporada: "21", region: DEFAULT_REGION },
    "1ª División Regional Aficionados - Grupo A": { competicion: "22911132", grupo: "22911133", temporada: "21", region: DEFAULT_REGION },
    "1ª División Regional Aficionados - Grupo B": { competicion: "22911132", grupo: "22911134", temporada: "21", region: DEFAULT_REGION },
    "Liga Nacional Juvenil": { competicion: "22911128", grupo: "22911129", temporada: "21", region: DEFAULT_REGION },
    "Juvenil Regional - Grupo A": { competicion: "22911154", grupo: "22911155", temporada: "21", region: DEFAULT_REGION },
    "Juvenil Regional - Grupo B": { competicion: "22911154", grupo: "22911156", temporada: "21", region: DEFAULT_REGION },
    "División de Honor - Grupo 1": { competicion: "23289323", grupo: "23289324", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160070" },
    "División de Honor - Grupo 2": { competicion: "23289323", grupo: "23289325", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160070" },
    "División de Honor - Grupo 3": { competicion: "23289323", grupo: "23289326", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160070" },
    "División de Honor - Grupo 4": { competicion: "23289323", grupo: "23289327", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160070" },
    "División de Honor - Grupo 5": { competicion: "23289323", grupo: "23289328", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160070" },
    "Segunda Federación - Grupo 1": { competicion: "23289298", grupo: "23289299", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 2": { competicion: "23289298", grupo: "23289300", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 3": { competicion: "23289298", grupo: "23289301", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 4": { competicion: "23289298", grupo: "23289302", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 5": { competicion: "23289298", grupo: "23289303", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 1": { competicion: "23289295", grupo: "23289296", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 2": { competicion: "23289295", grupo: "23289297", temporada: "21", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
  },
  "2024/2025": {
    "Tercera Federación - Grupo 8": { competicion: "11379751", grupo: "11379752", temporada: "20", region: DEFAULT_REGION },
    "1ª División Regional Aficionados - Grupo A": { competicion: "11379757", grupo: "11379758", temporada: "20", region: DEFAULT_REGION },
    "1ª División Regional Aficionados - Grupo B": { competicion: "11379757", grupo: "11379759", temporada: "20", region: DEFAULT_REGION },
    "Liga Nacional Juvenil": { competicion: "11379753", grupo: "11379754", temporada: "20", region: DEFAULT_REGION },
    "Primera Federación - Grupo 1": { competicion: "901769684", grupo: "901769685", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 2": { competicion: "901769684", grupo: "901769686", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 1": { competicion: "901769687", grupo: "901769688", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 2": { competicion: "901769687", grupo: "901769689", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 3": { competicion: "901769687", grupo: "901769690", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 4": { competicion: "901769687", grupo: "901769691", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 5": { competicion: "901769687", grupo: "901769692", temporada: "20", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
  },
  "2023/2024": {
    "Tercera Federación - Grupo 8": { competicion: "10088896", grupo: "10088897", temporada: "19", region: DEFAULT_REGION },
    "Primera Federación - Grupo 1": { competicion: "900164032", grupo: "900164033", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 2": { competicion: "900164032", grupo: "900164034", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 1": { competicion: "900164038", grupo: "900164040", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 2": { competicion: "900164038", grupo: "900164041", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 3": { competicion: "900164038", grupo: "900164042", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 4": { competicion: "900164038", grupo: "900164043", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 5": { competicion: "900164038", grupo: "900164044", temporada: "19", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
  },
  "2022/2023": {
    "Tercera Federación - Grupo 8": { competicion: "11386",    grupo: "43749",    temporada: "18", region: DEFAULT_REGION },
    "Primera Federación - Grupo 1": { competicion: "11382",    grupo: "43715",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 2": { competicion: "11382",    grupo: "43716",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 1": { competicion: "11383",    grupo: "43736",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 2": { competicion: "11383",    grupo: "43737",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 3": { competicion: "11383",    grupo: "43738",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 4": { competicion: "11383",    grupo: "43739",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 5": { competicion: "11383",    grupo: "43740",    temporada: "18", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
  },
  "2021/2022": {
    "Tercera Federación - Grupo 8": { competicion: "10239",    grupo: "36978",    temporada: "17", region: DEFAULT_REGION },
    "Primera Federación - Grupo 1": { competicion: "10236",    grupo: "40893",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Primera Federación - Grupo 2": { competicion: "10236",    grupo: "40954",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 1": { competicion: "10237",    grupo: "40955",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 2": { competicion: "10237",    grupo: "40956",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 3": { competicion: "10237",    grupo: "40957",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 4": { competicion: "10237",    grupo: "40958",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
    "Segunda Federación - Grupo 5": { competicion: "10237",    grupo: "40959",    temporada: "17", region: "Nacional", domain: "marcadores.rfef.es", codAgrupacion: "900160074" },
  },
  "2020/2021": {
    "Tercera Federación - Grupo 8": { competicion: "9551",     grupo: "34376",    temporada: "16", region: DEFAULT_REGION },
  },
  "2019/2020": {
    "Tercera Federación - Grupo 8": { competicion: "7723",     grupo: "25626",    temporada: "15", region: DEFAULT_REGION },
  },
  "2018/2019": {
    "Tercera Federación - Grupo 8": { competicion: "6958",     grupo: "22836",    temporada: "14", region: DEFAULT_REGION },
  },
  "2017/2018": {
    "Tercera Federación - Grupo 8": { competicion: "5163",     grupo: "16846",    temporada: "13", region: DEFAULT_REGION },
  },
  "2016/2017": {
    "Tercera Federación - Grupo 8": { competicion: "3446",     grupo: "11497",    temporada: "12", region: DEFAULT_REGION },
  },
  "2015/2016": {
    "Tercera Federación - Grupo 8": { competicion: "2252",     grupo: "8375",     temporada: "11", region: DEFAULT_REGION },
  },
};

export function getSeasonConfig(
  season: string,
  competitionName: string = DEFAULT_COMPETITION_NAME
): CompetitionConfig | null {
  const seasonMap = SEASON_CONFIGS[season];
  if (!seasonMap) return null;
  const codes = seasonMap[competitionName];
  if (!codes) return null;
  return {
    season,
    competitionName,
    ...codes,
  };
}

/** Todas las temporadas configuradas, en orden cronológico descendente */
export function getAllConfiguredSeasons(): string[] {
  return Object.keys(SEASON_CONFIGS).sort().reverse();
}
