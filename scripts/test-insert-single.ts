import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const matchRow = {
    federation_id: "test_2026_2027_1",
    competition: "Tercera Federación - Grupo 8",
    competition_code: "24218932",
    group_code: "24218933",
    season: "2026/2027",
    matchday: 1,
    match_date: "2026-09-06",
    venue: "Campo Municipal La Arboleda",
    home_team: "S.D. Almazán",
    away_team: "Unionistas de Salamanca C.F. \"B\"",
    home_score: -1,
    away_score: -1,
    matchday_url: "https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&CodJornada=1",
  };

  const { data, error } = await statsAdmin.from("stat_matches").upsert(matchRow, { onConflict: "federation_id" }).select();
  console.log("Upsert Result Data:", data);
  console.log("Upsert Result Error:", error);
}

main().catch(console.error);
