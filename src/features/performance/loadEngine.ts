/**
 * ClubLab v2026.01.01 — Load Engine
 * Migrated from proyecto_v1.
 *
 * Calculates training loads, ACWR, monotony, and strain.
 * All functions are pure — no side effects, no DB calls.
 */

import type { LoadLevel } from "@/types";

// ============================================================
// TYPES
// ============================================================

export interface SessionLoadInput {
  minutes?: number | null;
  rpe?: number | null;
}

export interface WeeklyLoadInput {
  loads: number[];
}

export interface PlannedVsActualInput {
  plannedLoad?: number | null;
  actualLoad?: number | null;
}

export interface LoadComparisonResult {
  difference: number | null;
  percentageDifference: number | null;
  status: "below_planned" | "on_target" | "above_planned" | "unknown";
  message: string;
}

// ============================================================
// LOAD CALCULATIONS
// ============================================================

/**
 * Session Load = Minutes × RPE (Foster method)
 */
export function calculateSessionLoad(input: SessionLoadInput): number | null {
  if (input.minutes == null || input.rpe == null) return null;
  if (input.minutes <= 0 || input.rpe <= 0) return null;
  return input.minutes * input.rpe;
}

/**
 * Weekly Load = sum of all session loads in the week
 */
export function calculateWeeklyLoad(input: WeeklyLoadInput): number {
  return input.loads.reduce((total, load) => total + load, 0);
}

/**
 * Classify weekly load into a qualitative level
 */
export function classifyWeeklyLoad(weeklyLoad: number): LoadLevel {
  if (weeklyLoad >= 2300) return "high";
  if (weeklyLoad >= 1800) return "medium_high";
  if (weeklyLoad >= 1000) return "medium";
  if (weeklyLoad > 0) return "low";
  return "recovery";
}

/**
 * Compare planned vs actual load
 */
export function comparePlannedVsActualLoad(
  input: PlannedVsActualInput
): LoadComparisonResult {
  if (
    input.plannedLoad == null ||
    input.actualLoad == null ||
    input.plannedLoad <= 0
  ) {
    return {
      difference: null,
      percentageDifference: null,
      status: "unknown",
      message: "No hay datos suficientes para comparar carga prevista y real.",
    };
  }

  const difference = input.actualLoad - input.plannedLoad;
  const percentageDifference = Math.round(
    (difference / input.plannedLoad) * 100
  );

  if (percentageDifference > 15) {
    return { difference, percentageDifference, status: "above_planned",
      message: "La carga real ha superado claramente la carga prevista." };
  }
  if (percentageDifference < -15) {
    return { difference, percentageDifference, status: "below_planned",
      message: "La carga real ha quedado por debajo de la carga prevista." };
  }
  return { difference, percentageDifference, status: "on_target",
    message: "La carga real está alineada con la carga prevista." };
}

/**
 * ACWR — Acute to Chronic Workload Ratio
 * Acute window: 7 days, Chronic window: 28 days
 * Safe zone: 0.8 – 1.3
 */
export function calculateACWR(
  acuteLoadSum: number,
  chronicLoadSum: number
): number {
  const chronicAvg = chronicLoadSum / 28;
  if (chronicAvg <= 0) return 0;
  const acuteAvg = acuteLoadSum / 7;
  return acuteAvg / chronicAvg;
}

/**
 * Training Monotony = mean / std deviation of daily loads
 * High monotony (>2) = injury risk
 */
export function calculateMonotony(dailyLoads: number[]): number {
  if (dailyLoads.length === 0) return 0;
  const sum = dailyLoads.reduce((a, b) => a + b, 0);
  const mean = sum / dailyLoads.length;
  if (mean === 0) return 0;

  const variance =
    dailyLoads.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    dailyLoads.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 0.001) return 1.0;
  return mean / stdDev;
}

/**
 * Training Strain = total workload × monotony
 */
export function calculateStrain(
  totalLoad: number,
  monotony: number
): number {
  return totalLoad * monotony;
}

/**
 * Classify ACWR into risk zones
 */
export function classifyACWR(
  acwr: number
): "undertraining" | "optimal" | "danger" | "very_high_risk" {
  if (acwr < 0.8) return "undertraining";
  if (acwr <= 1.3) return "optimal";
  if (acwr <= 1.5) return "danger";
  return "very_high_risk";
}
