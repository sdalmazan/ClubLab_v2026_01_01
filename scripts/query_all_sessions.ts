import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: sessions, error: sErr } = await supabase
    .from("training_sessions")
    .select(`
      id,
      date,
      title,
      team_id,
      teams (
        name
      )
    `)
    .order("date", { ascending: true });

  if (sErr) {
    console.error(sErr);
    return;
  }

  console.log("=== ALL SESSIONS IN DATABASE ===");
  sessions?.forEach((s) => {
    console.log(`Team: ${s.teams?.name} (${s.team_id}) | Date: ${s.date} | Title: ${s.title}`);
  });
}

main();
