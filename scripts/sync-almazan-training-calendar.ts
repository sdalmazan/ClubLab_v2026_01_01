import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { statsAdmin } from "../src/lib/supabase/stats-admin";

function getSundayForMatchday(jornada: number): string {
  const baseDate = new Date("2026-09-06T12:00:00Z");
  baseDate.setDate(baseDate.getDate() + (jornada - 1) * 7);
  return baseDate.toISOString().split("T")[0];
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  Sincronizador de Calendario de Almazán en Entrenamientos");
  console.log("════════════════════════════════════════════════════════");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const teamId = "26e2583c-d367-40a5-be3a-f9ad0225222d";
  const organizationId = "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d"; // S.D. Almazán

  // Get user ID for created_by
  const { data: orgRoles } = await supabase
    .from("user_organization_roles")
    .select("user_id")
    .limit(1);
  const createdBy = orgRoles?.[0]?.user_id || "00000000-0000-0000-0000-000000000000";

  // Almazán 2026/2027 calendar array (J3 to J34)
  const almazanFixtures = [
    { j: 3, home: "S.D. Almazán", away: "C.D. Laguna" },
    { j: 4, home: "Salamanca C.F. UDS", away: "S.D. Almazán" },
    { j: 5, home: "S.D. Almazán", away: "C.D. Villaralbo" },
    { j: 6, home: "Atlético Mansillés", away: "S.D. Almazán" },
    { j: 7, home: "S.D. Almazán", away: "C.D. Palencia C.F." },
    { j: 8, home: "C.D. Bembibre", away: "S.D. Almazán" },
    { j: 9, home: "S.D. Almazán", away: "C.D. Numancia B" },
    { j: 10, home: "C.D. Mojados", away: "S.D. Almazán" },
    { j: 11, home: "S.D. Almazán", away: "C.D. Mirandés B" },
    { j: 12, home: "C.F. Briviesca", away: "S.D. Almazán" },
    { j: 13, home: "S.D. Almazán", away: "C.D. Colegios Diocesanos" },
    { j: 14, home: "C.D. Becerril", away: "S.D. Almazán" },
    { j: 15, home: "S.D. Almazán", away: "C.D. La Virgen del Camino" },
    { j: 16, home: "Burgos C.F. Promesas", away: "S.D. Almazán" },
    { j: 17, home: "S.D. Almazán", away: "C.D. Santa Marta de Tormes" },
    { j: 18, home: "Unionistas C.F. B", away: "S.D. Almazán" },
    { j: 19, home: "S.D. Almazán", away: "Arandina C.F." },
    { j: 20, home: "C.D. Laguna", away: "S.D. Almazán" },
    { j: 21, home: "S.D. Almazán", away: "Salamanca C.F. UDS" },
    { j: 22, home: "C.D. Villaralbo", away: "S.D. Almazán" },
    { j: 23, home: "S.D. Almazán", away: "Atlético Mansillés" },
    { j: 24, home: "C.D. Palencia C.F.", away: "S.D. Almazán" },
    { j: 25, home: "S.D. Almazán", away: "C.D. Bembibre" },
    { j: 26, home: "C.D. Numancia B", away: "S.D. Almazán" },
    { j: 27, home: "S.D. Almazán", away: "C.D. Mojados" },
    { j: 28, home: "C.D. Mirandés B", away: "S.D. Almazán" },
    { j: 29, home: "S.D. Almazán", away: "C.F. Briviesca" },
    { j: 30, home: "C.D. Colegios Diocesanos", away: "S.D. Almazán" },
    { j: 31, home: "S.D. Almazán", away: "C.D. Becerril" },
    { j: 32, home: "C.D. La Virgen del Camino", away: "S.D. Almazán" },
    { j: 33, home: "S.D. Almazán", away: "Burgos C.F. Promesas" },
    { j: 34, home: "C.D. Santa Marta de Tormes", away: "S.D. Almazán" },
  ];

  let insertedCount = 0;
  let updatedCount = 0;

  for (const m of almazanFixtures) {
    const j = m.j;
    const matchDate = getSundayForMatchday(j);
    const title = `Liga vs ${m.home === "S.D. Almazán" ? m.away : m.home}`;

    // Check if session already exists for this date and team
    const { data: existing } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("team_id", teamId)
      .eq("date", matchDate)
      .eq("session_type", "match")
      .maybeSingle();

    const sessionPayload = {
      organization_id: organizationId,
      team_id: teamId,
      created_by: createdBy,
      title,
      date: matchDate,
      session_type: "match",
      duration_min: 90,
      microcycle_day: "MD",
      status: "planned",
      start_time: "17:00:00",
      notes: `Partido Oficial Tercera RFEF Grupo 8 - Jornada ${j}: ${m.home} vs ${m.away}`,
    };

    if (existing) {
      await supabase.from("training_sessions").update(sessionPayload).eq("id", existing.id);
      updatedCount++;
    } else {
      const { error: insErr } = await supabase.from("training_sessions").insert(sessionPayload);
      if (insErr) console.error(`Error insertando J${j}:`, insErr.message);
      else insertedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`CALENDARIO DE ENTRENAMIENTOS DE ALMAZÁN ACTUALIZADO:`);
  console.log(`- Sesiones de partido creadas: ${insertedCount}`);
  console.log(`- Sesiones de partido actualizadas: ${updatedCount}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
