import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { sendPlayerInvitationEmail } from "../src/lib/email/mailer";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log("🔍 Buscando organización 'SD Almazán'...");
  let { data: org, error: orgErr } = await adminSupabase
    .from("organizations")
    .select("id, name")
    .ilike("name", "%Almazán%")
    .limit(1)
    .maybeSingle();

  if (!org) {
    console.log("No se encontró 'SD Almazán', buscando la primera organización disponible...");
    const { data: firstOrg } = await adminSupabase
      .from("organizations")
      .select("id, name")
      .limit(1)
      .maybeSingle();
      
    if (firstOrg) {
      org = firstOrg;
    } else {
      console.log("Creando organización de prueba 'SD Almazán'...");
      const { data: newOrg, error: createErr } = await adminSupabase
        .from("organizations")
        .insert({ name: "SD Almazán" })
        .select("id, name")
        .single();
        
      if (createErr) {
        console.error("Error al crear organización:", createErr);
        process.exit(1);
      }
      org = newOrg;
    }
  }

  console.log(`✅ Organización seleccionada: ${org.name} (${org.id})`);

  const recipientEmail = "diego.ciria.lopez@gmail.com";
  const recipientName = "Diego Ciria";
  const role = "player";

  // 1. Crear o buscar jugador en la tabla 'players'
  console.log(`👤 Verificando/Creando jugador en plantilla...`);
  let { data: player } = await adminSupabase
    .from("players")
    .select("id")
    .eq("organization_id", org.id)
    .ilike("email", recipientEmail)
    .maybeSingle();

  if (!player) {
    const { data: newPlayer, error: pErr } = await adminSupabase
      .from("players")
      .insert({
        organization_id: org.id,
        first_name: "Diego",
        last_name: "Ciria",
        email: recipientEmail,
      })
      .select("id")
      .single();

    if (pErr) {
      console.warn("Aviso al crear jugador:", pErr.message);
    } else {
      player = newPlayer;
    }
  }

  // 2. Generar invitación en 'player_invitations'
  console.log(`📩 Generando token de invitación...`);
  const { data: invitation, error: invErr } = await adminSupabase
    .from("player_invitations")
    .insert({
      organization_id: org.id,
      email: recipientEmail,
      full_name: recipientName,
      role: role,
      player_id: player?.id || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (invErr || !invitation) {
    console.error("Error al crear la invitación:", invErr);
    process.exit(1);
  }

  console.log(`✅ Invitación registrada con ID: ${invitation.id} y token: ${invitation.token}`);

  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  const invitationUrl = `${baseUrl}/es/invite?token=${invitation.token}&email=${encodeURIComponent(recipientEmail)}`;

  console.log(`🚀 Enviando correo de invitación a ${recipientEmail}...`);
  console.log(`URL de invitación: ${invitationUrl}`);

  const success = await sendPlayerInvitationEmail({
    to: recipientEmail,
    recipientName: recipientName,
    invitationUrl: invitationUrl,
    orgName: org.name,
    roleName: "Jugador",
  });

  if (success) {
    console.log("🎉 Correo enviado con éxito a", recipientEmail);
  } else {
    console.error("❌ Falló el envío del correo.");
  }
}

main().catch(console.error);
