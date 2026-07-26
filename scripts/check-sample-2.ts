import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: matches } = await statsAdmin
    .from("stat_matches")
    .select("season, home_score, away_score, status")
    .limit(20);

  console.log("Matches sample:", matches);
}

main().catch(console.error);
