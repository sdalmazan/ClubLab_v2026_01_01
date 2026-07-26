import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rpe, postFeeling, notes, playerId: inputPlayerId, sessionId } = body;

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const organizationId = orgRole?.organization_id;

    let playerId = inputPlayerId;
    if (!playerId) {
      const { data: playerRow } = await supabase
        .from("players")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      playerId = playerRow?.id;
    }

    if (!organizationId || !playerId) {
      return NextResponse.json({ success: true, message: "Check-out registrado" });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    await supabase.from("rpe_entries").upsert({
      organization_id: organizationId,
      player_id: playerId,
      date: todayStr,
      rpe: rpe ?? 7,
      post_feeling: postFeeling || "good",
      notes: notes || null,
      session_id: sessionId || null,
    }, { onConflict: "player_id,date" });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
