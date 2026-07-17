import { EntityInsight, EntityType } from "../types";

/**
 * InsightsEngine — The core intelligence placeholder of the Analysis Framework.
 * Resolves rule-based patterns on calculated metrics to return structured insights,
 * and formats prompt templates prepared for future Large Language Model (Gemini/OpenAI) queries.
 */
export class InsightsEngine {
  /**
   * Generates analytical insights for a given entity based on calculated metric values.
   */
  static generateInsights(
    entityType: EntityType,
    entityId: string,
    metrics: Record<string, number | string>
  ): EntityInsight[] {
    const insights: EntityInsight[] = [];
    const entityName = entityId.split("|")[0];

    if (entityType === "player") {
      const goals90 = Number(metrics.goals90 || 0);
      const dependency = Number(metrics.dependency || 0);
      const impact = Number(metrics.impact || 0);

      // Rule: High scoring efficiency
      if (goals90 > 0.5) {
        insights.push({
          id: `player_high_scorer_${entityId}`,
          priority: "high",
          category: "attack",
          summary: `Excelente promedio goleador de ${entityName}`,
          details: `${entityName} promedia ${goals90} goles por cada 90 minutos de juego, situándose entre los atacantes más resolutivos del grupo.`,
          relatedMetrics: ["goals", "goals90"],
          promptTemplate: `Analiza las condiciones tácticas que permiten a ${entityName} promediar ${goals90} goles por 90 minutos. Sugiere movimientos ofensivos para maximizar este promedio.`,
        });
      }

      // Rule: Goal dependency
      if (dependency > 30) {
        insights.push({
          id: `player_goal_dependency_${entityId}`,
          priority: "medium",
          category: "scouting",
          summary: `Elevada dependencia goleadora en ${entityName}`,
          details: `El equipo anota el ${dependency}% de sus goles totales a través de ${entityName}. Si es neutralizado, el caudal ofensivo del club se reduce críticamente.`,
          relatedMetrics: ["goals", "dependency"],
          promptTemplate: `El equipo tiene un ${dependency}% de dependencia goleadora en ${entityName}. Sugiere alternativas tácticas de finalización para distribuir el gol en otros jugadores.`,
        });
      }

      // Rule: Impact
      if (impact > 5) {
        insights.push({
          id: `player_positive_impact_${entityId}`,
          priority: "high",
          category: "dynamics",
          summary: `Gran influencia en el marcador (+/-)`,
          details: `Mientras ${entityName} está en el campo, el balance de goles de su equipo es de +${impact}. Su presencia aporta estabilidad defensiva o empuje ofensivo clave.`,
          relatedMetrics: ["impact", "minutes"],
          promptTemplate: `¿Por qué el equipo rinde mejor (+${impact} de diferencial de goles) con ${entityName} en el terreno de juego? Detalla su posible influencia en el ritmo o colocación.`,
        });
      }
    } else if (entityType === "team") {
      const attack = Number(metrics.attackIndex || 0);
      const defense = Number(metrics.defenseIndex || 0);
      const resilience = Number(metrics.resilience || 0);

      // Rule: High attack index
      if (attack > 1.8) {
        insights.push({
          id: `team_high_attack_${entityId}`,
          priority: "high",
          category: "attack",
          summary: "Ataque altamente efectivo",
          details: `El equipo promedia ${attack} goles por partido. Demuestra una gran capacidad de asociación en el último tercio y efectividad de cara a puerta.`,
          relatedMetrics: ["attackIndex"],
          promptTemplate: `El equipo tiene un promedio de ${attack} goles por partido. Analiza sus patrones ofensivos más probables.`,
        });
      }

      // Rule: Poor resilience
      if (resilience < 20 && resilience > 0) {
        insights.push({
          id: `team_low_resilience_${entityId}`,
          priority: "high",
          category: "dynamics",
          summary: "Problemas de remontada / Reacción anímica",
          details: `Solo rescata un ${resilience}% de los puntos tras encajar el primer gol. Le cuesta reponerse a los golpes iniciales y suele acusar la desventaja en el marcador.`,
          relatedMetrics: ["resilience"],
          promptTemplate: `El rival tiene un índice de resiliencia del ${resilience}%. Propón un plan de partido enfocado en golpear primero para forzar su frustración táctica.`,
        });
      }
    } else if (entityType === "coach") {
      const irc = Number(metrics.rotationIndex || 0);
      const bench = Number(metrics.benchUsage || 0);
      const reaction = Number(metrics.reactionTime || 0);

      // Rule: Conservative substitutions reaction
      if (reaction > 65) {
        insights.push({
          id: `coach_slow_reaction_${entityId}`,
          priority: "medium",
          category: "coach",
          summary: "Ventana de reacción tardía",
          details: `El entrenador tarda un promedio de ${reaction} minutos en realizar su primera sustitución. Suele mantener el plan inicial y no reacciona rápido a las variaciones del encuentro.`,
          relatedMetrics: ["reactionTime", "benchUsage"],
          promptTemplate: `El entrenador rival promedia ${reaction}' para su primer cambio. Diseña tácticas para sorprenderle al inicio de la segunda mitad (minuto 45-60) antes de su ventana de cambio.`,
        });
      }
    }

    // Default fallback insight if nothing matched
    if (insights.length === 0) {
      insights.push({
        id: `default_insight_${entityId}`,
        priority: "low",
        category: "general",
        summary: `Perfil regular detectado para ${entityName}`,
        details: `Las métricas analizadas se sitúan en rangos normales de consistencia. No se aprecian anomalías tácticas ni picos de rendimiento crítico.`,
        relatedMetrics: Object.keys(metrics).slice(0, 3),
        promptTemplate: `Genera un resumen general de rendimiento para ${entityName} basándote en su perfil medio actual.`,
      });
    }

    return insights;
  }
}
