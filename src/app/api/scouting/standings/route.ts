import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export interface TeamStanding {
  position: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ("V" | "E" | "D")[];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season") || "2026/2027";
    const competition = searchParams.get("competition") || "Tercera Federación - Grupo 8";
    const requestedMatchday = searchParams.get("matchday");

    // Fetch all matches for the season
    const { data: matches, error } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .eq("season", season)
      .eq("competition", competition)
      .order("matchday", { ascending: true })
      .order("match_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allMatches: any[] = matches || [];

    // Find all unique teams in this season
    const teamsSet = new Set<string>();
    for (const m of allMatches) {
      if (m.home_team) teamsSet.add(m.home_team);
      if (m.away_team) teamsSet.add(m.away_team);
    }
    const teamsList = Array.from(teamsSet);

    // Find the highest matchday that has at least 1 played match
    let lastPlayedMatchday = 1;
    for (const m of allMatches) {
      const isPlayed = m.home_score !== null && m.away_score !== null;
      if (isPlayed && m.matchday > lastPlayedMatchday) {
        lastPlayedMatchday = m.matchday;
      }
    }

    // Determine target matchday to evaluate standings for
    const targetMatchday = requestedMatchday ? parseInt(requestedMatchday, 10) : lastPlayedMatchday;

    // Filter matches up to targetMatchday
    const matchesUpToTarget = allMatches.filter((m: any) => m.matchday <= targetMatchday);

    // Map to track stats per team up to targetMatchday
    const teamStats = new Map<
      string,
      {
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
        matchResults: { matchday: number; date: string | null; result: "V" | "E" | "D" }[];
      }
    >();

    // Initialize all teams
    for (const team of teamsList) {
      teamStats.set(team, {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        matchResults: [],
      });
    }

    // Process played matches up to targetMatchday
    for (const m of matchesUpToTarget) {
      const isPlayed = m.home_score !== null && m.away_score !== null;
      if (!isPlayed) continue;

      const home = teamStats.get(m.home_team);
      const away = teamStats.get(m.away_team);

      const hScore = Number(m.home_score);
      const aScore = Number(m.away_score);

      if (home) {
        home.played += 1;
        home.goalsFor += hScore;
        home.goalsAgainst += aScore;

        if (hScore > aScore) {
          home.wins += 1;
          home.points += 3;
          home.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "V" });
        } else if (hScore === aScore) {
          home.draws += 1;
          home.points += 1;
          home.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "E" });
        } else {
          home.losses += 1;
          home.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "D" });
        }
      }

      if (away) {
        away.played += 1;
        away.goalsFor += aScore;
        away.goalsAgainst += hScore;

        if (aScore > hScore) {
          away.wins += 1;
          away.points += 3;
          away.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "V" });
        } else if (aScore === hScore) {
          away.draws += 1;
          away.points += 1;
          away.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "E" });
        } else {
          away.losses += 1;
          away.matchResults.push({ matchday: m.matchday, date: m.match_date, result: "D" });
        }
      }
    }

    // Build standings array
    const standings: TeamStanding[] = Array.from(teamStats.entries()).map(([team, stats]) => {
      const goalDiff = stats.goalsFor - stats.goalsAgainst;

      // Extract last 5 matches form (ordered chronologically)
      const last5 = stats.matchResults
        .slice(-5)
        .map((r) => r.result);

      return {
        position: 0,
        team,
        played: stats.played,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,
        goalDiff,
        points: stats.points,
        form: last5,
      };
    });

    // Sort standings according to official rules: Points > Goal Difference > Goals For > Team Name
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    });

    // Assign 1-based positions
    standings.forEach((item, index) => {
      item.position = index + 1;
    });

    // Extract total matchdays (max matchday in dataset, default 34)
    const totalMatchdays = Math.max(34, ...allMatches.map((m: any) => m.matchday || 0));

    return NextResponse.json({
      season,
      competition,
      selectedMatchday: targetMatchday,
      lastPlayedMatchday,
      totalMatchdays,
      standings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
