import React from "react";
import { Sparkles, AlertCircle, Award, CheckCircle, User } from "lucide-react";
import { InsightsEngine } from "@/features/analysis/insights/core";
import { EntityType } from "@/features/analysis/types";

interface InsightsCardProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  metrics: Record<string, number | string>;
  onPlayerClick?: (playerName: string) => void;
}

/**
 * InsightsCard Component.
 * Displays dynamic rule-based performance insights (strengths, dependencies, risks).
 * Clicking on the analyzed player name opens their profile.
 */
export const InsightsCard: React.FC<InsightsCardProps> = ({
  entityType,
  entityId,
  entityName,
  metrics,
  onPlayerClick,
}) => {
  const insights = InsightsEngine.generateInsights(entityType, entityId, metrics);

  // Helper for priority styling
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "high":
        return {
          bg: "bg-red-500/10 border-red-500/30",
          text: "text-red-400",
          badge: "bg-red-500/20 text-red-400 border-red-500/35",
          icon: <AlertCircle className="h-4 w-4 text-red-400" />,
        };
      case "medium":
        return {
          bg: "bg-amber-500/10 border-amber-500/30",
          text: "text-amber-400",
          badge: "bg-amber-500/20 text-amber-400 border-amber-500/35",
          icon: <Award className="h-4 w-4 text-amber-400" />,
        };
      default:
        return {
          bg: "bg-slate-800/20 border-slate-800",
          text: "text-slate-400",
          badge: "bg-slate-800 text-slate-400 border-slate-700/60",
          icon: <CheckCircle className="h-4 w-4 text-slate-400" />,
        };
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Insights & Diagnósticos</h3>
            <p className="text-xxs text-slate-500">Heurísticas de rendimiento basadas en datos de actas</p>
          </div>
        </div>
      </div>

      {entityType === "player" && onPlayerClick && entityName && (
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/30 px-3.5 py-2.5 text-xs text-slate-400">
          <User className="h-4 w-4 text-primary shrink-0" />
          <span>Jugador analizado:</span>
          <span
            onClick={() => onPlayerClick(entityName)}
            className="text-primary font-bold hover:underline cursor-pointer transition-all"
            title="Abrir ficha de jugador"
          >
            {entityName}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {insights.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-2 pl-2">
            No se han generado diagnósticos adicionales para el primer registro.
          </div>
        ) : (
          insights.map((insight: any) => {
            const styles = getPriorityStyles(insight.priority);

            return (
              <div
                key={insight.id}
                className={`flex flex-col gap-2 rounded-xl border p-4 transition-all ${styles.bg}`}
              >
                {/* Insight Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {styles.icon}
                    <span className="text-sm font-bold text-white">{insight.summary}</span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xxs font-extrabold uppercase tracking-wide shrink-0 ${styles.badge}`}>
                    {insight.priority === "high" ? "Prioritario" : insight.priority === "medium" ? "Medio" : "Informativo"}
                  </span>
                </div>

                {/* Detail description */}
                <p className="text-xs text-slate-300 leading-relaxed pl-6">
                  {insight.details}
                </p>

                {/* Associated metrics tags */}
                <div className="flex flex-wrap gap-1.5 pl-6 mt-1">
                  {insight.relatedMetrics.map((mId: string) => (
                    <span key={mId} className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-xxs font-mono text-slate-400">
                      #{mId}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default InsightsCard;
