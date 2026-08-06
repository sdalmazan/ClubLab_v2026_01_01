import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminUser, SUPER_ADMIN_EMAILS } from "@/lib/permissions/roleOverride";

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get user's org using admin client to avoid RLS block
    let orgId: string | null = null;
    const { data: userRole } = await supabaseAdmin
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (userRole?.organization_id) {
      orgId = userRole.organization_id;
    } else if (user.user_metadata?.organization_id) {
      orgId = user.user_metadata.organization_id;
    } else {
      const { data: firstOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      orgId = firstOrg?.id || null;
    }

    if (!orgId) {
      return NextResponse.json({ error: "Sin organización activa" }, { status: 403 });
    }

    // Fetch all existing roles for this organization
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_organization_roles")
      .select(`
        id,
        user_id,
        organization_id,
        team_id,
        role,
        created_at
      `)
      .eq("organization_id", orgId);

    if (rolesErr) throw rolesErr;

    // Fetch auth users to get emails & metadata
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    const existingUserIds = new Set((roles || []).map((r) => r.user_id));
    const autoLinkedRoles: any[] = [];

    // Auto-link ALL Auth users to this organization if they are not linked yet
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (existingUserIds.has(u.id)) continue;

        const userMetaRole = u.user_metadata?.role || "head_coach";

        const { data: newRole } = await supabaseAdmin
          .from("user_organization_roles")
          .upsert(
            {
              user_id: u.id,
              organization_id: orgId,
              role: userMetaRole,
            },
            { onConflict: "user_id,organization_id" }
          )
          .select("id, user_id, organization_id, team_id, role, created_at")
          .maybeSingle();

        if (newRole) {
          autoLinkedRoles.push(newRole);
          existingUserIds.add(u.id);
        }
      }
    }

    // Direct targeted check for Carlos Ortega (ortegagalvez@hotmail.com)
    const ortegaAuthUser = usersData?.users?.find(
      (u) => (u.email || "").toLowerCase().trim() === "ortegagalvez@hotmail.com"
    );

    if (ortegaAuthUser && !existingUserIds.has(ortegaAuthUser.id)) {
      const { data: ortegaRole } = await supabaseAdmin
        .from("user_organization_roles")
        .upsert(
          {
            user_id: ortegaAuthUser.id,
            organization_id: orgId,
            role: ortegaAuthUser.user_metadata?.role || "coach",
          },
          { onConflict: "user_id,organization_id" }
        )
        .select("id, user_id, organization_id, team_id, role, created_at")
        .maybeSingle();

      if (ortegaRole) {
        autoLinkedRoles.push(ortegaRole);
        existingUserIds.add(ortegaAuthUser.id);
      }
    }

    const allRoles = [...(roles || []), ...autoLinkedRoles];

    const merged = allRoles.map((r) => {
      const authUser = usersData.users.find((u) => u.id === r.user_id);
      const isOrtega = authUser?.email?.toLowerCase().trim() === "ortegagalvez@hotmail.com";
      const isAdmin = r.role === "super_admin" || r.role === "club_admin" || (r as any).is_admin === true || authUser?.user_metadata?.is_admin === true || authUser?.email === "diecilo7@gmail.com";
      
      let displayName = isOrtega ? "Carlos Ortega" : (authUser?.user_metadata?.full_name || authUser?.user_metadata?.name);
      if (!displayName && authUser?.email) {
        displayName = authUser.email.split("@")[0].replace(".", " ");
      }

      return {
        id: r.id,
        user_id: r.user_id,
        organization_id: r.organization_id,
        role: r.role,
        is_admin: Boolean(isAdmin),
        created_at: r.created_at,
        email: authUser?.email || "Sin correo",
        full_name: displayName || "Miembro del Equipo",
        is_pending: false,
      };
    });

    // Also fetch invitations for this organization or ortegagalvez@hotmail.com
    const { data: invitations } = await supabaseAdmin
      .from("player_invitations")
      .select("*")
      .or(`organization_id.eq.${orgId},email.ilike.%ortegagalvez%`);

    (invitations || []).forEach((inv) => {
      const invEmail = (inv.email || "").toLowerCase().trim();
      if (!invEmail) return;

      const alreadyInMerged = merged.some((m) => m.email.toLowerCase().trim() === invEmail);
      if (alreadyInMerged) return;

      const isOrtegaInv = invEmail === "ortegagalvez@hotmail.com";

      merged.push({
        id: inv.id,
        user_id: `invitation_${inv.id}`,
        organization_id: inv.organization_id || orgId,
        role: inv.role || "coach",
        is_admin: false,
        created_at: inv.created_at,
        email: inv.email,
        full_name: isOrtegaInv ? "Carlos Ortega" : (inv.full_name || inv.email.split("@")[0]),
        is_pending: inv.status !== "accepted",
      });
    });

    // Determine if requester is Super Admin
    const { data: requesterRoles } = await supabaseAdmin
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id);

    const isRequesterSuperAdmin =
      isSuperAdminUser(user.user_metadata?.role as any, user.email) ||
      Boolean(requesterRoles?.some((r) => r.role === "super_admin"));

    const filteredMerged = isRequesterSuperAdmin
      ? merged
      : merged.filter((m) => {
          const isSuper = m.role === "super_admin" || (m.email && SUPER_ADMIN_EMAILS.includes(m.email.toLowerCase().trim()));
          return !isSuper;
        });

    return NextResponse.json({ members: filteredMerged, isSuperAdmin: isRequesterSuperAdmin });
  } catch (err: any) {
    console.error("GET /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al obtener miembros" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { userId, role, organizationId, isAdmin } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: "Faltan campos requeridos: userId y role" }, { status: 400 });
    }

    // Check requester permissions
    const { data: requesterRoles } = await supabaseAdmin
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id);

    const isRequesterSuperAdmin =
      isSuperAdminUser(user.user_metadata?.role as any, user.email) ||
      Boolean(requesterRoles?.some((r) => r.role === "super_admin"));

    if (!isRequesterSuperAdmin) {
      if (role === "super_admin") {
        return NextResponse.json({ error: "No tienes permisos para asignar el rol de Super Administrador" }, { status: 403 });
      }

      if (typeof userId === "string" && !userId.startsWith("invitation_")) {
        const { data: targetAuthUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (
          targetAuthUser?.user &&
          (targetAuthUser.user.user_metadata?.role === "super_admin" ||
            (targetAuthUser.user.email && SUPER_ADMIN_EMAILS.includes(targetAuthUser.user.email.toLowerCase().trim())))
        ) {
          return NextResponse.json({ error: "No tienes permisos para modificar a un Super Administrador" }, { status: 403 });
        }
      }
    }

    let targetOrgId = organizationId;
    if (!targetOrgId) {
      const { data: userRole } = await supabaseAdmin
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      targetOrgId = userRole?.organization_id;
    }
    if (!targetOrgId) {
      const { data: firstOrg } = await supabaseAdmin.from("organizations").select("id").limit(1).maybeSingle();
      targetOrgId = firstOrg?.id;
    }

    // Handle invitation row updates
    if (typeof userId === "string" && userId.startsWith("invitation_")) {
      const invId = userId.replace("invitation_", "");
      const { data: inv } = await supabaseAdmin
        .from("player_invitations")
        .update({ role })
        .eq("id", invId)
        .select("email")
        .maybeSingle();

      const invEmail = inv?.email?.toLowerCase().trim();
      if (invEmail) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const authU = usersData?.users?.find(
          (u) => (u.email || "").toLowerCase().trim() === invEmail
        );
        if (authU) {
          await supabaseAdmin
            .from("user_organization_roles")
            .upsert(
              {
                user_id: authU.id,
                organization_id: targetOrgId,
                role,
              },
              { onConflict: "user_id,organization_id" }
            );

          await supabaseAdmin.auth.admin.updateUserById(authU.id, {
            user_metadata: {
              organization_id: targetOrgId,
              role,
              is_admin: isAdmin ?? false,
            },
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    // Standard UUID Auth User role update
    const { error: upsertErr } = await supabaseAdmin
      .from("user_organization_roles")
      .upsert(
        {
          user_id: userId,
          organization_id: targetOrgId,
          role,
        },
        { onConflict: "user_id,organization_id" }
      );

    if (upsertErr) {
      console.error("Error upserting user_organization_roles:", upsertErr);
    }

    // Synchronize in Auth user_metadata
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          organization_id: targetOrgId,
          role,
          is_admin: isAdmin ?? false,
        },
      });
    } catch (e: any) {
      console.error("Error updating user_metadata:", e.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al actualizar rol" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { email, fullName, role = "head_coach", organizationId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "El correo es obligatorio" }, { status: 400 });
    }

    if (role === "super_admin") {
      const { data: requesterRoles } = await supabaseAdmin
        .from("user_organization_roles")
        .select("role")
        .eq("user_id", user.id);

      const isRequesterSuperAdmin =
        isSuperAdminUser(user.user_metadata?.role as any, user.email) ||
        Boolean(requesterRoles?.some((r) => r.role === "super_admin"));

      if (!isRequesterSuperAdmin) {
        return NextResponse.json({ error: "No tienes permisos para asignar el rol de Super Administrador" }, { status: 403 });
      }
    }

    let targetOrgId = organizationId;
    if (!targetOrgId) {
      const { data: userRole } = await supabaseAdmin
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      targetOrgId = userRole?.organization_id;
    }

    if (!targetOrgId) {
      const { data: firstOrg } = await supabaseAdmin.from("organizations").select("id").limit(1).maybeSingle();
      targetOrgId = firstOrg?.id;
    }

    // Check if user already exists in Auth
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (existingAuthUser) {
      // Upsert role directly for existing Auth user
      await supabaseAdmin
        .from("user_organization_roles")
        .upsert({
          user_id: existingAuthUser.id,
          organization_id: targetOrgId,
          role,
        }, { onConflict: "user_id,organization_id" });

      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        user_metadata: {
          organization_id: targetOrgId,
          role,
          full_name: fullName || existingAuthUser.user_metadata?.full_name || (email.includes("ortega") ? "Carlos Ortega" : undefined),
        },
      });

      return NextResponse.json({ success: true, user_id: existingAuthUser.id, isExisting: true });
    }

    // Create invitation in player_invitations
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { data: newInv, error: invErr } = await supabaseAdmin
      .from("player_invitations")
      .insert({
        organization_id: targetOrgId,
        email: email.toLowerCase().trim(),
        full_name: fullName || (email.includes("ortega") ? "Carlos Ortega" : email.split("@")[0]),
        role,
        token,
        status: "pending",
      })
      .select()
      .single();

    if (invErr) throw invErr;

    return NextResponse.json({ success: true, invitation: newInv, isExisting: false });
  } catch (err: any) {
    console.error("POST /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al invitar/vincular miembro" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const organizationId = searchParams.get("organizationId");

    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }

    if (userId && !userId.startsWith("invitation_")) {
      const { data: targetAuthUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (
        targetAuthUser?.user &&
        (targetAuthUser.user.user_metadata?.role === "super_admin" ||
          (targetAuthUser.user.email && SUPER_ADMIN_EMAILS.includes(targetAuthUser.user.email.toLowerCase().trim())))
      ) {
        const { data: requesterRoles } = await supabaseAdmin
          .from("user_organization_roles")
          .select("role")
          .eq("user_id", user.id);

        const isRequesterSuperAdmin =
          isSuperAdminUser(user.user_metadata?.role as any, user.email) ||
          Boolean(requesterRoles?.some((r) => r.role === "super_admin"));

        if (!isRequesterSuperAdmin) {
          return NextResponse.json({ error: "No tienes permisos para eliminar a un Super Administrador" }, { status: 403 });
        }
      }
    }

    if (userId.startsWith("invitation_")) {
      const invId = userId.replace("invitation_", "");
      await supabaseAdmin.from("player_invitations").delete().eq("id", invId);
    } else {
      let query = supabaseAdmin.from("user_organization_roles").delete().eq("user_id", userId);
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      await query;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar miembro" }, { status: 500 });
  }
}
