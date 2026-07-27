import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneNumber } from "@/lib/whatsapp/service";
import { dispatchClubNotification } from "@/lib/notifications/router";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, fullName, email, password, preferredChannel = "email", phoneNumber, privacyAccepted } = body;

    if (!token) {
      return NextResponse.json({ error: "Token de invitación obligatorio." }, { status: 400 });
    }

    if (!privacyAccepted) {
      return NextResponse.json({ error: "Debes aceptar la Política de Privacidad RGPD para continuar." }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Validate Invitation Server-Side
    const { data: invitation, error: invErr } = await adminSupabase
      .from("player_invitations")
      .select("*, organizations(name)")
      .eq("token", token)
      .single();

    if (invErr || !invitation) {
      return NextResponse.json({ error: "La invitación no es válida o ha expirado." }, { status: 404 });
    }

    if (invitation.status === "accepted") {
      return NextResponse.json({ error: "Esta invitación ya ha sido utilizada previamente." }, { status: 400 });
    }

    const targetEmail = invitation.email || email;
    const orgName = (invitation as any)?.organizations?.name || "S.D. Almazán";
    const role = invitation.role || "player";
    const organizationId = invitation.organization_id;

    // 2. Validate OTP Verification Server-Side for Selected Channel
    let cleanPhone = "";
    if (preferredChannel === "whatsapp") {
      if (!phoneNumber) {
        return NextResponse.json({ error: "El número de WhatsApp es obligatorio." }, { status: 400 });
      }
      const norm = normalizePhoneNumber(phoneNumber);
      cleanPhone = norm.cleanPhone;
      const digitsOnly = norm.digitsOnly;

      const { data: verifiedOtp } = await adminSupabase
        .from("auth_otp_codes")
        .select("id")
        .eq("identifier", digitsOnly)
        .eq("channel", "whatsapp")
        .not("verified_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (!verifiedOtp) {
        return NextResponse.json({ error: "El número de WhatsApp debe ser verificado por código OTP antes de activar la cuenta." }, { status: 400 });
      }
    } else {
      const { data: verifiedOtp } = await adminSupabase
        .from("auth_otp_codes")
        .select("id")
        .eq("identifier", targetEmail.trim().toLowerCase())
        .eq("channel", "email")
        .not("verified_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (!verifiedOtp) {
        return NextResponse.json({ error: "El correo electrónico debe ser verificado por código OTP antes de activar la cuenta." }, { status: 400 });
      }
    }

    // 3. Create or Confirm User in Supabase Auth (email_confirm: true avoids automatic Supabase link emails)
    let authUserId: string;
    const { data: usersList } = await adminSupabase.auth.admin.listUsers();
    const existingUser = usersList.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

    if (existingUser) {
      authUserId = existingUser.id;
      await adminSupabase.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      });
    } else {
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: targetEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      });

      if (createError || !newUser.user) {
        throw new Error(createError?.message || "No se pudo crear la cuenta de usuario.");
      }
      authUserId = newUser.user.id;
    }

    // 4. Assign Role in user_organization_roles (Derive role from invitation, NEVER client input)
    await adminSupabase.from("user_organization_roles").upsert(
      {
        user_id: authUserId,
        organization_id: organizationId,
        role: role || "player",
      },
      { onConflict: "user_id,organization_id" }
    );

    // 5. Link Player Profile in players table (ONLY if role is player or explicit player_id exists)
    const userRole = role || "player";
    const isPlayerRole = userRole === "player";
    const redirectUrl = isPlayerRole ? "/player" : "/dashboard";

    const playerUpdateData: any = {
      user_id: authUserId,
      email: targetEmail,
      notification_channel: preferredChannel,
      email_verified: preferredChannel === "email",
      email_verified_at: preferredChannel === "email" ? new Date().toISOString() : null,
      whatsapp_verified: preferredChannel === "whatsapp",
      whatsapp_verified_at: preferredChannel === "whatsapp" ? new Date().toISOString() : null,
      notification_pref_whatsapp: preferredChannel === "whatsapp",
      notification_pref_email: preferredChannel === "email",
    };

    if (cleanPhone) {
      playerUpdateData.phone_number = cleanPhone;
    }

    let targetPlayerId: string | null = invitation.player_id;

    if (targetPlayerId) {
      await adminSupabase.from("players").update(playerUpdateData).eq("id", targetPlayerId);
    } else {
      const { data: matchingPlayer } = await adminSupabase
        .from("players")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("email", targetEmail.trim())
        .limit(1)
        .maybeSingle();

      if (matchingPlayer) {
        targetPlayerId = matchingPlayer.id;
        await adminSupabase.from("players").update(playerUpdateData).eq("id", targetPlayerId);
      } else if (isPlayerRole) {
        // Create new player record ONLY for player role
        const nameParts = fullName.trim().split(" ");
        const { data: newPlayer } = await adminSupabase
          .from("players")
          .insert({
            organization_id: organizationId,
            first_name: nameParts[0] || fullName,
            last_name: nameParts.slice(1).join(" ") || "Jugador",
            ...playerUpdateData,
          })
          .select("id")
          .single();
        if (newPlayer) targetPlayerId = newPlayer.id;
      }
    }

    // 6. Record RGPD Consent
    await adminSupabase.from("user_data_consents").upsert(
      {
        user_id: authUserId,
        consent_type: "privacy_policy",
        version: "1.0",
        accepted: true,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,consent_type,version" }
    );

    // 7. Mark Invitation as Accepted
    await adminSupabase
      .from("player_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("token", token);

    // 8. Dispatch Admin Registration Alert to diecilo7@gmail.com
    try {
      const { sendRegistrationNotificationAlert } = await import("@/lib/email/mailer");
      await sendRegistrationNotificationAlert({
        newUserName: fullName,
        newUserEmail: targetEmail,
        newUserRole: userRole,
        organizationName: orgName,
      });
    } catch (alertErr) {
      console.warn("[Registration Alert Warning] Could not dispatch alert email:", alertErr);
    }

    // 9. Dispatch ONE Single Welcome Message via Active Channel
    if (targetPlayerId) {
      await dispatchClubNotification({
        playerId: targetPlayerId,
        title: `¡Bienvenido a ${orgName}!`,
        body: `Hola ${fullName}, tu cuenta de ${isPlayerRole ? "Jugador" : "Entrenador/Staff"} ha sido activada correctamente en ${orgName}. Tu canal de notificaciones activo es ${preferredChannel === "whatsapp" ? "WhatsApp" : "Correo Electrónico"}.`,
        actionUrl: redirectUrl,
        actionText: isPlayerRole ? "Entrar a Mi Perfil de Jugador" : "Acceder al Panel de Control",
      });
    }

    return NextResponse.json({
      success: true,
      role: userRole,
      redirectUrl: redirectUrl,
      message: "Cuenta activada correctamente.",
    });
  } catch (err: any) {
    console.error("[POST /api/auth/complete-onboarding] Error:", err);
    return NextResponse.json({ error: err.message || "Error al activar la cuenta." }, { status: 500 });
  }
}
