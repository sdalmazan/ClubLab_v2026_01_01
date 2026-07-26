import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: teams } = await supabase.from("teams").select("*");
  console.log("Teams full:", teams);

  const { data: orgs } = await supabase.from("organizations").select("id, name");
  console.log("Orgs:", orgs);
}

main().catch(console.error);
