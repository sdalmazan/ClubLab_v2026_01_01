import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  const teamId = "26e2583c-d367-40a5-be3a-f9ad0225222d";
  console.log(`Shifting database sessions back by 1 day for team ${teamId} to start on July 27th...`);

  // 1. Preseason sessions: ASCENDING
  const { data: preseason, error: preErr } = await supabase
    .from("preseason_sessions")
    .select("id, date")
    .eq("team_id", teamId)
    .order("date", { ascending: true });

  if (preErr) {
    console.error("Error fetching preseason sessions:", preErr);
  } else if (preseason && preseason.length > 0) {
    console.log(`Found ${preseason.length} preseason sessions. Shifting dates ASCENDING (1 day backward)...`);
    for (const ps of preseason) {
      const d = new Date(ps.date);
      d.setDate(d.getDate() - 1);
      const newDateStr = d.toISOString().split("T")[0];
      
      const { error: updErr } = await supabase
        .from("preseason_sessions")
        .update({ date: newDateStr })
        .eq("id", ps.id);
      if (updErr) {
        console.error(`Failed to update preseason session ${ps.id} (${ps.date} -> ${newDateStr}):`, updErr);
      }
    }
  }

  // 2. Training sessions: ASCENDING
  const { data: training, error: trErr } = await supabase
    .from("training_sessions")
    .select("id, date")
    .eq("team_id", teamId)
    .order("date", { ascending: true });

  if (trErr) {
    console.error("Error fetching training sessions:", trErr);
  } else if (training && training.length > 0) {
    console.log(`Found ${training.length} training sessions. Shifting dates ASCENDING (1 day backward)...`);
    for (const ts of training) {
      const d = new Date(ts.date);
      d.setDate(d.getDate() - 1);
      const newDateStr = d.toISOString().split("T")[0];

      const { error: updErr } = await supabase
        .from("training_sessions")
        .update({ date: newDateStr })
        .eq("id", ts.id);
      if (updErr) {
        console.error(`Failed to update training session ${ts.id} (${ts.date} -> ${newDateStr}):`, updErr);
      }
    }
  }

  console.log("Database shift complete.");
}

main();
