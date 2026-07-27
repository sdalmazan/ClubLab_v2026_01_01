import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("=== Setting up Invisible Player for diego.ciria.lopez@gmail.com ===");

  const targetEmail = "diego.ciria.lopez@gmail.com";

  // 1. Get or create auth user
  console.log(`1. Checking auth user for ${targetEmail}...`);
  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error("Error listing auth users:", listErr);
    process.exit(1);
  }

  let user = usersData.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (!user) {
    console.log(`User ${targetEmail} not found. Creating user in auth.users...`);
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      email_confirm: true,
      user_metadata: { full_name: "Diego Ciria" },
    });
    if (createErr || !newUser.user) {
      console.error("Error creating auth user:", createErr);
      process.exit(1);
    }
    user = newUser.user;
    console.log("User created with ID:", user.id);
  } else {
    console.log("Auth user found with ID:", user.id);
  }

  // 2. Find Organization (SD Almazán)
  console.log("2. Locating Organization for SD Almazán...");
  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id, name");

  if (orgErr || !orgs || orgs.length === 0) {
    console.error("Error fetching organizations:", orgErr);
    process.exit(1);
  }

  let org = orgs.find((o) => o.name.toLowerCase().includes("almazán") || o.name.toLowerCase().includes("almazan")) || orgs[0];
  console.log(`Selected Organization: ${org.name} (${org.id})`);

  // 3. Find Team & Season
  console.log("3. Locating Team and Season...");
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id, name, season_id, club_id")
    .order("created_at", { ascending: true });

  const team = teams?.[0];
  if (!team) {
    console.error("No teams found for organization");
    process.exit(1);
  }
  console.log(`Selected Team: ${team.name} (${team.id})`);

  const { data: seasons } = await supabaseAdmin
    .from("seasons")
    .select("id, name")
    .eq("is_active", true);

  const seasonId = seasons?.[0]?.id || team.season_id;
  console.log(`Selected Season ID: ${seasonId}`);

  // 4. Assign user_organization_role = 'player'
  console.log("4. Assigning user organization role...");
  const { error: roleErr } = await supabaseAdmin
    .from("user_organization_roles")
    .upsert(
      {
        user_id: user.id,
        organization_id: org.id,
        team_id: team.id,
        role: "player",
      },
      { onConflict: "user_id,organization_id" }
    );

  if (roleErr) {
    console.error("Error setting user organization role:", roleErr);
  } else {
    console.log("Role 'player' successfully set in user_organization_roles.");
  }

  // 5. Upsert Player record with adjective = 'invisible' and target email
  console.log("5. Upserting invisible player record...");

  const { data: existingPlayer } = await supabaseAdmin
    .from("players")
    .select("id")
    .or(`email.eq.${targetEmail},user_id.eq.${user.id}`)
    .maybeSingle();

  let playerId = existingPlayer?.id;

  const playerPayload: any = {
    user_id: user.id,
    email: targetEmail,
    organization_id: org.id,
    first_name: "Diego",
    last_name: "Ciria",
    sporting_name: "Diego Ciria",
    adjective: "invisible",
  };

  if (playerId) {
    const { error: updateErr } = await supabaseAdmin
      .from("players")
      .update(playerPayload)
      .eq("id", playerId);

    if (updateErr) {
      console.error("Error updating player record:", updateErr);
    } else {
      console.log(`Player record updated (ID: ${playerId}, adjective: 'invisible').`);
    }
  } else {
    const { data: newPlayer, error: insertErr } = await supabaseAdmin
      .from("players")
      .insert(playerPayload)
      .select("id")
      .single();

    if (insertErr || !newPlayer) {
      console.error("Error inserting player record:", insertErr);
      process.exit(1);
    }
    playerId = newPlayer.id;
    console.log(`New invisible player record created (ID: ${playerId}, adjective: 'invisible').`);
  }

  // 6. Ensure team membership
  console.log("6. Ensuring team membership...");
  if (seasonId) {
    const { data: existingMembership } = await supabaseAdmin
      .from("player_team_memberships")
      .select("id")
      .eq("player_id", playerId)
      .maybeSingle();

    if (!existingMembership) {
      const { error: memberErr } = await supabaseAdmin
        .from("player_team_memberships")
        .insert({
          player_id: playerId,
          team_id: team.id,
          season_id: seasonId,
          status: "active",
          jersey_number: 99,
          positions: ["midfielder"],
          player_type: "main",
        });

      if (memberErr) console.error("Error creating team membership:", memberErr);
      else console.log("Team membership created.");
    } else {
      console.log("Team membership already active.");
    }
  }

  console.log("\n=== SUCCESS: Invisible player setup completed for diego.ciria.lopez@gmail.com ===");
}

main().catch(console.error);
