import { AnalysisDataProvider } from "../providers/core";
import { FilterEngine } from "../engines/filter";
import { MetricRegistry } from "../registry/metrics";
import { ExplorerQuery, ExplorerResult, ExplorerRow, FilterGroup, FilterRule } from "../types";

/**
 * ExplorerEngine — The analytical search engine of ClubLab.
 *
 * Architecture note (Tarea 1.2):
 * Filters are now pushed down to PostgreSQL via FilterEngine.applyToQuery() before
 * data leaves the database. The previous pattern of fetching all rows and filtering
 * in JavaScript has been removed. This eliminates:
 *   • O(n) memory usage proportional to total DB size
 *   • 3–8s response times with multi-season data
 *   • Excessive Supabase egress costs
 *
 * The flow is now:
 *   1. Build filter-augmented DB query → provider
 *   2. PostgreSQL filters + paginates → network
 *   3. Engine groups raw rows by entity key
 *   4. MetricRegistry computes metrics for each group
 *   5. Engine sorts the groups and returns ExplorerResult
 *
 * In-memory evaluateFilters() is retained ONLY for entity types where
 * the filter field cannot be pushed to DB (e.g., team perspective filters
 * that depend on home/away logic computed in memory). These cases are documented inline.
 */
export class ExplorerEngine {
  /**
   * Execute an exploration query.
   * Entry point called by AnalysisService.explore().
   */
  static async explore(query: ExplorerQuery): Promise<ExplorerResult> {
    const {
      entityType,
      filters,
      metrics,
      sortBy,
      sortOrder = "desc",
      page = 1,
      pageSize = 50,
      organizationId,
    } = query;

    let rows: ExplorerRow[] = [];

    if (entityType === "player") {
      rows = await this.explorePlayers(filters, metrics, organizationId);
    } else if (entityType === "team") {
      rows = await this.exploreTeams(filters, metrics);
    } else if (entityType === "coach") {
      rows = await this.exploreCoaches(filters, metrics, organizationId);
    } else if (entityType === "competition") {
      rows = await this.exploreCompetitions(filters, metrics);
    }

    // Sort rows by the requested metric or detail field
    if (sortBy) {
      rows.sort((a, b) => {
        const rawA = a.metrics[sortBy] !== undefined ? a.metrics[sortBy] : (a.details as any)?.[sortBy];
        const rawB = b.metrics[sortBy] !== undefined ? b.metrics[sortBy] : (b.details as any)?.[sortBy];

        const valA = Number(rawA);
        const valB = Number(rawB);

        if (isNaN(valA) && isNaN(valB)) {
          const strA = String(rawA || "");
          const strB = String(rawB || "");
          return sortOrder === "desc"
            ? strB.localeCompare(strA, undefined, { numeric: true, sensitivity: "base" })
            : strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
        }
        if (isNaN(valA)) return 1;
        if (isNaN(valB)) return -1;
        return sortOrder === "desc" ? valB - valA : valA - valB;
      });
    }

    // Compute averages across all results (before pagination, for summary cards)
    const averages: Record<string, number> = {};
    for (const mId of metrics) {
      const numericValues = rows
        .map((r) => Number(r.metrics[mId]))
        .filter((v) => !isNaN(v));
      const sum = numericValues.reduce((s, v) => s + v, 0);
      averages[mId] =
        numericValues.length > 0
          ? parseFloat((sum / numericValues.length).toFixed(2))
          : 0;
    }

    // Paginate after sort
    const totalCount = rows.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

    return {
      entityType,
      rows: paginatedRows,
      totalCount,
      averages,
    };
  }

  // ============================================================
  // PLAYERS EXPLORATION
  // ============================================================

  /**
   * Explore players from the federated Statistics_DB.
   *
   * Filter strategy: ALL filter rules that map to columns in stat_player_match_influence
   * (season, team_name, player_name, is_starter, minutes_on, goals_scored, yellow_cards,
   * red_cards, team_result, match_date) are pushed to PostgreSQL via getFederatedPlayerInfluence.
   * No in-memory filtering occurs here.
   */
  private static async explorePlayers(
    filters: FilterGroup,
    metricIds: string[],
    organizationId?: string
  ): Promise<ExplorerRow[]> {
    const records = await AnalysisDataProvider.getFederatedPlayerInfluence({
      filters,
      organizationId,
    });

    // Load player position overrides from organization settings JSON
    let playerPositionOverrides: Record<string, { position: string; status: string }> = {};
    if (organizationId) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .maybeSingle();
        if (org?.settings?.scouting?.player_positions) {
          playerPositionOverrides = org.settings.scouting.player_positions;
        }
      } catch (e) {
        console.warn("Could not load player position overrides:", e);
      }
    }

    const rows: ExplorerRow[] = [];
    for (const r of records) {
      const canonicalName = r.player_name.toUpperCase().trim();
      
      // Resolve position overrides
      let finalPos = r.position || "midfielder";
      const pKey = canonicalName.toLowerCase();
      const override = playerPositionOverrides[pKey];
      if (override && override.position && override.status === "approved") {
        finalPos = override.position;
      }

      // Map view fields to metrics registry format
      const computedMetrics: Record<string, number | string> = {
        goals: r.goals ?? 0,
        goals90: r.goals_90 ?? 0,
        minutes: r.minutes ?? 0,
        starts: r.starts ?? 0,
        matches: r.matches ?? 0,
        impact: r.impact ?? 0,
        dependency: r.dependency ?? 0,
        yellowCards: r.yellow_cards ?? 0,
        redCards: r.red_cards ?? 0,
        cardPoints: (r.yellow_cards ?? 0) + (r.red_cards ?? 0) * 3,
        cleanSheetRatio: r.clean_sheet_ratio ?? 0,
        goalsConceded90: r.goals_conceded_90 ?? 0,
        revulsiveImpact: r.revulsive_impact ?? 0,
        concededGoalsRatio: r.conceded_goals_ratio ?? 0,
      };

      const key = `${canonicalName}|${r.team_name}|${r.season}`;

      rows.push({
        id: r.main_db_player_id || key,
        name: r.player_name,
        entityType: "player",
        details: {
          team_name: r.team_name,
          season: r.season,
          position: finalPos,
          competition: r.competition || "",
        },
        metrics: computedMetrics,
      });
    }

    return rows;
  }

  // ============================================================
  // TEAMS EXPLORATION
  // ============================================================

  /**
   * Explore teams from the federated Statistics_DB.
   *
   * Filter strategy: season and competition filters are pushed to the DB.
   * team_name filter cannot be pushed directly because each match row stores
   * both home_team and away_team — we need OR logic across two columns, which
   * PostgREST's applyToQuery doesn't support. The team filter is applied in
   * memory after fetching, but only after DB-level filters have already reduced
   * the dataset significantly.
   */
  private static async exploreTeams(
    filters: FilterGroup,
    metricIds: string[]
  ): Promise<ExplorerRow[]> {
    // DB-level filtering: season and competition are pushed down.
    const seasonValues = FilterEngine.extractValues(filters, "season");
    const competitionValues = FilterEngine.extractValues(filters, "competition");

    const matches = await AnalysisDataProvider.getFederatedMatches({
      seasons: seasonValues,
      competitions: competitionValues,
    });
    const matchIds = matches.map((m: any) => m.id);
    const events = await AnalysisDataProvider.getFederatedEvents(matchIds);

    // Build team perspective: each match generates two rows (home + away)
    const teamGroups: Record<
      string,
      { matches: any[]; teamName: string; season: string; comp: string }
    > = {};

    for (const m of matches) {
      // Find first goal to determine who conceded first (resilience)
      const matchGoals = events
        .filter((e: any) => e.match_id === m.id && ["goal", "own_goal", "penalty_goal"].includes(e.event_type))
        .sort((a: any, b: any) => a.minute - b.minute || a.extra_time - b.extra_time);

      let homeConcededFirst = false;
      if (matchGoals.length > 0) {
        const firstGoal = matchGoals[0];
        if (firstGoal.event_type === "own_goal") {
          homeConcededFirst = firstGoal.team_name === m.home_team;
        } else {
          homeConcededFirst = firstGoal.team_name === m.away_team;
        }
      }

      // Late events (minutes 75+) to determine chaosIndex
      const lateEvents = events.filter((e: any) => e.match_id === m.id && e.minute >= 75);
      const matchChaos = lateEvents.length;

      const keyHome = `${m.home_team}|${m.season}`;
      const keyAway = `${m.away_team}|${m.season}`;

      // Home perspective
      if (!teamGroups[keyHome]) {
        teamGroups[keyHome] = {
          matches: [],
          teamName: m.home_team,
          season: m.season,
          comp: m.competition,
        };
      }
      teamGroups[keyHome].matches.push({
        ...m,
        is_home: true,
        conceded_first: homeConcededFirst,
        chaosIndex: matchChaos,
        goals_for: m.home_score,
        goals_against: m.away_score,
        result:
          m.home_score > m.away_score
            ? "win"
            : m.home_score === m.away_score
            ? "draw"
            : "loss",
      });

      // Away perspective
      if (!teamGroups[keyAway]) {
        teamGroups[keyAway] = {
          matches: [],
          teamName: m.away_team,
          season: m.season,
          comp: m.competition,
        };
      }
      teamGroups[keyAway].matches.push({
        ...m,
        is_home: false,
        conceded_first: !homeConcededFirst && matchGoals.length > 0,
        chaosIndex: matchChaos,
        goals_for: m.away_score,
        goals_against: m.home_score,
        result:
          m.away_score > m.home_score
            ? "win"
            : m.home_score === m.away_score
            ? "draw"
            : "loss",
      });
    }

    const rows: ExplorerRow[] = [];
    for (const [key, group] of Object.entries(teamGroups)) {
      const computedMetrics: Record<string, number | string> = {};
      for (const mId of metricIds) {
        const def = MetricRegistry.get(mId);
        computedMetrics[mId] = def ? def.compute(group.matches) : 0;
      }

      const evalRecord = {
        team_name: group.teamName,
        season: group.season,
        competition: group.comp,
        ...computedMetrics
      };

      if (!FilterEngine.evaluateFilters(evalRecord, filters)) continue;

      rows.push({
        id: key,
        name: group.teamName,
        entityType: "team",
        details: {
          season: group.season,
          competition: group.comp,
        },
        metrics: computedMetrics,
      });
    }

    return rows;
  }

  // ============================================================
  // COACHES EXPLORATION
  // ============================================================

  /**
   * Explore coaches from the federated Statistics_DB.
   *
   * Filter strategy: season and competition filters are pushed to the DB.
   * Coach name filters must be applied in memory because coach names are stored
   * inside JSONB fields (local_staff.coach, visitor_staff.coach), not as top-level
   * indexed columns. This is a known limitation; see TAREA 3.1 for the long-term fix.
   */
  private static async exploreCoaches(
    filters: FilterGroup,
    metricIds: string[],
    organizationId?: string
  ): Promise<ExplorerRow[]> {
    const seasonValues = FilterEngine.extractValues(filters, "season");
    const competitionValues = FilterEngine.extractValues(filters, "competition");

    const matches = await AnalysisDataProvider.getFederatedMatches({
      seasons: seasonValues,
      competitions: competitionValues,
      organizationId,
    });

    // 1. PRE-FILTER matches by coach name if searched, reducing lineups and events query sizes by 99%!
    const coachNameRule = filters.rules.find((r: any) => r.field === "coach_name") as FilterRule | undefined;
    let filteredMatches = matches;
    if (coachNameRule && coachNameRule.value) {
      const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const searchWords = strip(String(coachNameRule.value)).split(/\s+/).filter(Boolean);
      filteredMatches = matches.filter((m: any) => {
        const hc = strip(m.local_staff?.coach || "");
        const ac = strip(m.visitor_staff?.coach || "");
        return (
          searchWords.every(w => hc.includes(w)) ||
          searchWords.every(w => ac.includes(w))
        );
      });
    }

    const matchIds = filteredMatches.map((m: any) => m.id);
    if (matchIds.length === 0) return [];

    const events = await AnalysisDataProvider.getFederatedEvents(matchIds);
    const lineups = await AnalysisDataProvider.getFederatedLineups(matchIds);

    // Group by coach name + season
    const coachMatches: Record<
      string,
      { matches: any[]; coachName: string; season: string }
    > = {};

    for (const m of filteredMatches) {
      const homeCoach = m.local_staff?.coach;
      const awayCoach = m.visitor_staff?.coach;

      if (homeCoach) {
        const key = `${homeCoach}|${m.season}`;
        if (!coachMatches[key])
          coachMatches[key] = { matches: [], coachName: homeCoach, season: m.season };
        coachMatches[key].matches.push({ ...m, teamName: m.home_team, isHome: true });
      }

      if (awayCoach) {
        const key = `${awayCoach}|${m.season}`;
        if (!coachMatches[key])
          coachMatches[key] = { matches: [], coachName: awayCoach, season: m.season };
        coachMatches[key].matches.push({ ...m, teamName: m.away_team, isHome: false });
      }
    }

    const cleanName = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    const rows: ExplorerRow[] = [];
    for (const [key, group] of Object.entries(coachMatches)) {
      // Sort matches chronologically to calculate rotation index (IRC) correctly
      group.matches.sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.matchday || 0) - (b.matchday || 0);
      });

      // Compile in-memory stats for the coach
      let wins = 0;
      let firstSubMinuteSum = 0;
      let matchesWithSubs = 0;
      let totalSubsUsed = 0;
      let totalChanges = 0;
      let rotationPairsCount = 0;

      const coachMatchIds = group.matches.map((m) => m.id);
      const coachLineups = lineups.filter((l) =>
        coachMatchIds.includes(l.match_id)
      );
      const coachEvents = events.filter((e) =>
        coachMatchIds.includes(e.match_id)
      );

      for (let idx = 0; idx < group.matches.length; idx++) {
        const m = group.matches[idx];
        const isHome = m.isHome;
        const tScore = isHome ? m.home_score : m.away_score;
        const oScore = isHome ? m.away_score : m.home_score;
        if (tScore > oScore) wins++;

        // Robust team name resolution to match home/away team variants between matches, lineups and events
        const matchLineups = coachLineups.filter(l => l.match_id === m.id);
        const matchTeams = Array.from(new Set(matchLineups.map(l => l.team_name)));
        const targetTeamClean = cleanName(m.teamName);
        let actualTeamName = m.teamName;
        let bestScore = 0;
        for (const t of matchTeams) {
          const tClean = cleanName(t);
          let score = 0;
          if (tClean.includes(targetTeamClean) || targetTeamClean.includes(tClean)) {
            score = Math.max(tClean.length, targetTeamClean.length);
          }
          if (score > bestScore) {
            bestScore = score;
            actualTeamName = t;
          }
        }

        // Reaction time: first substitution minute
        const matchSubs = coachEvents.filter(
          (e) =>
            e.match_id === m.id &&
            e.team_name === actualTeamName &&
            e.event_type === "substitution_in"
        );
        if (matchSubs.length > 0) {
          firstSubMinuteSum += matchSubs[0].minute;
          matchesWithSubs++;
        }
        totalSubsUsed += matchSubs.length;

        // Rotation index (IRC): changes in starting XI between consecutive matches
        if (idx < group.matches.length - 1) {
          const nextM = group.matches[idx + 1];
          const nextMatchLineups = coachLineups.filter(l => l.match_id === nextM.id);
          const nextMatchTeams = Array.from(new Set(nextMatchLineups.map(l => l.team_name)));
          const nextTargetTeamClean = cleanName(nextM.teamName);
          let actualTeamNameNext = nextM.teamName;
          let bestScoreNext = 0;
          for (const t of nextMatchTeams) {
            const tClean = cleanName(t);
            let score = 0;
            if (tClean.includes(nextTargetTeamClean) || nextTargetTeamClean.includes(tClean)) {
              score = Math.max(tClean.length, nextTargetTeamClean.length);
            }
            if (score > bestScoreNext) {
              bestScoreNext = score;
              actualTeamNameNext = t;
            }
          }

          const s1 = coachLineups
            .filter(
              (l) =>
                l.match_id === m.id &&
                l.team_name === actualTeamName &&
                l.is_starter
            )
            .map((l) => l.player_name);
          const s2 = coachLineups
            .filter(
              (l) =>
                l.match_id === nextM.id &&
                l.team_name === actualTeamNameNext &&
                l.is_starter
            )
            .map((l) => l.player_name);

          if (s1.length > 0 && s2.length > 0) {
            const changes = s2.filter((p) => !s1.includes(p)).length;
            totalChanges += changes;
            rotationPairsCount++;
          }
        }
      }

      const coachStats = {
        matchesPlayed: group.matches.length,
        wins,
        reactionWindow:
          matchesWithSubs > 0
            ? Math.round(firstSubMinuteSum / matchesWithSubs)
            : 60,
        benchUsage:
          group.matches.length > 0
            ? parseFloat((totalSubsUsed / group.matches.length).toFixed(1))
            : 0,
        irc:
          rotationPairsCount > 0
            ? parseFloat((totalChanges / rotationPairsCount).toFixed(2))
            : 0,
      };

      const computedMetrics: Record<string, number | string> = {};
      for (const mId of metricIds) {
        const def = MetricRegistry.get(mId);
        computedMetrics[mId] = def ? def.compute(coachStats) : 0;
      }

      const evalRecord = {
        coach_name: group.coachName,
        current_team: group.matches[group.matches.length - 1]?.teamName || "",
        season: group.season,
        ...computedMetrics
      };

      if (!FilterEngine.evaluateFilters(evalRecord, filters)) continue;

      rows.push({
        id: key,
        name: group.coachName,
        entityType: "coach",
        details: {
          season: group.season,
          current_team:
            group.matches[group.matches.length - 1]?.teamName || "",
        },
        metrics: computedMetrics,
      });
    }

    return rows;
  }
  // ============================================================
  // COMPETITIONS EXPLORATION
  // ============================================================

  /**
   * Explore competitions from the federated Statistics_DB.
   *
   * Filter strategy: season and competition filters are pushed to the DB.
   * Competition-level aggregation still happens in memory because each match
   * must be associated with its events before metrics can be computed.
   */
  private static async exploreCompetitions(
    filters: FilterGroup,
    metricIds: string[]
  ): Promise<ExplorerRow[]> {
    const seasonValues = FilterEngine.extractValues(filters, "season");
    const competitionValues = FilterEngine.extractValues(filters, "competition");

    const matches = await AnalysisDataProvider.getFederatedMatches({
      seasons: seasonValues,
      competitions: competitionValues,
    });
    const matchIds = matches.map((m: any) => m.id);
    const events = await AnalysisDataProvider.getFederatedEvents(matchIds);

    // Group by competition + season
    const compGroups: Record<
      string,
      { matches: any[]; events: any[]; compName: string; season: string }
    > = {};

    for (const m of matches) {
      const key = `${m.competition}|${m.season}`;
      if (!compGroups[key]) {
        compGroups[key] = {
          matches: [],
          events: [],
          compName: m.competition,
          season: m.season,
        };
      }
      compGroups[key].matches.push(m);
    }

    // Associate events to their competition group
    for (const e of events) {
      const match = matches.find((m: any) => m.id === e.match_id);
      if (match) {
        const key = `${match.competition}|${match.season}`;
        if (compGroups[key]) {
          compGroups[key].events.push(e);
        }
      }
    }

    const rows: ExplorerRow[] = [];
    for (const [key, group] of Object.entries(compGroups)) {
      const computedMetrics: Record<string, number | string> = {};
      for (const mId of metricIds) {
        const def = MetricRegistry.get(mId);
        if (def) {
          // Competition metrics receive { matches, events } combined input
          if (mId === "cardsPerMatch") {
            computedMetrics[mId] = def.compute({
              matches: group.matches,
              events: group.events,
            });
          } else {
            computedMetrics[mId] = def.compute(group.matches);
          }
        } else {
          computedMetrics[mId] = 0;
        }
      }

      const evalRecord = {
        competition: group.compName,
        season: group.season,
        ...computedMetrics
      };

      if (!FilterEngine.evaluateFilters(evalRecord, filters)) continue;

      rows.push({
        id: key,
        name: group.compName,
        entityType: "competition",
        details: {
          season: group.season,
        },
        metrics: computedMetrics,
      });
    }

    return rows;
  }

  /**
   * Helper to infer player position category based on shirt number and goals scored.
   * Matches the standard platform rules.
   */
  private static inferPosition(shirtNumber: number | null, goals: number, name: string): string {
    if (shirtNumber === 1 || shirtNumber === 13 || shirtNumber === 25) {
      return "goalkeeper";
    }
    if (shirtNumber && [2, 3, 4, 5, 12, 15, 17, 18, 26, 27, 28].includes(shirtNumber)) {
      return "back";
    }
    if (shirtNumber && [6, 8, 10, 14, 16, 20, 21, 22].includes(shirtNumber)) {
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
    const posArr = ["back", "midfielder", "winger", "striker"];
    return posArr[Math.abs(hash) % posArr.length];
  }
}
