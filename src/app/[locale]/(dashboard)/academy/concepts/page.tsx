"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConceptHeatmap } from "@/components/academy/ConceptHeatmap";
import { TACTICAL_CONCEPTS } from "@/lib/exercise-taxonomy";
import { GraduationCap, ArrowLeft, BarChart3, Filter } from "lucide-react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  category: string | null;
}

export default function ConceptHeatmapPage() {
  const supabase = createClient();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [period, setPeriod] = useState<"month" | "quarter" | "season">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadHeatmap();
    }
  }, [selectedTeamId, period]);

  async function loadTeams() {
    try {
      const { data, error: fetchErr } = await supabase
        .from("teams")
        .select("id, name, category")
        .order("name");

      if (fetchErr) throw fetchErr;
      setTeams(data ?? []);
      if (data && data.length > 0) {
        setSelectedTeamId(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Error al cargar los equipos.");
      setLoading(false);
    }
  }

  async function loadHeatmap() {
    try {
      setLoading(true);
      setError(null);

      // Query view for aggregated minutes
      const { data: rows, error: fetchErr } = await supabase
        .from("concept_minutes_by_week")
        .select("*")
        .eq("team_id", selectedTeamId);

      if (fetchErr) throw fetchErr;

      // Group and aggregate by period (weeks or months)
      const formatted = buildHeatmapGrid(rows ?? [], period);
      setHeatmapData(formatted);
    } catch (err: any) {
      console.error(err);
      setError("Error al calcular el mapa de calor.");
    } finally {
      setLoading(false);
    }
  }

  // Build the grid cells for all 16 taxonomy concepts
  function buildHeatmapGrid(rows: any[], currentPeriod: "month" | "quarter" | "season") {
    // Determine column headers
    const columns: { key: string; label: string; filterFn: (row: any) => boolean }[] = [];
    const today = new Date();

    if (currentPeriod === "month") {
      // 4 columns representing the last 4 calendar weeks
      for (let i = 3; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i * 7);
        const wNum = getWeekNumber(d);
        columns.push({
          key: `W-${wNum}`,
          label: `Sem ${wNum}`,
          filterFn: (row) => row.week_number === wNum,
        });
      }
    } else if (currentPeriod === "quarter") {
      // 12 columns representing the last 12 calendar weeks
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i * 7);
        const wNum = getWeekNumber(d);
        columns.push({
          key: `W-${wNum}`,
          label: `S${wNum}`,
          filterFn: (row) => row.week_number === wNum,
        });
      }
    } else {
      // Group by months in season (Aug to Jul)
      const months = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]; // Month indices (0-indexed)
      const monthLabels = ["Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"];
      
      months.forEach((mIdx, idx) => {
        columns.push({
          key: `M-${mIdx}`,
          label: monthLabels[idx],
          filterFn: (row) => {
            const date = new Date(row.week_start);
            return date.getMonth() === mIdx;
          },
        });
      });
    }

    // Now map all TACTICAL_CONCEPTS from the standard taxonomy
    return TACTICAL_CONCEPTS.map((concept) => {
      const weeksData = columns.map((col) => {
        // Find matching rows for this concept and column
        const matches = rows.filter(
          (r) => r.concept_key === concept.key && col.filterFn(r)
        );

        const totalMinutes = matches.reduce((sum, r) => sum + Number(r.total_minutes), 0);
        const sessionCount = matches.reduce((sum, r) => sum + Number(r.session_count), 0);

        return {
          week_label: col.label,
          minutes: totalMinutes,
          session_count: sessionCount,
        };
      });

      return {
        concept_key: concept.key,
        concept_label: concept.label,
        category: concept.category,
        weeks: weeksData,
      };
    });
  }

  // Helper to get ISO week number
  function getWeekNumber(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  const selectClass =
    "rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer w-full sm:w-[200px]";

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Navigation */}
      <div>
        <Link
          href="/academy"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Metodología
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 corp-icon" />
            Mapa de Calor de Conceptos
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Volumen de entrenamiento de conceptos tácticos agrupados por semanas o meses.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white/2 p-2 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-1.5 px-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros</span>
          </div>

          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className={selectClass}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-950">
                {t.name} ({t.category || "General"})
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className={selectClass}
          >
            <option value="month" className="bg-slate-950">Últimas 4 Semanas (Mes)</option>
            <option value="quarter" className="bg-slate-950">Últimas 12 Semanas (Trimestre)</option>
            <option value="season" className="bg-slate-950">Temporada Completa (Meses)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 corp-spinner" />
          <p className="text-xs text-slate-500 mt-2 font-medium">Calculando mapa de calor táctico...</p>
        </div>
      ) : heatmapData.length === 0 ? (
        <div className="text-center py-20 text-slate-500 italic text-sm">
          No hay datos de entrenamiento registrados para este equipo en el periodo seleccionado.
        </div>
      ) : (
        <div className="glass rounded-3xl p-6 border border-white/10 bg-slate-900/30">
          <ConceptHeatmap data={heatmapData} period={period} maxMinutes={period === "season" ? 400 : 120} />
        </div>
      )}
    </div>
  );
}
