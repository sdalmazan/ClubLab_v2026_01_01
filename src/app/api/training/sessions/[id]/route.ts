import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateSession, deleteSession } from "@/services/sessions";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const body = await request.json();
    const { client_updated_at, ...updateData } = body;

    if (client_updated_at) {
      const { data: existingSession } = await supabase
        .from("training_sessions")
        .select("updated_at")
        .eq("id", id)
        .single();

      if (existingSession && existingSession.updated_at) {
        const dbTime = new Date(existingSession.updated_at).getTime();
        const clientTime = new Date(client_updated_at).getTime();
        if (Math.abs(dbTime - clientTime) > 2000) {
          return NextResponse.json({
            error: "CONCURRENCY_ERROR",
            message: "Esta sesión ha sido modificada por otro usuario. Copia tus cambios o recarga la página para evitar sobrescribirlos."
          }, { status: 409 });
        }
      }
    }

    await updateSession(id, orgRole.organization_id, updateData);

    const { data: updatedSession } = await supabase
      .from("training_sessions")
      .select("updated_at")
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      updated_at: updatedSession?.updated_at ?? null
    });
  } catch (e: any) {
    console.error(`[PUT /api/training/sessions/${id}] Error:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(`[DELETE /api/training/sessions/${id}] Error:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
