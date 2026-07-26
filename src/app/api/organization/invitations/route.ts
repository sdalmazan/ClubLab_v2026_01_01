import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPlayerInvitationEmail } from "@/lib/email/mailer";

// GET /api/organization/invitations?token=xxx -> Read invitation details for signup form
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token parameter" }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: invitation, error } = await adminSupabase
      .from("player_invitations")
      .select("*, organizations(name)")
      .eq("token", token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitación no encontrada o token inválido." }, { status: 404 });
    }

    if (invitation.status === "accepted") {
      return NextResponse.json({ error: "Esta invitación ya ha sido utilizada." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        fullName: invitation.full_name,
        role: invitation.role,
        organizationName: (invitation as any).organizations?.name || "tu club",
        token: invitation.token,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/organization/invitations -> Create invitation & send email
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, organizations(name)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    const { email, fullName, role = "player", teamId } = await request.json();

    if (!email || !fullName) {
      return NextResponse.json({ error: "El correo y el nombre completo son obligatorios" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const organizationId = orgRole.organization_id;
    const orgName = (orgRole as any).organizations?.name || "ClubLab";

    // 1. Check if player entity exists or create a draft in players table
    let playerId: string | null = null;
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.slice(1).join(" ") || "Registrado";

    const { data: existingPlayer } = await adminSupabase
      .from("players")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email.trim())
      .limit(1)
      .maybeSingle();

    if (existingPlayer) {
      playerId = existingPlayer.id;
    } else {
      // Create draft player profile
      const { data: newPlayer, error: playerErr } = await adminSupabase
        .from("players")
        .insert({
          organization_id: organizationId,
          first_name: firstName,
          last_name: lastName,
          email: email.trim(),
        })
        .select("id")
        .single();

      if (!playerErr && newPlayer) {
        playerId = newPlayer.id;
      }
    }

    // 2. Create invitation record
    const { data: invitation, error: invErr } = await adminSupabase
      .from("player_invitations")
      .insert({
        organization_id: organizationId,
        email: email.trim(),
        full_name: fullName.trim(),
        role: role,
        player_id: playerId,
        status: "pending",
      })
      .select("*")
      .single();

    if (invErr || !invitation) {
      throw new Error(invErr?.message || "No se pudo crear la invitación.");
    }

    // 3. Send email invite with registration URL containing token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";
    const invitationUrl = `${appUrl}/es/invite?token=${invitation.token}&email=${encodeURIComponent(email)}`;

    const roleName = role === "player" ? "Jugador" : role === "head_coach" ? "Entrenador" : "Staff Técnico";

    await sendPlayerInvitationEmail({
      to: email.trim(),
      recipientName: fullName,
      invitationUrl,
      orgName,
      roleName,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        invitationUrl,
      },
    });
  } catch (e: any) {
    console.error("[POST /api/organization/invitations] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
