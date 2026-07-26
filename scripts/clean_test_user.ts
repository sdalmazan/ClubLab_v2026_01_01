import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function cleanUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan variables de entorno Supabase");
    process.exit(1);
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const targetEmail = "diego.ciria.lopez@gmail.com";
  console.log(`🧹 Eliminando datos de prueba para: ${targetEmail}...`);

  // 1. Borrar invitaciones
  const { data: invs, error: invErr } = await adminSupabase
    .from("player_invitations")
    .delete()
    .ilike("email", targetEmail)
    .select();
  console.log(`- Invitaciones eliminadas: ${invs?.length || 0}`);

  // 2. Buscar usuario en Auth
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
  const targetUser = authUsers.users.find(
    (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
  );

  if (targetUser) {
    const userId = targetUser.id;
    console.log(`- Usuario de Auth encontrado ID: ${userId}`);

    // Borrar roles de organización
    await adminSupabase.from("user_organization_roles").delete().eq("user_id", userId);
    console.log("- Roles de organización eliminados");

    // Borrar consentimientos RGPD
    await adminSupabase.from("user_data_consents").delete().eq("user_id", userId);
    console.log("- Consentimientos RGPD eliminados");

    // Desvincular/borrar fichas de jugador
    await adminSupabase.from("players").delete().eq("user_id", userId);
    
    // Eliminar de Auth.users
    const { error: deleteUserErr } = await adminSupabase.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("Error al eliminar usuario de Auth:", deleteUserErr.message);
    } else {
      console.log("✅ Usuario de Supabase Auth eliminado correctamente");
    }
  } else {
    console.log("- No se encontró usuario en Auth con este correo");
  }

  // 3. Limpiar cualquier registro restante en la tabla 'players' por email
  const { data: remainingPlayers } = await adminSupabase
    .from("players")
    .delete()
    .ilike("email", targetEmail)
    .select();
  console.log(`- Fichas de jugador limpiadas por email: ${remainingPlayers?.length || 0}`);

  console.log("✨ Limpieza completada con éxito.");
}

cleanUser().catch(console.error);
