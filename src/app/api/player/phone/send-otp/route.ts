import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppOTP } from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return NextResponse.json({ error: "Introduce un número de teléfono válido con prefijo del país (ej. +34600000000)." }, { status: 400 });
    }

    const cleanPhone = phoneNumber.trim();

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const adminSupabase = createAdminClient();

    // Update in players table for matching user_id or email
    const { data: player } = await adminSupabase
      .from("players")
      .select("id, first_name")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (player) {
      await adminSupabase
        .from("players")
        .update({
          phone_number: cleanPhone,
          phone_verified: false,
          phone_verification_code: code,
          phone_verification_expires_at: expiresAt,
        })
        .eq("id", player.id);

      await sendWhatsAppOTP({
        phoneNumber: cleanPhone,
        code,
        recipientName: player.first_name,
      });

      return NextResponse.json({
        success: true,
        message: `Código de 6 dígitos enviado por WhatsApp a ${cleanPhone}`,
      });
    }

    return NextResponse.json({ error: "No se encontró ficha de jugador vinculada." }, { status: 404 });
  } catch (e: any) {
    console.error("[POST /api/player/phone/send-otp] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
