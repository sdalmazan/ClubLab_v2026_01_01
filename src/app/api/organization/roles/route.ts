import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper to check if requester can manage roles in org
async function canManageRoles(userId: string, orgId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: orgRole } = await supabaseAdmin
    .from("user_organization_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (!orgRole) return false;
  const role = orgRole.role;
  return (
    role === "super_admin" ||
    role === "club_admin" ||
    role === "head_coach" ||
    role === "owner" ||
    role === "admin" ||
    role === "academy_director"
  );
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get user's org
    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userRole?.organization_id) {
      return NextResponse.json({ error: "Sin organización activa" }, { status: 403 });
    }

    const orgId = userRole.organization_id;

    // Fetch all roles for this organization
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

    const merged = (roles || []).map((r) => {
      const authUser = usersData.users.find((u) => u.id === r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        organization_id: r.organization_id,
        role: r.role,
        created_at: r.created_at,
        email: authUser?.email || "Sin correo",
        full_name:
          authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          authUser?.email?.split("@")[0] ||
          "Miembro del Equipo",
      };
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

    const body = await request.json();
    const { userId, role, organizationId } = body;

    if (!userId || !role || !organizationId) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    const allowed = await canManageRoles(user.id, organizationId);
    if (!allowed) {
      return NextResponse.json(
        { error: "No tienes permisos para modificar roles en este equipo" },
        { status: 403 }
      );
    }

    const { data: updatedRole, error } = await supabaseAdmin
      .from("user_organization_roles")
      .update({ role })
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, role: updatedRole });
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

    const body = await request.json();
    const { email, role, organizationId } = body;

    if (!email || !role || !organizationId) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    const allowed = await canManageRoles(user.id, organizationId);
    if (!allowed) {
      return NextResponse.json(
        { error: "No tienes permisos para invitar miembros" },
        { status: 403 }
      );
    }

    // Check if user already exists
    let targetUserId: string;
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = usersList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      targetUserId = existing.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { invitedByAdmin: true },
      });
      if (createError) throw createError;
      targetUserId = newUser.user.id;
    }

    // Insert or upsert user_organization_roles
    const { data: newRole, error: roleError } = await supabaseAdmin
      .from("user_organization_roles")
      .upsert(
        {
          user_id: targetUserId,
          organization_id: organizationId,
          role,
          invited_by: user.id,
        },
        { onConflict: "user_id,organization_id" }
      )
      .select()
      .single();

    if (roleError) throw roleError;

    return NextResponse.json({ success: true, role: newRole });
  } catch (err: any) {
    console.error("POST /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al invitar usuario" }, { status: 500 });
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

    if (!userId || !organizationId) {
      return NextResponse.json({ error: "Parámetros obligatorios faltantes" }, { status: 400 });
    }

    const allowed = await canManageRoles(user.id, organizationId);
    if (!allowed) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar miembros de este equipo" },
        { status: 403 }
      );
    }

    // 1. Delete user role in organization
    const { error: roleDelErr } = await supabaseAdmin
      .from("user_organization_roles")
      .delete()
      .eq("user_id", userId)
      .eq("organization_id", organizationId);

    if (roleDelErr) throw roleDelErr;

    // 2. Delete user profile if present
    await supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("id", userId);

    // 3. Attempt auth.admin.deleteUser, swallow 500 DB constraints gracefully
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authErr) {
      console.warn("Notice: auth.admin.deleteUser failed due to DB constraints, but user was removed from team roles successfully.", authErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/organization/roles error:", err);
    return NextResponse.json({ error: err.message || "Error al eliminar usuario" }, { status: 500 });
  }
}
