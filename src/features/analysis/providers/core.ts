import { statsAdmin } from "@/lib/supabase/stats-admin";
import { FilterEngine } from "../engines/filter";
import { FilterGroup, FilterRule, SavedView, UserDataConsent } from "../types";

/**
 * Lazily resolves the appropriate Supabase client for local (Main_DB) operations.
 *
 * WHY dynamic import: providers/core.ts is transitively imported by Client Components
 * (e.g. UniversalExplorer → AnalysisService → providers/core.ts). A static top-level
 * `import from '@/lib/supabase/server'` would pull `next/headers` into the client bundle
 * and cause a build error.
 *
 * Dynamic import is evaluated only at call time — always on the server — so the bundler
 * never sees `next/headers` in the client graph.
 *
 * NOTE: This function is ONLY called from server-side methods (Server Components, Server
 * Actions, Route Handlers).
 */
async function getServerClient() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

/**
 * AnalysisDataProvider — Unified data access layer for the Analysis Framework.
 *
 * TWO DATA SOURCES:
 *   • Main_DB (Supabase, RLS-protected):  club-private data (matches, players, sessions…)
 *                                          → uses createClient() with user cookies
 *   • Statistics_DB (Supabase Federation): federated public data (scraped RFCYLF actas)
 *                                          → uses statsAdmin (service_role, read-only usage)
 *
 * IMPORTANT: RLS on Main_DB guarantees multi-tenant isolation.
 * Do NOT add redundant application-level organization_id filters for local methods —
 * it creates a false sense of security and duplicates policy logic.
 *
 */
export interface GetFederatedMatchesOptions {
  seasons?: string[];
  competitions?: string[];
  teams?: string[];
  matchday?: number;
  filters?: FilterGroup;
  organizationId?: string;
}

export interface GetFederatedPlayerInfluenceOptions {
  seasons?: string[];
  playerNames?: string[];
  teamNames?: string[];
  filters?: FilterGroup;
  organizationId?: string;
}

export interface GetLocalMatchesOptions {
  teamId?: string;
  seasonId?: string;
}

export interface GetLocalPlayerStatsOptions {
  matchIds?: string[];
  playerIds?: string[];
}

export class AnalysisDataProvider {
  // ============================================================
  // FEDERATED DATA — Statistics_DB (public scraped data)
  // ============================================================

  /**
   * Fetch match records from the federated Statistics_DB (Tercera RFEF scraped data).
   * Filters applied via PostgREST push-down for efficient server-side filtering.
   */
  static async getFederatedMatches(options?: GetFederatedMatchesOptions) {
    const buildQuery = () => {
      let query = statsAdmin.from("stat_matches").select("*");

      const seasonVals = options?.seasons || (options?.filters ? FilterEngine.extractValues(options.filters, "season") : []);
      if (seasonVals.length > 0) {
        const expandedSeasons = Array.from(new Set(seasonVals.flatMap((s: any) => {
          const str = String(s);
          return [str, str.replace("-", "/"), str.replace("/", "-")];
        })));
        query = query.in("season", expandedSeasons);
      }
      if (options?.competitions && options.competitions.length > 0) {
        query = query.in("competition", options.competitions);
      }
      if (options?.matchday !== undefined) {
        query = query.eq("matchday", options.matchday);
      }

      // Generic filter push-down via FilterEngine
      if (options?.filters) {
        let filteredDbRules = options.filters.rules.filter((r: any) => r.field !== "season");
        
        // Intercept and push down coach name searches to PostgreSQL JSONB operators
        const coachRule = options.filters.rules.find(
          (r: any) => !r.rules && r.field === "coach_name"
        ) as FilterRule | undefined;
        
        if (coachRule && coachRule.value) {
          const coachVal = String(coachRule.value).trim();
          const words = coachVal.split(/\s+/).filter(Boolean);
          for (const w of words) {
            const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
            query = query.or(`local_staff->>coach.ilike.%${pat}%,visitor_staff->>coach.ilike.%${pat}%`);
          }
          filteredDbRules = filteredDbRules.filter((r: any) => r.field !== "coach_name");
        }

        const cleanedFilters = {
          ...options.filters,
          rules: filteredDbRules,
        };

        query = FilterEngine.applyToQuery(query, cleanedFilters);
      }
      return query;
    };

    // Query all matching records in pages of 1000 to bypass PostgREST limit
    let allMatches: any[] = [];
    let fromMatch = 0;
    const matchLimit = 1000;
    let hasMoreMatches = true;

    while (hasMoreMatches) {
      const { data, error } = await buildQuery().range(fromMatch, fromMatch + matchLimit - 1);
      if (error) throw error;
      if (!data || data.length === 0) {
        hasMoreMatches = false;
      } else {
        allMatches = [...allMatches, ...data];
        if (data.length < matchLimit) {
          hasMoreMatches = false;
        } else {
          fromMatch += matchLimit;
        }
      }
    }

    let filtered = allMatches;

    // Team filter: PostgREST doesn't support OR across two columns natively via applyToQuery,
    // so we handle home_team / away_team OR filtering in memory (still after DB-side filters).
    if (options?.teams && options.teams.length > 0) {
      const cleanTeams = options.teams.map((t) => t.toLowerCase().trim());
      filtered = filtered.filter(
        (m: any) =>
          cleanTeams.includes(m.home_team.toLowerCase().trim()) ||
          cleanTeams.includes(m.away_team.toLowerCase().trim())
      );
    }

    // Load organization settings to merge PDF-parsed coaching staff details
    let scoutingMatches: Record<string, any> = {};
    try {
      const supabase = await getServerClient();
      let activeOrgId = options?.organizationId;

      if (!activeOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: orgRole } = await supabase
            .from("user_organization_roles")
            .select("organization_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (orgRole) {
            activeOrgId = orgRole.organization_id;
          }
        }
      }

      if (activeOrgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", activeOrgId)
          .single();
        if (org?.settings?.scouting?.matches) {
          scoutingMatches = org.settings.scouting.matches;
        }
      }
    } catch (e) {
      console.warn("Could not load organization scouting settings for matches:", e);
    }

    return filtered.map((m: any) => {
      const sc = scoutingMatches[m.id] || {};
      return {
        ...m,
        local_staff: sc.local_staff || null,
        visitor_staff: sc.visitor_staff || null,
        overrides: sc.overrides || {}
      };
    });
  }

  /**
   * Fetch lineups for a set of match IDs from the federated Statistics_DB.
   * Chunks requests to prevent PostgREST URL length limits. Runs queries concurrently.
   */
  static async getFederatedLineups(matchIds: string[]) {
    if (matchIds.length === 0) return [];

    const chunkSize = 100;
    const promises = [];

    for (let i = 0; i < matchIds.length; i += chunkSize) {
      const chunk = matchIds.slice(i, i + chunkSize);
      promises.push(
        statsAdmin
          .from("stat_lineups")
          .select("*")
          .in("match_id", chunk)
      );
    }

    const responses = await Promise.all(promises);
    let allLineups: any[] = [];
    for (const res of responses) {
      if (res.error) throw res.error;
      if (res.data) allLineups = [...allLineups, ...res.data];
    }

    return allLineups;
  }

  /**
   * Fetch match events (goals, cards, substitutions) from the federated Statistics_DB.
   * Chunks requests to prevent PostgREST URL length limits. Runs queries concurrently.
   */
  static async getFederatedEvents(matchIds: string[]) {
    if (matchIds.length === 0) return [];

    const chunkSize = 100;
    const promises = [];

    for (let i = 0; i < matchIds.length; i += chunkSize) {
      const chunk = matchIds.slice(i, i + chunkSize);
      promises.push(
        statsAdmin
          .from("stat_events")
          .select("*")
          .in("match_id", chunk)
          .order("minute", { ascending: true })
      );
    }

    const responses = await Promise.all(promises);
    let allEvents: any[] = [];
    for (const res of responses) {
      if (res.error) throw res.error;
      if (res.data) allEvents = [...allEvents, ...res.data];
    }

    return allEvents;
  }

  /**
   * Fetch player influence records from the federated Statistics_DB.
   * Filters are pushed down to PostgreSQL via PostgREST — no in-memory filtering here.
   * Uses embedded joins on stat_matches to retrieve league competitions natively.
   */
  static async getFederatedPlayerInfluence(options?: GetFederatedPlayerInfluenceOptions) {
    const buildQuery = () => {
      let query = statsAdmin
        .from("v_player_season_stats")
        .select("*");

      // Filter by season
      const seasonFilter = options?.filters?.rules.find((r: any) => r.field === "season") as FilterRule | undefined;
      if (seasonFilter && seasonFilter.value) {
        const rawVals = Array.isArray(seasonFilter.value) ? seasonFilter.value : [seasonFilter.value];
        const expandedVals = Array.from(new Set(rawVals.flatMap((s: any) => {
          const str = String(s);
          return [str, str.replace("-", "/"), str.replace("/", "-")];
        })));
        query = query.in("season", expandedVals);
      } else if (options?.seasons && options.seasons.length > 0) {
        const expandedVals = Array.from(new Set(options.seasons.flatMap((s: any) => {
          const str = String(s);
          return [str, str.replace("-", "/"), str.replace("/", "-")];
        })));
        query = query.in("season", expandedVals);
      }

      // Filter by competition
      const compFilter = options?.filters?.rules.find((r: any) => r.field === "competition") as FilterRule | undefined;
      if (compFilter) {
        if (compFilter.operator === "in") {
          query = query.in("competition", compFilter.value);
        } else {
          query = query.eq("competition", compFilter.value);
        }
      }

      if (options?.playerNames && options.playerNames.length > 0) {
        query = query.in("player_name", options.playerNames);
      }
      if (options?.teamNames && options.teamNames.length > 0) {
        const resolvedTeams = options.teamNames.map((t) =>
          t === "S.D. Almazán" ? "C.D. Almazán" : t
        );
        query = query.in("team_name", resolvedTeams);
      }

      // Push down search filters using PostgreSQL ilike + vowel wildcards to be accent-safe
      const nameFilter = options?.filters?.rules.find((r: any) => r.field === "player_name") as FilterRule | undefined;
      if (nameFilter && nameFilter.value) {
        const cleanSearch = String(nameFilter.value).trim();
        const words = cleanSearch.split(/\s+/).filter(Boolean);
        for (const w of words) {
          const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
          query = query.ilike("player_name", `%${pat}%`);
        }
      }
      const teamFilter = options?.filters?.rules.find((r: any) => r.field === "team_name" || r.field === "current_team") as FilterRule | undefined;
      if (teamFilter && teamFilter.value) {
        const cleanTeam = String(teamFilter.value).trim();
        const words = cleanTeam.split(/\s+/).filter(Boolean);
        for (const w of words) {
          const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
          query = query.ilike("team_name", `%${pat}%`);
        }
      }

      // Clean and map filters before pushing to database query
      let dbFilters = options?.filters;
      if (dbFilters) {
        const dbFieldMap: Record<string, string> = {
          goals: "goals",
          goals90: "goals_90",
          minutes: "minutes",
          starts: "starts",
          matches: "matches",
          impact: "impact",
          dependency: "dependency",
          yellowCards: "yellow_cards",
          redCards: "red_cards",
          cleanSheetRatio: "clean_sheet_ratio",
          goalsConceded90: "goals_conceded_90",
          revulsiveImpact: "revulsive_impact",
          concededGoalsRatio: "conceded_goals_ratio",
        };

        const mappedRules = dbFilters.rules.map((rule: any) => {
          if ("condition" in rule) return rule;
          const field = rule.field;
          const mappedField = dbFieldMap[field] || field;
          return {
            ...rule,
            field: mappedField,
          };
        });

        const cleanedRules = mappedRules.filter((r: any) => 
          r.rules || // keep groups
          !(r.field.includes("name") || r.field === "competition" || r.field === "season" || r.field === "team_name" || r.field === "current_team")
        );

        dbFilters = {
          ...dbFilters,
          rules: cleanedRules,
        };

        query = FilterEngine.applyToQuery(query, dbFilters);
      }
      return query;
    };

    // Query all matching records in pages of 1000 to bypass PostgREST limit
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await buildQuery().range(from, from + limit - 1);
      if (error) throw error;
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        if (data.length < limit) {
          hasMore = false;
        } else {
          from += limit;
        }
      }
    }

    return allData;
  }

  // ============================================================
  // LOCAL DATA — Main_DB (RLS-protected, club-private)
  // ============================================================

  /**
   * Fetch local matches from the primary database (Main_DB).
   * RLS guarantees organization isolation — no need for redundant app-level org filter.
   */
  static async getLocalMatches(options?: GetLocalMatchesOptions) {
    const supabase = await getServerClient();
    let query = supabase.from("matches").select("*");

    if (options?.teamId) {
      query = query.eq("team_id", options.teamId);
    }
    if (options?.seasonId) {
      query = query.eq("season_id", options.seasonId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch local player stats from the primary database (Main_DB).
   * RLS guarantees organization isolation.
   */
  static async getLocalPlayerStats(options?: GetLocalPlayerStatsOptions) {
    const supabase = await getServerClient();
    let query = supabase.from("match_player_stats").select("*, players(*)");

    if (options?.matchIds && options.matchIds.length > 0) {
      query = query.in("match_id", options.matchIds);
    }
    if (options?.playerIds && options.playerIds.length > 0) {
      query = query.in("player_id", options.playerIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch active coaching staff from the primary database (Main_DB).
   * Uses the profiles table instead of auth.users directly to avoid
   * exposing raw auth data.
   */
  static async getLocalCoaches(organizationId: string) {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("user_organization_roles")
      .select("*, profile:profiles(id, email, full_name, avatar_url)")
      .eq("organization_id", organizationId)
      .in("role", ["head_coach", "coach", "physical_coach"]);

    if (error) throw error;
    return data || [];
  }

  // ============================================================
  // SAVED VIEWS CRUD — Main_DB (RLS-protected)
  // ============================================================

  static async getSavedViews(organizationId: string) {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("saved_views")
      .select("*")
      .eq("organization_id", organizationId)
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    // Map database snake_case columns back to camelCase properties for framework usage
    return (data || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      createdBy: row.created_by,
      name: row.name,
      description: row.description,
      icon: row.icon,
      entityType: row.entity_type,
      filters: row.filters,
      metrics: row.metrics,
      sortBy: row.sort_by,
      sortOrder: row.sort_order,
      isFavorite: row.is_favorite,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as SavedView[];
  }

  static async saveView(view: SavedView) {
    const supabase = await getServerClient();

    const dbRow = {
      organization_id: view.organizationId,
      created_by: view.createdBy,
      name: view.name,
      description: view.description,
      icon: view.icon || "layout",
      entity_type: view.entityType,
      filters: view.filters,
      metrics: view.metrics,
      sort_by: view.sortBy,
      sort_order: view.sortOrder,
      is_favorite: view.isFavorite,
      updated_at: new Date().toISOString(),
    };

    if (view.id) {
      const { data, error } = await supabase
        .from("saved_views")
        .update(dbRow)
        .eq("id", view.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("saved_views")
        .insert({
          ...dbRow,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  static async deleteView(viewId: string) {
    const supabase = await getServerClient();
    const { error } = await supabase
      .from("saved_views")
      .delete()
      .eq("id", viewId);
    if (error) throw error;
    return true;
  }

  // ============================================================
  // GDPR CONSENTS CRUD — Main_DB (RLS-protected)
  // ============================================================

  static async getUserConsent(userId: string, consentType: string, version: string) {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("user_data_consents")
      .select("*")
      .eq("user_id", userId)
      .eq("consent_type", consentType)
      .eq("version", version)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      consentType: data.consent_type,
      version: data.version,
      accepted: data.accepted,
      acceptedAt: data.accepted_at,
      withdrawnAt: data.withdrawn_at,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
    } as UserDataConsent;
  }

  static async saveUserConsent(consent: UserDataConsent) {
    const supabase = await getServerClient();

    const dbRow = {
      user_id: consent.userId,
      consent_type: consent.consentType,
      version: consent.version,
      accepted: consent.accepted,
      accepted_at: consent.accepted ? new Date().toISOString() : null,
      withdrawn_at: !consent.accepted ? new Date().toISOString() : null,
      ip_address: consent.ipAddress,
      user_agent: consent.userAgent,
      updated_at: new Date().toISOString(),
    };

    if (consent.id) {
      const { data, error } = await supabase
        .from("user_data_consents")
        .update(dbRow)
        .eq("id", consent.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("user_data_consents")
        .insert({
          ...dbRow,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }
}
