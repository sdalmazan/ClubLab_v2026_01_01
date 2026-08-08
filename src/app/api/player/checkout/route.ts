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

    let targetDate = new Date().toISOString().split("T")[0];
    let resolvedSessionId = sessionId || null;

    if (matchId && !resolvedSessionId) {
      const { data: matchRow } = await supabase
        .from("matches")
        .select("session_id, date, opponent, competition")
        .eq("id", matchId)
        .maybeSingle();

      if (matchRow) {
        if (matchRow.date) targetDate = matchRow.date;

        if (matchRow.session_id) {
          resolvedSessionId = matchRow.session_id;
        } else {
          // We MUST create a session because rpe_entries requires a session_id
          const { data: newSession, error: createSessionErr } = await supabase
            .from("training_sessions")
            .insert({
              organization_id: organizationId,
              team_id: orgRole?.team_id || null, // Best effort
              date: matchRow.date || targetDate,
              title: `Partido vs ${matchRow.opponent || "Rival"}`,
              session_type: "match",
              notes: matchRow.competition || "Partido Oficial",
              status: "completed",
              match_opponent: matchRow.opponent,
              match_competition: matchRow.competition
            })
            .select("id")
            .single();

          if (newSession?.id) {
            resolvedSessionId = newSession.id;
            // Link back to match
            await supabase.from("matches").update({ session_id: newSession.id }).eq("id", matchId);
          } else {
            console.error("Error creating synthetic session for match:", createSessionErr);
          }
        }
      }
    } else if (resolvedSessionId) {
       // just fetch date to be accurate if possible
       const { data: s } = await supabase.from("training_sessions").select("date").eq("id", resolvedSessionId).maybeSingle();
       if (s?.date) targetDate = s.date;
    }

    if (!resolvedSessionId) {
      return NextResponse.json({ error: "No se encontró sesión o partido válido para registrar el esfuerzo." }, { status: 400 });
    }

    // Insert/Upsert into rpe_entries (NOTE: date and match_id columns do NOT exist in the DB schema)
    const rpePayload: any = {
      organization_id: organizationId,
      player_id: playerId,
      session_id: resolvedSessionId,
      rpe: rpe ?? 7,
      post_feeling: postFeeling || "good",
      notes: notes || (matchId ? `Check-out Partido (Match ID: ${matchId}) - Fecha: ${targetDate}` : `Fecha: ${targetDate}`),
    };
    const { error: upsertErr } = await supabase
      .from("rpe_entries")
      .upsert(rpePayload, { onConflict: "player_id,session_id" });

    if (upsertErr) {
      console.error("Error saving RPE entry:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

