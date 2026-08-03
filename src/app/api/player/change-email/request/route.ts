import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailAlert } from "@/lib/email/mailer";
import crypto from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { newEmail } = await request.json();
    if (!newEmail || !newEmail.includes("@")) {
      return NextResponse.json({ error: "Introduce un correo electrónico válido." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const normalizedNewEmail = newEmail.trim().toLowerCase();
    const oldEmail = user.email?.trim().toLowerCase();

    if (oldEmail === normalizedNewEmail) {
      return NextResponse.json({ error: "El nuevo correo es idéntico al actual." }, { status: 400 });
    }

    // Check if new email is already taken by another active player
    const { data: existingPlayer } = await adminSupabase
      .from("players")
      .select("id")
      .ilike("email", normalizedNewEmail)
      .neq("user_id", user.id)
      .maybeSingle();

    if (existingPlayer) {
      return NextResponse.json({
        error: "Este correo electrónico ya está registrado por otro futbolista en la plataforma. No se permiten registros duplicados de jugadores.",
      }, { status: 400 });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Store token in player_invitations table with role email_change_confirm
    await adminSupabase.from("player_invitations").insert({
      organization_id: "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d",
      email: normalizedNewEmail,
      token: token,
      role: "email_change_confirm",
      status: "pending",
      expires_at: expiresAt,
      metadata: {
        userId: user.id,
        oldEmail: oldEmail,
        newEmail: normalizedNewEmail,
      },
    });

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";
    const confirmUrl = `${appBaseUrl}/api/player/change-email/confirm?token=${token}`;

    // Send confirmation link strictly to the OLD EMAIL ADDRESS
    if (oldEmail) {
      await sendEmailAlert({
        to: oldEmail,
        recipientName: user.user_metadata?.full_name || "Jugador",
        title: "Confirmación de Desvinculación de Correo Antiguo",
        body: `Hemos recibido una solicitud para desvincular este correo electrónico de tu ficha de jugador y sustituirlo por el nuevo correo: ${normalizedNewEmail}.\n\n` +
          `Por motivos de seguridad, para desvincular y eliminar tu correo antiguo debes confirmar la operación haciendo clic en el enlace de abajo:`,
        actionUrl: confirmUrl,
        actionText: "Dar OK y Eliminar Correo Antiguo",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Se ha enviado un correo de verificación a tu dirección antigua (${oldEmail}). Debes abrir ese mensaje y hacer clic en el enlace para dar el OK a la eliminación del correo antiguo.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar la solicitud de cambio de correo." }, { status: 500 });
  }
}
