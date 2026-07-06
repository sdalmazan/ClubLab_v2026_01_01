import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name") || "";

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    // Query Statistics_DB for match records
    const { data: stats, error } = await statsAdmin
      .from("stat_player_match_influence")
      .select("player_name, team_name, season, minutes_on, goals_for_while_on, goals_against_while_on, goals_scored, penalties_scored, is_starter, yellow_cards, red_cards, match_date")
      .ilike("player_name", name)
      .order("match_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by season + team
    const historyMap: Record<string, any> = {};

    for (const row of stats || []) {
      const key = `${row.season}|${row.team_name}`;
      if (!historyMap[key]) {
        historyMap[key] = {
          season: row.season,
          team_name: row.team_name,
          matches_played: 0,
          starts: 0,
          minutes_on: 0,
          goals_scored: 0,
          penalties_scored: 0,
          yellow_cards: 0,
          red_cards: 0,
          goals_for_while_on: 0,
          goals_against_while_on: 0,
          latest_match_date: row.match_date || "",
        };
      }
      const s = historyMap[key];
      s.matches_played += 1;
      if (row.is_starter) s.starts += 1;
      s.minutes_on += (row.minutes_on || 0);
      s.goals_scored += (row.goals_scored || 0);
      s.penalties_scored += (row.penalties_scored || 0);
      s.yellow_cards += (row.yellow_cards || 0);
      s.red_cards += (row.red_cards || 0);
      s.goals_for_while_on += (row.goals_for_while_on || 0);
      s.goals_against_while_on += (row.goals_against_while_on || 0);
    }

    const sortedHistory = Object.values(historyMap).sort((a: any, b: any) => {
      if (a.season !== b.season) {
        return b.season.localeCompare(a.season);
      }
      return b.latest_match_date.localeCompare(a.latest_match_date);
    });

    return NextResponse.json(sortedHistory);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
