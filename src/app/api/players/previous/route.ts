import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");
  const search = searchParams.get("search");

  if (!teamId) {
    return NextResponse.json({ error: "Falta el parámetro teamId" }, { status: 400 });
  }

  try {
    // 1. Get the current team context
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("name, club_id, season_id, seasons(start_date)")
      .eq("id", teamId)
      .single();

    if (teamErr || !team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    // 2. Fetch active players in the active squad to exclude them from import lists
    const { data: activeMembers } = await supabase
      .from("player_team_memberships")
      .select(`
        player_id,
        players (
          first_name,
          last_name
        )
      `)
      .eq("team_id", teamId)
      .eq("season_id", team.season_id);

    const activePlayerIds = new Set<string>();
    const activePlayerNames = new Set<string>();

    if (activeMembers) {
      for (const m of activeMembers) {
        if (m.player_id) activePlayerIds.add(m.player_id);
        const player = m.players as any;
        if (player) {
          const first = (player.first_name || "").trim().toLowerCase();
          const last = (player.last_name || "").trim().toLowerCase();
          if (first || last) {
            activePlayerNames.add(`${last} ${first}`.replace(/\s+/g, " ").trim());
            activePlayerNames.add(`${first} ${last}`.replace(/\s+/g, " ").trim());
          }
        }
      }
    }

    const isActivePlayer = (name: string, id?: string) => {
      if (id && activePlayerIds.has(id)) return true;

      const clean = name.replace(/,/g, "").replace(/\s+/g, " ").toLowerCase().trim();
      if (activePlayerNames.has(clean)) return true;

      const parts = name.split(",");
      if (parts.length === 2) {
        const reverseClean = `${parts[1].trim()} ${parts[0].trim()}`.replace(/\s+/g, " ").toLowerCase().trim();
        if (activePlayerNames.has(reverseClean)) return true;
      }

      return false;
    };

    // CASE A: Search for other players in the league by name
    if (search) {
      let query = statsAdmin
        .from("stat_lineups")
        .select("player_name, team_name");

      // Split the search query into tokens to allow matching different word orders
      const tokens = search.trim().split(/\s+/).filter((t) => t.length > 1);
      if (tokens.length > 0) {
        for (const token of tokens) {
          query = query.ilike("player_name", `%${token}%`);
        }
      } else {
        query = query.ilike("player_name", `%${search}%`);
      }

      const { data: searchResults, error: err } = await query.limit(100);

      if (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }

      const mergedMap: Record<string, { id?: string; name: string; team?: string }> = {};

      // Find if we have matches in main database by name to attach existing IDs
      const orgId = (team as any).clubs?.organization_id || 
                    (await supabase.from("clubs").select("organization_id").eq("id", team.club_id).single()).data?.organization_id;
      
      let mainDbPlayers: any[] = [];
      if (orgId) {
        const { data } = await supabase
          .from("players")
          .select("id, first_name, last_name")
          .eq("organization_id", orgId);
        mainDbPlayers = data || [];
      }

      for (const row of searchResults || []) {
        if (!row.player_name) continue;
        const formattedName = row.player_name.toUpperCase();
        const key = `${formattedName}|${row.team_name}`.trim().toLowerCase();

        let matchedId: string | undefined;
        for (const mp of mainDbPlayers) {
          const fullName = `${mp.last_name} ${mp.first_name}`.toLowerCase();
          if (fullName.includes(formattedName.toLowerCase()) || formattedName.toLowerCase().includes(fullName)) {
            matchedId = mp.id;
            break;
          }
        }

        // Exclude if already in active squad
        if (isActivePlayer(formattedName, matchedId)) {
          continue;
        }

        mergedMap[key] = {
          id: matchedId,
          name: formattedName,
          team: row.team_name
        };
      }

      const sortedList = Object.values(mergedMap).sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ players: sortedList, isSearch: true });
    }

    // CASE B: Standard team roster continuity import
    const mergedMap: Record<string, { id?: string; name: string; team?: string }> = {};
    const currentStartDate = (team as any)?.seasons?.start_date;

    // 2. Query MAIN DATABASE for players of the previous season
    if (currentStartDate) {
      const { data: prevSeason } = await supabase
        .from("seasons")
        .select("id")
        .eq("club_id", team.club_id)
        .lt("start_date", currentStartDate)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevSeason) {
        const { data: mainDbMembers } = await supabase
          .from("player_team_memberships")
          .select(`
            player_id,
            players (
              first_name,
              last_name
            )
          `)
          .eq("team_id", teamId)
          .eq("season_id", prevSeason.id);

        if (mainDbMembers) {
          for (const m of mainDbMembers) {
            const player = m.players as any;
            if (player && player.first_name) {
              const formattedName = `${player.last_name.toUpperCase()}, ${player.first_name.toUpperCase()}`;
              
              if (isActivePlayer(formattedName, m.player_id)) {
                continue; // Exclude already active squad players
              }

              const key = formattedName.trim().toLowerCase();
              mergedMap[key] = {
                id: m.player_id,
                name: formattedName,
                team: team.name
              };
            }
          }
        }
      }
    }

    // 3. Query FEDERATION DATABASE for matches involving the team in the targetSeason
    const cleanTeamName = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("almaz") || lower === "senior a" || lower === "primer equipo" || lower === "senior") {
        return "C.D. Almazán";
      }
      return name;
    };

    let searchTeamName = cleanTeamName(team.name);
    let targetSeason = "2025/2026";

    // Find if we have matches in stat_matches for the targetSeason
    let matchesQuery = statsAdmin
      .from("stat_matches")
      .select("id")
      .eq("season", "2025/2026");

    if (searchTeamName === "C.D. Almazán") {
      matchesQuery = matchesQuery.or("home_team.eq.C.D. Almazán,away_team.eq.C.D. Almazán");
    } else {
      const cleaned = searchTeamName.replace(/S\.?D\.?/gi, "").trim();
      matchesQuery = matchesQuery.or(`home_team.ilike.%${cleaned}%,away_team.ilike.%${cleaned}%`);
    }

    const { data: matches2025 } = await matchesQuery;

    // If no matches in 2025/2026, find the most recent season with matches for this team
    if (!matches2025 || matches2025.length === 0) {
      let seasonQuery = statsAdmin
        .from("stat_matches")
        .select("season");

      if (searchTeamName === "C.D. Almazán") {
        seasonQuery = seasonQuery.or("home_team.eq.C.D. Almazán,away_team.eq.C.D. Almazán");
      } else {
        const cleaned = searchTeamName.replace(/S\.?D\.?/gi, "").trim();
        seasonQuery = seasonQuery.or(`home_team.ilike.%${cleaned}%,away_team.ilike.%${cleaned}%`);
      }

      const { data: seasonsList } = await seasonQuery.limit(500);
      if (seasonsList && seasonsList.length > 0) {
        const uniqueSeasons = Array.from(new Set(seasonsList.map((s: any) => s.season))).sort((a: any, b: any) =>
          b.localeCompare(a)
        );
        if (uniqueSeasons[0]) {
          targetSeason = uniqueSeasons[0];
        }
      }
    }

    // Query match IDs for targetSeason
    let finalMatchesQuery = statsAdmin
      .from("stat_matches")
      .select("id")
      .eq("season", targetSeason);

    if (searchTeamName === "C.D. Almazán") {
      finalMatchesQuery = finalMatchesQuery.or("home_team.eq.C.D. Almazán,away_team.eq.C.D. Almazán");
    } else {
      const cleaned = searchTeamName.replace(/S\.?D\.?/gi, "").trim();
      finalMatchesQuery = finalMatchesQuery.or(`home_team.ilike.%${cleaned}%,away_team.ilike.%${cleaned}%`);
    }

    const { data: finalMatches } = await finalMatchesQuery;
    const matchIds = finalMatches?.map((m: any) => m.id) || [];

    if (matchIds.length > 0) {
      // Query stat_lineups for players
      let lineupsQuery = statsAdmin
        .from("stat_lineups")
        .select("player_name, team_name")
        .in("match_id", matchIds);

      if (searchTeamName === "C.D. Almazán") {
        lineupsQuery = lineupsQuery.eq("team_name", "C.D. Almazán");
      } else {
        const cleaned = searchTeamName.replace(/S\.?D\.?/gi, "").trim();
        lineupsQuery = lineupsQuery.ilike("team_name", `%${cleaned}%`);
      }

      const { data: lineups } = await lineupsQuery;

      if (lineups) {
        for (const row of lineups) {
          if (row.player_name) {
            const formattedName = row.player_name.toUpperCase();
            const key = formattedName.trim().toLowerCase();

            if (isActivePlayer(formattedName)) {
              continue; // Exclude already active squad players
            }

            if (!mergedMap[key]) {
              mergedMap[key] = {
                name: formattedName,
                team: row.team_name
              };
            }
          }
        }
      }
    }

    const sortedList = Object.values(mergedMap).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ players: sortedList, season: targetSeason });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
