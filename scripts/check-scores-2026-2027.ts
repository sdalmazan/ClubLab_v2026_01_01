import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: matches } = await statsAdmin
    .from("stat_matches")
    .select("matchday, home_team, away_team, home_score, away_score")
    .eq("season", "2026/2027");

  const played = matches?.filter((m) => m.home_score !== null && m.away_score !== null && m.home_score >= 0 && m.away_score >= 0);
  console.log("Played matches count:", played?.length);
  console.log("Played matches sample:", played);
}

main().catch(console.error);
