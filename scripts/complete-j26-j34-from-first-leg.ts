import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

function getSundayForMatchday(jornada: number): string {
  const baseDate = new Date("2026-09-06T12:00:00Z");
  baseDate.setDate(baseDate.getDate() + (jornada - 1) * 7);
  return baseDate.toISOString().split("T")[0];
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Completando Jornadas 26 a 34 basadas en la 1ª Vuelta");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";
  const competition = "Tercera Federación - Grupo 8";
  const competitionCode = "24218932";
  const groupCode = "24218933";

  // Fetch all matches from J9 to J17
  const { data: firstLegMatches } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .eq("season", season)
    .gte("matchday", 9)
    .lte("matchday", 17);

  if (!firstLegMatches || firstLegMatches.length === 0) {
    console.error("No se encontraron partidos de la 1ª vuelta (J9..17).");
    return;
  }

  const rowsToInsert: any[] = [];

  for (let leg1J = 9; leg1J <= 17; leg1J++) {
    const leg2J = leg1J + 17; // J26..34
    const matchDate = getSundayForMatchday(leg2J);

    const leg1Fixtures = firstLegMatches.filter((m) => m.matchday === leg1J);

    for (const m of leg1Fixtures) {
      // Swap home and away for second leg
      const homeTeam = m.away_team;
      const awayTeam = m.home_team;
      const isAlmazan = homeTeam.toLowerCase().includes("almazán") || homeTeam.toLowerCase().includes("almazan");

      const hSlug = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const aSlug = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const fedId = `2026_2027_J${leg2J}_${hSlug}_${aSlug}`;

      rowsToInsert.push({
        federation_id: fedId,
        competition,
        competition_code: competitionCode,
        group_code: groupCode,
        season,
        matchday: leg2J,
        match_date: matchDate,
        venue: isAlmazan ? "Campo Municipal La Arboleda" : "Campo Pendiente de asignar",
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: -1,
        away_score: -1,
        matchday_url: `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${competitionCode}&CodGrupo=${groupCode}&CodTemporada=22&CodJornada=${leg2J}`,
      });
    }
  }

  const { error: insErr } = await statsAdmin.from("stat_matches").insert(rowsToInsert);
  if (insErr) {
    console.error("Error insertando J26..34:", insErr.message);
  } else {
    console.log(`Éxito: Se han creado los ${rowsToInsert.length} partidos de las Jornadas 26 a 34.`);
  }
}

main().catch(console.error);
