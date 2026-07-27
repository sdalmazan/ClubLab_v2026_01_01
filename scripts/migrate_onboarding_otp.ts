import { config } from "dotenv";
config({ path: ".env.local" });
import { createAdminClient } from "../src/lib/supabase/admin";

async function runMigration() {
  console.log("🚀 Ejecutando migración 031: Onboarding OTP y Canal de Notificaciones...");
  const adminSupabase = createAdminClient();

  // Test selecting from auth_otp_codes to see if table exists or needs creation
  const { error: testErr } = await adminSupabase.from("auth_otp_codes").select("id").limit(1);

  if (testErr) {
    console.log("ℹ️ La tabla auth_otp_codes aún no existe o necesita ser inicializada.");
  } else {
    console.log("✅ La tabla auth_otp_codes está lista.");
  }

  // Update existing player records with default notification_channel if null
  const { data: players, error: fetchErr } = await adminSupabase.from("players").select("id, notification_pref_whatsapp, notification_pref_email, notification_channel");
  
  if (!fetchErr && players) {
    console.log(`📊 Auditando ${players.length} jugadores en base de datos...`);
    for (const player of players) {
      if (!player.notification_channel) {
        let channel = "email";
        if (player.notification_pref_whatsapp && !player.notification_pref_email) {
          channel = "whatsapp";
        }
        await adminSupabase.from("players").update({
          notification_channel: channel,
          email_verified: false,
          whatsapp_verified: false
        }).eq("id", player.id);
      }
    }
    console.log("✨ Migración de jugadores existentes completada.");
  }

  console.log("🎉 Proceso de migración 031 finalizado.");
}

runMigration().catch((err) => {
  console.error("❌ Error en la migración:", err);
});
