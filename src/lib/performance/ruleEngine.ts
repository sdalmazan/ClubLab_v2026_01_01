/**
 * ClubLab v2026.01.01 — Recommendation Engine (Rule-Based Provider)
 * Deterministic engine for evaluating performance rules & generating recommendations.
 * Prepared for future AI Provider integration via IRecommendationEngine interface.
 */

import type {
  PerformanceRule,
  PerformanceThresholds,
  PerformanceRecommendation,
  PlayerPerformanceState,
  RuleCondition,
  RuleAction
} from "@/types/performance";

export interface PlayerEvaluationContext {
  organizationId: string;
  playerId: string;
  playerName: string;
  playerState: PlayerPerformanceState;
  wellnessScore?: number; // 0 to 25
  sleepQuality?: number;  // 1 to 5
  sorenessLevel?: number; // 1 to 5
  rpeLastSession?: number;// 1 to 10
  rpePlannedLastSession?: number;
  acwrRatio?: number;     // e.g. 1.42
  minutesLast7Days?: number;
  cmjDropPct?: number;
}

export interface IRecommendationEngine {
  evaluatePlayer(context: PlayerEvaluationContext, customRules?: PerformanceRule[], thresholds?: PerformanceThresholds): PerformanceRecommendation[];
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  id: "default-thresholds",
  organization_id: "default",
  wellness_warning_score: 14,
  wellness_critical_score: 11,
  soreness_critical_level: 4,
  acwr_warning_ratio: 1.30,
  acwr_critical_ratio: 1.45,
  max_minutes_7days: 270,
  max_minutes_14days: 480,
  is_gps_enabled: true,
};

export const DEFAULT_PERFORMANCE_RULES: PerformanceRule[] = [
  {
    id: "rule-r01",
    organization_id: "default",
    code: "R-01",
    name: "Restricción de Sprint en Return to Play",
    description: "Prohíbe tareas de sprint a alta velocidad (>25 km/h) para jugadores en proceso de reinserción.",
    category: "rtp",
    priority: 1,
    is_enabled: true,
    logical_operator: "AND",
    conditions: [
      { metric: "player_state", operator: "==", value: "return_to_play" }
    ],
    actions: [
      {
        type: "modify_session_task",
        target: "physical_coach",
        payload: {
          task_modification: "Excluir al jugador de tareas con carreras continuas a máxima velocidad (>25km/h). Asignar rutina preventiva de carrera controlada.",
        }
      }
    ]
  },
  {
    id: "rule-r02",
    organization_id: "default",
    code: "R-02",
    name: "Reducción de Carga por Wellness Crítico & Dolor Muscular",
    description: "Activa protocolo de recuperación activa cuando el wellness es muy bajo y el dolor muscular es elevado.",
    category: "wellness",
    priority: 1,
    is_enabled: true,
    logical_operator: "AND",
    conditions: [
      { metric: "wellness_score", operator: "<=", value: 12 },
      { metric: "soreness_level", operator: ">=", value: 4 }
    ],
    actions: [
      {
        type: "change_player_state",
        target: "player",
        payload: { new_state: "reduced_load" }
      },
      {
        type: "assign_routine",
        target: "physical_coach",
        payload: {
          routine_id: "recovery-active-01",
          alert_message: "Wellness crítico (<=12) con dolor muscular alto (>=4). Asignar rutina de movilidad + foam roller."
        }
      }
    ]
  },
  {
    id: "rule-r03",
    organization_id: "default",
    code: "R-03",
    name: "Alerta por Exceso de Minutos Competitivos en 7 Días",
    description: "Supervisión de jugadores con más de 270 minutos jugados en la última semana.",
    category: "carga",
    priority: 2,
    is_enabled: true,
    logical_operator: "AND",
    conditions: [
      { metric: "minutes_last_7days", operator: ">", value: 270 }
    ],
    actions: [
      {
        type: "create_alert",
        target: "head_coach",
        payload: {
          alert_message: "Acumulación de alta carga competitiva (>270 min en 7 días). Considerar rotación o reducción de dosis en entrenamiento."
        }
      }
    ]
  },
  {
    id: "rule-r04",
    organization_id: "default",
    code: "R-04",
    name: "Aviso de Spike de Carga (ACWR > 1.45)",
    description: "Alerta de desproporción entre carga aguda y crónica con riesgo de sobrecarga.",
    category: "carga",
    priority: 1,
    is_enabled: true,
    logical_operator: "AND",
    conditions: [
      { metric: "acwr_ratio", operator: ">=", value: 1.45 }
    ],
    actions: [
      {
        type: "change_player_state",
        target: "player",
        payload: { new_state: "reduced_load" }
      },
      {
        type: "create_alert",
        target: "physical_coach",
        payload: {
          alert_message: "ACWR Ratio en zona de Spike (>=1.45). Reducir volumen de la sesión principal en un 30%."
        }
      }
    ]
  },
  {
    id: "rule-r05",
    organization_id: "default",
    code: "R-05",
    name: "Monitoreo por Caída Neuromuscular CMJ",
    description: "Detecta pérdidas de salto vertical superior al 12% respecto al valor base del jugador.",
    category: "testing",
    priority: 2,
    is_enabled: true,
    logical_operator: "AND",
    conditions: [
      { metric: "cmj_drop_pct", operator: ">=", value: 12 }
    ],
    actions: [
      {
        type: "change_player_state",
        target: "player",
        payload: { new_state: "monitor" }
      },
      {
        type: "notify_staff",
        target: "physical_coach",
        payload: {
          alert_message: "Caída neuromuscular en CMJ >= 12%. Eximir de ejercicios de alta reactividad/pleometría."
        }
      }
    ]
  }
];

export class RuleEngineProvider implements IRecommendationEngine {
  evaluatePlayer(
    context: PlayerEvaluationContext,
    customRules: PerformanceRule[] = DEFAULT_PERFORMANCE_RULES,
    thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];
    const activeRules = customRules.filter(r => r.is_enabled);

    for (const rule of activeRules) {
      const triggered = this.evaluateConditions(context, rule.conditions, rule.logical_operator, thresholds);

      if (triggered) {
        const reasons = this.buildReasonStrings(context, rule.conditions, thresholds);

        recommendations.push({
          id: `rec-${rule.code}-${context.playerId}-${Date.now()}`,
          organization_id: context.organizationId,
          player_id: context.playerId,
          player_name: context.playerName,
          triggered_rule_id: rule.id,
          rule_code: rule.code,
          rule_name: rule.name,
          reasons,
          actions: rule.actions,
          status: "pending",
          created_at: new Date().toISOString(),
        });
      }
    }

    return recommendations;
  }

  private evaluateConditions(
    context: PlayerEvaluationContext,
    conditions: RuleCondition[],
    operator: "AND" | "OR",
    thresholds: PerformanceThresholds
  ): boolean {
    if (conditions.length === 0) return false;

    const results = conditions.map(cond => {
      let actualValue: number | string | undefined;

      switch (cond.metric) {
        case "wellness_score":
          actualValue = context.wellnessScore;
          break;
        case "soreness_level":
          actualValue = context.sorenessLevel;
          break;
        case "sleep_quality":
          actualValue = context.sleepQuality;
          break;
        case "rpe_last_session":
          actualValue = context.rpeLastSession;
          break;
        case "acwr_ratio":
          actualValue = context.acwrRatio;
          break;
        case "minutes_last_7days":
          actualValue = context.minutesLast7Days;
          break;
        case "player_state":
          actualValue = context.playerState;
          break;
        case "cmj_drop_pct":
          actualValue = context.cmjDropPct;
          break;
      }

      if (actualValue === undefined) return false;
      return this.compare(actualValue, cond.operator, cond.value);
    });

    return operator === "AND" ? results.every(Boolean) : results.some(Boolean);
  }

  private compare(actual: number | string, operator: string, target: number | string): boolean {
    if (typeof actual === "number" && typeof target === "number") {
      switch (operator) {
        case "<": return actual < target;
        case "<=": return actual <= target;
        case ">": return actual > target;
        case ">=": return actual >= target;
        case "==": return actual === target;
        case "!=": return actual !== target;
        default: return false;
      }
    }
    switch (operator) {
      case "==": return String(actual) === String(target);
      case "!=": return String(actual) !== String(target);
      default: return false;
    }
  }

  private buildReasonStrings(
    context: PlayerEvaluationContext,
    conditions: RuleCondition[],
    thresholds: PerformanceThresholds
  ): string[] {
    return conditions.map(c => {
      switch (c.metric) {
        case "wellness_score":
          return `Wellness Bajo (${context.wellnessScore ?? "N/D"} / 25)`;
        case "soreness_level":
          return `Dolor Muscular Elevado (${context.sorenessLevel ?? "N/D"} / 5)`;
        case "acwr_ratio":
          return `ACWR en zona de riesgo (${context.acwrRatio ?? "N/D"})`;
        case "minutes_last_7days":
          return `Minutos 7 Días Acumulados (${context.minutesLast7Days ?? "N/D"} min > ${thresholds.max_minutes_7days} min umbral)`;
        case "player_state":
          return `Estado actual del jugador: ${context.playerState}`;
        case "cmj_drop_pct":
          return `Caída en test CMJ (${context.cmjDropPct ?? "N/D"}%)`;
        default:
          return `Condición detectada: ${c.metric} ${c.operator} ${c.value}`;
      }
    });
  }
}
