import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppWelcome } from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  try {
    const { userId, email, consentAccepted, token, preferredChannel = "whatsapp", phoneNumber } = await request.json();

    if (!userId || !consentAccepted) {
      return NextResponse.json(
        { error: "Se requiere aceptar la Política de Privacidad de Datos para completar el registro." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Trigger WhatsApp welcome/confirmation message if phone is provided
    if (preferredChannel === "whatsapp" && phoneNumber) {
      try {
        await sendWhatsAppWelcome({
          phoneNumber: phoneNumber.trim(),
          recipientName: email ? email.split("@")[0] : "Usuario",
        });
      } catch (wsErr) {
        console.error("[WhatsApp Dispatch Error]", wsErr);
      }
    }

    // 1. Record GDPR Privacy Policy Consent in user_data_consents
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await adminSupabase
      .from("user_data_consents")
      .upsert({
        user_id: userId,
        consent_type: "privacy_policy",
        version: "1.0",
        accepted: true,
        accepted_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      }, { onConflict: "user_id,consent_type,version" });

    // 2. Process Invitation token or match by Email for Automatic Profile Linking
    let invitationData = null;

    if (token) {
      const { data: inv } = await adminSupabase
        .from("player_invitations")
        .select("*")
        .eq("token", token)
        .single();
      invitationData = inv;
    } else if (email) {
      const { data: inv } = await adminSupabase
        .from("player_invitations")
        .select("*")
        .ilike("email", email.trim())
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invitationData = inv;
    }

    if (invitationData) {
      const { organization_id, role, player_id, id: invId } = invitationData;

      // Assign user_organization_role
      await adminSupabase
        .from("user_organization_roles")
        .upsert({
          user_id: userId,
          organization_id: organization_id,
          role: role || "player",
        }, { onConflict: "user_id,organization_id" });

      const playerUpdateData: any = {
        user_id: userId,
        notification_pref_whatsapp: preferredChannel === "whatsapp",
        notification_pref_email: preferredChannel === "email",
      };
      if (phoneNumber) playerUpdateData.phone_number = phoneNumber;

      // Link player record if applicable
      if (player_id) {
        await adminSupabase
          .from("players")
          .update({
            ...playerUpdateData,
            email: email || invitationData.email,
          })
          .eq("id", player_id);
      } else if (email) {
        // Find by email in players table and link
        await adminSupabase
          .from("players")
          .update(playerUpdateData)
          .ilike("email", email.trim())
          .eq("organization_id", organization_id);
      }

      // Mark invitation as accepted
      await adminSupabase
        .from("player_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invId);

      return NextResponse.json({
        success: true,
        linked: true,
        organizationId: organization_id,
        role: role,
      });
    }

    // 3. Fallback: Search players table directly by email or create new player profile
    if (email) {
      const { data: matchingPlayers } = await adminSupabase
        .from("players")
        .select("id, organization_id")
        .ilike("email", email.trim());

      if (matchingPlayers && matchingPlayers.length > 0) {
        for (const p of matchingPlayers) {
          await adminSupabase
            .from("players")
            .update({ user_id: userId })
            .eq("id", p.id);

          await adminSupabase
            .from("user_organization_roles")
            .upsert({
              user_id: userId,
              organization_id: p.organization_id,
              role: "player",
            }, { onConflict: "user_id,organization_id" });
        }

        return NextResponse.json({
          success: true,
          linked: true,
          count: matchingPlayers.length,
        });
      } else {
        // Auto-create new player row for newly registered player
        const defaultOrgId = "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d";
        const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);
        const fullName = authUser?.user?.user_metadata?.full_name || email.split("@")[0] || "Jugador";
        const parts = fullName.trim().split(" ");
        const firstName = parts[0] || "Jugador";
        const lastName = parts.slice(1).join(" ") || "";

        const { data: existingPlayer } = await adminSupabase
          .from("players")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingPlayer) {
          await adminSupabase
            .from("players")
            .insert({
              organization_id: defaultOrgId,
              user_id: userId,
              email: email.trim().toLowerCase(),
              first_name: firstName,
              last_name: lastName,
              sporting_name: fullName,
              physical_status: "green",
              availability_status: "available",
              notification_pref_whatsapp: preferredChannel === "whatsapp",
              notification_pref_email: preferredChannel === "email",
            });
        }

        await adminSupabase
          .from("user_organization_roles")
          .upsert({
            user_id: userId,
            organization_id: defaultOrgId,
            role: "player",
          }, { onConflict: "user_id,organization_id" });

        return NextResponse.json({
          success: true,
          linked: true,
          createdNew: true,
        });
      }
    }

    return NextResponse.json({ success: true, linked: false });
  } catch (e: any) {
    console.error("[POST /api/auth/register-consent] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
