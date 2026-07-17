import { revalidateTag } from "next/cache";

/**
 * ClubLab — Analysis Cache Layer (v2)
 *
 * Replaces the previous in-process Map implementation (AnalysisCache) which had ~0%
 * effectiveness on Vercel because each serverless instance had its own isolated Map.
 *
 * This module provides:
 *   1. Cache tag constants — used to tag unstable_cache() calls in providers
 *   2. Invalidation helpers — called from Server Actions after writes
 *
 * The actual caching is handled by Next.js unstable_cache() applied directly
 * to the provider methods (see providers/core.ts). This file manages only
 * the invalidation side and the shared tag naming convention.
 *
 * ── How Next.js Data Cache works on Vercel ────────────────────────────────
 * • unstable_cache() stores results in Vercel's shared cache (not in-process).
 * • All serverless instances share the same cache → cache hits across instances.
 * • revalidateTag() invalidates across all instances simultaneously.
 * • TTLs are set per-cache-entry via the `revalidate` option.
 * ──────────────────────────────────────────────────────────────────────────
 */

// ============================================================
// CACHE TAG CONSTANTS
// ============================================================

/**
 * Tags for federated Statistics_DB data (public, shared across all orgs).
 * These are invalidated when the scraper imports new actas.
 */
export const CACHE_TAGS = {
  /** All federated stats — broadest invalidation */
  federatedStats: "federated-stats" as const,

  /** Per-season federated stats — preferred narrow invalidation */
  federatedStatsBySeason: (season: string) =>
    `federated-stats-season-${season.replace("/", "-")}` as string,

  /** Per-organization private data — players, matches, sessions, wellness */
  orgData: (orgId: string) => `org-data-${orgId}` as string,

  /** Saved views per organization */
  savedViews: (orgId: string) => `saved-views-${orgId}` as string,

  /** Dashboard layout context per user (role, org, teams, seasons) */
  userContext: (userId: string) => `user-context-${userId}` as string,
} as const;

// ============================================================
// INVALIDATION HELPERS
// ============================================================

/**
 * Call after the scraper imports a new acta for a specific season.
 * Invalidates only the cache entries for that season (narrowest possible scope).
 */
export function invalidateFederatedStats(season?: string) {
  if (season) {
    revalidateTag(CACHE_TAGS.federatedStatsBySeason(season), "default");
  } else {
    // Broad invalidation — use sparingly
    revalidateTag(CACHE_TAGS.federatedStats, "default");
  }
}

/**
 * Call after any write to Main_DB that affects org-scoped data:
 * players, matches, training sessions, wellness entries, etc.
 */
export function invalidateOrgData(orgId: string) {
  revalidateTag(CACHE_TAGS.orgData(orgId), "default");
}

/**
 * Call after saving or deleting a SavedView.
 */
export function invalidateSavedViews(orgId: string) {
  revalidateTag(CACHE_TAGS.savedViews(orgId), "default");
}

/**
 * Call after changing a user's role, team, or organization membership.
 * Forces dashboard layout to re-fetch context data.
 */
export function invalidateUserContext(userId: string) {
  revalidateTag(CACHE_TAGS.userContext(userId), "default");
}

// ============================================================
// LEGACY COMPATIBILITY SHIM
// ============================================================

/**
 * @deprecated Use CACHE_TAGS + invalidate* helpers instead.
 * Kept to avoid breaking existing call sites in index.ts during migration.
 * All methods are no-ops — caching is now handled by unstable_cache() in providers.
 */
export class AnalysisCache {
  /**
   * @deprecated No-op. Keys are now managed by Next.js Data Cache.
   */
  static generateKey(
    entityType: string,
    filters: any,
    metricIds: string[],
    additionalContext?: Record<string, any>
  ): string {
    const ctx = additionalContext ? JSON.stringify(additionalContext) : "";
    return `${entityType}|${JSON.stringify(filters)}|${metricIds.sort().join(",")}|${ctx}`;
  }

  /**
   * @deprecated Always returns null. Cache hits are handled by Next.js Data Cache.
   */
  static get<T = any>(_key: string): T | null {
    return null;
  }

  /**
   * @deprecated No-op. Cache storage is handled by Next.js Data Cache.
   */
  static set(_key: string, _value: any, _ttlMs?: number): void {
    // no-op
  }

  /**
   * @deprecated Use invalidateFederatedStats() or invalidateOrgData() instead.
   * This no-op is retained to avoid breaking existing call sites during the migration.
   */
  static invalidateAll(): void {
    // no-op — granular invalidation via cache tags replaces this broad clear
  }
}
