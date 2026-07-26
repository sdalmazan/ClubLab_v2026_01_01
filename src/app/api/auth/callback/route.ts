import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const role = searchParams.get("role");
  const token = searchParams.get("token");
  const preferredChannel = searchParams.get("preferredChannel") ?? "whatsapp";
  const queryPhone = searchParams.get("phone");

  if (code) {
    const supabase = await createClient();
    
    // Check if user is already logged in (e.g. double-request scenario)
    const { data: { user: existingUser } } = await supabase.auth.getUser();
    let targetUser = existingUser;

    if (!targetUser) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("❌ Error in exchangeCodeForSession:", error.message, error);
      }
      targetUser = data?.user ?? null;
    }

    if (targetUser) {
      const metadata = targetUser.user_metadata || {};
      const currentRole = metadata.role;
      const assignedRole = role || currentRole || "club_admin";

      if (!currentRole && role) {
        await supabase.auth.updateUser({
          data: { role: assignedRole }
        });
      }

      // Extract Google Profile Metadata (excluding avatar photo)
      const email = targetUser.email || metadata.email;
      const fullName = metadata.full_name || metadata.name || [metadata.given_name, metadata.family_name].filter(Boolean).join(" ");
      const firstName = metadata.given_name || fullName.split(" ")[0] || "Jugador";
      const lastName = metadata.family_name || fullName.split(" ").slice(1).join(" ") || "";
      const phoneNumber = queryPhone || metadata.phone_number || metadata.phone || null;
      const dateOfBirth = metadata.birthdate || metadata.birthday || metadata.date_of_birth || null;

      try {
        const adminSupabase = createAdminClient();

        // 1. Record RGPD Consent for Google OAuth Signups
        const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        await adminSupabase
          .from("user_data_consents")
          .upsert({
            user_id: targetUser.id,
            consent_type: "privacy_policy",
            version: "1.0",
            accepted: true,
            accepted_at: new Date().toISOString(),
            ip_address: ipAddress,
            user_agent: userAgent,
          }, { onConflict: "user_id,consent_type,version" });

        // 2. Process Invitation token if present
        let invitation = null;
        if (token) {
          const { data: inv } = await adminSupabase
            .from("player_invitations")
            .select("*")
            .eq("token", token)
            .single();
          invitation = inv;
        } else if (email) {
          const { data: inv } = await adminSupabase
            .from("player_invitations")
            .select("*")
            .ilike("email", email.trim())
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          invitation = inv;
        }

        if (invitation) {
          // Assign user_organization_role
          await adminSupabase
            .from("user_organization_roles")
            .upsert({
              user_id: targetUser.id,
              organization_id: invitation.organization_id,
              role: invitation.role || assignedRole,
            }, { onConflict: "user_id,organization_id" });

          const playerUpdate: any = {
            user_id: targetUser.id,
            email: email,
            notification_pref_whatsapp: preferredChannel === "whatsapp",
            notification_pref_email: preferredChannel === "email",
          };

          if (phoneNumber) playerUpdate.phone_number = phoneNumber;
          if (dateOfBirth) playerUpdate.date_of_birth = dateOfBirth;

          if (invitation.player_id) {
            await adminSupabase
              .from("players")
              .update(playerUpdate)
              .eq("id", invitation.player_id);
          } else {
            await adminSupabase
              .from("players")
              .update(playerUpdate)
              .ilike("email", email.trim())
              .eq("organization_id", invitation.organization_id);
          }

          // Mark invitation accepted
          await adminSupabase
            .from("player_invitations")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
            })
            .eq("id", invitation.id);
        } else if (email) {
          // Fallback: search players table directly by email
          const { data: matchingPlayers } = await adminSupabase
            .from("players")
            .select("id, organization_id")
            .ilike("email", email.trim());

          if (matchingPlayers && matchingPlayers.length > 0) {
            for (const p of matchingPlayers) {
              const playerUpdate: any = {
                user_id: targetUser.id,
                notification_pref_whatsapp: preferredChannel === "whatsapp",
                notification_pref_email: preferredChannel === "email",
              };

              if (phoneNumber) playerUpdate.phone_number = phoneNumber;
              if (dateOfBirth) playerUpdate.date_of_birth = dateOfBirth;

              await adminSupabase
                .from("players")
                .update(playerUpdate)
                .eq("id", p.id);

              await adminSupabase
                .from("user_organization_roles")
                .upsert({
                  user_id: targetUser.id,
                  organization_id: p.organization_id,
                  role: assignedRole,
                }, { onConflict: "user_id,organization_id" });
            }
          }
        }
      } catch (err: any) {
        console.error("⚠️ Error processing Google OAuth metadata linking:", err.message);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page or login with error param
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
