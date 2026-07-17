import { ComparisonResult, EntityType } from "../types";
import { MetricRegistry } from "../registry/metrics";

/**
 * Helper to determine if a lower value is better for a specific metric.
 * E.g., fewer goals conceded (defenseIndex) or earlier substitution times (reactionTime) are superior.
 */
function isLowerBetter(metricId: string): boolean {
  const lowerBetterKeys = [
    "defenseIndex",
    "goals_against",
    "cardsPerMatch",
    "yellowCards",
    "redCards",
    "fairPlayPenalty",
    "reactionTime", // earlier first substitution means faster coach reaction
  ];
  return lowerBetterKeys.includes(metricId);
}

/**
 * CompareEngine — Performs comparative analysis across multiple entities of the same type.
 * Generates averages, highlights top performers, and normalizes values to scale (0-100) for
 * radar charts and side-by-side tables.
 */
export class CompareEngine {
  /**
   * Compare a list of entities (players, teams, coaches, competitions) side-by-side
   */
  static compare(
    entityType: EntityType,
    entities: { id: string; name: string; records: any }[],
    metricIds: string[]
  ): ComparisonResult {
    if (entities.length === 0) {
      return { entityType, entities: [], metrics: [], averages: {} };
    }

    // 1. Calculate values for each entity and metric
    const entityResults = entities.map((e) => {
      const computedMetrics: Record<string, number | string> = {};
      
      for (const mId of metricIds) {
        const metricDef = MetricRegistry.get(mId);
        if (metricDef && metricDef.entityType === entityType) {
          try {
            computedMetrics[mId] = metricDef.compute(e.records);
          } catch (err) {
            computedMetrics[mId] = 0; // Fallback
          }
        } else {
          computedMetrics[mId] = 0;
        }
      }

      return {
        id: e.id,
        name: e.name,
        metrics: computedMetrics,
      };
    });

    // 2. Compute averages and find the best values
    const averages: Record<string, number> = {};
    const metricsMetadata: { id: string; name: string; formatType: string; bestValue?: number | string }[] = [];

    for (const mId of metricIds) {
      const metricDef = MetricRegistry.get(mId);
      if (!metricDef) continue;

      const numericValues = entityResults
        .map((e) => Number(e.metrics[mId]))
        .filter((v) => !isNaN(v));

      // Calculate Average
      const sum = numericValues.reduce((s, v) => s + v, 0);
      averages[mId] = numericValues.length > 0 ? parseFloat((sum / numericValues.length).toFixed(2)) : 0;

      // Identify the Best Value
      let bestValue: number | string | undefined = undefined;
      if (numericValues.length > 0) {
        const lowerBetter = isLowerBetter(mId);
        bestValue = lowerBetter ? Math.min(...numericValues) : Math.max(...numericValues);
        bestValue = parseFloat(Number(bestValue).toFixed(2));
      }

      metricsMetadata.push({
        id: mId,
        name: metricDef.name,
        formatType: metricDef.formatType,
        bestValue,
      });
    }

    return {
      entityType,
      entities: entityResults,
      metrics: metricsMetadata,
      averages,
    };
  }

  /**
   * Generates percentile ranks (0 - 100) for a given metric across a cohort of entities.
   * Useful for radar charts, placing the entity's score relative to the whole group.
   */
  static calculatePercentiles(
    rows: { id: string; name: string; metrics: Record<string, number | string> }[],
    metricId: string
  ): Record<string, number> {
    const scores = rows
      .map((r) => ({ id: r.id, val: Number(r.metrics[metricId]) }))
      .filter((s) => !isNaN(s.val))
      .sort((a, b) => {
        // Respect if lower value is better (e.g. fewer cards should result in a higher percentile)
        return isLowerBetter(metricId) ? b.val - a.val : a.val - b.val;
      });

    const percentiles: Record<string, number> = {};
    const n = scores.length;
    
    if (n === 0) return {};

    scores.forEach((s, index) => {
      // Percentile formula: (Rank - 0.5) / N * 100
      const percentile = ((index + 0.5) / n) * 100;
      percentiles[s.id] = parseFloat(percentile.toFixed(1));
    });

    return percentiles;
  }
}
