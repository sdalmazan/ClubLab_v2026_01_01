import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { statsAdmin } from "../src/lib/supabase/stats-admin";

async function main() {
  const { data: seasons } = await statsAdmin
    .from("stat_matches")
    .select("season, competition")
    .limit(50);

  console.log("Distinct seasons in DB:", Array.from(new Set(seasons?.map(s => s.season))));
  
  const { count } = await statsAdmin
    .from("stat_matches")
    .select("*", { count: "exact", head: true });
    
  console.log("Total rows in stat_matches:", count);

  // Check recent inserted rows
  const { data: recent } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("Recent rows in stat_matches:", recent);
}

main().catch(console.error);
