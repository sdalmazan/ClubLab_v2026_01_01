import { EntityType } from "../types";
import { PlayerConfig } from "./player";
import { TeamConfig } from "./team";
import { CoachConfig } from "./coach";
import { CompetitionConfig } from "./competition";

export interface EntityConfig {
  type: EntityType;
  label: string;
  metrics: string[];
  filters: string[];
  charts: { id: string; label: string; type: "radar" | "bar" | "line" }[];
  rankings: { id: string; label: string; metricId: string; order?: "asc" | "desc" }[];
  reports: { id: string; label: string; sections: string[] }[];
}

export const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  player: PlayerConfig,
  team: TeamConfig,
  coach: CoachConfig,
  competition: CompetitionConfig,
};

/**
 * Retrieve the analytical capabilities configuration for a given Entity Type.
 * Used by the UI to dynamically construct filter panels, charts, tables, rankings, and reports.
 */
export function getEntityConfig(type: EntityType): EntityConfig {
  const config = ENTITY_CONFIGS[type];
  if (!config) {
    throw new Error(`Unrecognized entity type: ${type}`);
  }
  return config;
}
