/**
 * ClubLab v2026.01.01 — Status Engine
 * Migrated from proyecto_v1.
 *
 * Calculates the overall player status (green/yellow/red)
 * based on wellness, performance, injuries, and alerts.
 * Pure function — no side effects, no DB calls.
 */

import type { PlayerStatus } from "@/types";

// ============================================================
// TYPES
// ============================================================

export interface PlayerStatusInput {
  fatigue?: number | null;
  mood?: number | null;
  sleepQuality?: number | null;
  availability?: "available" | "control" | "not_available" | null;
  localizedDiscomfort?: string | null;

  rpe?: number | null;
  postFeeling?: "very_good" | "good" | "loaded" | "very_loaded" | null;
  newDiscomfort?: boolean | null;

  hasActiveInjury?: boolean;
  hasReadaptationInjury?: boolean;
  hasMediumAlert?: boolean;
  hasHighAlert?: boolean;
  weeklyLoad?: number | null;
}

export interface PlayerStatusResult {
  status: PlayerStatus;
  reasons: string[];
}

// ============================================================
// STATUS CALCULATOR
// ============================================================

export function calculatePlayerStatus(
  input: PlayerStatusInput
): PlayerStatusResult {
  const reasons: string[] = [];
  const hasLocalizedDiscomfort = Boolean(input.localizedDiscomfort?.trim());

  // ── RED rules ──────────────────────────────────────────────
  if (input.availability === "not_available") {
    reasons.push("Jugador marcado como no apto.");
  }
  if (input.newDiscomfort) {
    reasons.push("Molestia nueva reportada después de la sesión.");
  }
  if (input.hasActiveInjury) {
    reasons.push("Lesión activa registrada.");
  }
  if (input.hasReadaptationInjury) {
    reasons.push("Jugador en fase de readaptación.");
  }
  if (input.fatigue === 5) {
    reasons.push("Fatiga muy alta.");
  }
  if (input.rpe != null && input.rpe >= 9 && input.postFeeling === "very_loaded") {
    reasons.push("RPE muy alto y sensación post sesión muy cargada.");
  }
  if (input.hasHighAlert) {
    reasons.push("Existe una alerta abierta de severidad alta.");
  }

  if (reasons.length > 0) {
    return { status: "red", reasons };
  }

  // ── YELLOW rules ───────────────────────────────────────────
  if (input.availability === "control") {
    reasons.push("Jugador disponible con control.");
  }
  if (input.fatigue != null && input.fatigue >= 3) {
    reasons.push("Fatiga elevada.");
  }
  if (input.sleepQuality != null && input.sleepQuality <= 2) {
    reasons.push("Descanso bajo.");
  }
  if (input.mood != null && input.mood <= 2) {
    reasons.push("Ánimo bajo.");
  }
  if (hasLocalizedDiscomfort) {
    reasons.push("Molestia localizada antes de la sesión.");
  }
  if (input.rpe != null && input.rpe >= 8) {
    reasons.push("RPE alto en la última sesión.");
  }
  if (input.postFeeling === "loaded") {
    reasons.push("Sensación post sesión cargada.");
  }
  if (input.weeklyLoad != null && input.weeklyLoad >= 1800) {
    reasons.push("Carga semanal alta.");
  }
  if (input.hasMediumAlert) {
    reasons.push("Existe una alerta abierta de severidad media.");
  }

  if (reasons.length > 0) {
    return { status: "yellow", reasons };
  }

  return {
    status: "green",
    reasons: ["Sin alertas relevantes. Puede entrenar normal."],
  };
}
