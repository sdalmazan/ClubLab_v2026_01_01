import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: matches, error } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .eq("season", "2026/2027");

  console.log("Error:", error);
  console.log("Total 2026/2027 matches count:", matches?.length);

  if (matches) {
    const j1 = matches.filter((m) => m.matchday === 1);
    console.log("\nJornada 1 count:", j1.length);
    console.log("Jornada 1 teams:");
    j1.forEach((m) => console.log(`  - [${m.home_team}] vs [${m.away_team}] (scores: ${m.home_score}-${m.away_score})`));

    const teams = new Set<string>();
    matches.forEach((m) => {
      if (m.home_team) teams.add(m.home_team);
      if (m.away_team) teams.add(m.away_team);
    });
    console.log("\nTotal unique teams count:", teams.size);
    console.log("Teams list:", Array.from(teams));

    const j34 = matches.filter((m) => m.matchday === 34);
    console.log("\nJornada 34 count:", j34.length);
    console.log("Jornada 34 sample:", j34.slice(0, 3));
  }
}

main().catch(console.error);
