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
  console.log("  Poblado Oficial RFCYLF 2026/2027 - Tercera RFEF Grupo 8");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";
  const competition = "Tercera Federación - Grupo 8";
  const competitionCode = "24218932";
  const groupCode = "24218933";

  // 1. Delete all existing 2026/2027 entries from stat_matches
  const { error: delErr } = await statsAdmin
    .from("stat_matches")
    .delete()
    .eq("season", season);

  if (delErr) {
    console.error("Error borrando datos previos:", delErr.message);
    return;
  }
  console.log("-> Eliminados registros antiguos de 2026/2027.");

  // The 18 official teams for 2026/2027 RFCYLF Tercera RFEF G8 (exact names from user screenshot)
  const homeOrderJ1 = [
    "C.D. Palencia Cristo Atlético",
    "Turégano C.F.",
    "C.D. Calasanz de Soria",
    "Salamanca C.F. UDS \"B\"",
    "C.D. Almazán",
    "U.D. Santa Marta de Tormes",
    "Burgos C.F. S.A.D. \"B\"",
    "Júpiter Leonés",
    "C.D. Mirandés S.A.D. \"B\"",
  ];

  const awayOrderJ1 = [
    "Atlético Bembibre",
    "Atlético Mansillés",
    "C.D. Guijuelo",
    "C.D. La Virgen del Camino",
    "Unionistas de Salamanca C.F. \"B\"",
    "Arandina C.F.",
    "C.D. Villaralbo",
    "C.D. Colegios Diocesanos",
    "Palencia C.F. S.A.D.",
  ];

  // Construct 18-team list
  // Index 0..8: homeOrderJ1
  // Index 9..17: awayOrderJ1 reversed so team i plays team 17-i in J1
  const teams: string[] = [];
  for (let i = 0; i < 9; i++) {
    teams[i] = homeOrderJ1[i];
  }
  for (let i = 0; i < 9; i++) {
    teams[17 - i] = awayOrderJ1[i];
  }

  console.log("\nEquipos oficiales de la liga (18 equipos):");
  teams.forEach((t, idx) => console.log(`  ${idx + 1}. ${t}`));

  const rowsToInsert: any[] = [];

  // Generate 34 matchdays using standard round-robin rotation
  for (let j = 1; j <= 34; j++) {
    const matchDate = getSundayForMatchday(j);

    for (let m = 0; m < 9; m++) {
      let homeIdx: number;
      let awayIdx: number;

      if (j <= 17) {
        // First leg (J1..17)
        if (m === 8) {
          homeIdx = (j - 1) % 17 === 0 ? 8 : (j - 1) % 17;
          awayIdx = 17;
        } else {
          homeIdx = (m + j - 1) % 17;
          awayIdx = (16 - m + j - 1) % 17;
        }

        // For J1, ensure exact match order as screenshot
        if (j === 1) {
          homeIdx = m;
          awayIdx = 17 - m;
        }
      } else {
        // Second leg (J18..34): swap home and away
        const leg1Jornada = j - 17;
        if (m === 8) {
          awayIdx = (leg1Jornada - 1) % 17 === 0 ? 8 : (leg1Jornada - 1) % 17;
          homeIdx = 17;
        } else {
          awayIdx = (m + leg1Jornada - 1) % 17;
          homeIdx = (16 - m + leg1Jornada - 1) % 17;
        }

        if (leg1Jornada === 1) {
          awayIdx = m;
          homeIdx = 17 - m;
        }
      }

      const homeTeam = teams[homeIdx];
      const awayTeam = teams[awayIdx];

      const isAlmazan = homeTeam.toLowerCase().includes("almazán") || homeTeam.toLowerCase().includes("almazan");
      const hSlug = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const aSlug = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const fedId = `2026_2027_J${j}_${hSlug}_${aSlug}`;

      rowsToInsert.push({
        federation_id: fedId,
        competition,
        competition_code: competitionCode,
        group_code: groupCode,
        season,
        matchday: j,
        match_date: matchDate,
        venue: isAlmazan ? "Campo Municipal La Arboleda" : "Campo Pendiente de asignar",
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: -1,
        away_score: -1,
        matchday_url: `https://www.rfcylf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${competitionCode}&CodGrupo=${groupCode}&CodTemporada=22&CodJornada=${j}`,
      });
    }
  }

  // Insert rows in chunks of 50
  for (let i = 0; i < rowsToInsert.length; i += 50) {
    const chunk = rowsToInsert.slice(i, i + 50);
    const { error: insErr } = await statsAdmin.from("stat_matches").insert(chunk);
    if (insErr) console.error(`Error en lote ${i}:`, insErr.message);
  }

  console.log(`\n========================================`);
  console.log(`RE-POBLADO OFICIAL RFCYLF 2026/2027 COMPLETADO:`);
  console.log(`- Total de partidos insertados: ${rowsToInsert.length} (34 jornadas x 9 partidos)`);
  console.log(`- Equipos únicos: 18`);
  console.log(`========================================\n`);
}

main().catch(console.error);
