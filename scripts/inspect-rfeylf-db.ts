import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: matches } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .eq("season", "2026/2027")
    .order("matchday", { ascending: true });

  console.log("Total matches currently in DB:", matches?.length);

  const matchdaysCount = new Map<number, number>();
  matches?.forEach((m) => {
    matchdaysCount.set(m.matchday, (matchdaysCount.get(m.matchday) || 0) + 1);
  });

  console.log("\nMatches per matchday:");
  for (let j = 1; j <= 34; j++) {
    console.log(`  Jornada ${j}: ${matchdaysCount.get(j) || 0} partidos`);
  }

  // Show sample of J1 to J5
  console.log("\nSample J1:");
  matches?.filter((m) => m.matchday === 1).forEach((m) => console.log(`  ${m.home_team} vs ${m.away_team} (${m.match_date})`));

  console.log("\nSample J2:");
  matches?.filter((m) => m.matchday === 2).forEach((m) => console.log(`  ${m.home_team} vs ${m.away_team} (${m.match_date})`));

  console.log("\nSample J18 (J1 vuelta):");
  matches?.filter((m) => m.matchday === 18).forEach((m) => console.log(`  ${m.home_team} vs ${m.away_team} (${m.match_date})`));
}

main().catch(console.error);
