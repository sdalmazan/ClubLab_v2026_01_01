"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Flame,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Search,
  ChevronRight,
  User,
  Sliders,
  Sparkles,
  MapPin,
  X,
  Trash2,
  Edit3,
  GitCompare,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GpsAnalysisDashboardProps {
  onOpenImportModal: () => void;
  refreshKey?: number;
  initialSessionId?: string;
}

export function GpsAnalysisDashboard({ onOpenImportModal, refreshKey = 0, initialSessionId }: GpsAnalysisDashboardProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionDetail, setSessionDetail] = useState<{
    session: any;
    periods: any[];
    metrics: any[];
  } | null>(null);
  const [seasonStats, setSeasonStats] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPlayerDossier, setSelectedPlayerDossier] = useState<any | null>(null);

  // Session Edit State
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Player Comparison State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparePlayerIdA, setComparePlayerIdA] = useState<string>("");
  const [comparePlayerIdB, setComparePlayerIdB] = useState<string>("");

  // Sorting state
  const [sortField, setSortField] = useState<"distance_km" | "hsr_m" | "sprints_count" | "max_speed_kmh" | "player_load_min" | "played_minutes">("distance_km");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSort = (field: "distance_km" | "hsr_m" | "sprints_count" | "max_speed_kmh" | "player_load_min" | "played_minutes") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Load sessions list and season averages
  const loadSessionsData = async (targetSessionId?: string) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/performance/gps/sessions");
      const data = await res.json();

      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        setSeasonStats(data.playerSeasonStats || {});

        const activeId = targetSessionId || initialSessionId || (data.sessions.length > 0 ? data.sessions[0].id : "");
        if (activeId) {
          setSelectedSessionId(activeId);
          await loadSessionDetail(activeId);
        }
      }
    } catch (err) {
      console.error("Failed to load GPS sessions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetail = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/performance/gps/sessions?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setSessionDetail({
          session: data.session,
          periods: data.periods || [],
          metrics: data.metrics || [],
        });
      }
    } catch (err) {
      console.error("Failed to load session detail:", err);
    }
  };

  useEffect(() => {
    loadSessionsData(initialSessionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, initialSessionId]);

  const handleSessionChange = (id: string) => {
    setSelectedSessionId(id);
    loadSessionDetail(id);
    setSelectedPlayerDossier(null);
  };

  // Render Pitch Heatmap Canvas when player dossier is open
  useEffect(() => {
    if (!selectedPlayerDossier || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Minimalist pitch
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.beginPath();
    ctx.moveTo(width / 2, 10);
    ctx.lineTo(width / 2, height - 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(10, height / 2 - 50, 45, 100);
    ctx.strokeRect(width - 55, height / 2 - 50, 45, 100);

    const heatmapPoints: Array<{ x: number; y: number; value: number }> = selectedPlayerDossier.heatmap_data || [];

    heatmapPoints.forEach((pt) => {
      const posX = 10 + (pt.x / 100) * (width - 20);
      const posY = 10 + (pt.y / 100) * (height - 20);
      const radius = 22 * (pt.value || 0.5);

      const radGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, radius);
      radGrad.addColorStop(0, "rgba(225, 29, 72, 0.7)"); // Deep Crimson core
      radGrad.addColorStop(0.5, "rgba(234, 179, 8, 0.4)"); // Gold mid
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(posX, posY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Sprint Vectors (Arrows & Peak Speed)
    const sprintVectors: any[] = selectedPlayerDossier.sprint_vectors || [];
    sprintVectors.forEach((v) => {
      const sx = 10 + (v.startX / 105) * (width - 20);
      const sy = 10 + (v.startY / 68) * (height - 20);
      const ex = 10 + (v.endX / 105) * (width - 20);
      const ey = 10 + (v.endY / 68) * (height - 20);

      // Line
      ctx.strokeStyle = "rgba(56, 189, 248, 0.85)"; // Sky blue vector
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(angle - Math.PI / 6), ey - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - 8 * Math.cos(angle + Math.PI / 6), ey - 8 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Origin dot
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [selectedPlayerDossier]);

  const activeMetrics = sessionDetail?.metrics || [];
  const teamTotalDist = activeMetrics.reduce((acc, m) => acc + Number(m.distance_km || 0), 0);
  const teamAvgDist = activeMetrics.length > 0 ? (teamTotalDist / activeMetrics.length).toFixed(2) : "0";
  const teamTotalHsr = activeMetrics.reduce((acc, m) => acc + Number(m.hsr_m || 0), 0);
  const teamAvgHsr = activeMetrics.length > 0 ? (teamTotalHsr / activeMetrics.length).toFixed(0) : "0";
  const teamTotalSprints = activeMetrics.reduce((acc, m) => acc + Number(m.sprints_count || 0), 0);
  const teamAvgPlMin = activeMetrics.length > 0 ? (activeMetrics.reduce((acc, m) => acc + Number(m.player_load_min || 0), 0) / activeMetrics.length).toFixed(2) : "0";

  const filteredMetrics = activeMetrics.filter((m) => {
    const pName = m.players ? `${m.players.first_name} ${m.players.last_name}` : "Futbolista";
    return pName.toLowerCase().includes(search.toLowerCase());
  });

  const sortedMetrics = [...filteredMetrics].sort((a, b) => {
    const valA = Number(a[sortField] ?? 0);
    const valB = Number(b[sortField] ?? 0);
    return sortDirection === "desc" ? valB - valA : valA - valB;
  });

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;
    const sObj = sessions.find(s => s.id === selectedSessionId);
    const dateLabel = sObj?.session_date || "seleccionada";
    if (!confirm(`¿Estás seguro de que deseas eliminar la sesión GPS del ${dateLabel}? Esta acción borrará de forma permanente todos sus datos.`)) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/performance/gps/sessions?sessionId=${selectedSessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSessionDetail(null);
        await loadSessionsData();
      } else {
        alert(data.error || "Error al eliminar la sesión.");
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditSession = () => {
    if (!selectedSessionId) return;
    const sObj = sessionDetail?.session || sessions.find(s => s.id === selectedSessionId);
    if (sObj) {
      setEditDate(sObj.session_date || "");
      setEditNotes(sObj.notes || "");
      setIsEditingSession(true);
    }
  };

  const handleSaveEditSession = async () => {
    if (!selectedSessionId) return;
    try {
      setIsSavingEdit(true);
      const res = await fetch(`/api/performance/gps/sessions?sessionId=${selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_date: editDate, notes: editNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditingSession(false);
        await loadSessionsData(selectedSessionId);
      } else {
        alert(data.error || "Error al guardar cambios.");
      }
    } catch (err) {
      console.error("Failed to edit session:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Session Bar & CTA Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700">
            <Calendar className="size-4" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Seleccionar Partido / Sesión GPS
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="bg-slate-950 text-white font-bold text-xs rounded-xl border border-slate-800 px-3 py-1.5 focus:outline-none focus:border-slate-700 max-w-xs sm:max-w-md truncate"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_date} — {s.session_type} ({s.detection_mode}) {s.notes ? `[${s.notes}]` : ""}
                </option>
              ))}
              {sessions.length === 0 && <option value="">Sin sesiones GPS cargadas aún</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedSessionId && (
            <>
              <button
                type="button"
                onClick={handleOpenEditSession}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Editar fecha o notas de esta sesión"
              >
                <Edit3 className="size-3.5 text-sky-400" />
                <span>Editar Fecha / Notas</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSession}
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs border border-rose-800/50 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Eliminar esta sesión permanentemente"
              >
                <Trash2 className="size-3.5 text-rose-400" />
                <span>Eliminar Sesión</span>
              </button>

              {activeMetrics.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setComparePlayerIdA(activeMetrics[0]?.player_id || "");
                    setComparePlayerIdB(activeMetrics[1]?.player_id || "");
                    setIsCompareModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-xs border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <GitCompare className="size-3.5 text-emerald-400" />
                  <span>Comparar Futbolistas</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Activity className="size-4" />
            <span>+ Importar Datos GPS</span>
          </button>
        </div>
      </div>

      {/* Highlights Destacados del Partido */}
      {activeMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          {(() => {
            const topDist = [...activeMetrics].sort((a, b) => Number(b.distance_km || 0) - Number(a.distance_km || 0))[0];
            const topSpeed = [...activeMetrics].sort((a, b) => Number(b.max_speed_kmh || 0) - Number(a.max_speed_kmh || 0))[0];
            const topHsr = [...activeMetrics].sort((a, b) => Number(b.hsr_m || 0) - Number(a.hsr_m || 0))[0];

            return (
              <>
                <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-800/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-sm">🏃</div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Mayor Kilometraje</span>
                    <span className="text-xs font-bold text-white block">
                      {topDist?.players ? (topDist.players.sporting_name || `${topDist.players.first_name} ${topDist.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">{topDist?.distance_km} km</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-sm">⚡</div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">Rey del Sprint (Vel. Máx)</span>
                    <span className="text-xs font-bold text-white block">
                      {topSpeed?.players ? (topSpeed.players.sporting_name || `${topSpeed.players.first_name} ${topSpeed.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">{topSpeed?.max_speed_kmh} km/h</span>
                  </div>
                </div>

                <div className="p-3 bg-sky-950/30 rounded-xl border border-sky-800/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-sm">🔥</div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-sky-400 block">Mayor Alta Intensidad (HSR)</span>
                    <span className="text-xs font-bold text-white block">
                      {topHsr?.players ? (topHsr.players.sporting_name || `${topHsr.players.first_name} ${topHsr.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-sky-300">{topHsr?.hsr_m} m</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Tarjetas Colectivas Minimalistas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Distancia Media</span>
          <span className="text-2xl font-bold text-white font-mono">{teamAvgDist} <span className="text-xs text-slate-400">km</span></span>
          <p className="text-[10px] text-slate-500">Media plantilla</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">HSR Medio (&gt;19.8 km/h)</span>
          <span className="text-2xl font-bold text-white font-mono">{teamAvgHsr} <span className="text-xs text-slate-400">m</span></span>
          <p className="text-[10px] text-slate-500">Volumen alta intensidad</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Player Load / min</span>
          <span className="text-2xl font-bold text-white font-mono">{teamAvgPlMin} <span className="text-xs text-slate-400">PL/m</span></span>
          <p className="text-[10px] text-slate-500">Carga inercial</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sprints Totales</span>
          <span className="text-2xl font-bold text-white font-mono">{teamTotalSprints} <span className="text-xs text-slate-400">acc.</span></span>
          <p className="text-[10px] text-slate-500">Acciones &gt;25.2 km/h</p>
        </div>
      </div>


      {/* Tabla de Rendimiento Individual con Ordenación Interactivas */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-4 text-slate-400" />
              Informe de Rendimiento GPS Individual (Haz clic en los encabezados para ordenar)
            </h3>
            <span className="text-[11px] text-slate-400 block">
              Ordenado por: <strong className="text-white uppercase">{sortField.replace("_", " ")} ({sortDirection})</strong>
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar futbolista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 pl-8 pr-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950 border-b border-slate-800 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="p-3">Futbolista</th>
                <th onClick={() => handleSort("played_minutes")} className="p-3 cursor-pointer hover:text-white select-none">
                  Min. Jugados {sortField === "played_minutes" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th onClick={() => handleSort("distance_km")} className="p-3 cursor-pointer hover:text-white select-none">
                  Distancia (km) {sortField === "distance_km" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th onClick={() => handleSort("hsr_m")} className="p-3 cursor-pointer hover:text-white select-none">
                  HSR (&gt;19.8 km/h) {sortField === "hsr_m" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th onClick={() => handleSort("sprints_count")} className="p-3 cursor-pointer hover:text-white select-none">
                  Sprints (&gt;25.2 km/h) {sortField === "sprints_count" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th onClick={() => handleSort("max_speed_kmh")} className="p-3 cursor-pointer hover:text-white select-none">
                  Vel. Máx (km/h) {sortField === "max_speed_kmh" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th onClick={() => handleSort("player_load_min")} className="p-3 cursor-pointer hover:text-white select-none">
                  Player Load {sortField === "player_load_min" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
                <th className="p-3">Acc / Dec</th>
                <th className="p-3 text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedMetrics.map((m) => {
                const pName = m.players ? (m.players.sporting_name || `${m.players.first_name} ${m.players.last_name}`.trim()) : "Futbolista";
                const pNum = m.players?.jersey_number;

                const seasonStat = seasonStats[m.player_id];
                const seasonAvgDist = seasonStat?.avgDistanceKm || 0;
                const distDiff = seasonAvgDist > 0 ? (((m.distance_km - seasonAvgDist) / seasonAvgDist) * 100).toFixed(1) : 0;
                const isDistHigher = Number(distDiff) >= 0;

                const playedMin = m.played_minutes ?? 90;
                const hasCustomMin = m.player_start_min != null || m.player_end_min != null;

                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedPlayerDossier(m)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {pNum && (
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            #{pNum}
                          </span>
                        )}
                        <div>
                          <span className="font-bold text-white block">{pName}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 font-mono">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border inline-block",
                        hasCustomMin ? "bg-amber-950/40 border-amber-800/60 text-amber-300" : "bg-slate-800 border-slate-700 text-slate-300"
                      )}>
                        {playedMin}' min
                        {hasCustomMin && ` (${m.player_start_min ?? 0}' - ${m.player_end_min ?? playedMin}')`}
                      </span>
                    </td>

                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.distance_km} km</span>
                        {seasonAvgDist > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-0.5 font-sans">
                            {isDistHigher ? <TrendingUp className="size-3 text-slate-300" /> : <TrendingDown className="size-3 text-slate-400" />}
                            {isDistHigher ? `+${distDiff}%` : `${distDiff}%`}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-bold text-white">{m.hsr_m} m</span>
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-bold text-white">{m.sprints_count}</span>
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-bold text-white">{m.max_speed_kmh} km/h</span>
                    </td>

                    <td className="p-3 font-mono">
                      <span className="font-bold text-white">{m.player_load_min} PL/m</span>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      <span>+{m.accelerations} / -{m.decelerations}</span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlayerDossier(m);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors inline-flex items-center gap-1 border border-slate-700 cursor-pointer"
                      >
                        <MapPin className="size-3" />
                        <span>Ver Dossier</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dossier & Mapa de Calor 2D Minimalista */}
      {selectedPlayerDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700">
                  <User className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    Dossier GPS — {selectedPlayerDossier.players ? `${selectedPlayerDossier.players.first_name} ${selectedPlayerDossier.players.last_name}` : "Futbolista"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Análisis posicional y mapa de calor de ocupación
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerDossier(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 2D Pitch Canvas (Heatmap + Sprint Vectors) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="size-4 text-slate-400" />
                    Mapa de Calor 2D & Flechas de Sprint
                  </span>
                  {selectedPlayerDossier.sprint_vectors && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {selectedPlayerDossier.sprint_vectors.length} sprints marcados
                    </span>
                  )}
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={340}
                    height={220}
                    className="rounded-lg border border-slate-800"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />Alta densidad ocupacional</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-sky-400 inline-block" />Vector de Sprint (&gt;25.2 km/h)</span>
                </div>
              </div>

              {/* Right Column: Bloques 1-8 Funcionales */}
              <div className="lg:col-span-7 space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {/* Bloque 1: Cinemática & Carga Locomotora */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    <Zap className="size-3.5 text-amber-400" />Bloque 1: Cinemática & Bandas de Velocidad
                  </span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Distancia Relativa</span>
                      <span className="font-bold text-white">{selectedPlayerDossier.relative_distance_mmin || Math.round((Number(selectedPlayerDossier.distance_km || 0) * 1000) / 90)} m/min</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">HSR (&gt;19.8 km/h)</span>
                      <span className="font-bold text-emerald-400">{selectedPlayerDossier.hsr_m} m</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Sprint (&gt;25.2 km/h)</span>
                      <span className="font-bold text-amber-400">{selectedPlayerDossier.sprints_count} conteos</span>
                    </div>
                  </div>
                </div>

                {/* Bloque 2: Aceleraciones, Desaceleraciones & COD */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    <Activity className="size-3.5 text-rose-400" />Bloque 2: Perfil Acc / Dec & Distancia Explosiva
                  </span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Aceleraciones Altas</span>
                      <span className="font-bold text-white">+{selectedPlayerDossier.accelerations} (&gt;3 m/s²)</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Desaceleraciones Altas</span>
                      <span className="font-bold text-white">-{selectedPlayerDossier.decelerations} (&lt;-3 m/s²)</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Dist. Explosiva</span>
                      <span className="font-bold text-sky-400">{selectedPlayerDossier.explosive_distance_m || Math.round(Number(selectedPlayerDossier.distance_km || 0) * 140)} m</span>
                    </div>
                  </div>
                </div>

                {/* Bloque 3: Carga Neuromuscular & Potencia Metabólica */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    <Flame className="size-3.5 text-emerald-400" />Bloque 3 & 4: PlayerLoad™ & Potencia Metabólica
                  </span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Player Load / min</span>
                      <span className="font-bold text-white">{selectedPlayerDossier.player_load_min} PL/m</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">HMLD (&gt;25.5 W/kg)</span>
                      <span className="font-bold text-white">{selectedPlayerDossier.hmld_m || Math.round(Number(selectedPlayerDossier.distance_km || 0) * 180)} m</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Potencia Metabólica</span>
                      <span className="font-bold text-amber-400">{selectedPlayerDossier.metabolic_power_wkg || 11.2} W/kg</span>
                    </div>
                  </div>
                </div>

                {/* Bloque 6 & 8: Worst Case Scenarios & ACWR */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                    <Clock className="size-3.5 text-sky-400" />Bloque 6 & 8: Peores Escenarios (Picos) & ACWR
                  </span>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Pico 1 min (m/min)</span>
                      <span className="font-bold text-white">{selectedPlayerDossier.worst_case_scenarios?.mMin1m || 155} m/min</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Pico 3 min (m/min)</span>
                      <span className="font-bold text-white">{selectedPlayerDossier.worst_case_scenarios?.mMin3m || 135} m/min</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">ACWR EWMA</span>
                      <span className="font-bold text-emerald-400">{selectedPlayerDossier.acwr_ratio || 1.05}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlayerDossier(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
              >
                Cerrar Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR SESIÓN ── */}
      {isEditingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="size-4 text-sky-400" /> Editar Datos de Sesión
              </h3>
              <button type="button" onClick={() => setIsEditingSession(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase text-[10px] mb-1">Fecha del Partido / Sesión</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase text-[10px] mb-1">Notas / Nombre Rival</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ej. Partido vs SD Almazán"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingSession(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditSession}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingEdit ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: COMPARAR FUTBOLISTAS (JUGADOR A VS JUGADOR B) ── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <GitCompare className="size-4 text-emerald-400" /> Comparativa Directa entre Futbolistas
              </h3>
              <button type="button" onClick={() => setIsCompareModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Futbolista A</label>
                <select
                  value={comparePlayerIdA}
                  onChange={(e) => setComparePlayerIdA(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold text-xs"
                >
                  {activeMetrics.map((m) => (
                    <option key={m.player_id} value={m.player_id}>
                      {m.players ? (m.players.sporting_name || `${m.players.first_name} ${m.players.last_name}`) : "Futbolista"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-sky-400 block mb-1">Futbolista B</label>
                <select
                  value={comparePlayerIdB}
                  onChange={(e) => setComparePlayerIdB(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold text-xs"
                >
                  {activeMetrics.map((m) => (
                    <option key={m.player_id} value={m.player_id}>
                      {m.players ? (m.players.sporting_name || `${m.players.first_name} ${m.players.last_name}`) : "Futbolista"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Metrics Side by Side */}
            {(() => {
              const pA = activeMetrics.find((m) => m.player_id === comparePlayerIdA) || activeMetrics[0];
              const pB = activeMetrics.find((m) => m.player_id === comparePlayerIdB) || activeMetrics[1] || activeMetrics[0];

              if (!pA || !pB) return null;

              const pAName = pA.players ? (pA.players.sporting_name || `${pA.players.first_name} ${pA.players.last_name}`) : "Futbolista A";
              const pBName = pB.players ? (pB.players.sporting_name || `${pB.players.first_name} ${pB.players.last_name}`) : "Futbolista B";

              const compMetrics = [
                { label: "Minutos Jugados", valA: pA.played_minutes || 90, valB: pB.played_minutes || 90, unit: "min" },
                { label: "Distancia Total", valA: pA.distance_km || 0, valB: pB.distance_km || 0, unit: "km" },
                { label: "Alta Intensidad HSR (>19.8 km/h)", valA: pA.hsr_m || 0, valB: pB.hsr_m || 0, unit: "m" },
                { label: "Conteo Sprints (>25.2 km/h)", valA: pA.sprints_count || 0, valB: pB.sprints_count || 0, unit: "acc" },
                { label: "Velocidad Máxima", valA: pA.max_speed_kmh || 0, valB: pB.max_speed_kmh || 0, unit: "km/h" },
                { label: "Player Load / min", valA: pA.player_load_min || 0, valB: pB.player_load_min || 0, unit: "PL/m" },
                { label: "Aceleraciones (>3 m/s²)", valA: pA.accelerations || 0, valB: pB.accelerations || 0, unit: "acc" },
                { label: "Desaceleraciones (<-3 m/s²)", valA: pA.decelerations || 0, valB: pB.decelerations || 0, unit: "dec" },
              ];

              return (
                <div className="space-y-3 font-mono">
                  {compMetrics.map((cm, idx) => {
                    const maxVal = Math.max(0.1, cm.valA, cm.valB);
                    const pctA = Math.min(100, Math.round((cm.valA / maxVal) * 100));
                    const pctB = Math.min(100, Math.round((cm.valB / maxVal) * 100));

                    return (
                      <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex justify-between text-xs font-sans">
                          <span className="font-bold text-emerald-400">{cm.valA} {cm.unit} ({pAName})</span>
                          <span className="font-bold text-slate-300 uppercase text-[10px]">{cm.label}</span>
                          <span className="font-bold text-sky-400">{cm.valB} {cm.unit} ({pBName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden flex justify-end">
                            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pctA}%` }} />
                          </div>
                          <div className="w-px h-3 bg-slate-700 shrink-0" />
                          <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden">
                            <div className="bg-sky-400 h-full rounded-full transition-all" style={{ width: `${pctB}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
              >
                Cerrar Comparativa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
