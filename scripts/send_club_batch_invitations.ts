import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendPlayerInvitationEmail } from "../src/lib/email/mailer";

interface ClubMember {
  fullName: string;
  email: string;
  role: "head_coach" | "assistant_coach" | "physical_coach" | "physio" | "club_admin" | "player";
  roleDescription: string;
}

const CLUB_MEMBERS: ClubMember[] = [
  { fullName: "Pablo Ayuso", email: "pabloayuso13@hotmail.com", role: "head_coach", roleDescription: "Primer Entrenador" },
  { fullName: "Yago Mata", email: "yago.matrod@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Jesús Bernardo Villanueva", email: "jbvillalato@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Víctor Moreno", email: "morenomonux@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Toni Varea", email: "tonivarea01@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Álvaro Neves", email: "alvaronevesvinaras@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Daniel Madruga", email: "danimadrugah@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Sergio Santacruz", email: "Sergiosanta10@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Rafael Checa", email: "rchecam@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Hugo Jiménez", email: "hugojimenezgarcia10@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Javier Márquez", email: "marquezjavier19@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Marcos Gil", email: "marcosgil4.mg@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Ebraima", email: "ebri1970@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Arturo", email: "arturohanton@gmail.com", role: "physical_coach", roleDescription: "Preparador Físico" },
  { fullName: "Óscar Miñana", email: "oscarminana@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Dani Martínez", email: "danimartinezg93@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Hame", email: "hamelinjawara77@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Ángel Losilla", email: "angellosilla1797@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Javier García Albitre", email: "albitre1996@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Narci", email: "igjavi1@hotmail.com", role: "physio", roleDescription: "Fisioterapeuta" },
  { fullName: "Hugo Martinez", email: "hugomboutefeu@gmail.com", role: "player", roleDescription: "Jugador" },
  { fullName: "Carlos Ortega", email: "ortegagalvez@hotmail.com", role: "assistant_coach", roleDescription: "Segundo Entrenador" },
  { fullName: "Héctor Lapeña", email: "hectorlapenamartinez@gmail.com", role: "club_admin", roleDescription: "Administrador del Club" },
];

async function main() {
  console.log("======================================================================");
  console.log(`🚀 ENVÍO MASIVO DE INVITACIONES S.D. ALMAZÁN (${CLUB_MEMBERS.length} MIEMBROS)`);
  console.log("======================================================================");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Get S.D. Almazán Organization ID
  console.log("\n🔍 Buscando organización 'S.D. Almazán'...");
  let { data: org } = await adminSupabase
    .from("organizations")
    .select("id, name")
    .ilike("name", "%Almazán%")
    .limit(1)
    .maybeSingle();

  if (!org) {
    console.log("Creando organización S.D. Almazán...");
    const { data: newOrg } = await adminSupabase
      .from("organizations")
      .insert({ name: "S.D. Almazán" })
      .select("id, name")
      .single();
    org = newOrg;
  }

  console.log(`✅ Organización confirmada: ${org.name} (${org.id})\n`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < CLUB_MEMBERS.length; i++) {
    const member = CLUB_MEMBERS[i];
    const indexStr = `[${i + 1}/${CLUB_MEMBERS.length}]`;
    const cleanEmail = member.email.trim().toLowerCase();

    console.log(`${indexStr} Procesando: ${member.fullName} (${member.roleDescription}) <${cleanEmail}>`);

    try {
      // Create or update Player/Staff record in players table
      let playerId: string | null = null;
      if (member.role === "player") {
        const { data: existingPlayer } = await adminSupabase
          .from("players")
          .select("id")
          .eq("organization_id", org.id)
          .ilike("email", cleanEmail)
          .limit(1)
          .maybeSingle();

        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          const nameParts = member.fullName.trim().split(" ");
          const { data: newPlayer } = await adminSupabase
            .from("players")
            .insert({
              organization_id: org.id,
              first_name: nameParts[0] || member.fullName,
              last_name: nameParts.slice(1).join(" ") || "Jugador",
              email: cleanEmail,
              notification_channel: "email",
              email_verified: false,
            })
            .select("id")
            .single();

          if (newPlayer) playerId = newPlayer.id;
        }
      }

      // Generate Invitation Token
      const token = crypto.randomUUID();

      // Delete existing pending invitations for this email
      await adminSupabase
        .from("player_invitations")
        .delete()
        .eq("organization_id", org.id)
        .ilike("email", cleanEmail);

      // Insert new invitation
      const { error: invErr } = await adminSupabase.from("player_invitations").insert({
        organization_id: org.id,
        player_id: playerId,
        full_name: member.fullName,
        email: cleanEmail,
        token,
        role: member.role,
        status: "pending",
      });

      if (invErr) {
        console.error(`❌ Error al crear invitación para ${member.fullName}:`, invErr.message);
        failCount++;
        continue;
      }

      const inviteUrl = `${appUrl}/invite?token=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanEmail)}`;

      // Dispatch Email
      const emailSent = await sendPlayerInvitationEmail({
        to: cleanEmail,
        playerName: member.fullName,
        clubName: org.name,
        invitationUrl: inviteUrl,
      });

      if (emailSent) {
        console.log(`  ✅ Correo enviado a ${cleanEmail} (Rol: ${member.role})`);
        successCount++;
      } else {
        console.error(`  ❌ Error al enviar correo de invitación a ${cleanEmail}`);
        failCount++;
      }
    } catch (e: any) {
      console.error(`  ❌ Excepción con ${member.fullName}:`, e.message);
      failCount++;
    }
  }

  console.log("\n======================================================================");
  console.log(`🎉 PROCESO DE INVITACIONES FINALIZADO`);
  console.log(`- Exitosos: ${successCount}`);
  console.log(`- Fallidos: ${failCount}`);
  console.log("======================================================================");
}

main().catch((err) => console.error("Error en envío masivo de invitaciones:", err));
