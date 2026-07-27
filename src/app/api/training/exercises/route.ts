import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeDifficulty(diff?: string): "beginner" | "intermediate" | "advanced" {
  if (!diff) return "intermediate";
  const d = diff.toLowerCase().trim();
  if (d === "very_low" || d === "low" || d === "beginner" || d.includes("baja")) {
    return "beginner";
  }
  if (d === "high" || d === "very_high" || d === "advanced" || d.includes("alta")) {
    return "advanced";
  }
  return "intermediate";
}

function normalizeScope(scope?: string): "coach" | "academy" | "global" {
  if (!scope || scope === "none") return "coach";
  if (scope === "academy" || scope === "global") return scope;
  return "coach";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Load user role & organization
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgRole?.organization_id) {
      return NextResponse.json({ error: "Usuario sin organización activa" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      difficulty,
      is_shared,
      tags,
      library_scope,
      tactical_concepts,
      muscle_groups,
      space_dimensions,
      needs_groups,
      num_groups,
      players_per_group,
      image_url,
      video_url,
      whiteboard_data,
      whiteboard_zone,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }

    const { data: exercise, error } = await supabase
      .from("exercises")
      .insert({
        organization_id: orgRole.organization_id,
        created_by: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category?.trim() || "General",
        difficulty: normalizeDifficulty(difficulty),
        is_shared: !!is_shared,
        tags: tags || [],
        library_scope: normalizeScope(library_scope),
        tactical_concepts: tactical_concepts || [],
        muscle_groups: muscle_groups || [],
        space_dimensions: space_dimensions || null,
        needs_groups: !!needs_groups,
        num_groups: num_groups !== undefined ? Number(num_groups) : 2,
        players_per_group: players_per_group || null,
        image_url: image_url || null,
        video_url: video_url || null,
        whiteboard_data: whiteboard_data || null,
        whiteboard_zone: whiteboard_zone || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(exercise);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      title,
      description,
      category,
      difficulty,
      is_shared,
      tags,
      library_scope,
      tactical_concepts,
      muscle_groups,
      space_dimensions,
      needs_groups,
      num_groups,
      players_per_group,
      image_url,
      video_url,
      whiteboard_data,
      whiteboard_zone,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID de ejercicio obligatorio" }, { status: 400 });
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }

    // Fetch the existing exercise to check its current scope
    const { data: existing, error: fetchErr } = await supabase
      .from("exercises")
      .select("library_scope")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Ejercicio no encontrado" }, { status: 404 });
    }

    if (existing.library_scope === "global" || existing.library_scope === "academy") {
      // Check user role
      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      const role = roleData?.role;
      
      if (existing.library_scope === "global" && role !== "super_admin") {
        return NextResponse.json({ error: "No tienes permisos para modificar la biblioteca ClubLab" }, { status: 403 });
      }
      
      if (existing.library_scope === "academy") {
        const isAcademiaAdmin = role === "super_admin" || role === "admin" || role === "owner" || role === "head_coach";
        if (!isAcademiaAdmin) {
          return NextResponse.json({ error: "No tienes permisos para modificar la biblioteca de la Academia" }, { status: 403 });
        }
      }
    }

    const { data: exercise, error } = await supabase
      .from("exercises")
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        category: category?.trim() || "General",
        difficulty: normalizeDifficulty(difficulty),
        is_shared: !!is_shared,
        tags: tags || [],
        library_scope: normalizeScope(library_scope),
        tactical_concepts: tactical_concepts || [],
        muscle_groups: muscle_groups || [],
        space_dimensions: space_dimensions || null,
        needs_groups: !!needs_groups,
        num_groups: num_groups !== undefined ? Number(num_groups) : 2,
        players_per_group: players_per_group || null,
        image_url: image_url || null,
        video_url: video_url || null,
        whiteboard_data: whiteboard_data || null,
        whiteboard_zone: whiteboard_zone || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(exercise);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
