"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TACTICAL_CONCEPTS } from "@/lib/exercise-taxonomy";

interface HeatmapCell {
  concept_key: string;
  concept_label: string;
  category: string;
  weeks: Array<{
    week_label: string; // e.g. "Sem 1", "Sem 2", "Ene", "Feb"
    minutes: number;
    session_count: number;
  }>;
}

interface ConceptHeatmapProps {
  data: HeatmapCell[];
  period: "month" | "quarter" | "season";
  maxMinutes?: number;
}

// Group concepts by category
const CATEGORIES = ["Fase Ofensiva", "Fase Defensiva", "Transición A-D", "Transición D-A", "ABP"];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Fase Ofensiva": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Fase Defensiva": { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  "Transición A-D": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  "Transición D-A": { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  "ABP": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
};

export function ConceptHeatmap({ data, period, maxMinutes = 180 }: ConceptHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    concept: string;
    week: string;
    minutes: number;
    sessions: number;
    x: number;
    y: number;
  } | null>(null);

  // Get unique week labels from first data element to draw column headers
  const weekLabels = data[0]?.weeks.map((w) => w.week_label) ?? [];

  // Helper to determine cell color intensity
  const getCellColor = (minutes: number) => {
    if (minutes === 0) return "bg-white/2 hover:bg-white/5 border border-white/5";
    const ratio = minutes / maxMinutes;
    if (ratio < 0.2) return "bg-emerald-950/40 text-emerald-300 border border-emerald-950/60";
    if (ratio < 0.4) return "bg-emerald-900/50 text-emerald-200 border border-emerald-900/70";
    if (ratio < 0.7) return "bg-emerald-700/60 text-emerald-100 border border-emerald-700/80";
    if (ratio < 1.0) return "bg-emerald-500/75 text-white border border-emerald-500/90";
    return "bg-emerald-400 text-slate-950 font-bold border border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)] animate-pulse";
  };

  return (
    <div className="relative space-y-6">
      {/* Heatmap Grid container with horizontal scroll support */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[240px]">
                Concepto Táctico
              </th>
              {weekLabels.map((label) => (
                <th
                  key={label}
                  className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[50px]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {CATEGORIES.map((category) => {
              const categoryRows = data.filter((row) => row.category === category);
              if (categoryRows.length === 0) return null;

              const style = CATEGORY_COLORS[category] ?? { bg: "bg-white/5", text: "text-white", border: "border-white/5" };

              return (
                <optgroup key={category} label={category} className="contents">
                  {/* Category separator row */}
                  <tr>
                    <td
                      colSpan={weekLabels.length + 1}
                      className={cn("p-2 text-[10px] font-extrabold uppercase tracking-widest pl-3 border-y border-white/5", style.bg, style.text)}
                    >
                      {category}
                    </td>
                  </tr>

                  {categoryRows.map((row) => (
                    <tr key={row.concept_key} className="hover:bg-white/[0.01] transition-all">
                      <td className="p-2 pl-6 text-xs text-slate-300 font-semibold truncate max-w-[240px]">
                        {row.concept_label}
                      </td>
                      {row.weeks.map((w, wIdx) => {
                        const cellColor = getCellColor(w.minutes);
                        return (
                          <td
                            key={wIdx}
                            className="p-1"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredCell({
                                concept: row.concept_label,
                                week: w.week_label,
                                minutes: w.minutes,
                                sessions: w.session_count,
                                x: rect.left + window.scrollX + rect.width / 2,
                                y: rect.top + window.scrollY - 10,
                              });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <div
                              className={cn(
                                "h-10 rounded-lg flex items-center justify-center text-xs font-semibold transition-all cursor-pointer select-none",
                                cellColor
                              )}
                            >
                              {w.minutes > 0 ? `${w.minutes}'` : "-"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </optgroup>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-4 justify-end text-[10px] text-slate-500 font-bold uppercase tracking-wider pr-2">
        <span>Leyenda:</span>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-8 rounded bg-white/2 border border-white/5 flex items-center justify-center text-[8px] font-medium text-slate-650">0'</div>
          <div className="h-4 w-8 rounded bg-emerald-950/40 border border-emerald-950/60 text-emerald-300 flex items-center justify-center text-[8px] font-medium">1-30'</div>
          <div className="h-4 w-8 rounded bg-emerald-900/50 border border-emerald-900/70 text-emerald-250 flex items-center justify-center text-[8px] font-medium">30-60'</div>
          <div className="h-4 w-8 rounded bg-emerald-700/60 border border-emerald-700/80 text-emerald-150 flex items-center justify-center text-[8px] font-medium">60-120'</div>
          <div className="h-4 w-8 rounded bg-emerald-500/75 border border-emerald-500/90 text-white flex items-center justify-center text-[8px] font-medium">120-180'</div>
          <div className="h-4 w-8 rounded bg-emerald-400 border border-emerald-300 text-slate-950 flex items-center justify-center text-[8px] font-black shadow-md shadow-emerald-500/10">&gt;180'</div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          className="absolute z-50 pointer-events-none bg-slate-950/95 border border-white/15 rounded-xl p-3 shadow-2xl animate-fade-in text-xs min-w-[160px] flex flex-col gap-1.5"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
            transform: "translate(-50%, -100%)",
            position: "fixed",
          }}
        >
          <span className="font-extrabold text-white block border-b border-white/5 pb-1">
            {hoveredCell.concept}
          </span>
          <div className="space-y-1">
            <p className="text-slate-450 text-[10px]">
              Periodo: <span className="text-slate-205 font-bold">{hoveredCell.week}</span>
            </p>
            <p className="text-slate-450 text-[10px]">
              Tiempo total: <span className="text-emerald-400 font-extrabold">{hoveredCell.minutes} minutos</span>
            </p>
            <p className="text-slate-455 text-[10px]">
              Sesiones: <span className="text-sky-400 font-extrabold">{hoveredCell.sessions} entrenamientos</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
