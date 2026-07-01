import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assignTaskToPlayer } from "@/services/tasks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playerId = (await params).id;

  try {
    const { exerciseId, staffComment } = await request.json();

    if (!exerciseId) {
      return NextResponse.json({ error: "Faltan campos obligatorios (exerciseId)" }, { status: 400 });
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

    const task = await assignTaskToPlayer(
      player.organization_id,
      playerId,
      exerciseId,
      staffComment
    );

    return NextResponse.json({ success: true, id: task.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
