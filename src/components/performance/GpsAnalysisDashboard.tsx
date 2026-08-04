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
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GpsAnalysisDashboardProps {
  onOpenImportModal: () => void;
}

export function GpsAnalysisDashboard({ onOpenImportModal }: GpsAnalysisDashboardProps) {
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load sessions list and season averages
  const loadSessionsData = async (targetSessionId?: string) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/performance/gps/sessions");
      const data = await res.json();

      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        setSeasonStats(data.playerSeasonStats || {});

        const activeId = targetSessionId || (data.sessions.length > 0 ? data.sessions[0].id : "");
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
    loadSessionsData();
  }, []);

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

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Session Bar & CTA Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
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
              className="bg-slate-950 text-white font-bold text-xs rounded-xl border border-slate-800 px-3 py-1.5 focus:outline-none focus:border-slate-700"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_date} — {s.session_type} ({s.detection_mode})
                </option>
              ))}
              {sessions.length === 0 && <option value="">Sin sesiones GPS cargadas aún</option>}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenImportModal}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Activity className="size-4" />
          <span>+ Importar Datos GPS</span>
        </button>
      </div>

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

      {/* Periodos Trimmer Engine */}
      {sessionDetail?.periods && sessionDetail.periods.length > 0 && (
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="size-4 text-slate-400" />
            Periodos Delimitados por Trimmer Engine:
          </span>
          <div className="flex flex-wrap gap-2">
            {sessionDetail.periods.map((p, i) => (
              <div key={i} className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono flex items-center gap-2">
                <span className="font-bold text-white">{p.period_name}</span>
                <span className="text-slate-400 text-[10px]">({p.t_start} - {p.t_end} | {p.duration_min} min)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de Rendimiento Individual Minimalista */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="size-4 text-slate-400" />
            Rendimiento GPS Individual vs. Media de la Temporada
          </h3>
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
                <th className="p-3">Distancia (km)</th>
                <th className="p-3">HSR (&gt;19.8 km/h)</th>
                <th className="p-3">Sprints (&gt;25.2 km/h)</th>
                <th className="p-3">Vel. Máx (km/h)</th>
                <th className="p-3">Player Load</th>
                <th className="p-3">Acc / Dec</th>
                <th className="p-3 text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMetrics.map((m) => {
                const pName = m.players ? (m.players.sporting_name || `${m.players.first_name} ${m.players.last_name}`.trim()) : "Futbolista";
                const pNum = m.players?.jersey_number;

                const seasonStat = seasonStats[m.player_id];
                const seasonAvgDist = seasonStat?.avgDistanceKm || 0;
                const distDiff = seasonAvgDist > 0 ? (((m.distance_km - seasonAvgDist) / seasonAvgDist) * 100).toFixed(1) : 0;
                const isDistHigher = Number(distDiff) >= 0;

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
                        <span className="font-bold text-white block">{pName}</span>
                      </div>
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

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-2">
                  <MapPin className="size-4 text-slate-400" />
                  Mapa de Calor Posicional 2D
                </span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={340}
                    height={220}
                    className="rounded-lg border border-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Resumen de Variables Locomotoras
                </span>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Distancia Total</span>
                    <span className="font-bold text-white">{selectedPlayerDossier.distance_km} km</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">HSR (&gt;19.8 km/h)</span>
                    <span className="font-bold text-white">{selectedPlayerDossier.hsr_m} m</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Sprints (&gt;25.2 km/h)</span>
                    <span className="font-bold text-white">{selectedPlayerDossier.sprints_count}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Vel. Máxima</span>
                    <span className="font-bold text-white">{selectedPlayerDossier.max_speed_kmh} km/h</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Player Load / min</span>
                    <span className="font-bold text-white">{selectedPlayerDossier.player_load_min}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">Acc. / Dec.</span>
                    <span className="font-bold text-white">+{selectedPlayerDossier.accelerations} / -{selectedPlayerDossier.decelerations}</span>
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
    </div>
  );
}
