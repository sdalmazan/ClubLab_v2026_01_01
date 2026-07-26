import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export const dynamic = "force-dynamic";

function inferPosition(
  existingPos: string | null | undefined,
  shirtNumber: number | null,
  goals: number,
  name: string
): string {
  if (existingPos) {
    const p = existingPos.toLowerCase().trim();
    if (["goalkeeper", "portero", "por", "pt", "gk"].includes(p)) return "goalkeeper";
    if (["back", "defensa", "defender", "df", "lat", "cen", "ct", "cb", "lb", "rb"].includes(p)) return "back";
    if (["midfielder", "centrocampista", "med", "mc", "piv", "vol"].includes(p)) return "midfielder";
    if (["striker", "forward", "winger", "delantero", "extremo", "del", "ext", "fw"].includes(p)) return "striker";
  }

  if (shirtNumber && [1, 12, 13, 22, 25].includes(shirtNumber)) {
    return "goalkeeper";
  }
  if (shirtNumber && [2, 3, 4, 5, 15, 17, 18, 26, 27, 28].includes(shirtNumber)) {
    return "back";
  }
  if (shirtNumber && [6, 8, 10, 14, 16, 20, 21].includes(shirtNumber)) {
    return "midfielder";
  }
  if (shirtNumber && [7, 9, 11, 19, 23, 24].includes(shirtNumber)) {
    return "striker";
  }
  
  if (goals >= 3) {
    return "striker";
  }
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const posArr = ["goalkeeper", "back", "midfielder", "winger", "striker"];
  return posArr[Math.abs(hash) % posArr.length];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Check user plan/subscription
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select(`
        role,
        organizations (
          subscriptions (
            plans ( slug )
          )
        )
      `)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    // Handle both array and single object representation of subscriptions to prevent plan detection fail
    const orgData = (orgRole as any)?.organizations;
    const subs = orgData?.subscriptions;
    let plan = "free";
    if (subs) {
      if (Array.isArray(subs) && subs.length > 0) {
        plan = subs[0]?.plans?.slug || "free";
      } else if (typeof subs === "object") {
        plan = (subs as any).plans?.slug || (subs as any)[0]?.plans?.slug || "free";
      }
    }

    const hasScoutingAccess = plan === "performance" || plan === "academy" || orgRole?.role === "super_admin" || user.email === "diecilo7@gmail.com";

    // Extract search query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const teamParam = searchParams.get("team")?.trim() || "";
    const season = searchParams.get("season")?.trim() || "";
    const competition = searchParams.get("competition")?.trim() || "";
    const position = searchParams.get("position")?.trim() || "";
    
    const minGoalsStr = searchParams.get("minGoals") || "";
    const minGoals = minGoalsStr ? parseInt(minGoalsStr) : 0;
    
    const maxGoalsConcededStr = searchParams.get("maxGoalsConceded") || "";
    const maxGoalsConceded = maxGoalsConcededStr ? parseInt(maxGoalsConcededStr) : null;

    // Allow user to query their own team ("C.D. Almazán" / "S.D. Almazán") without premium license check
    const isQueryingOwnTeam = teamParam === "C.D. Almazán" || teamParam === "S.D. Almazán";

    if (!hasScoutingAccess && !isQueryingOwnTeam) {
      return NextResponse.json(
        { error: "Tu licencia actual no incluye acceso al módulo de Scouting de otros equipos." },
        { status: 403 }
      );
    }

    // Block non-premium (free) plans from querying historical seasons of their own team
    const isPremium = plan === "performance" || plan === "academy" || orgRole?.role === "super_admin" || user.email === "diecilo7@gmail.com";
    
    // Fetch influence records in pages (PostgREST limit is 1000)
    let allInfluenceData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = statsAdmin
        .from("stat_player_match_influence")
        .select("*")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.ilike("player_name", `%${search}%`);
      }
      
      // Support comma-separated team multi-select
      if (teamParam) {
        const teamsList = teamParam.split(",").map(t => t === "S.D. Almazán" ? "C.D. Almazán" : t);
        query = query.in("team_name", teamsList);
      }
      
      // Support comma-separated season multi-select
      if (season) {
        const seasonsList = season.split(",");
        query = query.in("season", seasonsList);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allInfluenceData = [...allInfluenceData, ...data];
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    if (allInfluenceData.length === 0) {
      return NextResponse.json([]);
    }

    // Extract unique IDs
    const matchIds = Array.from(new Set(allInfluenceData.map((d) => d.match_id)));
    const lineupIds = Array.from(new Set(allInfluenceData.map((d) => d.lineup_id)));

    // Fetch matches with competition details (chunked to prevent PostgREST URI Too Long / Bad Request)
    const matchesMap = new Map<string, any>();
    const matchChunkSize = 100;
    for (let i = 0; i < matchIds.length; i += matchChunkSize) {
      const chunk = matchIds.slice(i, i + matchChunkSize);
      let matchesQuery = statsAdmin
        .from("stat_matches")
        .select("id, competition, season, match_date, home_team, away_team")
        .in("id", chunk);

      // Support comma-separated competition multi-select
      if (competition) {
        const compsList = competition.split(",");
        matchesQuery = matchesQuery.in("competition", compsList);
      }

      const { data: chunkMatches, error: matchesErr } = await matchesQuery;
      if (matchesErr) {
        return NextResponse.json({ error: matchesErr.message }, { status: 500 });
      }

      if (chunkMatches) {
        for (const m of chunkMatches) {
          matchesMap.set(m.id, m);
        }
      }
    }

    // Fetch lineups for shirt numbers & positions (chunked to prevent Bad Request)
    const lineupsMap = new Map<string, any>();
    const lineupChunkSize = 100;
    for (let i = 0; i < lineupIds.length; i += lineupChunkSize) {
      const chunk = lineupIds.slice(i, i + lineupChunkSize);
      const { data: chunkLineups, error: lineupsErr } = await statsAdmin
        .from("stat_lineups")
        .select("id, shirt_number, position")
        .in("id", chunk);

      if (lineupsErr) {
        return NextResponse.json({ error: lineupsErr.message }, { status: 500 });
      }

      if (chunkLineups) {
        for (const l of chunkLineups) {
          lineupsMap.set(l.id, l);
        }
      }
    }

    // Aggregate stats by player + team + season
    const playerStats: Record<string, any> = {};

    for (const row of allInfluenceData) {
      const match = matchesMap.get(row.match_id);
      if (!match) continue; // Filter out matches that don't match the competition filter

      const lineup = lineupsMap.get(row.lineup_id);
      const shirtNumber = lineup?.shirt_number ?? null;
      const explicitPosition = lineup?.position || row.position || null;

      const key = `${row.player_name}|${row.team_name}|${row.season}`;
      
      if (!playerStats[key]) {
        playerStats[key] = {
          player_name: row.player_name,
          team_name: row.team_name,
          season: row.season,
          competition: match.competition,
          shirt_number: shirtNumber,
          position: explicitPosition,
          matches_played: 0,
          starts: 0,
          minutes_on: 0,
          goals_scored: 0,
          yellow_cards: 0,
          red_cards: 0,
          goals_for_while_on: 0,
          goals_against_while_on: 0,
          clean_sheets_minutes: 0,
          penalties_scored: 0,
          
          // Substitution details
          sub_appearances: 0,
          sub_team_goals_before: 0,
          sub_opp_goals_before: 0,
          sub_team_goals_after: 0,
          sub_opp_goals_after: 0,

          // Track matches for chronological regularity
          match_history: [],
        };
      } else if (!playerStats[key].position && explicitPosition) {
        playerStats[key].position = explicitPosition;
      }

      const p = playerStats[key];
      p.matches_played += 1;
      if (row.is_starter) {
        p.starts += 1;
      } else if (row.minutes_on > 0) {
        p.sub_appearances += 1;
        
        // Calculate goals before coming on
        const isHome = row.team_name === match.home_team;
        const teamGoalsBefore = isHome ? row.score_home_at_entry : row.score_away_at_entry;
        const oppGoalsBefore = isHome ? row.score_away_at_entry : row.score_home_at_entry;
        
        // Calculate goals after coming on
        const teamGoalsAfter = isHome ? row.goals_for_while_on : row.goals_against_while_on;
        const oppGoalsAfter = isHome ? row.goals_against_while_on : row.goals_for_while_on;

        p.sub_team_goals_before += (teamGoalsBefore || 0);
        p.sub_opp_goals_before += (oppGoalsBefore || 0);
        p.sub_team_goals_after += (teamGoalsAfter || 0);
        p.sub_opp_goals_after += (oppGoalsAfter || 0);
      }

      p.minutes_on += (row.minutes_on || 0);
      p.goals_scored += (row.goals_scored || 0);
      p.yellow_cards += (row.yellow_cards || 0);
      p.red_cards += (row.red_cards || 0);
      p.goals_for_while_on += (row.goals_for_while_on || 0);
      p.goals_against_while_on += (row.goals_against_while_on || 0);
      p.penalties_scored += (row.penalties_scored || 0);
      
      // Clean sheet ponderado
      if ((row.team_goals_conceded || 0) === 0) {
        p.clean_sheets_minutes += (row.minutes_on || 0);
      }

      p.match_history.push({
        match_date: match.match_date || "1970-01-01",
        minutes_on: row.minutes_on || 0
      });
    }

    let list = Object.values(playerStats).map((p: any) => {
      // Infer position
      const inferredPos = inferPosition(p.position, p.shirt_number, p.goals_scored, p.player_name);
      
      // Compute advanced metrics
      const totalCards = p.yellow_cards + p.red_cards;
      const cardsDensity = totalCards > 0 ? Math.round(p.minutes_on / totalCards) : 9999;
      
      // Net goal impact per 90 mins
      const netImpactPer90 = p.minutes_on > 0 
        ? parseFloat((((p.goals_for_while_on - p.goals_against_while_on) / p.minutes_on) * 90).toFixed(2))
        : 0;

      // Substitution revulsive impact
      let revulsiveImpact = 0;
      if (p.sub_appearances > 0) {
        const netDiffBefore = p.sub_team_goals_before - p.sub_opp_goals_before;
        const netDiffAfter = p.sub_team_goals_after - p.sub_opp_goals_after;
        revulsiveImpact = parseFloat((netDiffAfter - netDiffBefore).toFixed(2));
      }

      // Regularity index (latest 5 matches)
      p.match_history.sort((a: any, b: any) => b.match_date.localeCompare(a.match_date));
      const latest5 = p.match_history.slice(0, 5);
      const minutesPlayed5 = latest5.reduce((sum: number, m: any) => sum + m.minutes_on, 0);
      const regularityIndex = Math.round((minutesPlayed5 / 450) * 100);

      // Clean sheet ratio
      const cleanSheetRatio = p.minutes_on > 0 
        ? Math.round((p.clean_sheets_minutes / p.minutes_on) * 100)
        : 0;

      return {
        player_name: p.player_name,
        team_name: p.team_name,
        season: p.season,
        competition: p.competition,
        shirt_number: p.shirt_number,
        position: inferredPos,
        matches_played: p.matches_played,
        starts: p.starts,
        minutes_on: p.minutes_on,
        goals_scored: p.goals_scored,
        goals_conceded: p.goals_against_while_on, // Goles encajados en cancha
        yellow_cards: p.yellow_cards,
        red_cards: p.red_cards,
        
        // Advanced
        net_impact: p.goals_for_while_on - p.goals_against_while_on,
        net_impact_per_90: netImpactPer90,
        revulsive_impact: revulsiveImpact,
        regularity_index: regularityIndex,
        cards_density: cardsDensity,
        clean_sheet_ratio: cleanSheetRatio,
        penalties_scored: p.penalties_scored,
        
        // Explicitly return goals for and against while on field
        goals_for_while_on: p.goals_for_while_on,
        goals_against_while_on: p.goals_against_while_on,
      };
    });

    // Apply plan-based lock: Non-premium (free) users cannot see historical data of their own team
    if (!isPremium && isQueryingOwnTeam) {
      // Filter out historical seasons (e.g. only allow season === activeSeasonName)
      list = list.filter((p: any) => p.season === "2026/2027");
    }

    // Apply Filters
    if (minGoals > 0) {
      list = list.filter((p: any) => p.goals_scored >= minGoals);
    }
    if (maxGoalsConceded !== null) {
      list = list.filter((p: any) => p.goals_conceded <= maxGoalsConceded);
    }
    
    // Support comma-separated position multi-select
    if (position) {
      const posList = position.split(",");
      list = list.filter((p: any) => posList.includes(p.position));
    }
    
    // Support comma-separated competition multi-select
    if (competition) {
      const compsList = competition.split(",");
      list = list.filter((p: any) => compsList.some(comp => p.competition.toLowerCase().includes(comp.toLowerCase())));
    }

    // Sort by goals desc
    list.sort((a: any, b: any) => b.goals_scored - a.goals_scored);

    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 505 });
  }
}
