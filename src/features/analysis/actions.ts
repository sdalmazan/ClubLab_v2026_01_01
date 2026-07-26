'use server';

/**
 * Server Actions — Analysis Feature
 *
 * This file acts as the server-side boundary between Client Components
 * (e.g. UniversalExplorer) and the Analysis engine (which depends on
 * next/headers, supabase/server, and other server-only APIs).
 *
 * WHY this file exists:
 *   Next.js App Router requires that server-only code (anything that imports
 *   next/headers, cookies(), etc.) is never bundled for the client. Client
 *   Components cannot import directly from modules in the server dependency
 *   graph — they must go through either:
 *     1. Props/RSC composition (data fetched in Server Component, passed down)
 *     2. Server Actions (this file) — Next.js generates an RPC stub on the
 *        client and keeps the real implementation server-side only.
 *
 * All functions exported from a 'use server' file are automatically:
 *   • Excluded from the client bundle
 *   • Protected with CSRF validation by Next.js
 *   • Callable from Client Components as async functions
 *
 * NO additional cost or tooling required — this is standard Next.js App Router.
 */

import { AnalysisService } from './index';
import type { ExplorerQuery, ExplorerResult, SavedView, UserDataConsent, ReportConfig, EntityType } from './types';
import { statsAdmin } from "@/lib/supabase/stats-admin";

// ============================================================
// EXPLORER
// ============================================================

/**
 * Executes an analytical explorer query server-side.
 * Replaces the direct AnalysisService.explore() call in UniversalExplorer.
 */
export async function exploreAction(query: ExplorerQuery): Promise<ExplorerResult> {
  return AnalysisService.explore(query);
}

// ============================================================
// SAVED VIEWS
// ============================================================

/**
 * Fetches all saved views for an organization.
 */
export async function getSavedViewsAction(organizationId: string): Promise<SavedView[]> {
  return AnalysisService.getSavedViews(organizationId);
}

/**
 * Creates or updates a saved view.
 */
export async function saveSavedViewAction(view: SavedView): Promise<any> {
  return AnalysisService.saveSavedView(view);
}

/**
 * Deletes a saved view by ID.
 */
export async function deleteSavedViewAction(
  viewId: string,
  organizationId?: string
): Promise<boolean> {
  return AnalysisService.deleteSavedView(viewId, organizationId);
}

// ============================================================
// ANALYSIS SHORTCUTS
// ============================================================

/**
 * Fetches detailed player analysis (metrics + insights) for a specific player/season.
 */
export async function getPlayerAnalysisAction(playerName: string, season: string) {
  return AnalysisService.getPlayerAnalysis(playerName, season);
}

/**
 * Fetches detailed team analysis (metrics + insights) for a specific team/season.
 */
export async function getTeamAnalysisAction(teamName: string, season: string) {
  return AnalysisService.getTeamAnalysis(teamName, season);
}

// ============================================================
// GDPR CONSENTS
// ============================================================

export async function getUserConsentAction(
  userId: string,
  consentType: string,
  version: string
): Promise<UserDataConsent | null> {
  return AnalysisService.getUserConsent(userId, consentType, version);
}

export async function saveUserConsentAction(consent: UserDataConsent): Promise<any> {
  return AnalysisService.saveUserConsent(consent);
}

// ============================================================
// REPORTS
// ============================================================

/**
 * Builds a compiled report layout server-side.
 * ReportBuilder uses ExplorerEngine and AnalysisDataProvider, which are server-only.
 */
export async function buildReportAction(config: ReportConfig): Promise<any> {
  return AnalysisService.buildReport(config);
}

// ============================================================
// AUTOCOMPLETE SUGGESTIONS
// ============================================================

/**
 * Returns case-insensitive autocomplete suggestions from the database
 * matching the user query.
 */
export async function getSuggestionsAction(
  entityType: EntityType,
  query: string
): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.trim();

  try {
    if (entityType === "player") {
      let q = statsAdmin.from("v_player_season_stats").select("player_name");
      const words = cleanQuery.split(/\s+/).filter(Boolean);
      for (const w of words) {
        const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
        q = q.ilike("player_name", `%${pat}%`);
      }
      const { data } = await q.limit(100);
      const uniqueNames = Array.from(new Set(data?.map((d: any) => d.player_name) || [])) as string[];
      
      const lowerQuery = cleanQuery.toLowerCase();
      uniqueNames.sort((a, b) => {
        const aLow = a.toLowerCase();
        const bLow = b.toLowerCase();
        const aStarts = aLow.startsWith(lowerQuery) || aLow.split(", ").some(part => part.startsWith(lowerQuery));
        const bStarts = bLow.startsWith(lowerQuery) || bLow.split(", ").some(part => part.startsWith(lowerQuery));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aLow.localeCompare(bLow);
      });
      return uniqueNames.slice(0, 15);
    }

    if (entityType === "team") {
      let qHome = statsAdmin.from("stat_matches").select("home_team");
      let qAway = statsAdmin.from("stat_matches").select("away_team");
      const words = cleanQuery.split(/\s+/).filter(Boolean);

      for (const w of words) {
        const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
        qHome = qHome.ilike("home_team", `%${pat}%`);
        qAway = qAway.ilike("away_team", `%${pat}%`);
      }

      const { data: homeTeams } = await qHome.limit(500);
      const { data: awayTeams } = await qAway.limit(500);
      const names = [
        ...(homeTeams?.map((t: any) => t.home_team) || []),
        ...(awayTeams?.map((t: any) => t.away_team) || []),
      ];
      const uniqueTeams = Array.from(new Set(names)) as string[];

      const lowerQuery = cleanQuery.toLowerCase();
      uniqueTeams.sort((a, b) => {
        const aLow = a.toLowerCase();
        const bLow = b.toLowerCase();
        const aStarts = aLow.startsWith(lowerQuery);
        const bStarts = bLow.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aLow.localeCompare(bLow);
      });
      return uniqueTeams.slice(0, 15);
    }

    if (entityType === "competition") {
      let q = statsAdmin.from("stat_matches").select("competition");
      const words = cleanQuery.split(/\s+/).filter(Boolean);
      for (const w of words) {
        const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
        q = q.ilike("competition", `%${pat}%`);
      }
      const { data } = await q.limit(500);
      const uniqueComps = Array.from(new Set(data?.map((d: any) => d.competition) || [])) as string[];

      const lowerQuery = cleanQuery.toLowerCase();
      uniqueComps.sort((a, b) => {
        const aLow = a.toLowerCase();
        const bLow = b.toLowerCase();
        const aStarts = aLow.startsWith(lowerQuery);
        const bStarts = bLow.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aLow.localeCompare(bLow);
      });
      return uniqueComps.slice(0, 15);
    }

    if (entityType === "coach") {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (orgRole) {
          const { data: org } = await supabase
            .from("organizations")
            .select("settings")
            .eq("id", orgRole.organization_id)
            .single();

          const coaches = new Set<string>();
          const matches = org?.settings?.scouting?.matches || {};
          for (const mId in matches) {
            const sc = matches[mId];
            if (sc.local_staff?.coach) coaches.add(sc.local_staff.coach);
            if (sc.visitor_staff?.coach) coaches.add(sc.visitor_staff.coach);
          }
          return Array.from(coaches)
            .filter((name) => name.toLowerCase().includes(cleanQuery.toLowerCase()))
            .slice(0, 10);
        }
      }
    }
  } catch (err) {
    console.error("Error retrieving suggestions:", err);
  }

  return [];
}

/**
 * Fetches the player position override settings and user role.
 */
export async function getPlayerPositionOverrideAction(playerName: string, organizationId: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { override: null, role: "trainer", currentUserId: null };

    const { data: userRole } = await supabase
      .from("user_organization_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const role = userRole?.role || "trainer";

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    const playerPositions = org?.settings?.scouting?.player_positions || {};
    const key = playerName.toUpperCase().trim().toLowerCase();
    const override = playerPositions[key] || null;

    return { override, role, currentUserId: user.id };
  } catch (err) {
    console.error("Error fetching player position override:", err);
    return { override: null, role: "trainer", currentUserId: null };
  }
}

/**
 * Saves or proposes a player position override in the organization settings.
 */
export async function savePlayerPositionOverrideAction(
  playerName: string,
  organizationId: string,
  newPosition: string,
  status: "approved" | "pending" | "rejected"
) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    const settings = org?.settings || {};
    if (!settings.scouting) settings.scouting = {};
    if (!settings.scouting.player_positions) settings.scouting.player_positions = {};

    const key = playerName.toUpperCase().trim().toLowerCase();

    if (status === "rejected") {
      delete settings.scouting.player_positions[key];
    } else if (status === "approved") {
      const existing = settings.scouting.player_positions[key] || {};
      settings.scouting.player_positions[key] = {
        ...existing,
        position: newPosition,
        status: "approved",
        playerName: playerName
      };
      delete settings.scouting.player_positions[key].suggestedPosition;
      delete settings.scouting.player_positions[key].proposedByUserId;
    } else if (status === "pending") {
      const existing = settings.scouting.player_positions[key] || {};
      settings.scouting.player_positions[key] = {
        ...existing,
        playerName: playerName,
        suggestedPosition: newPosition,
        status: "pending",
        proposedByUserId: user.id
      };
    }

    const { error } = await supabase
      .from("organizations")
      .update({ settings })
      .eq("id", organizationId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Error saving player position override:", err);
    throw err;
  }
}

/**
 * Dynamically resolves the league of our organization and queries all players in it for scouting.
 */
export async function getScoutingOpportunitiesAction(organizationId: string, season: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Resolve organization setting to find their matches/coach
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const orgName = org?.name || "Almazán";
    
    // Find which competition this club plays in in this season
    const statsUrl = process.env.NEXT_PUBLIC_FEDERATION_SUPABASE_URL;
    const statsServiceRoleKey = process.env.FEDERATION_SUPABASE_SERVICE_ROLE_KEY;
    const { createClient: createStatsClient } = await import("@supabase/supabase-js");
    const statsAdmin = createStatsClient(statsUrl!, statsServiceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cleanOrg = orgName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\.?d\.?|c\.?d\.?|c\.?f\.?/gi, "").trim();
    
    let league = "Tercera Federación - Grupo 8"; // default fallback
    
    // Scan match rows in stats DB for this season to identify our league
    const { data: matchedRows } = await statsAdmin
      .from("stat_matches")
      .select("competition, home_team, away_team")
      .eq("season", season)
      .limit(100);

    for (const m of matchedRows || []) {
      const hClean = m.home_team.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const aClean = m.away_team.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (hClean.includes(cleanOrg) || aClean.includes(cleanOrg)) {
        league = m.competition;
        break;
      }
    }

    const allMetrics = [
      "goals",
      "goals90",
      "minutes",
      "starts",
      "matches",
      "impact",
      "yellowCards",
      "redCards",
      "cleanSheetRatio",
      "goalsConceded90",
    ];

    const result = await AnalysisService.explore({
      entityType: "player",
      filters: {
        condition: "AND",
        rules: [
          { field: "season", operator: "eq", value: season },
          { field: "competition", operator: "eq", value: league }
        ]
      },
      metrics: allMetrics,
      page: 1,
      pageSize: 400, // Load all players in the league
      organizationId,
    });

    return result.rows;
  } catch (err) {
    console.error("Error loading scouting opportunities:", err);
    return [];
  }
}

/**
 * Dynamically calculates the standing/league position of a team in a season/competition.
 * Handles in-memory calculations over federated matches in Node.js for zero database migration impact.
 */
export async function getTeamLeaguePositionAction(
  teamName: string,
  season: string,
  competition: string
): Promise<number | null> {
  try {
    const { data: matches, error } = await statsAdmin
      .from("stat_matches")
      .select("home_team, away_team, home_score, away_score")
      .eq("season", season)
      .eq("competition", competition)
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    if (error || !matches || matches.length === 0) return null;

    const teamPoints: Record<string, number> = {};
    for (const m of matches) {
      const hScore = Number(m.home_score);
      const aScore = Number(m.away_score);
      if (isNaN(hScore) || isNaN(aScore)) continue;

      if (!teamPoints[m.home_team]) teamPoints[m.home_team] = 0;
      if (!teamPoints[m.away_team]) teamPoints[m.away_team] = 0;

      if (hScore > aScore) {
        teamPoints[m.home_team] += 3;
      } else if (aScore > hScore) {
        teamPoints[m.away_team] += 3;
      } else {
        teamPoints[m.home_team] += 1;
        teamPoints[m.away_team] += 1;
      }
    }

    const sortedTeams = Object.keys(teamPoints).sort((a, b) => teamPoints[b] - teamPoints[a]);
    const index = sortedTeams.indexOf(teamName);
    return index !== -1 ? index + 1 : null;
  } catch (err) {
    console.warn("Could not get team standing:", err);
    return null;
  }
}
