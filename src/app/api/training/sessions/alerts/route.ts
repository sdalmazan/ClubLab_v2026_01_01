import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    const { sessionId, sessionTitle, blockType, userIds } = await request.json();

    if (!sessionTitle || !blockType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Load other staff members in the same organization
    let query = supabase
      .from("user_organization_roles")
      .select("user_id")
      .eq("organization_id", orgRole.organization_id)
      .neq("user_id", user.id);

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in("user_id", userIds);
    }

    const { data: staffMembers } = await query;

    if (staffMembers && staffMembers.length > 0) {
      const blockName = blockType === "warmup" ? "calentamiento" : "vuelta a la calma";
      const title = `Sesión: Completar ${blockType === "warmup" ? "Calentamiento" : "Vuelta a la Calma"}`;
      const body = `El entrenador principal solicita que completes el bloque de ${blockName} para la sesión "${sessionTitle}".`;

      const notificationsData = staffMembers.map((sm) => ({
        organization_id: orgRole.organization_id,
        user_id: sm.user_id,
        title,
        body,
        type: "warning",
        is_read: false,
        metadata: { sessionId, blockType }
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notificationsData);

      if (notifError) throw notifError;
    }

    return NextResponse.json({ success: true, count: staffMembers?.length ?? 0 });
  } catch (e: any) {
    console.error("[POST /api/training/sessions/alerts] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
