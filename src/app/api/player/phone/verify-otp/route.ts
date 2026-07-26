import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppWelcome } from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await request.json();

    if (!code || code.trim().length !== 6) {
      return NextResponse.json({ error: "El código de verificación debe tener 6 dígitos." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: player } = await adminSupabase
      .from("players")
      .select("id, first_name, phone_number, phone_verification_code, phone_verification_expires_at")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: "No se encontró ficha de jugador vinculada." }, { status: 404 });
    }

    if (!player.phone_verification_code || player.phone_verification_code !== code.trim()) {
      return NextResponse.json({ error: "El código de verificación introducido es incorrecto." }, { status: 400 });
    }

    if (player.phone_verification_expires_at && new Date(player.phone_verification_expires_at) < new Date()) {
      return NextResponse.json({ error: "El código de verificación ha caducado. Solicita uno nuevo." }, { status: 400 });
    }

    // Mark phone as verified & enable WhatsApp notifications preference
    await adminSupabase
      .from("players")
      .update({
        phone_verified: true,
        phone_verification_code: null,
        phone_verification_expires_at: null,
        notification_pref_whatsapp: true,
      })
      .eq("id", player.id);

    // Send Welcome WhatsApp Message
    if (player.phone_number) {
      sendWhatsAppWelcome({
        phoneNumber: player.phone_number,
        recipientName: player.first_name || "Jugador",
      }).catch((err) => {
        console.error("[WhatsApp Welcome Warning]", err.message);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Teléfono verificado correctamente. Avisos por WhatsApp activados.",
    });
  } catch (e: any) {
    console.error("[POST /api/player/phone/verify-otp] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
