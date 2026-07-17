import { ExplorerRow } from "../types";

/**
 * RankingEngine — Sorts, filters, and ranks analytical records based on registered metrics.
 * Built to dynamically compile "Top Scorers", "Top Defenses", "Fair Play" leaderboards, or
 * custom subsets like "Under-23 (U23)" talent pools.
 */
export class RankingEngine {
  /**
   * Sort entities by a specific metric ID in descending (default) or ascending order.
   */
  static rank(
    rows: ExplorerRow[],
    metricId: string,
    options?: { limit?: number; order?: "asc" | "desc" }
  ): ExplorerRow[] {
    const order = options?.order || "desc";
    const limit = options?.limit;

    const ranked = [...rows].sort((a, b) => {
      const valA = Number(a.metrics[metricId]) ?? 0;
      const valB = Number(b.metrics[metricId]) ?? 0;

      if (isNaN(valA) && isNaN(valB)) return 0;
      if (isNaN(valA)) return 1; // Put NaN at the end
      if (isNaN(valB)) return -1;

      return order === "desc" ? valB - valA : valA - valB;
    });

    return limit ? ranked.slice(0, limit) : ranked;
  }

  /**
   * Ranks younger players (e.g. Under-23, U23) by a metric.
   * Assumes birth date or age is present in the player details metadata.
   */
  static rankU23(
    rows: ExplorerRow[],
    metricId: string,
    options?: { limit?: number; referenceYear?: number }
  ): ExplorerRow[] {
    const refYear = options?.referenceYear || new Date().getFullYear();
    
    // Filter rows that represent players under 23 years old
    const u23Rows = rows.filter((row) => {
      if (row.entityType !== "player") return false;
      
      const dob = row.details.date_of_birth;
      if (dob) {
        const birthYear = new Date(dob).getFullYear();
        return refYear - birthYear <= 23;
      }
      
      const age = Number(row.details.age);
      if (!isNaN(age)) {
        return age <= 23;
      }
      
      return false;
    });

    return this.rank(u23Rows, metricId, { limit: options?.limit, order: "desc" });
  }

  /**
   * Generates a Fair Play ranking (lower card totals/points are ranked higher).
   * Usually ranks by yellow cards + 2 * red cards.
   */
  static rankFairPlay(
    rows: ExplorerRow[],
    options?: { limit?: number }
  ): ExplorerRow[] {
    const fairPlayRows = rows.map((row) => {
      const yellow = Number(row.metrics.yellowCards || row.metrics.yellow_cards || 0);
      const red = Number(row.metrics.redCards || row.metrics.red_cards || 0);
      
      // Standard Spanish Federation Fair Play formula: 1pt per yellow, 3pt per double yellow / red
      const penaltyPoints = yellow * 1 + red * 3;
      
      return {
        ...row,
        metrics: {
          ...row.metrics,
          fairPlayPenalty: penaltyPoints,
        },
      };
    });

    // Sort ascending (lower penalty points is better)
    return this.rank(fairPlayRows, "fairPlayPenalty", {
      limit: options?.limit,
      order: "asc",
    });
  }
}
