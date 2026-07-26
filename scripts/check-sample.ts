import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: sample } = await statsAdmin
    .from("stat_matches")
    .select("home_score, away_score, status, match_date, federation_id")
    .eq("season", "2025/2026")
    .limit(10);

  console.log("Sample 2025/2026 matches:", sample);
}

main().catch(console.error);
