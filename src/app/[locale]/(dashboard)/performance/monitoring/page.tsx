"use client";

import { useState, useRef, useEffect } from "react";
import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { ExportDataModal } from "@/components/performance/ExportDataModal";
import { PlayerDailyCheckDetailModal } from "@/components/dashboard/PlayerDailyCheckDetailModal";
import { 
  Activity, 
  Flame, 
  Heart, 
  Zap, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Smile,
  Moon,
  Brain,
  Scale,
  X,
  User,
  Sparkles,
  Search,
  Upload,
  HeartPulse,
  Dumbbell,
  FileSpreadsheet,
  Plus,
  Eye,
  Sliders
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HolisticPlayerRecord {
  id: string;
  name: string;
  position: string;
  jerseyNumber?: number;
  injuryStatus: "apto" | "rtp" | "baja";
  injuryDetail?: string;
  discomfortNote?: string;
  wellnessScore: number | null;
  sleepQuality: number | null;
  fatigueLevel: number | null;
  gpsDistanceKm: number;
  hsrDistanceM: number;
  sprintsCount: number;
  acwrRatio: number;
  bodyFatPercentage: number | null;
  weightKg: number | null;
  weightDiffKg?: number;
  completedWellnessToday: boolean;
  rawPlayerObj: any;
}

function formatPositionLabel(posKey?: string): string {
  if (!posKey) return "Futbolista";
  switch (posKey) {
    case "goalkeeper": return "POR";
    case "left_back": return "LI";
    case "right_back": return "LD";
    case "left_center_back":
    case "right_center_back": return "DFC";
    case "defensive_midfielder": return "MCD";
    case "central_midfielder":
    case "playmaker_midfielder": return "MC";
    case "attacking_midfielder": return "MCO";
    case "left_winger": return "EI";
    case "right_winger": return "ED";
    case "second_striker": return "SD";
    case "striker": return "DC";
    default: return posKey.toUpperCase();
  }
}

const INITIAL_HOLISTIC_ROSTER: HolisticPlayerRecord[] = [];

export default function PerformanceMonitoringPage() {
  const [activeTab, setActiveTab] = useState<"matrix360" | "wellness_weight">("matrix360");
  const [roster, setRoster] = useState<HolisticPlayerRecord[]>(INITIAL_HOLISTIC_ROSTER);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modals state
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [gpsFileName, setGpsFileName] = useState("");
  const [gpsSessionType, setGpsSessionType] = useState("Entrenamiento Principal");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected Player Detail Modal & 360 Dossier Modal
  const [selectedDetailPlayer, setSelectedDetailPlayer] = useState<any | null>(null);
  const [dossierPlayer, setDossierPlayer] = useState<HolisticPlayerRecord | null>(null);

  useEffect(() => {
    async function loadSquad() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/players");
        const json = await res.json();
        if (json.players && Array.isArray(json.players)) {
          const mapped: HolisticPlayerRecord[] = json.players.map((p: any) => {
            const rawName = p.sporting_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Futbolista";
            const typeLabel = p.membership?.player_type === "reserve" 
              ? " [Filial]" 
              : p.membership?.player_type === "youth" 
              ? " [Juvenil]" 
              : "";
            const fullName = `${rawName}${typeLabel}`;
            const pos = formatPositionLabel(p.membership?.positions?.[0]);
            
            const hasInjury = !!p.active_injury;
            const injuryStatus: "apto" | "rtp" | "baja" = hasInjury
              ? (p.active_injury.status === "readaptation" ? "rtp" : "baja")
              : (p.physical_status === "red" ? "baja" : p.physical_status === "yellow" ? "rtp" : "apto");

            const latestW = p.latest_wellness;
            const completedWellnessToday = !!latestW;

            const sleep = latestW?.sleep_quality ?? null;
            const fatigue = latestW?.fatigue ?? null;
            const mood = latestW?.mood ?? null;
            const muscle = latestW?.muscle_soreness ?? null;
            const stress = latestW?.stress ?? null;

            const wellnessScore = (sleep != null && fatigue != null && mood != null && muscle != null && stress != null)
              ? (sleep + (6 - fatigue) + mood + (6 - muscle) + (6 - stress))
              : null;

            return {
              id: p.id,
              name: fullName,
              position: pos,
              jerseyNumber: p.membership?.jersey_number || p.jersey_number || undefined,
              injuryStatus,
              injuryDetail: p.active_injury ? `${p.active_injury.body_part} (${p.active_injury.severity || 'Activa'})` : p.availability_notes || undefined,
              discomfortNote: latestW?.discomfort_body_part || latestW?.localized_discomfort || undefined,
              wellnessScore,
              sleepQuality: sleep,
              fatigueLevel: fatigue,
              gpsDistanceKm: p.gps_distance_km || 0,
              hsrDistanceM: p.hsr_distance_m || 0,
              sprintsCount: p.sprints_count || 0,
              acwrRatio: p.acwr_ratio || 1.0,
              bodyFatPercentage: p.body_fat_percentage != null ? p.body_fat_percentage : null,
              weightKg: latestW?.weight_kg || p.weight_kg || null,
              weightDiffKg: 0,
              completedWellnessToday,
              rawPlayerObj: p,
            };
          });
          setRoster(mapped);
        }
      } catch (err) {
        console.error("Failed to load squad for performance monitoring:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSquad();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGpsFileName(file.name);
    }
  };

  const handleImportGpsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`¡Datos GPS de la sesión ("${gpsSessionType}") importados correctamente para la plantilla!`);
    setIsGpsModalOpen(false);
    setGpsFileName("");
  };

  const filteredRoster = roster.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100 space-y-6">
      {/* ── HEADER & GPS IMPORT CTA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Monitorización Holística & Matriz 360°
          </h1>
          <p className="text-xs text-slate-400">
            Análisis integral para el Preparador Físico: lesiones, molestias, wellness, datos GPS, peso y pliegues cutáneos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="size-4" />
            <span>Exportar Datos (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGpsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Upload className="size-4" />
            <span>+ Importar Datos GPS</span>
          </button>
        </div>
      </div>

      <PerformanceSubNav />

      {/* ── MAIN TABS: MATRIZ 360° vs WELLNESS & PESO ── */}
      <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1 gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("matrix360")}
          className={cn(
            "flex-1 min-w-[200px] rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "matrix360"
              ? "bg-primary text-primary-foreground shadow"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Activity className="size-4" />
          <span>Matriz Holística 360° (Plantilla Completa)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("wellness_weight")}
          className={cn(
            "flex-1 min-w-[200px] rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "wellness_weight"
              ? "bg-primary text-primary-foreground shadow"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Scale className="size-4" />
          <span>Wellness & Pesaje Matutino</span>
        </button>
      </div>

      {/* ── TAB 1: MATRIZ HOLÍSTICA 360° ── */}
      {activeTab === "matrix360" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-white/10 flex-wrap">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400" />
              Expediente Físico Integrado (Haz clic en un jugador para abrir su ficha 360°)
            </span>

            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar futbolista..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-white/10 pl-8 pr-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* High-density 360° Matrix Table */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-white/5 border-b border-white/10 uppercase text-[10px] font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-3.5">Futbolista</th>
                    <th className="p-3.5">Estado Médico / Lesión</th>
                    <th className="p-3.5">Wellness</th>
                    <th className="p-3.5">GPS (Distancia / HSR)</th>
                    <th className="p-3.5">Ratio ACWR</th>
                    <th className="p-3.5">% Grasa (ISAK)</th>
                    <th className="p-3.5">Peso</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRoster.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => setDossierPlayer(p)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {p.jerseyNumber != null && (
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              #{p.jerseyNumber}
                            </span>
                          )}
                          <div>
                            <span className="font-bold text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-400">{p.position}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {p.injuryStatus === "apto" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            🟩 Apto (Sin lesión)
                          </span>
                        )}
                        {p.injuryStatus === "rtp" && (
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                              🟧 RTP (Césped)
                            </span>
                            {p.injuryDetail && <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{p.injuryDetail}</span>}
                          </div>
                        )}
                        {p.injuryStatus === "baja" && (
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 uppercase">
                              🔴 Baja Médica
                            </span>
                            {p.injuryDetail && <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{p.injuryDetail}</span>}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-mono">
                        {p.completedWellnessToday && p.wellnessScore != null ? (
                          <>
                            <span className={p.wellnessScore < 15 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                              {p.wellnessScore} / 25
                            </span>
                            <span className="text-[10px] text-slate-400 block">Sueño: {p.sleepQuality ?? "–"}/5</span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            ⏳ Sin Check-in
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono">
                        <span className="font-bold text-white">{p.gpsDistanceKm > 0 ? `${p.gpsDistanceKm} km` : "—"}</span>
                        {p.hsrDistanceM > 0 && <span className="text-[10px] text-slate-400 block">HSR: {p.hsrDistanceM} m</span>}
                      </td>

                      <td className="p-3.5 font-mono">
                        <span className={p.acwrRatio > 1.4 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                          {p.acwrRatio || 1.0}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono">
                        {p.bodyFatPercentage != null ? (
                          <>
                            <span className="font-bold text-sky-400">{p.bodyFatPercentage}%</span>
                            <span className="text-[10px] text-slate-400 block">Pliegues ISAK</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">— Sin medir</span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono">
                        {p.weightKg != null ? (
                          <span className="font-bold text-white">{p.weightKg} kg</span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailPlayer({
                              id: p.id,
                              name: p.name,
                              jerseyNumber: p.jerseyNumber,
                              checkin: p.rawPlayerObj?.latest_wellness,
                              checkout: p.rawPlayerObj?.latest_rpe,
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Ver Check-in / Out
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: WELLNESS & PESAJES MATUTINOS (CUMPLIMIENTO DE PLANTILLA) ── */}
      {activeTab === "wellness_weight" && (
        <div className="space-y-5">
          {/* Wellness Compliance Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Plantilla</span>
                <span className="text-2xl font-black text-white font-mono">{roster.length}</span>
              </div>
              <div className="p-3 bg-slate-800 text-slate-300 rounded-xl">
                <User className="size-5" />
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Check-in Completado</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {roster.filter(p => p.completedWellnessToday).length}
                </span>
              </div>
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <CheckCircle2 className="size-5" />
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Check-in Pendiente</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {roster.filter(p => !p.completedWellnessToday).length}
                </span>
              </div>
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                <Clock className="size-5" />
              </div>
            </div>
          </div>

          {/* Roster Cards with Status & Reminder trigger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredRoster.map(p => {
              const isDone = p.completedWellnessToday;
              return (
                <div key={p.id} className={cn(
                  "bg-slate-900 border rounded-2xl p-4 space-y-3 shadow-md transition-all",
                  isDone ? "border-emerald-500/30" : "border-amber-500/30 bg-amber-500/5"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-white text-sm block">{p.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">{p.position}</span>
                    </div>
                    {isDone ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Completado
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="size-3" /> Pendiente
                      </span>
                    )}
                  </div>

                  {isDone ? (
                    <div className="text-xs text-slate-400 space-y-1.5 pt-1 border-t border-white/5">
                      <div className="flex justify-between"><span>Puntuación Wellness:</span><span className="font-bold text-emerald-400">{p.wellnessScore}/25</span></div>
                      <div className="flex justify-between"><span>Sueño:</span><span className="font-bold text-white">{p.sleepQuality}/5</span></div>
                      <div className="flex justify-between"><span>Fatiga:</span><span className="font-bold text-white">{p.fatigueLevel}/5</span></div>
                      <div className="flex justify-between"><span>Peso Matutino:</span><span className="font-bold font-mono text-sky-400">{p.weightKg} kg</span></div>
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-white/5 space-y-2">
                      <p className="text-[11px] text-amber-400/90 italic">
                        Sin registro de salud hoy.
                      </p>
                      <button
                        type="button"
                        onClick={() => alert(`Recordatorio enviado a ${p.name} por WhatsApp/Correo`)}
                        className="w-full py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-bold text-[11px] rounded-xl border border-amber-500/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Clock className="size-3" /> Recordar por WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORTAR DATOS GPS (CSV / DISPOSITIVO) — OPAQUE 100% ── */}
      {isGpsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Upload className="size-4 text-emerald-400" />
                Importar Datos GPS de Sesión
              </h3>
              <button type="button" onClick={() => setIsGpsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleImportGpsSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-white block mb-1">Tipo de Sesión / Partido:</label>
                <input
                  type="text"
                  required
                  value={gpsSessionType}
                  onChange={(e) => setGpsSessionType(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-white block">Seleccionar Archivo CSV (Catapult, WIMU, STATSports):</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.fit,.json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border border-dashed border-white/20 hover:border-emerald-400/50 rounded-xl bg-white/5 text-center space-y-1 cursor-pointer transition-all"
                >
                  <FileSpreadsheet className="size-6 text-emerald-400 mx-auto" />
                  <span className="text-xs font-bold text-white block">
                    {gpsFileName ? gpsFileName : "Hacer clic para examinar archivo CSV de GPS"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Soporta métricas de distancia, HSR, aceleraciones y sprints</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setIsGpsModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs hover:bg-emerald-400">
                  Cargar Datos GPS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FICHA EXPEDIENTE HOLÍSTICO 360° DEL JUGADOR — OPAQUE 100% ── */}
      {dossierPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                {dossierPlayer.jerseyNumber != null && (
                  <span className="text-sm font-mono font-bold px-2 py-1 rounded bg-primary/20 text-primary border border-primary/30">
                    #{dossierPlayer.jerseyNumber}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-black text-white">{dossierPlayer.name}</h3>
                  <span className="text-xs text-slate-400">{dossierPlayer.position} • Expediente Físico Holístico 360°</span>
                </div>
              </div>
              <button type="button" onClick={() => setDossierPlayer(null)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            {/* Grid 360 Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Box 1: Salud & Enfermería */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h4 className="font-extrabold text-destructive flex items-center gap-1.5">
                  <HeartPulse className="size-4" /> 1. Estado Médico & Enfermería
                </h4>
                <p className="text-slate-300">
                  Dictamen: <strong className="text-white uppercase">{dossierPlayer.injuryStatus}</strong>
                </p>
                {dossierPlayer.injuryDetail && (
                  <p className="text-slate-400 italic">"{dossierPlayer.injuryDetail}"</p>
                )}
              </div>

              {/* Box 2: Molestias Post-Entreno */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h4 className="font-extrabold text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="size-4" /> 2. Molestias & Check-out
                </h4>
                <p className="text-slate-300">
                  {dossierPlayer.discomfortNote ? dossierPlayer.discomfortNote : "Sin molestias reportadas en la última sesión."}
                </p>
              </div>

              {/* Box 3: GPS & Carga */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 font-mono">
                <h4 className="font-extrabold text-emerald-400 flex items-center gap-1.5 font-sans">
                  <Zap className="size-4" /> 3. Métricas GPS & Carga
                </h4>
                <div className="flex justify-between"><span>Distancia:</span><strong className="text-white">{dossierPlayer.gpsDistanceKm} km</strong></div>
                <div className="flex justify-between"><span>HSR (&gt;21 km/h):</span><strong className="text-emerald-400">{dossierPlayer.hsrDistanceM} m</strong></div>
                <div className="flex justify-between"><span>ACWR:</span><strong className="text-emerald-400">{dossierPlayer.acwrRatio}</strong></div>
              </div>

              {/* Box 4: Antropometría & Peso */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 font-mono">
                <h4 className="font-extrabold text-sky-400 flex items-center gap-1.5 font-sans">
                  <Scale className="size-4" /> 4. Composición Corporal (ISAK)
                </h4>
                <div className="flex justify-between"><span>% Grasa Corporal:</span><strong className="text-sky-300">{dossierPlayer.bodyFatPercentage}%</strong></div>
                <div className="flex justify-between"><span>Peso Actual:</span><strong className="text-white">{dossierPlayer.weightKg} kg</strong></div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDossierPlayer(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
              >
                Cerrar Expediente 360°
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export CSV Modal */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        squadPlayers={roster}
      />

      {/* Player Daily Check Detail Modal */}
      <PlayerDailyCheckDetailModal
        isOpen={!!selectedDetailPlayer}
        onClose={() => setSelectedDetailPlayer(null)}
        player={selectedDetailPlayer}
      />
    </div>
  );
}
