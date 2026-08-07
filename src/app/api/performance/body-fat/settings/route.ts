import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ error: "Sin organización asignada" }, { status: 403 });
    }

    const { data: settings } = await supabase
      .from("team_body_fat_settings")
      .select("*")
      .eq("organization_id", userRole.organization_id)
      .limit(1)
      .maybeSingle();

    // Default configuration if not saved in DB yet
    const defaultSettings = {
      active_skinfolds: ["triceps", "subescapular", "biceps", "abdominal", "iliaco", "pierna"],
      target_fat_min: 8.0,
      target_fat_max: 12.0,
    };

    return NextResponse.json(settings || defaultSettings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al obtener configuración" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ error: "Sin organización asignada" }, { status: 403 });
    }

    const body = await request.json();
    const { active_skinfolds, target_fat_min, target_fat_max } = body;

    const upsertData = {
      organization_id: userRole.organization_id,
      team_id: userRole.team_id || null,
      active_skinfolds: active_skinfolds || ["triceps", "subescapular", "biceps", "abdominal", "iliaco", "pierna"],
      target_fat_min: target_fat_min != null ? Number(target_fat_min) : 8.0,
      target_fat_max: target_fat_max != null ? Number(target_fat_max) : 12.0,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from("team_body_fat_settings")
      .upsert(upsertData, { onConflict: "organization_id, team_id" })
      .select()
      .single();

    if (error) {
      console.error("Error upserting body fat settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar configuración" }, { status: 500 });
  }
}
