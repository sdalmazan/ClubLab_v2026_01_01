import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSession } from "@/services/sessions";

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

    const body = await request.json();

    const sessionId = await createSession(orgRole.organization_id, user.id, body);

    return NextResponse.json({ id: sessionId });
  } catch (e: any) {
    console.error("[POST /api/training/sessions] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
