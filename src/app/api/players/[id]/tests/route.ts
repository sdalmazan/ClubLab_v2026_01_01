import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertPerformanceTest } from "@/services/tests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = (await params).id;

  try {
    const { testTypeId, date, value, notes } = await request.json();

    if (!testTypeId || !date || value === undefined) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Obtener la organización del jugador
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("organization_id")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    // Obtener el equipo del jugador
    const { data: membership } = await supabase
      .from("player_team_memberships")
      .select("team_id")
      .eq("player_id", playerId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const teamId = membership?.team_id || null;

    const test = await insertPerformanceTest(player.organization_id, teamId, {
      player_id: playerId,
      test_id: testTypeId,
      date,
      value: Number(value),
      notes,
      conducted_by: user.id,
    });

    return NextResponse.json({ success: true, id: test.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
