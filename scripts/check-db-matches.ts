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
  console.log("Count 2026/2027:", matches?.length);
  if (matches && matches.length > 0) {
    console.log("Sample match 0:", matches[0]);
    const j1 = matches.filter(m => m.matchday === 1);
    console.log("Jornada 1 count:", j1.length);
    console.log("Jornada 1 sample:", j1[0]);
  }
}

main().catch(console.error);
