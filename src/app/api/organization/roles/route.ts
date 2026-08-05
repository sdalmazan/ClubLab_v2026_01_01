import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const allRoles = [...(roles || []), ...autoLinkedRoles];

    const merged = allRoles.map((r) => {
      const authUser = usersData.users.find((u) => u.id === r.user_id);
      const isAdmin = r.role === "super_admin" || r.role === "club_admin" || (r as any).is_admin === true || authUser?.user_metadata?.is_admin === true || authUser?.email === "diecilo7@gmail.com";
      return {
        id: r.id,
        user_id: r.user_id,
        organization_id: r.organization_id,
        role: r.role,
        is_admin: Boolean(isAdmin),
        created_at: r.created_at,
        email: authUser?.email || "Sin correo",
        full_name:
          authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          (authUser?.email ? authUser.email.split("@")[0].replace(".", " ") : "Miembro del Equipo"),
        is_pending: false,
      };
    });

    // Also fetch pending invitations from player_invitations table
    const { data: invitations } = await supabaseAdmin
      .from("player_invitations")
      .select("*")
      .eq("organization_id", orgId)
      .neq("status", "accepted");

    const mergedEmails = new Set(merged.map((m) => m.email.toLowerCase().trim()));

    (invitations || []).forEach((inv) => {
      const invEmail = (inv.email || "").toLowerCase().trim();
      if (!invEmail || mergedEmails.has(invEmail)) return;

      merged.push({
        id: inv.id,
        user_id: `invitation_${inv.id}`,
        organization_id: inv.organization_id,
        role: inv.role || "coach",
        is_admin: false,
        created_at: inv.created_at,
        email: inv.email,
        full_name: inv.full_name || inv.email.split("@")[0],
        is_pending: true,
      });
    });

    return NextResponse.json(merged);
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

    if (!userId || !role || !organizationId) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Upsert role in user_organization_roles
    const { error: upsertErr } = await supabaseAdmin
      .from("user_organization_roles")
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        role,
      }, { onConflict: "user_id,organization_id" });

    if (upsertErr) throw upsertErr;

    // Sychronize in Auth user_metadata
    if (!userId.startsWith("invitation_")) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          organization_id: organizationId,
          role,
          is_admin: isAdmin ?? false,
        },
      });
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
          full_name: fullName || existingAuthUser.user_metadata?.full_name,
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
        full_name: fullName || email.split("@")[0],
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
