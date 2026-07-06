import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import { calculateRivalAnalysis } from "@/lib/scouting/rivalAnalysisEngine";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener parámetros de búsqueda
    const { searchParams } = new URL(request.url);
    const rivalName = searchParams.get("rivalName");
    const season = searchParams.get("season") || "2025/2026";

    if (!rivalName) {
      return NextResponse.json({ error: "El parámetro rivalName es obligatorio" }, { status: 400 });
    }

    // 3. Obtener organización del usuario y sus overrides
    const { data: orgRole, error: orgRoleErr } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    let orgSettings: any = {};
    if (orgRole) {
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgRole.organization_id)
        .single();
      if (org) {
        orgSettings = org.settings || {};
      }
    }

    // 4. Obtener todos los partidos de la temporada en Statistics_DB
    const { data: allMatches, error: matchesErr } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .eq("season", season);

    if (matchesErr || !allMatches) {
      return NextResponse.json({ error: matchesErr?.message || "No se encontraron partidos" }, { status: 500 });
    }

    const cleanRivalName = rivalName.toLowerCase().trim();
    const rivalMatches = allMatches.filter(
      (m: any) =>
        m.home_team.toLowerCase().trim() === cleanRivalName ||
        m.away_team.toLowerCase().trim() === cleanRivalName
    );

    if (rivalMatches.length === 0) {
      return NextResponse.json({
        message: "No se encontraron enfrentamientos oficiales para este equipo en la temporada seleccionada",
        rivalName,
        season,
        matchesPlayed: 0,
      });
    }

    const matchIds = rivalMatches.map((m: any) => m.id);

    // 5. Obtener alineaciones
    const { data: lineups, error: lineupsErr } = await statsAdmin
      .from("stat_lineups")
      .select("*")
      .in("match_id", matchIds);

    if (lineupsErr) {
      return NextResponse.json({ error: lineupsErr.message }, { status: 500 });
    }

    // 6. Obtener eventos
    const { data: events, error: eventsErr } = await statsAdmin
      .from("stat_events")
      .select("*")
      .in("match_id", matchIds)
      .order("minute", { ascending: true })
      .order("extra_time", { ascending: true });

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    // 7. Calcular las métricas avanzadas de scouting en memoria
    const analysisResult = calculateRivalAnalysis(
      rivalName,
      season,
      rivalMatches,
      lineups || [],
      events || [],
      orgSettings
    );

    return NextResponse.json(analysisResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
