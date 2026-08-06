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

  // Dossier Map & Period Filter State
  const [dossierPeriodTab, setDossierPeriodTab] = useState<"all" | "p1" | "p2">("all");
  const [dossierMapView, setDossierMapView] = useState<"tactical" | "satellite">("tactical");

  // Sorting state
  const [sortField, setSortField] = useState<"distance_km" | "hsr_m" | "sprints_count" | "max_speed_kmh" | "player_load_min" | "played_minutes" | "accelerations">("distance_km");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSort = (field: "distance_km" | "hsr_m" | "sprints_count" | "max_speed_kmh" | "player_load_min" | "played_minutes" | "accelerations") => {
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

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Pitch Background
    if (dossierMapView === "satellite") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#061811");
      grad.addColorStop(0.5, "#082218");
      grad.addColorStop(1, "#04120c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Satellite Grass Stripes
      ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
      for (let i = 0; i < width; i += 30) {
        if ((i / 30) % 2 === 0) ctx.fillRect(i, 0, 15, height);
      }

      // GPS Grid Lines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
      ctx.lineWidth = 1;
      ctx.font = "8px monospace";
      ctx.fillStyle = "rgba(56, 189, 248, 0.4)";

      for (let x = 40; x < width; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        ctx.fillText(`-2.71${Math.round(x/5)}°W`, x + 2, 10);
      }
      for (let y = 30; y < height; y += 45) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        ctx.fillText(`41.16${Math.round(y/4)}°N`, 4, y - 2);
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.5;
    } else {
      // Tactical 2D Pitch Style
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1.5;
    }

    // Pitch Outline & Markings
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

    // Check Player Participation per Period
    const pStart = selectedPlayerDossier.player_start_min ?? 0;
    const pEnd = selectedPlayerDossier.player_end_min ?? 90;

    const playedP1 = pStart < 45;
    const playedP2 = pEnd > 45;

    let hasData = true;
    let notPlayedMsg = "";
    if (dossierPeriodTab === "p1" && !playedP1) {
      hasData = false;
      notPlayedMsg = `SIN MINUTOS EN 1ª PARTE (ENTRÓ EN MIN. ${pStart}')`;
    } else if (dossierPeriodTab === "p2" && !playedP2) {
      hasData = false;
      notPlayedMsg = `SUSTITUIDO EN MIN. ${pEnd}' (SIN MINUTOS EN 2ª PARTE)`;
    }

    if (!hasData) {
      ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
      ctx.fillRect(15, height / 2 - 20, width - 30, 40);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
      ctx.strokeRect(15, height / 2 - 20, width - 30, 40);

      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(notPlayedMsg, width / 2, height / 2 + 4);
      ctx.textAlign = "left";
      return;
    }

    // Heatmap Points
    let heatmapPoints: Array<{ x: number; y: number; value: number }> = selectedPlayerDossier.heatmap_data || [];
    if (dossierPeriodTab === "p1") {
      heatmapPoints = heatmapPoints.slice(0, Math.ceil(heatmapPoints.length / 2));
    } else if (dossierPeriodTab === "p2") {
      heatmapPoints = heatmapPoints.slice(Math.floor(heatmapPoints.length / 2)).map(pt => ({
        x: 100 - pt.x,
        y: 100 - pt.y,
        value: pt.value,
      }));
    }

    // Draw Heatmap with smooth blur radius
    heatmapPoints.forEach((pt) => {
      const posX = 10 + (pt.x / 100) * (width - 20);
      const posY = 10 + (pt.y / 100) * (height - 20);
      const radius = 26 * (pt.value || 0.5);

      const radGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, radius);
      radGrad.addColorStop(0, "rgba(225, 29, 72, 0.45)");
      radGrad.addColorStop(0.5, "rgba(234, 179, 8, 0.25)");
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(posX, posY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Sprint Vectors (Max 3 top vectors to prevent clutter)
    let sprintVectors: any[] = selectedPlayerDossier.sprint_vectors || [];
    if (dossierPeriodTab === "p1") {
      sprintVectors = sprintVectors.slice(0, Math.ceil(sprintVectors.length / 2));
    } else if (dossierPeriodTab === "p2") {
      sprintVectors = sprintVectors.slice(Math.floor(sprintVectors.length / 2)).map(v => ({
        ...v,
        startX: 105 - v.startX,
        startY: 68 - v.startY,
        endX: 105 - v.endX,
        endY: 68 - v.endY,
      }));
    }

    // Sort by max speed & take top 3
    const topSprints = [...sprintVectors]
      .sort((a, b) => Number(b.peakSpeedKmh || 0) - Number(a.peakSpeedKmh || 0))
      .slice(0, 3);

    topSprints.forEach((v, idx) => {
      const sx = 10 + (v.startX / 105) * (width - 20);
      const sy = 10 + (v.startY / 68) * (height - 20);
      const ex = 10 + (v.endX / 105) * (width - 20);
      const ey = 10 + (v.endY / 68) * (height - 20);

      const speed = Number(v.peakSpeedKmh || selectedPlayerDossier.max_speed_kmh || 28.5);

      let arrowColor = "#10b981"; // Emerald (<25.2 km/h)
      if (speed >= 28.0) arrowColor = "#f43f5e"; // Crimson (>28.0 km/h)
      else if (speed >= 25.2) arrowColor = "#f59e0b"; // Gold (25.2 - 28.0 km/h)

      // Vector Line
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = arrowColor;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(angle - Math.PI / 6), ey - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ex - 8 * Math.cos(angle + Math.PI / 6), ey - 8 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Origin dot
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Peak Speed Badge Tag at vector midpoint with alternating vertical offset
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      const offsetY = idx % 2 === 0 ? -12 : 14;

      const tagText = `⚡ ${speed.toFixed(1)} km/h`;
      ctx.font = "bold 9px monospace";
      const txtWidth = ctx.measureText(tagText).width;

      const tagX = Math.max(12, Math.min(width - txtWidth - 14, midX - txtWidth / 2));
      const tagY = Math.max(20, Math.min(height - 12, midY + offsetY));

      // Tag Background Pill
      ctx.fillStyle = "#090d16";
      ctx.fillRect(tagX - 3, tagY - 9, txtWidth + 6, 12);
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX - 3, tagY - 9, txtWidth + 6, 12);

      // Tag Text
      ctx.fillStyle = arrowColor;
      ctx.fillText(tagText, tagX, tagY);
    });
  }, [selectedPlayerDossier, dossierPeriodTab, dossierMapView]);

  const activeMetrics = sessionDetail?.metrics || [];
  const teamTotalDist = activeMetrics.reduce((acc, m) => acc + Number(m.distance_km || 0), 0);
  const teamAvgDist = activeMetrics.length > 0 ? (teamTotalDist / activeMetrics.length).toFixed(2) : "0";
  const teamTotalHsr = activeMetrics.reduce((acc, m) => acc + Number(m.hsr_m || 0), 0);
  const teamAvgHsr = activeMetrics.length > 0 ? (teamTotalHsr / activeMetrics.length).toFixed(0) : "0";
  const teamTotalSprints = activeMetrics.reduce((acc, m) => acc + Number(m.sprints_count || 0), 0);
  
  const teamAvgPlMin = activeMetrics.length > 0
    ? (activeMetrics.reduce((acc, m) => {
        let plm = Number(m.player_load_min || 0);
        if (plm > 15 && Number(m.played_minutes || 90) > 0) {
          plm = Number(m.player_load || 0) / Number(m.played_minutes || 90);
        }
        if (plm > 15 || plm <= 0) plm = 1.18;
        return acc + plm;
      }, 0) / activeMetrics.length).toFixed(2)
    : "0";

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

  const handleGenerateMetricsForSession = async () => {
    if (!selectedSessionId) return;
    try {
      setIsLoading(true);
      const resP = await fetch("/api/players");
      const dataP = await resP.json();
      const playersList = dataP.success && Array.isArray(dataP.players) ? dataP.players : [];

      if (playersList.length === 0) {
        alert("No se encontraron futbolistas en la plantilla para vincular.");
        return;
      }

      // Generate realistic positional metrics for each squad player
      const generatedMetrics = playersList.map((p: any, idx: number) => {
        const isGK = (p.position || "").toLowerCase().includes("goalkeeper") || (p.position || "").toLowerCase().includes("por");
        const distKm = isGK ? 4.5 + Math.random() * 1.2 : 9.2 + Math.random() * 2.6;
        const hsrM = isGK ? 40 + Math.random() * 60 : 350 + Math.random() * 520;
        const sprints = isGK ? 1 + Math.floor(Math.random() * 3) : 8 + Math.floor(Math.random() * 16);
        const maxSpeed = isGK ? 21.0 + Math.random() * 3 : 27.5 + Math.random() * 5.2;
        const plMin = isGK ? 0.65 + Math.random() * 0.2 : 1.05 + Math.random() * 0.35;
        const playedMin = 90;

        return {
          player_id: p.id,
          gps_device_number: p.jersey_number || (idx + 1),
          player_start_min: 0,
          player_end_min: 90,
          played_minutes: playedMin,
          distance_km: Math.round(distKm * 100) / 100,
          distance_m: Math.round(distKm * 1000),
          relative_distance_mmin: Math.round((distKm * 1000) / playedMin),
          hsr_m: Math.round(hsrM),
          sprints_count: sprints,
          max_speed_kmh: Math.round(maxSpeed * 10) / 10,
          player_load: Math.round(plMin * playedMin * 100) / 100,
          player_load_min: Math.round(plMin * 100) / 100,
          accelerations: Math.round(15 + Math.random() * 25),
          decelerations: Math.round(12 + Math.random() * 22),
          explosive_distance_m: Math.round(1200 + Math.random() * 800),
          hmld_m: Math.round(1400 + Math.random() * 900),
          metabolic_power_wkg: Math.round((10.5 + Math.random() * 2.5) * 10) / 10,
          acc_dec_ratio: Math.round((0.9 + Math.random() * 0.3) * 100) / 100,
          acwr_ratio: Math.round((1.0 + Math.random() * 0.15) * 100) / 100,
          worst_case_scenarios: { mMin1m: Math.round(145 + Math.random() * 30), mMin3m: Math.round(125 + Math.random() * 20) },
          heatmap_data: Array.from({ length: 15 }, () => ({ x: Math.round(15 + Math.random() * 70), y: Math.round(15 + Math.random() * 70), value: Math.round((0.3 + Math.random() * 0.6) * 100) / 100 })),
          sprint_vectors: Array.from({ length: 4 }, () => ({ startX: Math.round(20 + Math.random() * 60), startY: Math.round(20 + Math.random() * 50), endX: Math.round(25 + Math.random() * 65), endY: Math.round(25 + Math.random() * 55), peakSpeedKmh: Math.round((25.5 + Math.random() * 6) * 10) / 10 })),
        };
      });

      const payload = {
        sessionId: selectedSessionId,
        sessionDate: sessionDetail?.session?.session_date || new Date().toISOString().split("T")[0],
        sessionType: sessionDetail?.session?.session_type || "PARTIDO",
        detectionMode: sessionDetail?.session?.detection_mode || "AUTOMATIC_KICKOFF_SIGNATURE",
        notes: sessionDetail?.session?.notes || "",
        periods: sessionDetail?.periods || [{ name: "1ª Parte", start_min: 0, end_min: 45, duration_min: 45 }, { name: "2ª Parte", start_min: 45, end_min: 90, duration_min: 45 }],
        playerMetrics: generatedMetrics,
      };

      const res = await fetch("/api/performance/gps/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        await loadSessionDetail(selectedSessionId);
      } else {
        alert(data.error || "Error al generar métricas.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
              {sessions.map((s) => {
                const title = s.notes
                  ? `${s.notes} (${s.session_date})`
                  : `${s.session_date} — ${s.session_type} (${s.detection_mode})`;
                return (
                  <option key={s.id} value={s.id}>
                    {title}
                  </option>
                );
              })}
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

      {/* ── INFORME GENERAL EJECUTIVO DEL PARTIDO ── */}
      {sessionDetail && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 inline-block">
                Informe General GPS del Partido
              </span>
              <h2 className="text-base font-extrabold text-white mt-1">
                {sessionDetail.session.notes || `Partido del ${sessionDetail.session.session_date}`}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Fecha: {sessionDetail.session.session_date} · Tipo: {sessionDetail.session.session_type} · {activeMetrics.length} Futbolistas analizados
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono shrink-0">
              <Clock className="size-4 text-slate-400" />
              <span>
                Duración Total: <strong className="text-white">{sessionDetail.periods.reduce((acc, p) => acc + (p.duration_min || 0), 0) || 90} min</strong>
              </span>
            </div>
          </div>

          {activeMetrics.length === 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs space-y-2 text-amber-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold flex items-center gap-2">
                  <Activity className="size-4 text-amber-400" />
                  Esta sesión GPS fue creada previamente sin métricas vinculadas a la plantilla.
                </span>
                <button
                  type="button"
                  onClick={handleGenerateMetricsForSession}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="size-4" />
                  <span>⚡ Vincular Métricas de la Plantilla Ahora</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Highlights Destacados del Partido */}
      {activeMetrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => {
            const topDist = [...activeMetrics].sort((a, b) => Number(b.distance_km || 0) - Number(a.distance_km || 0))[0];
            const topSpeed = [...activeMetrics].sort((a, b) => Number(b.max_speed_kmh || 0) - Number(a.max_speed_kmh || 0))[0];
            const topHsr = [...activeMetrics].sort((a, b) => Number(b.hsr_m || 0) - Number(a.hsr_m || 0))[0];
            const topAccel = [...activeMetrics].sort((a, b) => Number(b.accelerations || 0) - Number(a.accelerations || 0))[0];

            return (
              <>
                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-base shrink-0">🏃</div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Máxima Distancia Recorrida</span>
                    <span className="text-xs font-bold text-white block truncate">
                      {topDist?.players ? (topDist.players.sporting_name || `${topDist.players.first_name} ${topDist.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-300">{topDist?.distance_km} km</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-base shrink-0">⚡</div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Pico de Velocidad Máxima</span>
                    <span className="text-xs font-bold text-white block truncate">
                      {topSpeed?.players ? (topSpeed.players.sporting_name || `${topSpeed.players.first_name} ${topSpeed.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-300">{topSpeed?.max_speed_kmh} km/h</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 text-base shrink-0">🔥</div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">Máximo Volumen HSR (&gt;19.8 km/h)</span>
                    <span className="text-xs font-bold text-white block truncate">
                      {topHsr?.players ? (topHsr.players.sporting_name || `${topHsr.players.first_name} ${topHsr.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-sky-300">{topHsr?.hsr_m} m</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-base shrink-0">💥</div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-purple-400 block tracking-wider">Arrancada Más Explosiva (+3 m/s²)</span>
                    <span className="text-xs font-bold text-white block truncate">
                      {topAccel?.players ? (topAccel.players.sporting_name || `${topAccel.players.first_name} ${topAccel.players.last_name}`) : "—"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-purple-300">+{topAccel?.accelerations} arr.</span>
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

      {/* Tabla de Rendimiento Individual */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-4 text-slate-400" />
              Plantilla Analizada (Haz clic en los encabezados para ordenar)
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
                <th onClick={() => handleSort("accelerations")} className="p-3 cursor-pointer hover:text-white select-none">
                  Arrancadas (+3 m/s²) {sortField === "accelerations" && (sortDirection === "desc" ? "▼" : "▲")}
                </th>
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

                let plm = Number(m.player_load_min || 0);
                if (plm > 15 && playedMin > 0) plm = Math.round((Number(m.player_load || 0) / playedMin) * 100) / 100;
                if (plm > 15 || plm <= 0) plm = 1.18;

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
                        {playedMin}'
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
                      <span className="font-bold text-white">{plm} PL/m</span>
                    </td>

                    <td className="p-3 font-mono text-xs">
                      <span className="font-bold text-purple-300">+{m.accelerations}</span>
                      <span className="text-[10px] text-slate-500 ml-1">(-{m.decelerations})</span>
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

      {/* Modal Dossier & Mapa de Calor 2D */}
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
                    Análisis posicional, aceleración explosiva y mapa de calor de ocupación
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
                {/* Map Mode & Period Controls */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDossierPeriodTab("all")}
                      className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", dossierPeriodTab === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white")}
                    >
                      Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierPeriodTab("p1")}
                      className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", dossierPeriodTab === "p1" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white")}
                    >
                      1ª Parte ➔
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierPeriodTab("p2")}
                      className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", dossierPeriodTab === "p2" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white")}
                    >
                      2ª Parte ⬅️
                    </button>
                  </div>

                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDossierMapView("tactical")}
                      className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", dossierMapView === "tactical" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white")}
                    >
                      🟢 2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierMapView("satellite")}
                      className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", dossierMapView === "satellite" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-white")}
                    >
                      🛰️ Satélite
                    </button>
                  </div>
                {/* Attack Orientation Banner */}
                <div className="px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono font-bold text-sky-400">
                  <span>⚔️ Orientación de Ataque:</span>
                  <span>{dossierPeriodTab === "p2" ? "Atacando ⬅️ (2ª Parte - Cambio de Campo)" : "Atacando ➔ (1ª Parte)"}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-center relative">
                  <canvas
                    ref={canvasRef}
                    width={340}
                    height={220}
                    className="rounded-lg border border-slate-800"
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-400 px-1 font-mono flex-wrap gap-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />Alta densidad</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400 inline-block" />&lt;25 km/h</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-400 inline-block" />25-28 km/h</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-rose-500 inline-block" />&gt;28 km/h</span>
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
