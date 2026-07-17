import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service role client to query auth users
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's organization_id
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    // Get all user_organization_roles for this organization
    const { data: roles, error: rolesErr } = await supabase
      .from("user_organization_roles")
      .select("user_id, role")
      .eq("organization_id", orgRole.organization_id);

    if (rolesErr) {
      return NextResponse.json({ error: rolesErr.message }, { status: 500 });
    }

    if (!roles || roles.length === 0) {
      return NextResponse.json([]);
    }

    // Get all auth users to match metadata
    const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) {
      console.error("Error listing auth users in staff route:", authErr.message);
      // Fallback
      return NextResponse.json(
        roles.map((r) => ({
          id: r.user_id,
          email: `staff_${r.user_id.substring(0, 4)}@clublab.com`,
          name: `Personal (${r.role})`,
          role: r.role
        })).filter((u) => {
          const email = u.email?.toLowerCase() || "";
          const name = u.name?.toLowerCase() || "";
          return email !== "diego.ciria.lopez@gmail.com" && email !== "diecilo7@gmail.com" && !name.includes("diego ciria");
        })
      );
    }

    const matchedUsers = roles.map((r) => {
      const au = authUsers.find((u) => u.id === r.user_id);
      return {
        id: r.user_id,
        email: au?.email ?? `staff_${r.user_id.substring(0, 4)}@clublab.com`,
        name: au?.user_metadata?.full_name ?? au?.email?.split("@")[0] ?? `Personal (${r.role})`,
        role: r.role
      };
    }).filter((u) => {
      const email = u.email?.toLowerCase() || "";
      const name = u.name?.toLowerCase() || "";
      return email !== "diego.ciria.lopez@gmail.com" && email !== "diecilo7@gmail.com" && !name.includes("diego ciria");
    });

    return NextResponse.json(matchedUsers);
  } catch (e: any) {
    console.error("[GET /api/training/sessions/staff] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
