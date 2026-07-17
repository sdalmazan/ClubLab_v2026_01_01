import { ReportConfig, ReportSection, ReportWidget, EntityType } from "../types";
import { ExplorerEngine } from "../explorer/core";
import { CompareEngine } from "../engines/compare";
import { MetricRegistry } from "../registry/metrics";
import { AnalysisDataProvider } from "../providers/core";

/**
 * ReportBuilder — Generates fully-populated analytical layout JSON schemas.
 * Resolves widget configurations (KPIs, tables, radar charts, comparisons) by executing
 * the required queries and compiling data.
 */
export class ReportBuilder {
  /**
   * Evaluates a ReportConfig, fetching all required data to populate the widgets.
   */
  static async build(config: ReportConfig): Promise<any> {
    const populatedSections = [];

    for (const section of config.sections) {
      const populatedWidgets = [];

      for (const widget of section.widgets) {
        try {
          const populatedWidget = await this.populateWidget(widget);
          populatedWidgets.push(populatedWidget);
        } catch (error: any) {
          populatedWidgets.push({
            ...widget,
            error: `Failed to load widget data: ${error.message || error}`,
          });
        }
      }

      populatedSections.push({
        ...section,
        widgets: populatedWidgets,
      });
    }

    return {
      title: config.title,
      description: config.description,
      generatedAt: new Date().toISOString(),
      sections: populatedSections,
    };
  }

  /**
   * Executes queries and computations based on widget type and configuration.
   */
  private static async populateWidget(widget: ReportWidget): Promise<any> {
    const { type, config } = widget;
    const { entityType, entityIds = [], metrics = [], filters = { condition: "AND", rules: [] } } = config;

    let data: any = null;

    switch (type) {
      case "kpi":
        // Get single KPI value
        if (entityIds.length > 0 && metrics.length > 0) {
          const metricId = metrics[0];
          const val = await this.fetchSingleMetric(entityType, entityIds[0], metricId);
          data = {
            value: val,
            metricId,
            metricName: MetricRegistry.get(metricId)?.name || metricId,
          };
        }
        break;

      case "table":
        // Run explorer engine to fetch tabular data
        const explorerRes = await ExplorerEngine.explore({
          entityType,
          filters,
          metrics,
          pageSize: 20, // default limit for report tables
        });
        data = {
          rows: explorerRes.rows,
          averages: explorerRes.averages,
          headers: metrics.map((mId) => ({
            id: mId,
            label: MetricRegistry.get(mId)?.name || mId,
          })),
        };
        break;

      case "comparison":
        // Run compare engine on selected entity IDs
        if (entityIds.length > 0 && metrics.length > 0) {
          const entitiesData = [];
          for (const id of entityIds) {
            const records = await this.fetchEntityRecords(entityType, id);
            entitiesData.push({
              id,
              name: id.split("|")[0], // fallback name
              records,
            });
          }
          const compareRes = CompareEngine.compare(entityType, entitiesData, metrics);
          data = compareRes;
        }
        break;

      case "chart":
        // Compile charts series (e.g. radar or line evolution)
        if (config.chartType === "radar") {
          // Radar comparison
          if (entityIds.length > 0 && metrics.length > 0) {
            const entitiesData = [];
            for (const id of entityIds) {
              const records = await this.fetchEntityRecords(entityType, id);
              entitiesData.push({
                id,
                name: id.split("|")[0],
                records,
              });
            }
            const compareRes = CompareEngine.compare(entityType, entitiesData, metrics);
            
            // Format for radar chart
            data = {
              chartType: "radar",
              indicators: metrics.map((mId) => ({
                key: mId,
                label: MetricRegistry.get(mId)?.name || mId,
              })),
              series: compareRes.entities.map((ent) => ({
                name: ent.name,
                values: ent.metrics,
              })),
            };
          }
        } else {
          // Default line/bar trend chart
          data = {
            chartType: config.chartType || "bar",
            series: [],
          };
        }
        break;

      case "text":
        // Plain text widget
        data = widget.title;
        break;

      default:
        data = null;
    }

    return {
      ...widget,
      data,
    };
  }

  // ============================================================
  // DATABASE HELPER METHODS
  // ============================================================

  private static async fetchEntityRecords(entityType: EntityType, id: string): Promise<any> {
    if (entityType === "player") {
      // Fetch influence logs for this player name
      const name = id.split("|")[0];
      return await AnalysisDataProvider.getFederatedPlayerInfluence({ playerNames: [name] });
    } else if (entityType === "team") {
      // Fetch matches for this team name
      const teamName = id.split("|")[0];
      const matches = await AnalysisDataProvider.getFederatedMatches({ teams: [teamName] });
      return matches.map((m: any) => ({
        ...m,
        is_home: m.home_team === teamName,
        goals_for: m.home_team === teamName ? m.home_score : m.away_score,
        goals_against: m.home_team === teamName ? m.away_score : m.home_score,
        result: m.home_team === teamName 
          ? (m.home_score > m.away_score ? "win" : m.home_score === m.away_score ? "draw" : "loss")
          : (m.away_score > m.home_score ? "win" : m.home_score === m.away_score ? "draw" : "loss"),
      }));
    } else if (entityType === "coach") {
      // Simulate coach stats payload
      return { wins: 10, matchesPlayed: 20, reactionWindow: 55, benchUsage: 4.2, irc: 1.8 };
    }
    return [];
  }

  private static async fetchSingleMetric(
    entityType: EntityType,
    entityId: string,
    metricId: string
  ): Promise<number | string> {
    const records = await this.fetchEntityRecords(entityType, entityId);
    const metricDef = MetricRegistry.get(metricId);
    
    if (metricDef && metricDef.entityType === entityType) {
      return metricDef.compute(records);
    }
    return 0;
  }
}
