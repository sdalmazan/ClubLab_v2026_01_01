import { TrendPoint, TrendResult, EntityType } from "../types";

/**
 * TrendEngine — Provides analytical computations for historical performance trends.
 * Supports calculations for rolling averages, last N matches, performance trajectories (slopes),
 * and seasonal comparisons.
 */
export class TrendEngine {
  /**
   * Filter and return the last N points (e.g. Last 3, 5, 10 matches)
   */
  static getLastN(points: TrendPoint[], n: number): TrendPoint[] {
    return points.slice(-n);
  }

  /**
   * Compute a Simple Rolling Average (SRA) for a specific metric.
   * Useful for smoothing line charts and detecting real performance trends.
   */
  static calculateRollingAverage(
    points: TrendPoint[],
    metricId: string,
    windowSize: number = 3
  ): TrendPoint[] {
    if (points.length === 0 || windowSize <= 0) return [];

    return points.map((p, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const subset = points.slice(start, index + 1);
      
      const values = subset
        .map((subP) => Number(subP.metrics[metricId]))
        .filter((val) => !isNaN(val));

      const average = values.length > 0 
        ? values.reduce((sum, val) => sum + val, 0) / values.length 
        : 0;

      return {
        ...p,
        metrics: {
          ...p.metrics,
          [`${metricId}_rolling`]: parseFloat(average.toFixed(2)),
        },
      };
    });
  }

  /**
   * Analyze the trend slope to determine if performance is improving, regressing, or stable.
   * Uses simple linear regression to check the direction of the trend.
   */
  static analyzeSlope(
    points: TrendPoint[],
    metricId: string
  ): "improvement" | "regression" | "stable" {
    const values = points
      .map((p) => Number(p.metrics[metricId]))
      .filter((val) => !isNaN(val));

    if (values.length < 2) return "stable";

    // Simple Linear Regression slope calculation
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumXX - sumX * sumX;
    
    if (denominator === 0) return "stable";

    const slope = numerator / denominator;
    const threshold = 0.05; // 5% variance threshold for stability

    if (slope > threshold) return "improvement";
    if (slope < -threshold) return "regression";
    return "stable";
  }

  /**
   * Compare two sets of trend points (e.g. comparing Season A vs Season B)
   */
  static comparePeriods(
    period1: TrendPoint[],
    period2: TrendPoint[],
    metricId: string
  ): { difference: number; percentageChange: number } {
    const val1List = period1.map((p) => Number(p.metrics[metricId])).filter((v) => !isNaN(v));
    const val2List = period2.map((p) => Number(p.metrics[metricId])).filter((v) => !isNaN(v));

    const avg1 = val1List.length > 0 ? val1List.reduce((s, v) => s + v, 0) / val1List.length : 0;
    const avg2 = val2List.length > 0 ? val2List.reduce((s, v) => s + v, 0) / val2List.length : 0;

    const difference = parseFloat((avg2 - avg1).toFixed(2));
    const percentageChange = avg1 !== 0 
      ? parseFloat(((difference / avg1) * 100).toFixed(1)) 
      : 0;

    return { difference, percentageChange };
  }
}
