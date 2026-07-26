import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  // 1. Get all teams
  const { data: teams, error: teamsError } = await supabase.from("teams").select("*");
  if (teamsError) {
    console.error("Error fetching teams:", teamsError);
    return;
  }

  // Find all teams matching Senior A
  const seniorTeams = teams?.filter((t) => t.name.toLowerCase().includes("senior") || t.category?.toLowerCase() === "senior") || [];
  
  if (seniorTeams.length === 0) {
    console.error("Could not find Senior teams");
    return;
  }

  for (const team of seniorTeams) {
    console.log(`\nProcessing Senior Team ID: ${team.id} (${team.name})`);

    // 2. Fetch preseason sessions DESCENDING to shift forward by 1 day
    const { data: preseason, error: preErr } = await supabase
      .from("preseason_sessions")
      .select("id, date")
      .eq("team_id", team.id)
      .order("date", { ascending: false }); // DESCENDING

    if (preErr) {
      console.error("Error fetching preseason sessions:", preErr);
    } else if (preseason && preseason.length > 0) {
      console.log(`Found ${preseason.length} preseason sessions. Shifting dates DESCENDING (1 day forward)...`);
      for (const ps of preseason) {
        const d = new Date(ps.date);
        d.setDate(d.getDate() + 1);
        const newDateStr = d.toISOString().split("T")[0];
        
        const { error: updErr } = await supabase
          .from("preseason_sessions")
          .update({ date: newDateStr })
          .eq("id", ps.id);
        if (updErr) {
          console.error(`Failed to update preseason session ${ps.id} (${ps.date} -> ${newDateStr}):`, updErr);
        }
      }
      console.log("Preseason sessions shifted forward.");
    }

    // 3. Fetch training sessions DESCENDING
    const { data: training, error: trErr } = await supabase
      .from("training_sessions")
      .select("id, date, title")
      .eq("team_id", team.id)
      .order("date", { ascending: false }); // DESCENDING

    if (trErr) {
      console.error("Error fetching training sessions:", trErr);
    } else if (training && training.length > 0) {
      console.log(`Found ${training.length} training sessions. Shifting dates DESCENDING (1 day forward)...`);
      for (const ts of training) {
        const d = new Date(ts.date);
        d.setDate(d.getDate() + 1);
        const newDateStr = d.toISOString().split("T")[0];

        const { error: updErr } = await supabase
          .from("training_sessions")
          .update({ date: newDateStr })
          .eq("id", ts.id);
        if (updErr) {
          console.error(`Failed to update training session ${ts.id} (${ts.date} -> ${newDateStr}):`, updErr);
        }
      }
      console.log("Training sessions shifted forward.");
    }
  }
}

main();
