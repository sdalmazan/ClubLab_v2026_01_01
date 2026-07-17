import { EntityType, ExplorerQuery, ExplorerResult, ComparisonResult, ReportConfig, SavedView, UserDataConsent } from "./types";
import { AnalysisDataProvider } from "./providers/core";
import { MetricRegistry } from "./registry/metrics";
import { FilterEngine } from "./engines/filter";
import { TrendEngine } from "./engines/trend";
import { RankingEngine } from "./engines/ranking";
import { CompareEngine } from "./engines/compare";
import { ExplorerEngine } from "./explorer/core";
import { ReportBuilder } from "./reports/builder";
import { AnalysisCache, invalidateSavedViews } from "./cache/layer";
import { SavedViewsClient } from "./views/savedViews";
import { InsightsEngine } from "./insights/core";
import { getEntityConfig } from "./entities";

/**
 * AnalysisService — The definitive analytical API façade of ClubLab.
 * Hides database and computation details from the UI.
 * Integrates caching and unified method calls for players, teams, coaches, and competitions.
 */
export class AnalysisService {
  /**
   * Explores entities using the Universal Filter Engine and central Metric Registry.
   * Leverages the Cache Layer for instant lookups on identical search criteria.
   */
  static async explore(query: ExplorerQuery): Promise<ExplorerResult> {
    const cacheKey = AnalysisCache.generateKey(query.entityType, query.filters, query.metrics, {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const cached = AnalysisCache.get<ExplorerResult>(cacheKey);
    if (cached) return cached;

    const result = await ExplorerEngine.explore(query);
    AnalysisCache.set(cacheKey, result);
    return result;
  }

  /**
   * Compares multiple entities side-by-side.
   */
  static compare(
    entityType: EntityType,
    entities: { id: string; name: string; records: any }[],
    metrics: string[]
  ): ComparisonResult {
    return CompareEngine.compare(entityType, entities, metrics);
  }

  /**
   * Generates a fully populated Report layout structure.
   */
  static async buildReport(config: ReportConfig): Promise<any> {
    return await ReportBuilder.build(config);
  }

  /**
   * Exposes rule-based smart insights and prompt templates for future AI integration.
   */
  static generateInsights(
    entityType: EntityType,
    entityId: string,
    metrics: Record<string, number | string>
  ) {
    return InsightsEngine.generateInsights(entityType, entityId, metrics);
  }

  /**
   * Retrieves player-specific performance analysis.
   */
  static async getPlayerAnalysis(playerName: string, season: string) {
    const cacheKey = `player_analysis|${playerName}|${season}`;
    const cached = AnalysisCache.get(cacheKey);
    if (cached) return cached;

    const records = await AnalysisDataProvider.getFederatedPlayerInfluence({
      playerNames: [playerName],
      seasons: [season],
    });

    const config = getEntityConfig("player");
    const computedMetrics: Record<string, number | string> = {};

    for (const mId of config.metrics) {
      const def = MetricRegistry.get(mId);
      if (def) computedMetrics[mId] = def.compute(records);
    }

    const insights = InsightsEngine.generateInsights("player", `${playerName}|${season}`, computedMetrics);

    const analysis = {
      playerName,
      season,
      matchesPlayed: records.length,
      metrics: computedMetrics,
      insights,
    };

    AnalysisCache.set(cacheKey, analysis);
    return analysis;
  }

  /**
   * Retrieves team-specific performance analysis.
   */
  static async getTeamAnalysis(teamName: string, season: string) {
    const cacheKey = `team_analysis|${teamName}|${season}`;
    const cached = AnalysisCache.get(cacheKey);
    if (cached) return cached;

    const matches = await AnalysisDataProvider.getFederatedMatches({
      teams: [teamName],
      seasons: [season],
    });

    const teamMatches = matches.map((m: any) => ({
      ...m,
      is_home: m.home_team === teamName,
      goals_for: m.home_team === teamName ? m.home_score : m.away_score,
      goals_against: m.home_team === teamName ? m.away_score : m.home_score,
      result: m.home_team === teamName 
        ? (m.home_score > m.away_score ? "win" : m.home_score === m.away_score ? "draw" : "loss")
        : (m.away_score > m.home_score ? "win" : m.home_score === m.away_score ? "draw" : "loss"),
    }));

    const config = getEntityConfig("team");
    const computedMetrics: Record<string, number | string> = {};

    for (const mId of config.metrics) {
      const def = MetricRegistry.get(mId);
      if (def) computedMetrics[mId] = def.compute(teamMatches);
    }

    const insights = InsightsEngine.generateInsights("team", `${teamName}|${season}`, computedMetrics);

    const analysis = {
      teamName,
      season,
      matchesPlayed: teamMatches.length,
      metrics: computedMetrics,
      insights,
    };

    AnalysisCache.set(cacheKey, analysis);
    return analysis;
  }

  /**
   * SAVED VIEWS INTERFACE
   */
  static async getSavedViews(organizationId: string): Promise<SavedView[]> {
    return await SavedViewsClient.getViews(organizationId);
  }

  static async saveSavedView(view: SavedView): Promise<any> {
    const result = await SavedViewsClient.saveView(view);
    // Invalidate cached saved views for this org across all Vercel instances
    if (view.organizationId) {
      invalidateSavedViews(view.organizationId);
    }
    return result;
  }

  static async deleteSavedView(viewId: string, organizationId?: string): Promise<boolean> {
    const result = await SavedViewsClient.deleteView(viewId);
    // Invalidate cached saved views for this org across all Vercel instances
    if (organizationId) {
      invalidateSavedViews(organizationId);
    }
    return result;
  }

  /**
   * GDPR CONSENTS INTERFACE
   */
  static async getUserConsent(userId: string, consentType: string, version: string): Promise<UserDataConsent | null> {
    return await AnalysisDataProvider.getUserConsent(userId, consentType, version);
  }

  static async saveUserConsent(consent: UserDataConsent): Promise<any> {
    return await AnalysisDataProvider.saveUserConsent(consent);
  }

  /**
   * Expose engine helpers directly for charts or custom sorting in UI
   */
  static getTrendEngine() {
    return TrendEngine;
  }

  static getRankingEngine() {
    return RankingEngine;
  }

  static getFilterFields(entityType?: EntityType) {
    return FilterEngine.getSupportedFilters(entityType);
  }
}
export * from "./types";
