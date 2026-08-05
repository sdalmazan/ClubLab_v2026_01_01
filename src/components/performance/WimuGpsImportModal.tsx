"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FolderSearch,
  AlertCircle,
  Sliders,
  Clock,
  Activity,
  Sparkles,
  Save,
  Check,
  FolderOpen,
  ArrowUpDown,
  Plus,
  Trash2,
  Timer,
  Download,
  FileJson,
  Bot,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerRosterItem {
  id: string;
  name: string;
  position: string;
  jerseyNumber?: number;
}

interface PeriodDefinition {
  name: string;
  expectedDurationMin: number | "";
}

interface AgentOutput {
  session_date: string;
  session_type: string;
  folder_path: string;
  files_processed: number;
  trimmer: {
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
  };
  player_metrics: Array<{
    player_id: string;
    gps_device_number: number;
    distance_km: number;
    hsr_m: number;
    sprints_count: number;
    max_speed_kmh: number;
    player_load: number;
    player_load_min: number;
    accelerations: number;
    decelerations: number;
    heatmap_data: Array<{ x: number; y: number; value: number }>;
  }>;
}

interface WimuGpsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: PlayerRosterItem[];
  onSuccess: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PARTIDO_PERIODS: PeriodDefinition[] = [
  { name: "1ª Parte", expectedDurationMin: 45 },
  { name: "2ª Parte", expectedDurationMin: 45 },
];

const DEFAULT_ENTRENAMIENTO_PERIODS: PeriodDefinition[] = [
  { name: "Bloque 1", expectedDurationMin: "" },
  { name: "Bloque 2", expectedDurationMin: "" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function WimuGpsImportModal({
  isOpen,
  onClose,
  roster,
  onSuccess,
}: WimuGpsImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [folderPath, setFolderPath] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionType, setSessionType] = useState<"PARTIDO" | "ENTRENAMIENTO">("PARTIDO");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Agent output (from uploaded wimu_output.json)
  const [agentOutput, setAgentOutput] = useState<AgentOutput | null>(null);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const outputJsonRef  = useRef<HTMLInputElement | null>(null);

  // Period definitions
  const [periodDefs, setPeriodDefs] = useState<PeriodDefinition[]>(DEFAULT_PARTIDO_PERIODS);

  // GPS assignment mode
  const [assignmentMode, setAssignmentMode] = useState<"global" | "by_period">("global");
  const [activeBlock, setActiveBlock] = useState<string>("1ª Parte");

  // GPS mapping { blockKey: { playerId: gpsNumber } }
  const [blockGpsMapping, setBlockGpsMapping] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, string> = {};
    roster.forEach((p, idx) => { if (idx < 11) init[p.id] = String(p.jerseyNumber || idx + 1); });
    return { Global: init, "1ª Parte": { ...init }, "2ª Parte": {}, "Bloque 1": { ...init }, "Bloque 2": {} };
  });

  // Trimmer Engine result (from API or agent)
  const [trimmerData, setTrimmerData] = useState<{
    session_type: string;
    detection_mode: string;
    periods: Array<{
      name: string; t_start: string; t_end: string;
      start_min: number; end_min: number; duration_min: number; confidence_score: number;
    }>;
    excluded_periods: string[];
  } | null>(null);

  if (!isOpen) return null;

  const currentBlockKey = assignmentMode === "global" ? "Global" : activeBlock;
  const currentBlockMapping = blockGpsMapping[currentBlockKey] || {};

  // ─── Period definition helpers ────────────────────────────────────────────

  const handleSessionTypeChange = (type: "PARTIDO" | "ENTRENAMIENTO") => {
    setSessionType(type);
    setPeriodDefs(type === "PARTIDO" ? DEFAULT_PARTIDO_PERIODS : DEFAULT_ENTRENAMIENTO_PERIODS);
    setActiveBlock(type === "PARTIDO" ? "1ª Parte" : "Bloque 1");
  };

  const handleAddPeriod = () => {
    const idx = periodDefs.length + 1;
    const newName = sessionType === "PARTIDO" ? `${idx}ª Parte` : `Bloque ${idx}`;
    setPeriodDefs(prev => [...prev, { name: newName, expectedDurationMin: "" }]);
    setBlockGpsMapping(prev => ({ ...prev, [newName]: {} }));
  };

  const handleRemovePeriod = (index: number) => {
    if (periodDefs.length <= 1) return;
    const removed = periodDefs[index];
    setPeriodDefs(prev => prev.filter((_, i) => i !== index));
    setBlockGpsMapping(prev => { const n = { ...prev }; delete n[removed.name]; return n; });
    if (activeBlock === removed.name) setActiveBlock(periodDefs[0]?.name || "Global");
  };

  const handlePeriodDefChange = (index: number, field: keyof PeriodDefinition, value: string | number | "") => {
    setPeriodDefs(prev => {
      const next = [...prev];
      const oldName = next[index].name;
      next[index] = { ...next[index], [field]: value };
      if (field === "name" && typeof value === "string" && value !== oldName) {
        setBlockGpsMapping(m => { const n = { ...m }; n[value] = n[oldName] || {}; delete n[oldName]; return n; });
        if (activeBlock === oldName) setActiveBlock(value);
      }
      return next;
    });
  };

  // ─── Folder picker ────────────────────────────────────────────────────────

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const fullPath = (firstFile as any).path;
      if (fullPath) {
        const last = Math.max(fullPath.lastIndexOf("/"), fullPath.lastIndexOf("\\"));
        setFolderPath(last !== -1 ? fullPath.substring(0, last) : fullPath);
      } else {
        setFolderPath(firstFile.webkitRelativePath.split("/")[0] || firstFile.name);
      }
    }
  };

  // ─── GPS number input ─────────────────────────────────────────────────────

  const handleGpsNumberChange = (playerId: string, value: string) => {
    setBlockGpsMapping(prev => ({
      ...prev,
      [currentBlockKey]: { ...prev[currentBlockKey], [playerId]: value },
    }));
  };

  // ─── Sorted roster ────────────────────────────────────────────────────────

  const sortedRoster = [...roster].sort((a, b) => {
    const na = parseInt(currentBlockMapping[a.id] || "", 10);
    const nb = parseInt(currentBlockMapping[b.id] || "", 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.name.localeCompare(b.name);
  });

  // ─── Config download (for local agent) ───────────────────────────────────

  const handleDownloadConfig = async () => {
    try {
      // Fetch current API token (masked) — in config we need the real one
      // We prompt to get it from settings
      const config = {
        api_url:          window.location.origin,
        api_token:        "PEGA_AQUI_TU_TOKEN_DESDE_AJUSTES",
        session_date:     sessionDate,
        session_type:     sessionType,
        folder_path:      folderPath || "C:\\Ruta\\A\\Grabaciones",
        period_defs:      periodDefs,
        gps_assignments:  blockGpsMapping,
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `wimu_config_${sessionDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg("Error generando el archivo de configuración.");
    }
  };

  // ─── Agent output.json upload ─────────────────────────────────────────────

  const handleOutputJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: AgentOutput = JSON.parse(ev.target?.result as string);
        if (!parsed.trimmer || !Array.isArray(parsed.trimmer.periods)) {
          setErrorMsg("El archivo no tiene el formato esperado de wimu_output.json.");
          return;
        }
        setAgentOutput(parsed);
        // Prefill session fields from agent output
        if (parsed.session_date) setSessionDate(parsed.session_date);
        if (parsed.session_type) setSessionType(parsed.session_type as any);
        if (parsed.folder_path) setFolderPath(parsed.folder_path);
        setErrorMsg("");
      } catch {
        setErrorMsg("El archivo JSON no es válido. Verifica que es el wimu_output.json generado por el agente.");
      }
    };
    reader.readAsText(file);
  };

  // ─── Step 1 → Step 2 ─────────────────────────────────────────────────────

  const handleAnalyzeFolder = async () => {
    setErrorMsg("");

    // If agent output is loaded, use it directly
    if (agentOutput) {
      setTrimmerData({
        session_type:    agentOutput.session_type,
        detection_mode:  agentOutput.trimmer.detection_mode,
        periods:         agentOutput.trimmer.periods,
        excluded_periods: agentOutput.trimmer.excluded_periods,
      });
      setStep(2);
      return;
    }

    // Fallback: use server-side Trimmer Engine (requires folder path)
    if (!folderPath.trim()) {
      setErrorMsg("Indica la ruta de la carpeta o sube el wimu_output.json del agente.");
      return;
    }

    try {
      setIsParsing(true);
      const res = await fetch("/api/performance/gps/parse", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ folderPath, sessionDate, sessionType, periodDefs, blockGpsMapping }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al analizar la carpeta GPS.");
      setTrimmerData(data.trimmerJson);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el lote GPS.");
    } finally {
      setIsParsing(false);
    }
  };

  // ─── Period editing (step 2) ──────────────────────────────────────────────

  const handlePeriodChange = (index: number, field: string, value: any) => {
    if (!trimmerData) return;
    const updated = [...trimmerData.periods];
    updated[index] = { ...updated[index], [field]: value };
    setTrimmerData({ ...trimmerData, periods: updated });
  };

  // ─── Step 2 → Step 3: Save ───────────────────────────────────────────────

  const handleSaveToSupabase = async () => {
    try {
      setIsSaving(true);
      setErrorMsg("");

      // Use real agent metrics if available; otherwise no metrics saved
      // (we no longer generate Math.random() data)
      let playerMetrics: any[] = [];

      if (agentOutput?.player_metrics && agentOutput.player_metrics.length > 0) {
        // Real metrics from agent
        playerMetrics = agentOutput.player_metrics;
      } else {
        // No agent output — we save the session + periods but no player metrics
        // The user should run the local agent for real per-player data
        console.warn("No agent output available. Session and periods will be saved without player metrics.");
      }

      const payload = {
        sessionDate,
        sessionType,
        detectionMode: trimmerData?.detection_mode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folderPath,
        notes:         agentOutput
          ? `Importación vía Agente GPS Local. ${agentOutput.files_processed} archivos procesados.`
          : `Importación manual — períodos configurados por el usuario.`,
        periods:       trimmerData?.periods || [],
        playerMetrics,
      };

      const res = await fetch("/api/performance/gps/sessions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || "Error al guardar en Supabase.");

      setStep(3);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al insertar en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
              <Upload className="size-4 text-slate-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-widest text-white uppercase">Lectura GPS</h2>
              <p className="text-xs text-slate-400">Importación y procesado de grabaciones `.qul`</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center justify-between px-8 py-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          {([
            { n: 1, label: "1. Importar datos" },
            { n: 2, label: "2. Validar Procesado de datos" },
            { n: 3, label: "3. Guardar datos tratados" },
          ] as const).map(({ n, label }, i, arr) => (
            <React.Fragment key={n}>
              <div className={cn("flex items-center gap-2 font-bold", step === n ? "text-white" : "text-slate-500")}>
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">{n}</span>
                <span>{label}</span>
              </div>
              {i < arr.length - 1 && <div className="h-px bg-slate-800 flex-1 mx-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── STEP 1 ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">

              {/* Local Agent Zone ── Primary method */}
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-slate-300 shrink-0" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Agente GPS Local (Método Recomendado)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Configura la sesión abajo, descarga el archivo de configuración y ejecuta el agente Python en tu PC.
                  El agente procesa los archivos `.qul` localmente y genera un `wimu_output.json` con los datos tratados.
                </p>

                {/* Upload output.json */}
                <div
                  onClick={() => outputJsonRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all",
                    agentOutput
                      ? "border-slate-600 bg-slate-800/30"
                      : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/20"
                  )}
                >
                  <input
                    ref={outputJsonRef}
                    type="file"
                    accept=".json"
                    onChange={handleOutputJsonUpload}
                    className="hidden"
                  />
                  {agentOutput ? (
                    <>
                      <Check className="size-5 text-white" />
                      <div className="text-center">
                        <span className="text-xs font-bold text-white block">wimu_output.json cargado</span>
                        <span className="text-[10px] text-slate-400">
                          {agentOutput.files_processed} archivos · {agentOutput.trimmer.periods.length} periodos · {agentOutput.player_metrics.length} jugadores
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileJson className="size-5 text-slate-400" />
                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-200 block">Subir wimu_output.json</span>
                        <span className="text-[10px] text-slate-500">Generado por el agente GPS local</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Configuración de Sesión</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              {/* Folder path */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ruta de la Carpeta GPS (.qul)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FolderSearch className="size-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="file"
                      ref={folderInputRef}
                      onChange={handleFolderSelect}
                      {...({ webkitdirectory: "", directory: "" } as any)}
                      className="hidden"
                    />
                    <input
                      type="text"
                      value={folderPath}
                      onChange={e => setFolderPath(e.target.value)}
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
                    <span>Examinar</span>
                  </button>
                </div>
              </div>

              {/* Date & Session Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Fecha de la Sesión</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-slate-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Tipo de Sesión</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["PARTIDO", "ENTRENAMIENTO"] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSessionTypeChange(t)}
                        className={cn(
                          "py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          sessionType === t
                            ? "bg-slate-800 text-white border-slate-600"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Period Definitions */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">Partes / Bloques</span>
                    <span className="text-[11px] text-slate-400">La duración esperada mejora la precisión del Trimmer Engine.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPeriod}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="size-3.5" />
                    Añadir parte
                  </button>
                </div>

                <div className="space-y-2">
                  {periodDefs.map((period, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-950 rounded-xl border border-slate-800 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-500 block mb-0.5 uppercase font-bold tracking-wider">Nombre</label>
                        <input
                          type="text"
                          value={period.name}
                          onChange={e => handlePeriodDefChange(idx, "name", e.target.value)}
                          className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-white font-bold focus:outline-none focus:border-slate-600"
                        />
                      </div>
                      <div className="w-36 shrink-0">
                        <label className="text-[10px] text-slate-500 block mb-0.5 uppercase font-bold tracking-wider flex items-center gap-1">
                          <Timer className="size-3" />Duración esperada (min)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={period.expectedDurationMin}
                          onChange={e => handlePeriodDefChange(idx, "expectedDurationMin", e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Opcional"
                          className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono focus:outline-none focus:border-slate-600 placeholder:text-slate-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePeriod(idx)}
                        disabled={periodDefs.length <= 1}
                        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* GPS Assignments */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">Asignación de Dispositivos GPS</span>
                    <span className="text-[11px] text-slate-400">GPS asignado a cada futbolista (global o por parte).</span>
                  </div>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(["global", "by_period"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAssignmentMode(mode)}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                          assignmentMode === mode ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                        )}
                      >
                        {mode === "global" ? "Global Sesión" : "Por Partes / Bloques"}
                      </button>
                    ))}
                  </div>
                </div>

                {assignmentMode === "by_period" && (
                  <div className="flex gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center font-bold px-2">Parte activa:</span>
                    {periodDefs.map(blk => (
                      <button
                        key={blk.name}
                        type="button"
                        onClick={() => setActiveBlock(blk.name)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          activeBlock === blk.name
                            ? "bg-slate-800 text-white border border-slate-700"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        {blk.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono px-1">
                    <span className="flex items-center gap-1"><ArrowUpDown className="size-3" />Ordenado por Nº GPS</span>
                    <span>Total: {roster.length}</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {sortedRoster.map(p => {
                      const gps = currentBlockMapping[p.id] || "";
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition-all",
                            gps ? "bg-slate-950 border-slate-700" : "bg-slate-950/40 border-slate-800/60 opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {p.jerseyNumber && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">#{p.jerseyNumber}</span>
                            )}
                            <div>
                              <span className="font-bold text-white block">{p.name}</span>
                              <span className="text-[10px] text-slate-400">{p.position}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {gps && <span className="font-mono text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">GPS #{gps}</span>}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">Nº:</span>
                              <input
                                type="text"
                                value={gps}
                                onChange={e => handleGpsNumberChange(p.id, e.target.value)}
                                placeholder="—"
                                className="w-12 text-center font-mono font-bold text-xs rounded bg-slate-900 border border-slate-700 py-1 text-white focus:outline-none focus:border-slate-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Config download tip */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700">
                <Info className="size-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Descarga el archivo de configuración con el botón de abajo y ejecútalo con el agente instalado en tu PC.
                  El token de API lo encuentras en <strong>Rendimiento → Ajustes → Agente GPS Local</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Trimmer Engine Validation ──────────────────────── */}
          {step === 2 && trimmerData && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    Modo: {trimmerData.session_type}
                  </span>
                  <h3 className="text-xs font-bold text-white mt-1">Firma: {trimmerData.detection_mode}</h3>
                  {agentOutput && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {agentOutput.files_processed} archivos .qul procesados · {agentOutput.player_metrics.length} jugadores
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Periodos: <strong className="text-white">{trimmerData.periods.length}</strong>
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Periodos Detectados — Edición Manual Activa</span>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {trimmerData.periods.map((period, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={period.name}
                          onChange={e => handlePeriodChange(idx, "name", e.target.value)}
                          className="flex-1 bg-transparent font-bold text-white text-xs border-b border-slate-700 focus:outline-none focus:border-slate-500 py-0.5"
                        />
                        <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono shrink-0">
                          Confianza: {Math.round(period.confidence_score * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Inicio</label>
                          <input type="text" value={period.t_start} onChange={e => handlePeriodChange(idx, "t_start", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Fin</label>
                          <input type="text" value={period.t_end} onChange={e => handlePeriodChange(idx, "t_end", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Duración (min)</label>
                          <input type="number" step="0.1" value={period.duration_min}
                            onChange={e => handlePeriodChange(idx, "duration_min", Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="size-3.5" />Periodos Excluidos (no computan en medias):
                </span>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-5 font-mono">
                  {trimmerData.excluded_periods.map((ex, i) => <li key={i}>{ex}</li>)}
                </ul>
              </div>

              {!agentOutput && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700">
                  <Info className="size-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300">
                    <strong>Sin agente:</strong> Los periodos son estimaciones del Trimmer Engine basadas en las duraciones configuradas.
                    Para datos locomotores reales por jugador (distancia, HSR, velocidad, etc.) utiliza el Agente GPS Local.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Success ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <div className="size-14 rounded-full bg-slate-800 border border-slate-700 text-white mx-auto flex items-center justify-center">
                <Check className="size-7" />
              </div>
              <h3 className="text-lg font-bold text-white">¡Sesión GPS Guardada!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {agentOutput
                  ? `${agentOutput.player_metrics.length} jugadores con datos reales guardados en la base de datos.`
                  : "Periodos de sesión guardados. Ejecuta el Agente GPS Local para añadir métricas individuales."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>

          {step === 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadConfig}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="size-4" />
                <span>Descargar Config</span>
              </button>
              <button
                type="button"
                onClick={handleAnalyzeFolder}
                disabled={isParsing}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isParsing ? (
                  <><Sliders className="size-4 animate-spin" /><span>Analizando...</span></>
                ) : agentOutput ? (
                  <><ChevronRight className="size-4" /><span>Continuar con datos del Agente</span></>
                ) : (
                  <><Sparkles className="size-4" /><span>Analizar Archivos GPS</span></>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors">
                Volver
              </button>
              <button
                type="button"
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <><Activity className="size-4 animate-spin" /><span>Guardando...</span></>
                ) : (
                  <><Save className="size-4" /><span>Confirmar y Guardar Sesión</span></>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
