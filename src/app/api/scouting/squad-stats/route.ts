import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Get user organization
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!orgRole) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    // Extract search query params
    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season") || "2025/2026";
    const targetTeam = searchParams.get("team") || "C.D. Almazán";

    // 3. Get organization scouting overrides
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgRole.organization_id)
      .single();

    const scoutingMatches = org?.settings?.scouting?.matches || {};

    // 4. Fetch all team matches
    const { data: matches, error: matchesErr } = await statsAdmin
      .from("stat_matches")
      .select("id, match_date, home_team, away_team, score_home, score_away, round")
      .or(`home_team.ilike.%Almazán%,away_team.ilike.%Almazán%`)
      .order("match_date", { ascending: true });

    if (matchesErr || !matches || matches.length === 0) {
      return NextResponse.json([]);
    }

    const matchIds = (matches as any[]).map((m: any) => m.id);

    // 5. Fetch all lineups for these matches
    const { data: lineups, error: lineupsErr } = await statsAdmin
      .from("stat_lineups")
      .select("match_id, player_name, shirt_number, is_starter, team_name")
      .in("match_id", matchIds);

    if (lineupsErr) {
      return NextResponse.json({ error: lineupsErr.message }, { status: 500 });
    }

    // 6. Fetch all goal events for these matches
    const { data: goalEvents, error: eventsErr } = await statsAdmin
      .from("stat_events")
      .select("id, match_id, event_type, minute, player_name, team_name")
      .in("match_id", matchIds)
      .in("event_type", ["goal", "penalty_goal"]);

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    // 7. Aggregate stats per player
    const playerMap: Record<
      string,
      {
        player_name: string;
        shirt_number: number | null;
        matches_played: number;
        starts: number;
        goals: number;
        penalty_goals: number;
        assists: number;
        total_contributions: number;
        matches_with_goals: string[];
        matches_with_assists: string[];
      }
    > = {};

    // Initialize players from lineups
    (lineups as any[] || []).forEach((l: any) => {
      const isOurTeam = l.team_name.toLowerCase().includes("almazán");
      if (!isOurTeam) return;

      const pName = l.player_name.trim();
      if (!playerMap[pName]) {
        playerMap[pName] = {
          player_name: pName,
          shirt_number: l.shirt_number || null,
          matches_played: 0,
          starts: 0,
          goals: 0,
          penalty_goals: 0,
          assists: 0,
          total_contributions: 0,
          matches_with_goals: [],
          matches_with_assists: [],
        };
      }

      playerMap[pName].matches_played += 1;
      if (l.is_starter) playerMap[pName].starts += 1;
      if (l.shirt_number && !playerMap[pName].shirt_number) {
        playerMap[pName].shirt_number = l.shirt_number;
      }
    });

    // Process goal events and assistances (including overrides)
    (goalEvents as any[] || []).forEach((event: any) => {
      const isOurTeamGoal = event.team_name.toLowerCase().includes("almazán");
      if (!isOurTeamGoal) return;

      const matchId = event.match_id;
      const matchOverrides = scoutingMatches[matchId]?.overrides || {};
      const assistances = matchOverrides.assistances || {};
      const goalScorers = matchOverrides.goal_scorers || {};

      const goalKey = event.id || `${event.player_name}-${event.minute}`;

      // Scorer (overridden or default)
      const actualScorer = (goalScorers[goalKey] || event.player_name).trim();

      // Assistant (overridden)
      const actualAssistant = (assistances[goalKey] || "").trim();

      // Credit scorer
      if (actualScorer) {
        if (!playerMap[actualScorer]) {
          playerMap[actualScorer] = {
            player_name: actualScorer,
            shirt_number: null,
            matches_played: 1,
            starts: 0,
            goals: 0,
            penalty_goals: 0,
            assists: 0,
            total_contributions: 0,
            matches_with_goals: [],
            matches_with_assists: [],
          };
        }
        playerMap[actualScorer].goals += 1;
        if (event.event_type === "penalty_goal") {
          playerMap[actualScorer].penalty_goals += 1;
        }
        playerMap[actualScorer].total_contributions += 1;
        playerMap[actualScorer].matches_with_goals.push(`Jornada (Min ${event.minute}')`);
      }

      // Credit assistant
      if (actualAssistant) {
        if (!playerMap[actualAssistant]) {
          playerMap[actualAssistant] = {
            player_name: actualAssistant,
            shirt_number: null,
            matches_played: 1,
            starts: 0,
            goals: 0,
            penalty_goals: 0,
            assists: 0,
            total_contributions: 0,
            matches_with_goals: [],
            matches_with_assists: [],
          };
        }
        playerMap[actualAssistant].assists += 1;
        playerMap[actualAssistant].total_contributions += 1;
        playerMap[actualAssistant].matches_with_assists.push(`Jornada (Min ${event.minute}')`);
      }
    });

    const squadList = Object.values(playerMap).sort(
      (a, b) => b.total_contributions - a.total_contributions || b.goals - a.goals || b.assists - a.assists
    );

    return NextResponse.json(squadList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
