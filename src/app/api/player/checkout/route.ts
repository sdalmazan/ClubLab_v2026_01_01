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
    const { rpe, postFeeling, notes, playerId: inputPlayerId, sessionId, matchId } = body;

    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id, team_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let organizationId = orgRole?.organization_id;

    let playerId = inputPlayerId;
    const { data: playerRow } = await supabase
      .from("players")
      .select("id, organization_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    if (playerRow) {
      if (!playerId) playerId = playerRow.id;
      if (!organizationId) organizationId = playerRow.organization_id;
    }

    if (!organizationId || !playerId) {
      return NextResponse.json(
        { error: "No se encontró la ficha del jugador ni la organización asociada a esta cuenta." },
        { status: 400 }
      );
    }

    // Find session_id and date if matchId or sessionId was provided
    let resolvedSessionId = sessionId || null;
    let targetDate = new Date().toISOString().split("T")[0];

    if (matchId) {
      const { data: matchRow } = await supabase
        .from("matches")
        .select("session_id, date")
        .eq("id", matchId)
        .maybeSingle();
      if (matchRow) {
        if (matchRow.session_id) resolvedSessionId = matchRow.session_id;
        if (matchRow.date) targetDate = matchRow.date;
      }
    } else if (resolvedSessionId) {
      const { data: sessionRow } = await supabase
        .from("training_sessions")
        .select("date")
        .eq("id", resolvedSessionId)
        .maybeSingle();
      if (sessionRow?.date) {
        targetDate = sessionRow.date;
      }
    }

    // Insert/Upsert into rpe_entries
    const rpePayload: any = {
      organization_id: organizationId,
      player_id: playerId,
      date: targetDate,
      rpe: rpe ?? 7,
      post_feeling: postFeeling || "good",
      notes: notes || (matchId ? `Check-out Partido (Match ID: ${matchId})` : null),
    };
    if (resolvedSessionId) {
      rpePayload.session_id = resolvedSessionId;
    }
    if (matchId) {
      rpePayload.match_id = matchId;
    }

    const { error: upsertErr } = await supabase
      .from("rpe_entries")
      .upsert(rpePayload, { onConflict: "player_id,date" });

    if (upsertErr) {
      console.error("Error saving RPE entry:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

