import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

interface StaffDefinition {
  email: string;
  fullName: string;
  role: "head_coach" | "assistant_coach" | "physical_coach" | "physio" | "club_admin";
}

const STAFF_MEMBERS: StaffDefinition[] = [
  { email: "pabloayuso13@hotmail.com", fullName: "Pablo Ayuso", role: "head_coach" },
  { email: "ortegagalvez@hotmail.com", fullName: "Carlos Ortega", role: "assistant_coach" },
  { email: "arturohanton@gmail.com", fullName: "Arturo", role: "physical_coach" },
  { email: "igjavi1@hotmail.com", fullName: "Narci", role: "physio" },
  { email: "hectorlapenamartinez@gmail.com", fullName: "Héctor Lapeña", role: "club_admin" },
];

async function main() {
  const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: org } = await adminSupabase
    .from("organizations")
    .select("id, name")
    .ilike("name", "%Almazán%")
    .limit(1)
    .single();

  console.log(`======================================================================`);
  console.log(`🔧 REVISIÓN Y CORRECCIÓN DE ROLES DE CUERPO TÉCNICO Y DIRECCIÓN - S.D. Almazán`);
  console.log(`======================================================================\n`);

  const { data: usersList } = await adminSupabase.auth.admin.listUsers();

  for (const staff of STAFF_MEMBERS) {
    const cleanEmail = staff.email.trim().toLowerCase();
    console.log(`👉 Corrigiendo perfil para: ${staff.fullName} <${cleanEmail}> (Rol: ${staff.role})...`);

    // 1. Delete staff from 'players' table if accidentally inserted as squad player
    const { data: existingPlayer } = await adminSupabase
      .from("players")
      .select("id")
      .eq("organization_id", org!.id)
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle();

    if (existingPlayer) {
      console.log(`   └─ Eliminando ficha de jugador de la plantilla para ${staff.fullName} (ID: ${existingPlayer.id})`);
      await adminSupabase.from("players").delete().eq("id", existingPlayer.id);
    }

    // 2. Find Auth user if registered
    const authUser = usersList.users.find((u) => u.email?.toLowerCase() === cleanEmail);

    if (authUser) {
      console.log(`   └─ Usuario Auth encontrado (${authUser.id}). Actualizando metadatos...`);

      // Update Auth Metadata with proper name and role
      await adminSupabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          full_name: staff.fullName,
          role: staff.role,
        },
      });

      // Update or Insert in user_organization_roles with exact staff role
      await adminSupabase.from("user_organization_roles").upsert(
        {
          user_id: authUser.id,
          organization_id: org!.id,
          role: staff.role,
        },
        { onConflict: "user_id,organization_id" }
      );

      console.log(`   ✅ Rol de ${staff.fullName} actualizado a "${staff.role}" en user_organization_roles.`);
    } else {
      console.log(`   ℹ️ El usuario ${staff.fullName} aún no se ha registrado en la plataforma.`);
    }

    // 3. Ensure player_invitations has proper role and full_name
    await adminSupabase
      .from("player_invitations")
      .update({
        full_name: staff.fullName,
        role: staff.role,
        player_id: null,
      })
      .eq("organization_id", org!.id)
      .ilike("email", cleanEmail);
  }

  console.log("\n======================================================================");
  console.log(`🎉 CORRECCIÓN DE ROLES DE CUERPO TÉCNICO COMPLETADA`);
  console.log("======================================================================");
}

main().catch((err) => console.error("Error en corrección de staff:", err));
