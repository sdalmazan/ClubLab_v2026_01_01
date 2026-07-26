import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: teams } = await supabase.from("teams").select("id, name").limit(10);
  console.log("Teams:", teams);

  const { data: matches, error } = await supabase
    .from("training_sessions")
    .select("id, title, date, session_type, team_id")
    .eq("session_type", "match")
    .order("date", { ascending: true });

  console.log("Error:", error);
  console.log("Match sessions count in training_sessions:", matches?.length);
  if (matches) {
    console.log("Sample match sessions:", matches.slice(0, 10));
  }
}

main().catch(console.error);
