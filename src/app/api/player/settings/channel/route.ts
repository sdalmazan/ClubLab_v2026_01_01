import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoneNumber } from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { playerId, newChannel, identifier, otpCode } = await request.json();

    if (!newChannel || !["email", "whatsapp"].includes(newChannel)) {
      return NextResponse.json({ error: "Canal inválido (debe ser 'email' o 'whatsapp')." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Verify player belongs to active user or organization
    const { data: player, error: pErr } = await adminSupabase
      .from("players")
      .select("id, user_id, notification_channel, email_verified, whatsapp_verified, phone_number, email")
      .eq("id", playerId)
      .single();

    if (pErr || !player) {
      return NextResponse.json({ error: "Perfil de jugador no encontrado." }, { status: 404 });
    }

    if (player.user_id !== user.id) {
      // Check admin status override
      const { data: orgRole } = await adminSupabase
        .from("user_organization_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const isStaff = ["super_admin", "club_admin", "head_coach"].includes(orgRole?.role || "");
      if (!isStaff && user.email !== "diecilo7@gmail.com") {
        return NextResponse.json({ error: "No tienes permisos para modificar las preferencias de este jugador." }, { status: 403 });
      }
    }

    // Verify target channel OTP
    let targetIdentifier = identifier || (newChannel === "email" ? player.email : player.phone_number);

    if (newChannel === "whatsapp") {
      const norm = normalizePhoneNumber(targetIdentifier);
      targetIdentifier = norm.digitsOnly;
    } else {
      targetIdentifier = targetIdentifier?.trim().toLowerCase();
    }

    const { data: verifiedOtp } = await adminSupabase
      .from("auth_otp_codes")
      .select("id")
      .eq("identifier", targetIdentifier)
      .eq("channel", newChannel)
      .not("verified_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (!verifiedOtp) {
      return NextResponse.json({
        error: `Debes verificar el nuevo canal (${newChannel === "whatsapp" ? "WhatsApp" : "Correo"}) mediante código OTP antes de poder activarlo.`,
      }, { status: 400 });
    }

    // ATOMIC CHANNEL MUTATION
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      notification_channel: newChannel,
      channel_last_changed_at: nowIso,
      notification_pref_whatsapp: newChannel === "whatsapp",
      notification_pref_email: newChannel === "email",
    };

    if (newChannel === "whatsapp") {
      updatePayload.whatsapp_verified = true;
      updatePayload.whatsapp_verified_at = nowIso;
      if (identifier) updatePayload.phone_number = normalizePhoneNumber(identifier).cleanPhone;
    } else {
      updatePayload.email_verified = true;
      updatePayload.email_verified_at = nowIso;
      if (identifier) updatePayload.email = identifier;
    }

    const { error: updateErr } = await adminSupabase
      .from("players")
      .update(updatePayload)
      .eq("id", player.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      activeChannel: newChannel,
      message: `Canal de notificaciones actualizado correctamente a ${newChannel === "whatsapp" ? "WhatsApp" : "Correo Electrónico"}.`,
    });
  } catch (err: any) {
    console.error("[POST /api/player/settings/channel] Error:", err);
    return NextResponse.json({ error: err.message || "Error al cambiar de canal." }, { status: 500 });
  }
}
