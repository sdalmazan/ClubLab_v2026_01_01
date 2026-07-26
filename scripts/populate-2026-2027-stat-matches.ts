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
  console.log("  Poblador Completo de Temporada 2026/2027 en DB Stats");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";
  const competition = "Tercera Federación - Grupo 8";
  const competitionCode = "24218932";
  const groupCode = "24218933";

  const teams = [
    "S.D. Almazán",
    "Unionistas de Salamanca C.F. \"B\"",
    "Arandina C.F.",
    "C.D. Laguna",
    "Salamanca C.F. UDS",
    "C.D. Villaralbo",
    "Atlético Mansillés",
    "C.D. Palencia C.F.",
    "C.D. Bembibre",
    "C.D. Numancia B",
    "C.D. Mojados",
    "C.D. Mirandés B",
    "C.F. Briviesca",
    "C.D. Colegios Diocesanos",
    "C.D. Becerril",
    "C.D. La Virgen del Camino",
    "Burgos C.F. Promesas",
    "C.D. Santa Marta de Tormes",
  ];

  // Generate standard 18-team round-robin schedule (34 matchdays, 9 matches per matchday)
  let totalInserted = 0;
  let totalUpdated = 0;

  for (let j = 1; j <= 34; j++) {
    const matchDate = getSundayForMatchday(j);

    // Create 9 fixtures per matchday
    for (let m = 0; m < 9; m++) {
      let homeIdx = (j - 1 + m) % 18;
      let awayIdx = (18 - 1 - m + j - 1) % 18;
      if (m === 0) awayIdx = 17;

      let homeTeam = teams[homeIdx];
      let awayTeam = teams[awayIdx];

      // Second half of season (J18-34): reverse venue
      if (j > 17) {
        const temp = homeTeam;
        homeTeam = awayTeam;
        awayTeam = temp;
      }

      const isAlmazan = homeTeam.toLowerCase().includes("almazán") || homeTeam.toLowerCase().includes("almazan");
      const hSlug = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const aSlug = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const fedId = `2026_2027_J${j}_${hSlug}_${aSlug}`;

      const matchRow = {
        federation_id: fedId,
        competition,
        competition_code: competitionCode,
        group_code: groupCode,
        season,
        matchday: j,
        match_date: matchDate,
        venue: isAlmazan ? "Campo Municipal La Arboleda" : "Campo por definir",
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: -1,
        away_score: -1,
        matchday_url: `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24218932&CodGrupo=24218933&CodTemporada=22&CodJornada=${j}`,
      };

      const { data: existing } = await statsAdmin
        .from("stat_matches")
        .select("id")
        .eq("season", season)
        .eq("competition", competition)
        .eq("matchday", j)
        .eq("home_team", homeTeam)
        .eq("away_team", awayTeam)
        .maybeSingle();

      if (existing) {
        await statsAdmin.from("stat_matches").update(matchRow).eq("id", existing.id);
        totalUpdated++;
      } else {
        const { error: insErr } = await statsAdmin.from("stat_matches").insert(matchRow);
        if (insErr) console.error(`Error J${j} (${homeTeam} vs ${awayTeam}):`, insErr.message);
        else totalInserted++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`RESUMEN BASE DE DATOS ESTATALES (TEMPORADA 2026/2027):`);
  console.log(`- Partidos insertados: ${totalInserted}`);
  console.log(`- Partidos actualizados: ${totalUpdated}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
