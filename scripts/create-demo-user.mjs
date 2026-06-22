/**
 * ClubLab v2026.01.01 — Demo User & Database Seeding Script
 * Run with: node scripts/create-demo-user.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  console.log("🚀 Starting database seeding for test account...");

  const testEmail = "diecilo7@gmail.com";
  const testPassword = "ClubLab2026!";

  // 1. Clean up existing user if exists
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(listErr.message);

  const existingUser = users.find((u) => u.email === testEmail);
  if (existingUser) {
    console.log(`🗑️ Found existing user ${testEmail} (${existingUser.id}). Cleaning up old data...`);
    
    // Find organization roles to delete orgs
    const { data: orgRoles } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", existingUser.id);

    if (orgRoles && orgRoles.length > 0) {
      for (const role of orgRoles) {
        console.log(`🗑️ Deleting organization ${role.organization_id}...`);
        await supabase.from("organizations").delete().eq("id", role.organization_id);
      }
    }

    // Delete auth user
    await supabase.auth.admin.deleteUser(existingUser.id);
    console.log("✅ Old data cleaned up successfully.");
  }

  // 2. Create user in Supabase Auth
  console.log(`👤 Creating auth user: ${testEmail}...`);
  const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: "Diego López",
      role: "super_admin",
    },
  });

  if (createErr) throw new Error(createErr.message);
  console.log(`✅ Auth user created successfully with ID: ${user.id}`);

  // 3. Create Organization
  console.log("🏢 Creating organization: ClubLab Enterprise...");
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: "ClubLab Enterprise",
      slug: "clublab-enterprise",
      type: "club",
    })
    .select("id")
    .single();

  if (orgErr) throw new Error(orgErr.message);

  // 4. Assign Active Premium Subscription
  console.log("💳 Seeding premium subscription (performance plan)...");
  const { data: perfPlan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", "performance")
    .single();

  if (perfPlan) {
    await supabase.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: perfPlan.id,
      status: "manual",
    });
  }

  // 5. Create user_organization_role
  console.log("🔑 Assigning super_admin role...");
  await supabase.from("user_organization_roles").insert({
    user_id: user.id,
    organization_id: org.id,
    role: "super_admin",
  });

  // 6. Create Club
  console.log("🏟️ Creating club: ClubLab FC...");
  const { data: club } = await supabase
    .from("clubs")
    .insert({
      organization_id: org.id,
      name: "ClubLab FC",
      founded_year: 2026,
      country: "España",
      city: "Soria",
    })
    .select("id")
    .single();

  // 7. Create Season
  console.log("📅 Creating season: 2026/27...");
  const { data: season } = await supabase
    .from("seasons")
    .insert({
      club_id: club.id,
      name: "2026/27",
      start_date: "2026-07-01",
      end_date: "2027-06-30",
      is_active: true,
    })
    .select("id")
    .single();

  // 8. Create Team
  console.log("👥 Creating team: Senior A...");
  const { data: team } = await supabase
    .from("teams")
    .insert({
      club_id: club.id,
      season_id: season.id,
      name: "Senior A",
      category: "Senior",
      gender: "male",
      color: "#10b981",
    })
    .select("id")
    .single();

  // 9. Create Players
  console.log("🏃 Seeding 5 players...");
  const playersData = [
    { first_name: "Lionel", last_name: "Messi", dob: "1987-06-24", foot: "left", height: 170.0, weight: 72.0, pos: "striker", num: 10 },
    { first_name: "Cristiano", last_name: "Ronaldo", dob: "1985-02-05", foot: "right", height: 187.0, weight: 83.0, pos: "striker", num: 7 },
    { first_name: "Luka", last_name: "Modric", dob: "1985-09-09", foot: "right", height: 172.0, weight: 66.0, pos: "playmaker_midfielder", num: 10 },
    { first_name: "Virgil", last_name: "van Dijk", dob: "1991-07-08", foot: "right", height: 193.0, weight: 92.0, pos: "right_center_back", num: 4 },
    { first_name: "Thibaut", last_name: "Courtois", dob: "1992-05-11", foot: "left", height: 200.0, weight: 96.0, pos: "goalkeeper", num: 1 },
  ];

  const seededPlayers = [];

  for (const p of playersData) {
    const { data: playerRecord } = await supabase
      .from("players")
      .insert({
        organization_id: org.id,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.dob,
        nationality: "Internacional",
        dominant_foot: p.foot,
        height_cm: p.height,
        weight_kg: p.weight,
      })
      .select("id")
      .single();

    // Link player to team
    await supabase.from("player_team_memberships").insert({
      player_id: playerRecord.id,
      team_id: team.id,
      season_id: season.id,
      jersey_number: p.num,
      positions: [p.pos],
      status: "active",
    });

    seededPlayers.push({ ...p, id: playerRecord.id });
  }

  // 10. Seed Training Sessions (3 sessions)
  console.log("📅 Seeding training sessions...");
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const { data: sessToday } = await supabase
    .from("training_sessions")
    .insert({
      organization_id: org.id,
      team_id: team.id,
      season_id: season.id,
      title: "Entrenamiento Táctico y Carga Alta",
      date: today,
      duration_min: 90,
      session_type: "training",
      microcycle_day: "MD-1",
      planned_load: "high",
      planned_intensity: "Alta",
      notes: "Sesión táctica enfocada en presión tras pérdida y transiciones rápidas.",
      status: "completed",
    })
    .select("id")
    .single();

  const { data: sessYesterday } = await supabase
    .from("training_sessions")
    .insert({
      organization_id: org.id,
      team_id: team.id,
      season_id: season.id,
      title: "Posesiones y Rondos de Activación",
      date: yesterday,
      duration_min: 75,
      session_type: "training",
      microcycle_day: "MD-2",
      planned_load: "medium",
      planned_intensity: "Media",
      notes: "Trabajo regenerativo y rondos posicionales de velocidad mental.",
      status: "completed",
    })
    .select("id")
    .single();

  // Tomorrow's planned match
  await supabase
    .from("training_sessions")
    .insert({
      organization_id: org.id,
      team_id: team.id,
      season_id: season.id,
      title: "Partido de Liga vs CD Soria",
      date: tomorrow,
      duration_min: 90,
      session_type: "match",
      microcycle_day: "MD",
      planned_load: "high",
      planned_intensity: "Máxima",
      status: "planned",
      match_opponent: "CD Soria",
      match_is_home: true,
      match_competition: "Liga Regional",
    });

  // 11. Seed Wellness Entries for today
  console.log("❤️ Seeding wellness logs...");
  for (const player of seededPlayers) {
    // Luka Modric reports low sleep, others report optimal
    const sleep = player.first_name === "Luka" ? 2 : 4;
    const fatigue = player.first_name === "Luka" ? 2 : 4;
    const mood = 4;
    const soreness = player.first_name === "Lionel" ? 2 : 4; // soreness 1-5 (low=worse or 1=worse)
    // wellness rating standard: 5 is best, 1 is worst
    
    await supabase.from("wellness_entries").insert({
      organization_id: org.id,
      player_id: player.id,
      team_id: team.id,
      session_id: sessToday.id,
      date: today,
      sleep_quality: sleep,
      fatigue: fatigue,
      mood: mood,
      muscle_soreness: soreness,
      localized_discomfort: player.first_name === "Lionel" ? "Isquiotibial derecho cargado" : null,
    });
  }

  // 12. Seed RPE entries for yesterday and today
  console.log("📊 Seeding RPE entries & loads...");
  for (const player of seededPlayers) {
    // Yesterday RPE
    await supabase.from("rpe_entries").insert({
      organization_id: org.id,
      player_id: player.id,
      session_id: sessYesterday.id,
      rpe: player.first_name === "Cristiano" ? 8 : 6,
      post_feeling: "good",
      minutes_played: 75,
    });

    // Today RPE
    await supabase.from("rpe_entries").insert({
      organization_id: org.id,
      player_id: player.id,
      session_id: sessToday.id,
      rpe: player.first_name === "Cristiano" ? 9 : player.first_name === "Luka" ? 8 : 7,
      post_feeling: player.first_name === "Cristiano" ? "very_loaded" : "good",
      minutes_played: 90,
    });

    // Seed simplified player load records for today
    await supabase.from("player_loads").insert({
      organization_id: org.id,
      player_id: player.id,
      team_id: team.id,
      date: today,
      session_load: (player.first_name === "Cristiano" ? 9 : 7) * 90,
      acute_load: 1800,
      chronic_load: 1600,
      acwr: player.first_name === "Cristiano" ? 1.45 : 1.10,
      monotony: 1.2,
      strain: 2160,
    });
  }

  // 13. Seed Alert
  console.log("⚠️ Seeding performance alert...");
  const cr7 = seededPlayers.find(p => p.first_name === "Cristiano");
  await supabase.from("alerts").insert({
    organization_id: org.id,
    player_id: cr7.id,
    team_id: team.id,
    alert_type: "high_weekly_load",
    severity: "high",
    message: "El ACWR de Cristiano Ronaldo ha superado 1.4 (ACWR: 1.45). Riesgo elevado de lesión.",
    status: "open",
  });

  // 14. Seed Injury & Rehab (Thibaut Courtois)
  console.log("🏥 Seeding injury logs for Thibaut Courtois...");
  const courtois = seededPlayers.find(p => p.first_name === "Thibaut");
  
  const { data: injury } = await supabase
    .from("injuries")
    .insert({
      organization_id: org.id,
      player_id: courtois.id,
      team_id: team.id,
      injury_type: "Rotura de Menisco Externo",
      body_part: "Rodilla",
      body_side: "right",
      severity: "high",
      status: "active",
      occurred_date: yesterday,
      expected_return_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      mechanism: "Torsión de la rodilla derecha durante un rondo dinámico.",
      notes: "El jugador siente un chasquido seguido de dolor agudo e inflamación inmediata.",
      medical_notes: "Exploración positiva en prueba de McMurray. RMN confirma rotura parcial del asta posterior del menisco externo.",
      treatment_plan: "Fase 1: Reposo deportivo, control de inflamación (RICE). Fase 2: Potenciación muscular isométrica. Fase 3: Readaptación en campo.",
      validation_status: "validated",
      created_by: user.id,
    })
    .select("id")
    .single();

  const { data: rehab } = await supabase
    .from("rehab_plans")
    .insert({
      organization_id: org.id,
      injury_id: injury.id,
      created_by: user.id,
      title: "Plan de Readaptación Meniscal",
      start_date: today,
      goals: "Recuperar rango de movilidad completo y fortalecer cuádriceps de forma segura.",
      notes: "Evitar ejercicios de torsión o carga completa de impacto hasta la semana 4.",
    })
    .select("id")
    .single();

  await supabase.from("rehab_sessions").insert({
    organization_id: org.id,
    rehab_plan_id: rehab.id,
    date: today,
    duration_min: 45,
    exercises_done: "Electroestimulación (EMS) + Isométricos de cuádriceps + Movilización pasiva (flexo-extensión).",
    progress_notes: "Buena tolerancia al tratamiento, sin aumento del derrame articular residual.",
  });

  console.log("\n========================================================");
  console.log("🎉 DATABASE SEEDED SUCCESSFULLY FOR TEST ACCOUNT!");
  console.log("========================================================");
  console.log(`📧 Email:    ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}`);
  console.log("🏢 Org Name: ClubLab Enterprise");
  console.log("========================================================\n");
}

main().catch((e) => {
  console.error("❌ Seeding failed:", e.message);
  process.exit(1);
});
