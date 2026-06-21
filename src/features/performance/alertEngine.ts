/**
 * ClubLab v2026.01.01 — Alert Engine
 * Migrated from proyecto_v1 with multi-tenant support.
 *
 * Generates alerts based on player wellness and performance data.
 * All functions are pure — no side effects, no DB calls.
 */

import type { AlertType, SeverityLevel } from "@/types";

// ============================================================
// TYPES
// ============================================================

export interface AlertThresholds {
  fatigue_medium_threshold: number;
  fatigue_high_threshold: number;
  fatigue_consecutive_days: number;
  fatigue_consecutive_threshold: number;
  sleep_quality_low_threshold: number;
  sleep_quality_consecutive_days: number;
  rpe_warning_threshold: number;
  rpe_danger_threshold: number;
  weekly_load_medium_threshold: number;
  weekly_load_high_threshold: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  fatigue_medium_threshold: 4,
  fatigue_high_threshold: 5,
  fatigue_consecutive_days: 3,
  fatigue_consecutive_threshold: 4,
  sleep_quality_low_threshold: 2,
  sleep_quality_consecutive_days: 2,
  rpe_warning_threshold: 8,
  rpe_danger_threshold: 9,
  weekly_load_medium_threshold: 1800,
  weekly_load_high_threshold: 2300,
};

export type AlertResult = {
  type: AlertType;
  severity: SeverityLevel;
  message: string;
};

export type AlertEngineInput = {
  fatigue?: number | null;
  availability?: "available" | "control" | "not_available" | null;
  localizedDiscomfort?: string | null;

  rpe?: number | null;
  postFeeling?: "very_good" | "good" | "loaded" | "very_loaded" | null;
  newDiscomfort?: boolean | null;
  newDiscomfortDetail?: string | null;

  weeklyLoad?: number | null;
  acwr?: number | null;

  hasRelatedInjuryHistory?: boolean;
  relatedInjuryArea?: string | null;

  recentCheckins?: { sleep_quality: number; fatigue: number; created_at: string }[] | null;
  thresholds?: AlertThresholds | null;
};

// ============================================================
// ALERT GENERATOR
// ============================================================

export function generateAlerts(input: AlertEngineInput): AlertResult[] {
  const alerts: AlertResult[] = [];
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;
  const hasLocalizedDiscomfort = Boolean(input.localizedDiscomfort?.trim());

  // 1. Fatiga alta pre-sesión
  if (input.fatigue != null) {
    if (input.fatigue >= t.fatigue_high_threshold) {
      alerts.push({ type: "fatigue_high", severity: "high",
        message: `Jugador con fatiga extrema antes de la sesión (nivel: ${input.fatigue}).` });
    } else if (input.fatigue >= t.fatigue_medium_threshold) {
      alerts.push({ type: "fatigue_high", severity: "medium",
        message: `Jugador con fatiga elevada antes de la sesión (nivel: ${input.fatigue}).` });
    }
  }

  // 1b. Fatiga consecutiva
  if (input.recentCheckins && input.recentCheckins.length >= t.fatigue_consecutive_days) {
    const last = input.recentCheckins.slice(-t.fatigue_consecutive_days);
    if (last.every((c) => c.fatigue >= t.fatigue_consecutive_threshold)) {
      alerts.push({ type: "fatigue_high", severity: "medium",
        message: `Cansancio elevado (≥${t.fatigue_consecutive_threshold}) durante ${t.fatigue_consecutive_days} reportes consecutivos.` });
    }
  }

  // 1c. Sueño deficiente consecutivo
  if (input.recentCheckins && input.recentCheckins.length >= t.sleep_quality_consecutive_days) {
    const last = input.recentCheckins.slice(-t.sleep_quality_consecutive_days);
    if (last.every((c) => c.sleep_quality <= t.sleep_quality_low_threshold)) {
      alerts.push({ type: "fatigue_high", severity: "medium",
        message: `Calidad del sueño deficiente (≤${t.sleep_quality_low_threshold}) durante ${t.sleep_quality_consecutive_days} reportes consecutivos.` });
    }
  }

  // 2. Disponibilidad limitada
  if (input.availability === "control") {
    alerts.push({ type: "limited_availability", severity: "medium",
      message: "Jugador disponible con control. Revisar carga individual." });
  }
  if (input.availability === "not_available") {
    alerts.push({ type: "limited_availability", severity: "high",
      message: "Jugador no apto para carga normal." });
  }

  // 3. Molestia localizada pre sesión
  if (hasLocalizedDiscomfort) {
    alerts.push({ type: "localized_discomfort", severity: "medium",
      message: `Jugador reporta molestia localizada: ${input.localizedDiscomfort}.` });
  }

  // 4. Nueva molestia post sesión
  if (input.newDiscomfort) {
    alerts.push({ type: "new_discomfort", severity: "high",
      message: input.newDiscomfortDetail
        ? `Nueva molestia post sesión: ${input.newDiscomfortDetail}.`
        : "El jugador reporta una nueva molestia después de la sesión." });
  }

  // 5. Mala tolerancia post sesión (RPE)
  if (input.rpe != null) {
    const isLoaded = input.postFeeling === "loaded" || input.postFeeling === "very_loaded";
    if (input.rpe >= t.rpe_danger_threshold && input.postFeeling === "very_loaded") {
      alerts.push({ type: "poor_session_tolerance", severity: "high",
        message: `Esfuerzo extremo en sesión (RPE: ${input.rpe}) y piernas muy cargadas.` });
    } else if (input.rpe >= t.rpe_warning_threshold && isLoaded) {
      alerts.push({ type: "poor_session_tolerance", severity: "medium",
        message: `Mala tolerancia al esfuerzo (RPE: ${input.rpe}, sensación: cargada).` });
    }
  }

  // 6. Carga semanal alta
  if (input.weeklyLoad != null) {
    if (input.weeklyLoad >= t.weekly_load_high_threshold) {
      alerts.push({ type: "high_weekly_load", severity: "high",
        message: `Carga semanal acumulada muy alta (${input.weeklyLoad}).` });
    } else if (input.weeklyLoad >= t.weekly_load_medium_threshold) {
      alerts.push({ type: "high_weekly_load", severity: "medium",
        message: `Carga semanal acumulada elevada (${input.weeklyLoad}).` });
    }
  }

  // 7. Riesgo por historial lesional
  if (input.hasRelatedInjuryHistory) {
    alerts.push({ type: "injury_history_risk",
      severity: input.newDiscomfort ? "high" : "medium",
      message: input.relatedInjuryArea
        ? `Riesgo por historial lesional: ${input.relatedInjuryArea}.`
        : "Riesgo por historial lesional relacionado." });
  }

  // 8. Alerta cruzada: ACWR alto + molestia activa
  if (input.acwr != null && input.acwr > 1.3 && hasLocalizedDiscomfort) {
    alerts.push({ type: "injury_history_risk", severity: "high",
      message: `Riesgo elevado: ACWR alto (${input.acwr.toFixed(2)}) + molestia activa ("${input.localizedDiscomfort}").` });
  }

  return alerts;
}
