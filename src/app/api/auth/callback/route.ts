import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationConfirmationEmail } from "@/lib/email/mailer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/dashboard";
  const role = searchParams.get("role");
  const token = searchParams.get("token");
  const preferredChannel = searchParams.get("preferredChannel") ?? "whatsapp";
  const queryPhone = searchParams.get("phone");

  // Force public base URL to prevent localhost:3000 redirects in production
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clublab.vercel.app";

  if (code) {
    const supabase = await createClient();
    
    // Check if user is already logged in
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
      const assignedRole = role || currentRole || "player";

      if (!currentRole && role) {
        await supabase.auth.updateUser({
          data: { role: assignedRole }
        });
      }

      const email = targetUser.email || metadata.email;
      const fullName = metadata.full_name || metadata.name || [metadata.given_name, metadata.family_name].filter(Boolean).join(" ") || "Jugador";
      const phoneNumber = queryPhone || metadata.phone_number || metadata.phone || null;
      const dateOfBirth = metadata.birthdate || metadata.birthday || metadata.date_of_birth || null;

      try {
        const adminSupabase = createAdminClient();

        // 1. Record RGPD Consent
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
        let invitation: any = null;
        if (token) {
          const { data: inv } = await adminSupabase
            .from("player_invitations")
            .select("*, organizations(name)")
            .eq("token", token)
            .single();
          invitation = inv;
        } else if (email) {
          const { data: inv } = await adminSupabase
            .from("player_invitations")
            .select("*, organizations(name)")
            .ilike("email", email.trim())
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          invitation = inv;
        }

        const explicitNext = searchParams.get("next");
        const effectiveRole = invitation?.role || assignedRole;

        // If explicit next parameter (such as /reset-password) was provided, NEVER overwrite it!
        if (!explicitNext && effectiveRole === "player") {
          next = "/player";
        }

        const orgName = (invitation as any)?.organizations?.name || "S.D. Almazán";

        if (invitation) {
          // Assign user_organization_role
          await adminSupabase
            .from("user_organization_roles")
            .upsert({
              user_id: targetUser.id,
              organization_id: invitation.organization_id,
              role: effectiveRole,
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

          // 3. Send Registration Confirmation Notification via Email/WhatsApp preference
          await sendRegistrationConfirmationEmail({
            to: email,
            recipientName: fullName,
            orgName: orgName,
            preferredChannel: preferredChannel,
          });

        } else if (email) {
          // Search players table directly by email
          const { data: matchingPlayers } = await adminSupabase
            .from("players")
            .select("id, organization_id, organizations(name)")
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
                  role: effectiveRole,
                }, { onConflict: "user_id,organization_id" });
            }

            await sendRegistrationConfirmationEmail({
              to: email,
              recipientName: fullName,
              orgName: (matchingPlayers[0] as any)?.organizations?.name || "S.D. Almazán",
              preferredChannel: preferredChannel,
            });
          } else if (effectiveRole === "player") {
            // New player signing up with a new email without a pre-created invitation
            const defaultOrgId = "2ef4ac4a-833a-4acf-8738-ac89d52d1a9d";
            const parts = fullName.trim().split(" ");
            const firstName = parts[0] || "Jugador";
            const lastName = parts.slice(1).join(" ") || "";

            const { data: existingPlayer } = await adminSupabase
              .from("players")
              .select("id")
              .eq("user_id", targetUser.id)
              .maybeSingle();

            if (!existingPlayer) {
              await adminSupabase
                .from("players")
                .insert({
                  organization_id: defaultOrgId,
                  user_id: targetUser.id,
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
                user_id: targetUser.id,
                organization_id: defaultOrgId,
                role: "player",
              }, { onConflict: "user_id,organization_id" });

            // Record pending_approval request
            const uninvitedToken = `uninvited-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            await adminSupabase
              .from("player_invitations")
              .insert({
                organization_id: defaultOrgId,
                email: email.trim().toLowerCase(),
                token: uninvitedToken,
                role: "player",
                status: "pending_approval",
                metadata: {
                  userId: targetUser.id,
                  fullName: fullName,
                  registeredAt: new Date().toISOString(),
                  preferredChannel: preferredChannel,
                },
              });

            // Notify Administrator
            try {
              const { sendEmailAlert } = await import("@/lib/email/mailer");
              await sendEmailAlert({
                to: "diecilo7@gmail.com",
                recipientName: "Administrador del Club",
                title: `🔔 Solicitud de Registro Pendiente: ${fullName}`,
                body: `El usuario ${fullName} (${email}) ha verificado su correo tras un registro sin invitación.\n\n` +
                  `Como Administrador del Club, debes autorizar su acceso desde el Panel de Administración de ClubLab.`,
                actionUrl: "/admin",
                actionText: "Revisar y Aprobar en Panel Admin",
              });
            } catch (mailErr) {
              console.error("⚠️ Error sending admin approval email:", mailErr);
            }
          }
        }
      } catch (err: any) {
        console.error("⚠️ Error processing auth callback linking:", err.message);
      }

      return NextResponse.redirect(`${appBaseUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${appBaseUrl}/login?error=auth-callback-failed`);
}
