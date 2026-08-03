import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify Super Admin status (either role is super_admin OR specific email)
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const isSuperAdmin = orgRole?.role === "super_admin" || user.email === "diecilo7@gmail.com";

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "delete_org": {
        const { id } = body;
        const { error } = await supabaseAdmin.from("organizations").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      case "toggle_user_admin_permission": {
        const { userId: targetUserId, isAdmin } = body;
        if (!targetUserId) {
          return NextResponse.json({ error: "Falta el ID del usuario" }, { status: 400 });
        }

        // 1. Update user metadata in Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: { is_admin: Boolean(isAdmin) },
        });

        // 2. Try to update user_organization_roles table
        try {
          await supabaseAdmin
            .from("user_organization_roles")
            .update({ is_admin: Boolean(isAdmin) })
            .eq("user_id", targetUserId);
        } catch (e) {
          // Column optional in custom schemas
        }

        return NextResponse.json({ success: true, isAdmin: Boolean(isAdmin) });
      }
      case "assign_user_organization_role":
      case "update_user_role": {
        const targetUserId = body.userId || body.targetUserId;
        const { organizationId, role } = body;
        if (!targetUserId) {
          return NextResponse.json({ error: "Falta el ID del usuario" }, { status: 400 });
        }

        const orgIdToSave = (organizationId && organizationId !== "" && organizationId !== "null" && organizationId !== "undefined")
          ? organizationId
          : null;

        const roleToSave = role && role !== "Ninguno" ? role : "player";
        const isAdminFlag = roleToSave === "super_admin" || roleToSave === "club_admin";

        // 1. Update Auth user_metadata
        const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        const currentMeta = userRecord?.user?.user_metadata || {};

        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            ...currentMeta,
            role: roleToSave,
            organization_id: orgIdToSave,
            is_admin: isAdminFlag || Boolean(currentMeta.is_admin),
          },
        });

        // 2. Clear previous role entries in user_organization_roles
        await supabaseAdmin
          .from("user_organization_roles")
          .delete()
          .eq("user_id", targetUserId);

        // 3. Insert new role entry in user_organization_roles
        if (orgIdToSave) {
          const { error: insertErr } = await supabaseAdmin
            .from("user_organization_roles")
            .insert({
              user_id: targetUserId,
              organization_id: orgIdToSave,
              role: roleToSave,
              is_admin: isAdminFlag || Boolean(currentMeta.is_admin),
            });

          if (insertErr) {
            console.error("Error inserting into user_organization_roles:", insertErr);
          }
        } else {
          try {
            await supabaseAdmin
              .from("user_organization_roles")
              .insert({
                user_id: targetUserId,
                organization_id: null,
                role: roleToSave,
                is_admin: isAdminFlag || Boolean(currentMeta.is_admin),
              });
          } catch (e) {}
        }

        // 4. Update player record if targetUserId belongs to a player
        if (orgIdToSave) {
          const playerQuery = userRecord?.user?.email
            ? `user_id.eq.${targetUserId},email.eq.${userRecord.user.email}`
            : `user_id.eq.${targetUserId}`;

          await supabaseAdmin
            .from("players")
            .update({ organization_id: orgIdToSave })
            .or(playerQuery);
        }

        return NextResponse.json({ success: true, organizationId: orgIdToSave, role: roleToSave });
      }
      case "approve_registration_request": {
        const { invitationId } = body;
        const { data: inv } = await supabaseAdmin
          .from("player_invitations")
          .select("*")
          .eq("id", invitationId)
          .single();

        if (inv) {
          await supabaseAdmin
            .from("player_invitations")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", invitationId);

          const userId = inv.metadata?.userId;
          if (userId) {
            await supabaseAdmin
              .from("players")
              .update({ availability_status: "available", physical_status: "green" })
              .eq("user_id", userId);
          }

          try {
            const { sendEmailAlert } = await import("@/lib/email/mailer");
            await sendEmailAlert({
              to: inv.email,
              recipientName: inv.metadata?.fullName || "Futbolista",
              title: "¡Tu Solicitud de Registro ha sido APROBADA!",
              body: `Hola, el Administrador del Club ha revisado y APROBADO tu solicitud de incorporación en ClubLab.\n\n` +
                `Ya tienes acceso completo al portal del futbolista de S.D. Almazán. Puedes iniciar sesión normalmente con tu correo y contraseña.`,
              actionUrl: "/login",
              actionText: "Iniciar Sesión en ClubLab",
            });
          } catch (e) {}
        }
        return NextResponse.json({ success: true });
      }
      case "reject_registration_request": {
        const { invitationId } = body;
        const { data: inv } = await supabaseAdmin
          .from("player_invitations")
          .select("*")
          .eq("id", invitationId)
          .single();

        if (inv) {
          await supabaseAdmin
            .from("player_invitations")
            .update({ status: "rejected" })
            .eq("id", invitationId);

          try {
            const { sendEmailAlert } = await import("@/lib/email/mailer");
            await sendEmailAlert({
              to: inv.email,
              recipientName: inv.metadata?.fullName || "Usuario",
              title: "Estado de tu Solicitud de Registro",
              body: `Hola, el Administrador del Club ha revisado tu solicitud de registro y ha determinado no autorizar la vinculación a esta plantilla.`,
            });
          } catch (e) {}
        }
        return NextResponse.json({ success: true });
      }
      case "create_org": {
        const { name, slug, adminEmail, adminName } = body;

        // Check if organization slug already exists
        const { data: existingOrg } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("slug", slug)
          .limit(1)
          .maybeSingle();

        if (existingOrg) {
          return NextResponse.json({ error: "El slug de la organización ya existe" }, { status: 400 });
        }

        // 1. Create Organization
        const { data: org, error: orgErr } = await supabaseAdmin
          .from("organizations")
          .insert({ name, slug, type: "club", settings: {} })
          .select("id")
          .single();

        if (orgErr) throw orgErr;

        // 2. Assign free plan subscription
        const { data: freePlan } = await supabaseAdmin
          .from("plans")
          .select("id")
          .eq("slug", "free")
          .limit(1)
          .maybeSingle();

        if (freePlan) {
          await supabaseAdmin.from("subscriptions").insert({
            organization_id: org.id,
            plan_id: freePlan.id,
            status: "manual",
          });
        }

        // 3. Create or associate Admin User
        let adminUserId: string;

        try {
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            email_confirm: true,
            user_metadata: { name: adminName, invitedByAdmin: true },
          });

          if (createError) {
            // Check if user already exists
            const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (listError) throw listError;
            const matched = usersList.users.find((u) => u.email === adminEmail);
            if (matched) {
              adminUserId = matched.id;
            } else {
              throw createError;
            }
          } else {
            adminUserId = newUser.user.id;
          }
        } catch (err) {
          // As a fallback, search the user list directly
          const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;
          const matched = usersList.users.find((u) => u.email === adminEmail);
          if (matched) {
            adminUserId = matched.id;
          } else {
            throw err;
          }
        }

        // 4. Create role
        const { error: roleError } = await supabaseAdmin
          .from("user_organization_roles")
          .insert({
            user_id: adminUserId,
            organization_id: org.id,
            role: "club_admin",
            invited_by: user.id,
          });

        if (roleError) throw roleError;

        // 5. Create Club
        const { data: club, error: clubErr } = await supabaseAdmin
          .from("clubs")
          .insert({ organization_id: org.id, name })
          .select("id")
          .single();

        if (clubErr) throw clubErr;

        // 6. Create default active season
        const { data: season, error: seasonErr } = await supabaseAdmin
          .from("seasons")
          .insert({
            club_id: club.id,
            name: "Temporada Actual",
            start_date: "2026-07-01",
            end_date: "2027-06-30",
            is_active: true,
          })
          .select("id")
          .single();

        if (seasonErr) throw seasonErr;

        // 7. Create default team
        const { error: teamErr } = await supabaseAdmin
          .from("teams")
          .insert({
            club_id: club.id,
            season_id: season.id,
            name: "Primer Equipo",
            category: "Senior",
          });

        if (teamErr) throw teamErr;

        return NextResponse.json({ success: true });
      }
      case "delete_user": {
        const { userId, organizationId } = body;
        
        // 1. Delete user_organization_roles
        let roleQuery = supabaseAdmin.from("user_organization_roles").delete().eq("user_id", userId);
        if (organizationId) {
          roleQuery = roleQuery.eq("organization_id", organizationId);
        }
        await roleQuery;

        // 2. Delete user_profiles
        await supabaseAdmin.from("user_profiles").delete().eq("id", userId);

        // 3. Attempt auth.admin.deleteUser, swallow foreign key errors
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (authErr) {
          console.warn("Notice: auth.admin.deleteUser failed due to DB foreign keys, but user was removed from team roles successfully.", authErr);
        }

        return NextResponse.json({ success: true });
      }
      case "delete_player": {
        const { playerId } = body;
        const { error } = await supabaseAdmin.from("players").delete().eq("id", playerId);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      case "invite_user": {
        const { email, role, organizationId } = body;
        
        // Create user directly in supabase auth and send an invitation
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { invitedByAdmin: true },
        });

        if (createError) throw createError;

        if (newUser && newUser.user) {
          const { error: roleError } = await supabaseAdmin
            .from("user_organization_roles")
            .insert({
              user_id: newUser.user.id,
              organization_id: organizationId,
              role,
              invited_by: user.id,
            });
          if (roleError) throw roleError;
        }

        return NextResponse.json({ success: true });
      }
      case "aggregate_stats": {
        await runDailyAggregation();
        return NextResponse.json({ success: true });
      }
      case "approve_position_override": {
        const { organizationId, playerName } = body;
        const { data: org, error: orgErr } = await supabaseAdmin
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();
        if (orgErr) throw orgErr;

        const settings = org?.settings || {};
        if (!settings.scouting) settings.scouting = {};
        if (!settings.scouting.player_positions) settings.scouting.player_positions = {};

        const key = playerName.toUpperCase().trim().toLowerCase();
        const existing = settings.scouting.player_positions[key] || {};

        settings.scouting.player_positions[key] = {
          ...existing,
          position: existing.suggestedPosition || existing.position || "",
          status: "approved"
        };
        delete settings.scouting.player_positions[key].suggestedPosition;
        delete settings.scouting.player_positions[key].proposedByUserId;

        const { error: updateErr } = await supabaseAdmin
          .from("organizations")
          .update({ settings })
          .eq("id", organizationId);
        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true });
      }
      case "reject_position_override": {
        const { organizationId, playerName } = body;
        const { data: org, error: orgErr } = await supabaseAdmin
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();
        if (orgErr) throw orgErr;

        const settings = org?.settings || {};
        if (!settings.scouting) settings.scouting = {};
        if (!settings.scouting.player_positions) settings.scouting.player_positions = {};

        const key = playerName.toUpperCase().trim().toLowerCase();
        const existing = settings.scouting.player_positions[key] || {};

        if (existing.position) {
          settings.scouting.player_positions[key] = {
            position: existing.position,
            status: "approved",
            playerName: existing.playerName || playerName
          };
        } else {
          delete settings.scouting.player_positions[key];
        }

        const { error: updateErr } = await supabaseAdmin
          .from("organizations")
          .update({ settings })
          .eq("id", organizationId);
        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Admin management error:", error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}

// Daily Aggregator Helper logic
async function runDailyAggregation() {
  const supabaseAdmin = createAdminClient();
  // Get all raw page views
  const { data: pageViews } = await supabaseAdmin
    .from("platform_page_views")
    .select("viewed_at, path, user_id");

  if (!pageViews || pageViews.length === 0) return;

  // Group page views by YYYY-MM-DD date string
  const viewsByDate: Record<string, any[]> = {};
  pageViews.forEach((view) => {
    const dateStr = new Date(view.viewed_at).toISOString().split("T")[0];
    if (!viewsByDate[dateStr]) viewsByDate[dateStr] = [];
    viewsByDate[dateStr].push(view);
  });

  // Get list of already aggregated dates to avoid double aggregation
  const { data: aggregated } = await supabaseAdmin
    .from("platform_daily_usage_stats")
    .select("date");

  const aggregatedDates = new Set(aggregated?.map((d) => d.date) || []);
  const todayStr = new Date().toISOString().split("T")[0];

  for (const dateStr of Object.keys(viewsByDate)) {
    // Skip today (ongoing data) and already aggregated dates
    if (dateStr === todayStr || aggregatedDates.has(dateStr)) continue;

    const views = viewsByDate[dateStr];
    const totalPageViews = views.length;

    // Count unique active users
    const uniqueUsers = new Set(views.map((v) => v.user_id).filter(Boolean));
    const activeUsersCount = uniqueUsers.size;

    // Compute most and least viewed screens
    const pathCounts: Record<string, number> = {};
    views.forEach((v) => {
      pathCounts[v.path] = (pathCounts[v.path] || 0) + 1;
    });

    let mostViewed = "";
    let mostCount = -1;
    let leastViewed = "";
    let leastCount = Infinity;

    Object.entries(pathCounts).forEach(([path, count]) => {
      if (count > mostCount) {
        mostCount = count;
        mostViewed = path;
      }
      if (count < leastCount) {
        leastCount = count;
        leastViewed = path;
      }
    });

    // Query features used on this day
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    const { data: features } = await supabaseAdmin
      .from("platform_feature_usage")
      .select("feature_name")
      .gte("used_at", startOfDay)
      .lte("used_at", endOfDay);

    let mostUsedFeature = "Ninguna";
    if (features && features.length > 0) {
      const featCounts: Record<string, number> = {};
      features.forEach((f) => {
        featCounts[f.feature_name] = (featCounts[f.feature_name] || 0) + 1;
      });
      let maxFeatCount = -1;
      Object.entries(featCounts).forEach(([feat, count]) => {
        if (count > maxFeatCount) {
          maxFeatCount = count;
          mostUsedFeature = feat;
        }
      });
    }

    // Insert statistics summary
    await supabaseAdmin.from("platform_daily_usage_stats").upsert({
      date: dateStr,
      active_users: activeUsersCount,
      total_page_views: totalPageViews,
      most_viewed_screen: mostViewed || "Ninguna",
      least_viewed_screen: leastViewed || "Ninguna",
      most_used_feature: mostUsedFeature,
    });
  }
}
