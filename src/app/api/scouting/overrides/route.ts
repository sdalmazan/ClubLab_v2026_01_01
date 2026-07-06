import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión de usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener organización del usuario
    const { data: orgRole, error: orgRoleErr } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (orgRoleErr || !orgRole) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    // 3. Obtener settings de la organización
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgRole.organization_id)
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: "No se pudieron obtener las configuraciones" }, { status: 500 });
    }

    const scoutingSettings = org.settings?.scouting || { matches: {} };
    return NextResponse.json(scoutingSettings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión de usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener organización del usuario
    const { data: orgRole, error: orgRoleErr } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (orgRoleErr || !orgRole) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    const payload = await request.json();

    // 3. Obtener settings existentes
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgRole.organization_id)
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 454 });
    }

    const currentSettings = org.settings || {};
    const currentScouting = currentSettings.scouting || { matches: {} };

    // Estructura del payload esperado:
    // {
    //   matchId: "...",
    //   overrides: {
    //     acta_quality: "good" | "bad",
    //     assistances: { [goalId]: string },
    //     player_positions: { [playerName]: string },
    //     card_classifications: { [cardKey]: "protesta" | "violencia" | "lance" }
    //   },
    //   staff: { (opcional: local_staff/visitor_staff overrides) }
    // }
    const { matchId, overrides, staff } = payload;
    if (!matchId) {
      return NextResponse.json({ error: "Falta el campo matchId" }, { status: 400 });
    }

    const matchNode = currentScouting.matches?.[matchId] || { overrides: {}, local_staff: null, visitor_staff: null };

    // Fusionar overrides
    matchNode.overrides = {
      ...matchNode.overrides,
      ...overrides,
    };

    // Fusionar staff si se recibe
    if (staff) {
      if (staff.local_staff !== undefined) matchNode.local_staff = staff.local_staff;
      if (staff.visitor_staff !== undefined) matchNode.visitor_staff = staff.visitor_staff;
    }

    // Actualizar el nodo principal de scouting
    const newScouting = {
      ...currentScouting,
      matches: {
        ...(currentScouting.matches || {}),
        [matchId]: matchNode,
      },
    };

    const newSettings = {
      ...currentSettings,
      scouting: newScouting,
    };

    // 4. Guardar en base de datos
    const { error: updateErr } = await supabase
      .from("organizations")
      .update({ settings: newSettings })
      .eq("id", orgRole.organization_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, scouting: newScouting });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
