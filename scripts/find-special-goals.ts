import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { statsAdmin } = await import("../src/lib/supabase/stats-admin");

  console.log("Escaneando todos los nombres de goleadores...");
  const { data, error } = await statsAdmin
    .from("stat_events")
    .select("match_id, player_name")
    .eq("event_type", "goal");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const special = data.filter(e => {
    const name = (e.player_name || "").toLowerCase();
    return name.includes("p.p.") || name.includes("(p)") || name.includes("propia") || name.includes("penal");
  });

  console.log(`Goles con sufijos especiales encontrados: ${special.length}`);
  if (special.length > 0) {
    console.log("Muestra:", JSON.stringify(special.slice(0, 10), null, 2));
  }

}

main().catch(console.error);
