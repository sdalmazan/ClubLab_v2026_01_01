import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data, error } = await statsAdmin
    .from("stat_matches")
    .select("season, competition, home_team, away_team, home_score, away_score")
    .limit(10);

  console.log("Error:", error);
  console.log("Data count:", data?.length);
  if (data && data.length > 0) {
    console.log("First item:", data[0]);
  }
}

main().catch(console.error);
