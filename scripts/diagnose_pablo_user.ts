import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const email = "pabloayuso13@hotmail.com";
  console.log(`🔍 Buscando usuario en Supabase Auth y DB para: ${email}...`);

  // 1. Auth User
  const { data: usersList } = await adminSupabase.auth.admin.listUsers();
  const user = usersList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    console.log(`✅ Usuario Auth encontrado! ID: ${user.id}`);
    console.log(`   └─ Email: ${user.email}`);
    console.log(`   └─ Metadata:`, user.user_metadata);

    // 2. Roles in user_organization_roles
    const { data: roles } = await adminSupabase
      .from("user_organization_roles")
      .select("*")
      .eq("user_id", user.id);
    console.log(`   └─ Roles en user_organization_roles:`, roles);

    // 3. Check player_invitations
    const { data: invite } = await adminSupabase
      .from("player_invitations")
      .select("*")
      .eq("email", email);
    console.log(`   └─ Registro en player_invitations:`, invite);

    // 4. Check players table
    const { data: player } = await adminSupabase
      .from("players")
      .select("*")
      .eq("user_id", user.id);
    console.log(`   └─ Registro en players table:`, player);
  } else {
    console.log(`❌ No se encontró usuario Auth para ${email}.`);
  }
}

main();
