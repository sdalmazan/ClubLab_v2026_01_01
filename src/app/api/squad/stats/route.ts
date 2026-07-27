import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId") || "";

    if (!teamId) {
      return NextResponse.json({ error: "El teamId es obligatorio" }, { status: 400 });
    }

    // Fetch players of this team from local DB
    const { data: players, error: playersErr } = await supabase
      .from("players")
      .select(`
        id, first_name, last_name, is_invisible,
        membership:player_team_memberships(team_id, status)
      `)
      .eq("player_team_memberships.team_id", teamId)
      .in("player_team_memberships.status", ["active", "inactive"])
      .or("is_invisible.eq.false,is_invisible.is.null");

    if (playersErr) {
      return NextResponse.json({ error: playersErr.message }, { status: 500 });
    }

    const visiblePlayers = (players || []).filter((p: any) => p.adjective !== "invisible" && p.is_invisible !== true && p.email !== "diego.ciria.lopez@gmail.com");

    if (visiblePlayers.length === 0) {
      return NextResponse.json([]);
    }

    // Map to list of full names
    const playerNames = visiblePlayers.map(p => `${p.first_name} ${p.last_name}`);

    // Query Statistics_DB for match influence details
    const { data: stats, error: statsErr } = await statsAdmin
      .from("stat_player_match_influence")
      .select("player_name, team_name, season, minutes_on, goals_for_while_on, goals_against_while_on, goals_scored, is_starter")
      .in("player_name", playerNames);

    if (statsErr) {
      return NextResponse.json({ error: statsErr.message }, { status: 500 });
    }

    return NextResponse.json(stats || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
