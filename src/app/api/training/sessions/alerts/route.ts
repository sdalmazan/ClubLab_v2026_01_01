import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailAlert } from "@/lib/email/mailer";

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

    // Load target staff members in the same organization
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

      // 1. Insert in-app notification records
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notificationsData);

      if (notifError) throw notifError;

      // 2. Fetch auth user emails and dispatch replicated emails
      try {
        const adminSupabase = createAdminClient();
        const targetUserIds = staffMembers.map((sm) => sm.user_id);
        const { data: usersList } = await adminSupabase.auth.admin.listUsers();

        if (usersList?.users) {
          const actionUrl = `/es/dashboard/training`;

          for (const member of staffMembers) {
            const authUser = usersList.users.find((u) => u.id === member.user_id);
            if (authUser?.email) {
              const recipientName = authUser.user_metadata?.full_name || authUser.email.split("@")[0];
              
              // Asynchronously trigger email sending
              sendEmailAlert({
                to: authUser.email,
                recipientName,
                title,
                body,
                actionUrl,
                actionText: "Ir a la Sesión de Entrenamiento"
              }).catch((err) => {
                console.error(`[Alert Email Error] Failed for ${authUser.email}:`, err);
              });
            }
          }
        }
      } catch (emailError: any) {
        console.error("[Alert Email Dispatch Warning]", emailError.message);
        // Non-blocking: alert row is saved regardless
      }
    }

    return NextResponse.json({ success: true, count: staffMembers?.length ?? 0 });
  } catch (e: any) {
    console.error("[POST /api/training/sessions/alerts] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

