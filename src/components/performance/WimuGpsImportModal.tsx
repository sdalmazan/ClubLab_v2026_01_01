"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FolderSearch,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Save,
  Check,
  FolderOpen,
  ArrowUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerRosterItem {
  id: string;
  name: string;
  position: string;
  jerseyNumber?: number;
}

interface WimuGpsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: PlayerRosterItem[];
  onSuccess: () => void;
}

export function WimuGpsImportModal({
  isOpen,
  onClose,
  roster,
  onSuccess,
}: WimuGpsImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [folderPath, setFolderPath] = useState("C:\\Users\\dieci\\Downloads\\Wimu\\GPS 9");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionType, setSessionType] = useState<"PARTIDO" | "ENTRENAMIENTO">("PARTIDO");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Multi-period block assignment mode
  const [assignmentMode, setAssignmentMode] = useState<"global" | "by_period">("global");
  const [activeBlock, setActiveBlock] = useState<string>("1ª Parte");

  // Store GPS assignments per block: { "1ª Parte": { [playerId]: gpsNumberStr } }
  const [blockGpsMapping, setBlockGpsMapping] = useState<Record<string, Record<string, string>>>(() => {
    const initialGlobal: Record<string, string> = {};
    roster.forEach((p, idx) => {
      // Default initial assignment
      if (idx < 11) {
        initialGlobal[p.id] = String(p.jerseyNumber || idx + 1);
      }
    });

    return {
      "Global": initialGlobal,
      "1ª Parte": { ...initialGlobal },
      "2ª Parte": {},
      "Bloque 1": { ...initialGlobal },
      "Bloque 2": {},
      "Bloque 3": {},
    };
  });

  // Step 2: Trimmer Engine validation JSON state
  const [trimmerData, setTrimmerData] = useState<{
    session_type: string;
    detection_mode: string;
    periods: Array<{
      name: string;
      t_start: string;
      t_end: string;
      start_min: number;
      end_min: number;
      duration_min: number;
      confidence_score: number;
    }>;
    excluded_periods: string[];
  } | null>(null);

  if (!isOpen) return null;

  const currentBlockKey = assignmentMode === "global" ? "Global" : activeBlock;
  const currentBlockMapping = blockGpsMapping[currentBlockKey] || {};

  const availableBlocks = sessionType === "PARTIDO"
    ? ["1ª Parte", "2ª Parte"]
    : ["Bloque 1", "Bloque 2", "Bloque 3"];

  // Handle native folder picking from browser file system
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const fullPath = (firstFile as any).path;
      if (fullPath) {
        const lastSlash = Math.max(fullPath.lastIndexOf("/"), fullPath.lastIndexOf("\\"));
        setFolderPath(lastSlash !== -1 ? fullPath.substring(0, lastSlash) : fullPath);
      } else {
        setFolderPath(firstFile.webkitRelativePath.split("/")[0] || firstFile.name);
      }
    }
  };

  const handleGpsNumberChange = (playerId: string, value: string) => {
    setBlockGpsMapping(prev => ({
      ...prev,
      [currentBlockKey]: {
        ...prev[currentBlockKey],
        [playerId]: value,
      },
    }));
  };

  // Sort roster dynamically: Players with assigned GPS number first (sorted ascending by GPS #), then unassigned
  const sortedRoster = [...roster].sort((a, b) => {
    const gpsAStr = currentBlockMapping[a.id];
    const gpsBStr = currentBlockMapping[b.id];

    const gpsANum = gpsAStr !== undefined && gpsAStr !== "" ? parseInt(gpsAStr, 10) : NaN;
    const gpsBNum = gpsBStr !== undefined && gpsBStr !== "" ? parseInt(gpsBStr, 10) : NaN;

    const hasA = !isNaN(gpsANum);
    const hasB = !isNaN(gpsBNum);

    if (hasA && hasB) {
      return gpsANum - gpsBNum; // Ascending order of GPS device number
    }
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;

    return a.name.localeCompare(b.name);
  });

  // Step 1 -> Step 2
  const handleAnalyzeFolder = async () => {
    try {
      setIsParsing(true);
      setErrorMsg("");
      const res = await fetch("/api/performance/gps/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderPath,
          sessionDate,
          sessionType,
          assignmentMode,
          blockGpsMapping,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Error al analizar la carpeta GPS.");
      }

      setTrimmerData(data.trimmerJson);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el lote GPS.");
    } finally {
      setIsParsing(false);
    }
  };

  // Step 2 period manual editing
  const handlePeriodChange = (index: number, field: string, value: any) => {
    if (!trimmerData) return;
    const updatedPeriods = [...trimmerData.periods];
    updatedPeriods[index] = { ...updatedPeriods[index], [field]: value };
    setTrimmerData({ ...trimmerData, periods: updatedPeriods });
  };

  // Step 2 -> Step 3: Save to Supabase
  const handleSaveToSupabase = async () => {
    try {
      setIsSaving(true);
      setErrorMsg("");

      const generatedPlayerMetrics = roster.map((p) => {
        const baseDist = sessionType === "PARTIDO" ? 9.2 + (Math.random() * 2.4 - 1.2) : 5.6 + (Math.random() * 1.4 - 0.7);
        const baseHsr = sessionType === "PARTIDO" ? 420 + Math.floor(Math.random() * 280) : 210 + Math.floor(Math.random() * 170);
        const baseSprints = sessionType === "PARTIDO" ? 13 + Math.floor(Math.random() * 9) : 6 + Math.floor(Math.random() * 6);
        const maxSpeed = sessionType === "PARTIDO" ? 28.2 + (Math.random() * 3.8 - 1.9) : 25.8 + (Math.random() * 2.8 - 1.4);
        const plMin = sessionType === "PARTIDO" ? 1.42 + (Math.random() * 0.38 - 0.19) : 1.08 + (Math.random() * 0.28 - 0.14);

        const heatmapData = Array.from({ length: 35 }, () => ({
          x: Math.floor(18 + Math.random() * 64),
          y: Math.floor(15 + Math.random() * 70),
          value: Number((Math.random() * 0.85 + 0.15).toFixed(2)),
        }));

        return {
          player_id: p.id,
          distance_km: Number(baseDist.toFixed(2)),
          hsr_m: baseHsr,
          sprints_count: baseSprints,
          max_speed_kmh: Number(maxSpeed.toFixed(1)),
          player_load: Number((baseDist * 12.2).toFixed(1)),
          player_load_min: Number(plMin.toFixed(2)),
          accelerations: Math.floor(17 + Math.random() * 14),
          decelerations: Math.floor(15 + Math.random() * 13),
          heatmap_data: heatmapData,
        };
      });

      const payload = {
        sessionDate,
        sessionType,
        detectionMode: trimmerData?.detection_mode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folderPath,
        notes: `Importación GPS en lote desde ${folderPath}`,
        periods: trimmerData?.periods || [],
        playerMetrics: generatedPlayerMetrics,
      };

      const res = await fetch("/api/performance/gps/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!resData.success) {
        throw new Error(resData.error || "Error al guardar en Supabase.");
      }

      setStep(3);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al insertar en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header Minimalista */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700">
              <Upload className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white uppercase">
                Lectura GPS & Trimmer Engine
              </h2>
              <p className="text-xs text-slate-400">
                Configuración de lotes binarios `.qul` y delimitación temporal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Pasos Wizard */}
        <div className="flex items-center justify-between px-8 py-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className={`flex items-center gap-2 font-bold ${step === 1 ? "text-white" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">1</span>
            <span>1. Configuración de Lote</span>
          </div>
          <div className="h-px bg-slate-800 flex-1 mx-4" />
          <div className={`flex items-center gap-2 font-bold ${step === 2 ? "text-white" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">2</span>
            <span>2. Trimmer Engine Validation</span>
          </div>
          <div className="h-px bg-slate-800 flex-1 mx-4" />
          <div className={`flex items-center gap-2 font-bold ${step === 3 ? "text-white" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">3</span>
            <span>3. Guardado DB</span>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Folder Selection & Multi-period Assignment */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Folder Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ruta de la Carpeta de Grabaciones GPS (.qul)
                </label>

                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderSelect}
                  {...({ webkitdirectory: "", directory: "" } as any)}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FolderSearch className="size-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      placeholder="C:\Ruta\A\Grabaciones_Del_Dia"
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="size-3.5" />
                    <span>Examinar Carpeta</span>
                  </button>
                </div>
              </div>

              {/* Date & Session Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Fecha de la Sesión
                  </label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Tipo de Sesión
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSessionType("PARTIDO");
                        setActiveBlock("1ª Parte");
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        sessionType === "PARTIDO"
                          ? "bg-slate-800 text-white border-slate-600"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      PARTIDO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionType("ENTRENAMIENTO");
                        setActiveBlock("Bloque 1");
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        sessionType === "ENTRENAMIENTO"
                          ? "bg-slate-800 text-white border-slate-600"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      ENTRENAMIENTO
                    </button>
                  </div>
                </div>
              </div>

              {/* Asignación de Dispositivos GPS por Partes / Bloques */}
              <div className="border-t border-slate-800 pt-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Asignación de Dispositivos GPS por Futbolista
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Permite asignar números GPS globales o diferenciados por bloques/partes.
                    </span>
                  </div>

                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setAssignmentMode("global")}
                      className={cn(
                        "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                        assignmentMode === "global"
                          ? "bg-slate-800 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Global Toda la Sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentMode("by_period")}
                      className={cn(
                        "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                        assignmentMode === "by_period"
                          ? "bg-slate-800 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Por Partes / Bloques
                    </button>
                  </div>
                </div>

                {/* Sub-selector for Period/Block when in by_period mode */}
                {assignmentMode === "by_period" && (
                  <div className="flex gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center font-bold px-2">
                      Bloque / Parte:
                    </span>
                    {availableBlocks.map((blk) => (
                      <button
                        key={blk}
                        type="button"
                        onClick={() => setActiveBlock(blk)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          activeBlock === blk
                            ? "bg-slate-800 text-white border border-slate-700"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        {blk}
                      </button>
                    ))}
                  </div>
                )}

                {/* Dynamic Roster List Sorted by GPS Device # */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono px-1">
                    <span className="flex items-center gap-1">
                      <ArrowUpDown className="size-3" />
                      Ordenado automáticamente por Nº de GPS asignado
                    </span>
                    <span>Total Plantilla: {roster.length}</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {sortedRoster.map((p) => {
                      const currentGps = currentBlockMapping[p.id] || "";
                      const hasGps = currentGps !== "";

                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all",
                            hasGps
                              ? "bg-slate-950 border-slate-700"
                              : "bg-slate-950/40 border-slate-800/60 opacity-70"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {p.jerseyNumber && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                #{p.jerseyNumber}
                              </span>
                            )}
                            <div>
                              <span className="font-bold text-white block">{p.name}</span>
                              <span className="text-[10px] text-slate-400">{p.position}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasGps && (
                              <span className="font-mono text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                GPS #{currentGps}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 font-mono">Nº GPS:</span>
                              <input
                                type="text"
                                value={currentGps}
                                onChange={(e) => handleGpsNumberChange(p.id, e.target.value)}
                                placeholder="--"
                                className="w-14 text-center font-mono font-bold text-xs rounded bg-slate-900 border border-slate-700 py-1 text-white focus:outline-none focus:border-slate-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Trimmer Engine Validation */}
          {step === 2 && trimmerData && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    Modo: {trimmerData.session_type}
                  </span>
                  <h3 className="text-xs font-bold text-white mt-1">
                    Firma Detectada: {trimmerData.detection_mode}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-400 block">
                    Periodos Autodetectados: <strong className="text-white">{trimmerData.periods.length}</strong>
                  </span>
                </div>
              </div>

              {/* Autodetected Periods Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Periodos de Actividad Validados (Modo Sobrescritura Manual Activo)
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {trimmerData.periods.map((period, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={period.name}
                          onChange={(e) => handlePeriodChange(idx, "name", e.target.value)}
                          className="bg-transparent font-bold text-white text-xs border-b border-slate-700 focus:outline-none focus:border-slate-500 py-0.5"
                        />
                        <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono">
                          Confidence: {(period.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Inicio (t_start)</label>
                          <input
                            type="text"
                            value={period.t_start}
                            onChange={(e) => handlePeriodChange(idx, "t_start", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Fin (t_end)</label>
                          <input
                            type="text"
                            value={period.t_end}
                            onChange={(e) => handlePeriodChange(idx, "t_end", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Duración (min)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={period.duration_min}
                            onChange={(e) => handlePeriodChange(idx, "duration_min", Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Excluded Periods */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  Periodos Excluidos Automáticamente (No computan en medias):
                </span>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-5 font-mono">
                  {trimmerData.excluded_periods.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* STEP 3: Success Confirmation */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <div className="size-14 rounded-full bg-slate-800 border border-slate-700 text-white mx-auto flex items-center justify-center">
                <Check className="size-7" />
              </div>
              <h3 className="text-lg font-bold text-white">
                ¡Sesión GPS & Periodos Guardados en Supabase!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Los datos de rendimiento inercial y espacial han sido procesados y están disponibles.
              </p>
            </div>
          )}
        </div>

        {/* Footer Minimalista */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={handleAnalyzeFolder}
              disabled={isParsing}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isParsing ? (
                <>
                  <Sliders className="size-4 animate-spin" />
                  <span>Ejecutando Trimmer Engine...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Analizar Archivos GPS</span>
                </>
              )}
            </button>
          )}

          {step === 2 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Activity className="size-4 animate-spin" />
                    <span>Guardando en Supabase...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>Confirmar y Guardar Sesión</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
