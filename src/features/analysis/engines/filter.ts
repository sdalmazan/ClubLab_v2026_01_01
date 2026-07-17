import { FilterGroup, FilterRule, EntityType } from "../types";

export interface FilterFieldMetadata {
  id: string;
  label: string;
  type: "select" | "multi-select" | "range" | "boolean" | "date-range" | "text";
  compatibleEntities: EntityType[];
  options?: { value: any; label: string }[];
}

/**
 * FilterEngine — Handles filtering capabilities.
 * Compiles FilterGroups into database operations (PostgREST)
 * or evaluates them in-memory for Javascript collections.
 */
export class FilterEngine {
  /**
   * List of universally supported filter fields in the platform.
   */
  static getSupportedFilters(entityType?: EntityType): FilterFieldMetadata[] {
    const allFilters: FilterFieldMetadata[] = [
      {
        id: "season",
        label: "Temporada",
        type: "multi-select",
        compatibleEntities: ["player", "team", "coach", "competition"],
      },
      {
        id: "competition",
        label: "Competición",
        type: "multi-select",
        compatibleEntities: ["player", "team", "coach", "competition"],
      },
      {
        id: "team_name",
        label: "Club",
        type: "select",
        compatibleEntities: ["player", "coach"],
      },
      {
        id: "position",
        label: "Posición",
        type: "select",
        compatibleEntities: ["player"],
        options: [
          { value: "goalkeeper", label: "Portero" },
          { value: "back", label: "Defensa" },
          { value: "midfielder", label: "Centrocampista" },
          { value: "striker", label: "Delantero" },
        ],
      },
      {
        id: "minutes_on",
        label: "Minutos Jugados",
        type: "range",
        compatibleEntities: ["player"],
      },
      {
        id: "is_starter",
        label: "Titular / Suplente",
        type: "boolean",
        compatibleEntities: ["player"],
      },
      {
        id: "goals_scored",
        label: "Goles anotados",
        type: "range",
        compatibleEntities: ["player"],
      },
      {
        id: "yellow_cards",
        label: "Tarjetas amarillas",
        type: "range",
        compatibleEntities: ["player"],
      },
      {
        id: "red_cards",
        label: "Tarjetas rojas",
        type: "range",
        compatibleEntities: ["player"],
      },
      {
        id: "is_home",
        label: "Local / Visitante",
        type: "boolean",
        compatibleEntities: ["team"],
      },
      {
        id: "team_result",
        label: "Resultado",
        type: "select",
        compatibleEntities: ["team", "player"],
        options: [
          { value: "win", label: "Victoria" },
          { value: "draw", label: "Empate" },
          { value: "loss", label: "Derrota" },
        ],
      },
      {
        id: "match_date",
        label: "Rango de fechas",
        type: "date-range",
        compatibleEntities: ["player", "team", "coach", "competition"],
      },
    ];

    if (entityType) {
      return allFilters.filter((f) => f.compatibleEntities.includes(entityType));
    }
    return allFilters;
  }

  /**
   * Apply a FilterGroup dynamically to a Supabase query builder.
   */
  static applyToQuery(query: any, group: FilterGroup): any {
    if (!group || !group.rules || group.rules.length === 0) return query;

    let q = query;
    if (group.condition === "AND") {
      for (const rule of group.rules) {
        if ("condition" in rule) {
          // Nested group inside AND:
          // Since PostgREST doesn't support arbitrary nesting via chain,
          // we use the PostgREST OR string mapping if the sub-group is an OR.
          if (rule.condition === "OR") {
            const orStr = this.compileOrGroupToString(rule);
            if (orStr) q = q.or(orStr);
          } else {
            q = this.applyToQuery(q, rule);
          }
        } else {
          q = this.applyRule(q, rule);
        }
      }
    } else {
      // Root level OR group
      const orStr = this.compileOrGroupToString(group);
      if (orStr) q = q.or(orStr);
    }
    return q;
  }

  /**
   * Check if a given record matches a FilterGroup in memory.
   */
  static evaluateFilters(record: any, group: FilterGroup): boolean {
    if (!group || !group.rules || group.rules.length === 0) return true;

    const results = group.rules.map((rule) => {
      if ("condition" in rule) {
        return this.evaluateFilters(record, rule);
      }
      return this.evaluateRule(record, rule);
    });

    if (group.condition === "AND") {
      return results.every((r) => r === true);
    } else {
      return results.some((r) => r === true);
    }
  }

  // ============================================================
  // DATABASE QUERY BUILDER HELPERS
  // ============================================================

  private static applyRule(query: any, rule: FilterRule): any {
    const { field, operator, value } = rule;
    if (value === undefined || value === null || value === "") return query;

    switch (operator) {
      case "eq":
        return query.eq(field, value);
      case "neq":
        return query.neq(field, value);
      case "gt":
        return query.gt(field, value);
      case "gte":
        return query.gte(field, value);
      case "lt":
        return query.lt(field, value);
      case "lte":
        return query.lte(field, value);
      case "like":
        const wordsArr = String(value).trim().split(/\s+/).filter(Boolean);
        let qChain = query;
        for (const w of wordsArr) {
          const pat = w.replace(/[aeiouáéíóúü]/gi, "_").replace(/[^a-zA-Z0-9_]/g, "");
          qChain = qChain.ilike(field, `%${pat}%`);
        }
        return qChain;
      case "ieq":
        return query.ilike(field, value);
      case "in":
        return query.in(field, Array.isArray(value) ? value : [value]);
      case "between":
        if (Array.isArray(value) && value.length === 2) {
          return query.gte(field, value[0]).lte(field, value[1]);
        }
        return query;
      default:
        return query;
    }
  }

  private static compileOrGroupToString(group: FilterGroup): string | null {
    const parts = group.rules
      .map((rule) => {
        if ("condition" in rule) {
          // PostgREST supports nesting like 'and(a.eq.1,or(b.eq.2,c.eq.3))'
          const cond = rule.condition.toLowerCase();
          const subStr = this.compileOrGroupToString(rule);
          return subStr ? `${cond}(${subStr})` : null;
        }
        return this.ruleToPostgrestString(rule);
      })
      .filter(Boolean);

    return parts.length > 0 ? parts.join(",") : null;
  }

  private static ruleToPostgrestString(rule: FilterRule): string | null {
    const { field, operator, value } = rule;
    if (value === undefined || value === null || value === "") return null;

    switch (operator) {
      case "eq":
        return `${field}.eq.${value}`;
      case "neq":
        return `${field}.neq.${value}`;
      case "gt":
        return `${field}.gt.${value}`;
      case "gte":
        return `${field}.gte.${value}`;
      case "lt":
        return `${field}.lt.${value}`;
      case "lte":
        return `${field}.lte.${value}`;
      case "like":
        const wordsStr = String(value).trim().split(/\s+/).filter(Boolean);
        if (wordsStr.length > 1) {
          const conditions = wordsStr.map(w => `${field}.ilike.*${w}*`);
          return `and(${conditions.join(",")})`;
        }
        return `${field}.ilike.*${value}*`;
      case "ieq":
        return `${field}.ilike.${value}`;
      case "in":
        const valuesList = Array.isArray(value) ? value.join(",") : value;
        return `${field}.in.(${valuesList})`;
      case "between":
        if (Array.isArray(value) && value.length === 2) {
          return `and(${field}.gte.${value[0]},${field}.lte.${value[1]})`;
        }
        return null;
      default:
        return null;
    }
  }

  // ============================================================
  // IN-MEMORY EVALUATION HELPERS
  // ============================================================

  private static evaluateRule(record: any, rule: FilterRule): boolean {
    const { field, operator, value } = rule;
    const recordVal = record[field];

    if (recordVal === undefined || recordVal === null) return false;

    switch (operator) {
      case "eq":
        return recordVal === value;
      case "neq":
        return recordVal !== value;
      case "gt":
        return recordVal > value;
      case "gte":
        return recordVal >= value;
      case "lt":
        return recordVal < value;
      case "lte":
        return recordVal <= value;
      case "like": {
        const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const wordsMem = strip(String(value)).split(/\s+/).filter(Boolean);
        const recordClean = strip(String(recordVal));
        return wordsMem.every(w => recordClean.includes(w));
      }
      case "ieq": {
        const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return strip(String(recordVal)) === strip(String(value));
      }
      case "in":
        const arr = Array.isArray(value) ? value : [value];
        return arr.includes(recordVal);
      case "between":
        if (Array.isArray(value) && value.length === 2) {
          return recordVal >= value[0] && recordVal <= value[1];
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Helper to recursively extract filter values for a specific field name.
   * Used to push down season/competition filtering to data providers.
   */
  public static extractValues(filters: FilterGroup, fieldName: string): string[] {
    const values: string[] = [];
    
    const walk = (group: FilterGroup) => {
      if (!group || !group.rules) return;
      for (const rule of group.rules) {
        if ("condition" in rule) {
          walk(rule);
        } else if (rule.field === fieldName) {
          if (rule.value !== undefined && rule.value !== null && rule.value !== "") {
            if (Array.isArray(rule.value)) {
              values.push(...rule.value.map(v => String(v)));
            } else if (typeof rule.value === "string") {
              if (rule.value.includes(",")) {
                values.push(...rule.value.split(",").map(v => v.trim()));
              } else {
                values.push(rule.value);
              }
            } else {
              values.push(String(rule.value));
            }
          }
        }
      }
    };
    
    walk(filters);
    return Array.from(new Set(values)); // Deduplicate results
  }
}
