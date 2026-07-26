import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Fijando Todos los Partidos 2026/2027 como No Jugados (-1, -1)");
  console.log("════════════════════════════════════════════════════════");

  const season = "2026/2027";

  const { data: matches, error: fetchErr } = await statsAdmin
    .from("stat_matches")
    .select("id, matchday, home_team, away_team, home_score, away_score")
    .eq("season", season);

  if (fetchErr || !matches) {
    console.error("Error al obtener partidos:", fetchErr);
    return;
  }

  console.log(`Encontrados ${matches.length} partidos para la temporada ${season}.`);

  // Reset scores to -1 for all unplayed 2026/2027 matches
  const { error: updateErr } = await statsAdmin
    .from("stat_matches")
    .update({ home_score: -1, away_score: -1 })
    .eq("season", season);

  if (updateErr) {
    console.error("Error actualizando marcadores a -1:", updateErr.message);
  } else {
    console.log("ÉXITO: Todos los partidos de la temporada 2026/2027 se han fijado como Sin Jugar (-1, -1).");
  }
}

main().catch(console.error);
