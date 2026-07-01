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

    await updateSession(id, orgRole.organization_id, body);

    return NextResponse.json({ success: true });
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
