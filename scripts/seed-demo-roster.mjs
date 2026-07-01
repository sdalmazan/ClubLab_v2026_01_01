/**
 * ClubLab v2026.01.01 — Demo Roster Seeding Script
 * Run with: node scripts/seed-demo-roster.mjs
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
  console.error("❌ Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const playersToSeed = [
  // Goalkeepers
  { first_name: "Marc", last_name: "Ter Stegen", dob: "1992-04-30", foot: "right", positions: ["goalkeeper"], num: 1, adjective: "Seguro", type: "main", label: "" },
  { first_name: "Iñaki", last_name: "Peña", dob: "1999-03-02", foot: "right", positions: ["goalkeeper"], num: 13, adjective: "Reflejos", type: "reserve", label: "Filial" },
  
  // Defenders
  { first_name: "Pau", last_name: "Cubarsí", dob: "2007-01-22", foot: "right", positions: ["left_center_back", "right_center_back"], num: 2, adjective: "Salida limpia", type: "youth", label: "Juvenil A" },
  { first_name: "Andreas", last_name: "Christensen", dob: "1996-04-10", foot: "right", positions: ["right_center_back", "defensive_midfielder"], num: 15, adjective: "Posicional", type: "main", label: "" },
  { first_name: "Ronald", last_name: "Araujo", dob: "1999-03-07", foot: "right", positions: ["right_center_back", "right_back"], num: 4, adjective: "Fuerza", type: "main", label: "", status: "injured", injury: { body_part: "Isquiotibiales", severity: "grave" } },
  { first_name: "Inigo", last_name: "Martinez", dob: "1991-05-17", foot: "left", positions: ["left_center_back"], num: 5, adjective: "Carácter", type: "main", label: "" },
  { first_name: "Alejandro", last_name: "Balde", dob: "2003-10-18", foot: "left", positions: ["left_back", "left_winger"], num: 3, adjective: "Velocidad", type: "main", label: "" },
  { first_name: "Hector", last_name: "Fort", dob: "2006-08-02", foot: "right", positions: ["right_back", "left_back"], num: 32, adjective: "Polivalente", type: "youth", label: "Juvenil B" },
  { first_name: "Jules", last_name: "Koundé", dob: "1998-11-12", foot: "right", positions: ["right_back", "right_center_back"], num: 23, adjective: "Incansable", type: "main", label: "" },
  { first_name: "Eric", last_name: "Garcia", dob: "2001-01-09", foot: "right", positions: ["right_center_back", "defensive_midfielder"], num: 24, adjective: "Inteligente", type: "main", label: "" },
  
  // Midfielders
  { first_name: "Frenkie", last_name: "de Jong", dob: "1997-05-12", foot: "right", positions: ["defensive_midfielder", "playmaker_midfielder"], num: 21, adjective: "Conducción", type: "main", label: "" },
  { first_name: "Marc", last_name: "Casadó", dob: "2003-09-14", foot: "right", positions: ["defensive_midfielder", "playmaker_midfielder"], num: 17, adjective: "Intensidad", type: "reserve", label: "Filial Senior" },
  { first_name: "Pedri", last_name: "González", dob: "2002-11-25", foot: "right", positions: ["playmaker_midfielder", "attacking_midfielder"], num: 8, adjective: "Magia", type: "main", label: "" },
  { first_name: "Gavi", last_name: "Páez", dob: "2004-08-05", foot: "right", positions: ["playmaker_midfielder", "defensive_midfielder"], num: 6, adjective: "Coraje", type: "main", label: "" },
  { first_name: "Fermín", last_name: "López", dob: "2003-05-11", foot: "right", positions: ["attacking_midfielder", "playmaker_midfielder"], num: 16, adjective: "Llegada", type: "main", label: "" },
  { first_name: "Dani", last_name: "Olmo", dob: "1998-05-07", foot: "right", positions: ["attacking_midfielder", "left_winger"], num: 20, adjective: "Talento", type: "main", label: "" },
  { first_name: "Pablo", last_name: "Torre", dob: "2003-04-03", foot: "right", positions: ["playmaker_midfielder", "attacking_midfielder"], num: 14, adjective: "Visión", type: "other", label: "Cedido" },
  
  // Forwards
  { first_name: "Lamine", last_name: "Yamal", dob: "2007-07-13", foot: "left", positions: ["right_winger", "attacking_midfielder"], num: 19, adjective: "Desequilibrante", type: "youth", label: "Cadete A" },
  { first_name: "Raphinha", last_name: "Dias", dob: "1996-12-14", foot: "left", positions: ["left_winger", "right_winger"], num: 11, adjective: "Presión", type: "main", label: "" },
  { first_name: "Robert", last_name: "Lewandowski", dob: "1988-08-21", foot: "right", positions: ["striker"], num: 9, adjective: "Goleador", type: "main", label: "" },
  { first_name: "Ansu", last_name: "Fati", dob: "2002-10-31", foot: "right", positions: ["left_winger", "striker"], num: 10, adjective: "Definición", type: "main", label: "" },
  
  // Inactive (Baja)
  { first_name: "Sergi", last_name: "Roberto", dob: "1992-02-07", foot: "right", positions: ["right_back", "playmaker_midfielder"], num: 22, adjective: "Veterano", type: "main", label: "", membership_status: "inactive", left_date: "2026-06-01" },
];

async function main() {
  console.log("🚀 Seeding 22 demo players with new affiliation settings...");

  // 1. Get existing team
  const { data: teams, error: teamErr } = await supabase.from("teams").select("id, club_id, season_id").limit(1);
  if (teamErr) throw new Error(teamErr.message);
  if (!teams || teams.length === 0) {
    console.error("❌ No teams found in database. Run create-demo-user.mjs first.");
    process.exit(1);
  }
  const team = teams[0];
  console.log(`🎯 Targeted Team: ${team.id}`);

  // Get organization ID from club
  const { data: club, error: clubErr } = await supabase.from("clubs").select("organization_id").eq("id", team.club_id).single();
  if (clubErr) throw new Error(clubErr.message);
  const orgId = club.organization_id;
  console.log(`🏢 Targeted Organization: ${orgId}`);

  // 2. Clear old players from this team
  const { data: oldMemberships } = await supabase.from("player_team_memberships").select("player_id").eq("team_id", team.id);
  if (oldMemberships && oldMemberships.length > 0) {
    const playerIds = oldMemberships.map(m => m.player_id);
    console.log(`🗑️ Deleting ${playerIds.length} existing players linked to this team...`);
    await supabase.from("player_team_memberships").delete().in("player_id", playerIds);
    await supabase.from("players").delete().in("id", playerIds);
  }

  // 3. Seed 22 players
  for (const p of playersToSeed) {
    console.log(`🏃 Seeding player: ${p.first_name} ${p.last_name}...`);

    // Insert player row
    const { data: playerRecord, error: playerErr } = await supabase
      .from("players")
      .insert({
        organization_id: orgId,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.dob,
        dominant_foot: p.foot,
        adjective: p.adjective,
      })
      .select("id")
      .single();

    if (playerErr) {
      console.error(`❌ Failed to seed player ${p.first_name}:`, playerErr.message);
      continue;
    }

    const playerId = playerRecord.id;

    // Insert membership row
    const membershipStatus = p.membership_status ?? "active";
    const joinedDate = "2025-07-01";
    const leftDate = p.left_date ?? null;

    const { error: memErr } = await supabase.from("player_team_memberships").insert({
      player_id: playerId,
      team_id: team.id,
      season_id: team.season_id,
      jersey_number: p.num,
      positions: p.positions,
      status: membershipStatus,
      joined_date: joinedDate,
      left_date: leftDate,
      player_type: p.type,
      player_type_label: p.label || null,
    });

    if (memErr) {
      console.error(`❌ Failed to link player ${p.first_name}:`, memErr.message);
    }

    // Seed injury if specified
    if (p.status === "injured" && p.injury) {
      console.log(`  🩹 Seeding injury for ${p.first_name}...`);
      await supabase.from("injuries").insert({
        organization_id: orgId,
        player_id: playerId,
        body_part: p.injury.body_part,
        severity: p.injury.severity,
        status: "active",
        injury_date: "2026-06-20",
      });
    }
  }

  console.log("✅ Seed completed successfully. 22 players seeded.");
}

main().catch(console.error);
