import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env vars");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const email = "pabloayuso13@hotmail.com";
  console.log(`Checking DB status for ${email}...`);

  // 1. Check auth.users
  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
  const user = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    console.log(`Found Auth User: ID = ${user.id}, Email = ${user.email}`);

    // 2. Check user_organization_roles
    const { data: roles, error: rolesErr } = await supabase
      .from("user_organization_roles")
      .select("*")
      .eq("user_id", user.id);
    
    console.log("Current user_organization_roles:", roles);

    // Update role to head_coach if not set or incorrect
    for (const r of roles || []) {
      if (r.role !== "head_coach") {
        console.log(`Updating role in org ${r.organization_id} from ${r.role} to head_coach...`);
        await supabase
          .from("user_organization_roles")
          .update({ role: "head_coach" })
          .eq("id", r.id);
      }
    }

    if (!roles || roles.length === 0) {
      console.log("No organization role found. Looking up S.D. Almazán org...");
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", "%Almazán%")
        .single();
      if (org) {
        console.log(`Inserting head_coach role for org ${org.id}...`);
        await supabase
          .from("user_organization_roles")
          .insert({
            user_id: user.id,
            organization_id: org.id,
            role: "head_coach",
          });
      }
    }

    // 3. Check players table
    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, user_id, email")
      .or(`user_id.eq.${user.id},email.ilike.${email}`);

    console.log("Players table records linked to Pablo Ayuso:", players);
    if (players && players.length > 0) {
      for (const p of players) {
        if (p.user_id === user.id) {
          console.log(`Unlinking user_id ${user.id} from player record ${p.id} (${p.first_name} ${p.last_name}) so Pablo is not treated as a squad player...`);
          await supabase.from("players").update({ user_id: null }).eq("id", p.id);
        }
      }
    }
  } else {
    console.log(`No Auth User found for ${email}.`);
  }

  // 4. Check player_invitations
  const { data: invs } = await supabase
    .from("player_invitations")
    .select("*")
    .ilike("email", email);

  console.log("Player invitations for Pablo Ayuso:", invs);
  for (const inv of invs || []) {
    if (inv.role !== "head_coach") {
      console.log(`Updating invitation ${inv.id} role to head_coach...`);
      await supabase.from("player_invitations").update({ role: "head_coach" }).eq("id", inv.id);
    }
  }

  console.log("DONE!");
}

main().catch(console.error);
