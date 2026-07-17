import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateSessionTemplate, deleteSessionTemplate } from "@/services/templates";

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
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }

    // Load existing template to check scope
    const { data: existing, error: fetchErr } = await supabase
      .from("session_templates")
      .select("library_scope, created_by")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const role = orgRole.role;
    const isAcademiaAdmin = role === "super_admin" || role === "admin" || role === "owner" || role === "head_coach";

    if (existing.library_scope === "global" && role !== "super_admin") {
      return NextResponse.json({ error: "No tienes permisos para modificar la biblioteca ClubLab" }, { status: 403 });
    }

    if (existing.library_scope === "academy" && !isAcademiaAdmin) {
      return NextResponse.json({ error: "No tienes permisos para modificar la biblioteca de la Academia" }, { status: 403 });
    }

    if (existing.library_scope === "coach" && existing.created_by !== user.id && !isAcademiaAdmin) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta plantilla personal" }, { status: 403 });
    }

    const body = await request.json();

    await updateSessionTemplate(id, orgRole.organization_id, body);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(`[PUT /api/training/templates/${id}] Error:`, e.message);
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
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgRole) {
      return NextResponse.json({ error: "No organization role assigned" }, { status: 403 });
    }

    // Load existing template to check scope
    const { data: existing, error: fetchErr } = await supabase
      .from("session_templates")
      .select("library_scope, created_by")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const role = orgRole.role;
    const isAcademiaAdmin = role === "super_admin" || role === "admin" || role === "owner" || role === "head_coach";

    if (existing.library_scope === "global" && role !== "super_admin") {
      return NextResponse.json({ error: "No tienes permisos para eliminar la biblioteca ClubLab" }, { status: 403 });
    }

    if (existing.library_scope === "academy" && !isAcademiaAdmin) {
      return NextResponse.json({ error: "No tienes permisos para eliminar la biblioteca de la Academia" }, { status: 403 });
    }

    if (existing.library_scope === "coach" && existing.created_by !== user.id && !isAcademiaAdmin) {
      return NextResponse.json({ error: "No tienes permisos para eliminar esta plantilla personal" }, { status: 403 });
    }

    await deleteSessionTemplate(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(`[DELETE /api/training/templates/${id}] Error:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(
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
    const { data: template, error } = await supabase
      .from("session_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    // Load template exercises
    const { data: exercises, error: exError } = await supabase
      .from("template_exercises")
      .select(`
        *,
        exercise:exercises(*)
      `)
      .eq("template_id", id)
      .order("order_index", { ascending: true });

    if (exError) {
      console.error("Error loading template exercises:", exError.message);
    }

    return NextResponse.json({
      ...template,
      exercises: exercises ?? []
    });
  } catch (e: any) {
    console.error(`[GET /api/training/templates/${id}] Error:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
