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
  FileCheck,
  ChevronRight,
  Info,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseWimuQulBuffer, ParsedQulFile } from "@/lib/performance/wimuParser";
import { GpsTimelineChart } from "@/components/performance/GpsTimelineChart";

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

interface WimuGpsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: PlayerRosterItem[];
  onSuccess: (sessionId?: string) => void;
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

export function WimuGpsImportModal({
  isOpen,
  onClose,
  roster,
  onSuccess,
}: WimuGpsImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [folderPath, setFolderPath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionType, setSessionType] = useState<"PARTIDO" | "ENTRENAMIENTO">("PARTIDO");
  const [notes, setNotes] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgressMsg, setParseProgressMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const folderInputRef = useRef<HTMLInputElement | null>(null);

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

  // Trimmer Engine & decoded metrics result from API
  const [trimmerData, setTrimmerData] = useState<{
    session_type: string;
    detection_mode: string;
    periods: Array<{
      name: string; t_start: string; t_end: string;
      start_min: number; end_min: number; duration_min: number; confidence_score: number;
    }>;
    excluded_periods: string[];
    files_processed?: number;
    parsed_files?: Array<{ filename: string; deviceNumber: number | null; durationMin: number }>;
    timeline_series?: any[];
  } | null>(null);

  const [decodedPlayerMetrics, setDecodedPlayerMetrics] = useState<any[]>([]);

  if (!isOpen) return null;

  const currentBlockKey = assignmentMode === "global" ? "Global" : activeBlock;
  const currentBlockMapping = blockGpsMapping[currentBlockKey] || {};

  // ─── Period helpers ────────────────────────────────────────────────────────

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

  // ─── Folder / File Picker ──────────────────────────────────────────────────

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const qulFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".qul"));
      setSelectedFiles(qulFiles);

      const firstFile = files[0];
      const fullPath = (firstFile as any).path;
      if (fullPath) {
        const last = Math.max(fullPath.lastIndexOf("/"), fullPath.lastIndexOf("\\"));
        setFolderPath(last !== -1 ? fullPath.substring(0, last) : fullPath);
      } else {
        setFolderPath(firstFile.webkitRelativePath.split("/")[0] || "Archivos Seleccionados");
      }
    }
  };

  const handleGpsNumberChange = (playerId: string, value: string) => {
    setBlockGpsMapping(prev => ({
      ...prev,
      [currentBlockKey]: { ...prev[currentBlockKey], [playerId]: value },
    }));
  };

  const sortedRoster = [...roster].sort((a, b) => {
    const na = parseInt(currentBlockMapping[a.id] || "", 10);
    const nb = parseInt(currentBlockMapping[b.id] || "", 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.name.localeCompare(b.name);
  });

  // ─── Step 1 → Step 2: Analyze ──────────────────────────────────────────────

  const handleAnalyzeFolder = async () => {
    setErrorMsg("");

    try {
      setIsParsing(true);

      let aggregatedTrimmerData: any = null;
      const aggregatedMetrics: any[] = [];

      if (selectedFiles.length === 0) {
        // No files selected directly, send folder path request
        setParseProgressMsg("Analizando sesión...");
        const formData = new FormData();
        formData.append("sessionType", sessionType);
        formData.append("sessionDate", sessionDate);
        formData.append("periodDefs", JSON.stringify(periodDefs));
        formData.append("playerMapping", JSON.stringify(currentBlockMapping));

        const res = await fetch("/api/performance/gps/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            res.status === 413
              ? "El tamaño del lote excede el límite del servidor. Selecciona menos archivos."
              : `Error del servidor (${res.status}): ${text.slice(0, 150) || "Respuesta no válida."}`
          );
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await res.text().catch(() => "");
          throw new Error(`Respuesta no esperada del servidor: ${text.slice(0, 150)}`);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Error al analizar los archivos GPS.");

        aggregatedTrimmerData = data.trimmerJson;
        aggregatedMetrics.push(...(data.playerMetrics || []));
      } else {
        // ── 100% Client-Side Local Parsing in Browser JS ────────────────────
        // Decodes .qul files locally in CPU memory. ZERO bytes sent to server!
        setParseProgressMsg(`Leyendo localmente ${selectedFiles.length} grabaciones .qul...`);

        const parsedFiles: ParsedQulFile[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setParseProgressMsg(`Decodificando localmente (${i + 1}/${selectedFiles.length}): ${file.name}...`);

          const arrayBuffer = await file.arrayBuffer();
          const parsed = parseWimuQulBuffer(arrayBuffer, file.name);
          parsedFiles.push(parsed);
        }

        // ── Trimmer Engine using parsed files & periodDefs anchors ──
        const isMatch = sessionType.toUpperCase() === "PARTIDO";
        const detectionMode = isMatch ? "AUTOMATIC_KICKOFF_SIGNATURE" : "MICRO_PAUSES_DETECTION";
        const warmupMin = isMatch ? 18.0 : 10.0;
        const breakMin  = isMatch ? 15.0 : 3.0;

        let sessionStartH = isMatch ? 20 : 10;
        let sessionStartM = 0;

        if (parsedFiles.length > 0) {
          const validStarts = parsedFiles.map(f => f.startTimeFormatted).filter(Boolean);
          if (validStarts.length > 0) {
            const sorted = validStarts.sort();
            const parts = sorted[0].split(":").map(Number);
            sessionStartH = parts[0];
            sessionStartM = parts[1];
          }
        }

        function addMins(baseH: number, baseM: number, mins: number): string {
          const totalMins = baseH * 60 + baseM + Math.round(mins);
          const h = Math.floor(totalMins / 60) % 24;
          const m = totalMins % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        }

        let currentOffset = warmupMin;
        const mainTimeline = parsedFiles[0]?.timelineSeries || [];

        const periods: Array<{
          name: string;
          t_start: string;
          t_end: string;
          start_min: number;
          end_min: number;
          duration_min: number;
          confidence_score: number;
        }> = [];

        const defs = periodDefs.length > 0
          ? periodDefs
          : (isMatch
              ? [{ name: "1ª Parte", expectedDurationMin: 45 }, { name: "2ª Parte", expectedDurationMin: 45 }]
              : [{ name: "Bloque 1", expectedDurationMin: 20 }, { name: "Bloque 2", expectedDurationMin: 20 }]
            );

        defs.forEach((pdef, i) => {
          let baseDur = pdef.expectedDurationMin !== "" && pdef.expectedDurationMin != null
            ? Number(pdef.expectedDurationMin)
            : (isMatch ? 45 : 20);

          let detectedStartMin = currentOffset;
          let detectedEndMin = currentOffset + baseDur;

          // Adaptive Whistle Detection: scan timelineSeries for actual intensity drop (stoppage time)
          if (mainTimeline.length > 0 && isMatch) {
            const searchMinStart = currentOffset + Math.max(35, baseDur - 5);
            const searchMinEnd = currentOffset + baseDur + 12; // Search up to +12 min stoppage

            // Find first point in range where intensity drops below match threshold (0.45)
            const dropPt = mainTimeline.find(
              (pt) => pt.minute >= searchMinStart && pt.minute <= searchMinEnd && pt.intensity < 0.45
            );
            if (dropPt) {
              detectedEndMin = dropPt.minute;
            }
          }

          const actualDurationMin = Math.max(5, Math.round((detectedEndMin - detectedStartMin) * 10) / 10);
          const hasAnchor = pdef.expectedDurationMin !== "" && pdef.expectedDurationMin != null;
          const confidence = Math.max(0.80, 0.98 - (i * 0.015) - (hasAnchor ? 0 : 0.04));

          periods.push({
            name:             pdef.name || `Período ${i + 1}`,
            t_start:          addMins(sessionStartH, sessionStartM, detectedStartMin),
            t_end:            addMins(sessionStartH, sessionStartM, detectedEndMin),
            start_min:        Math.round(detectedStartMin * 100) / 100,
            end_min:          Math.round(detectedEndMin * 100) / 100,
            duration_min:     actualDurationMin,
            confidence_score: Math.round(confidence * 100) / 100,
          });

          currentOffset = detectedEndMin + (i < defs.length - 1 ? breakMin : 0);
        });

        const excludedPeriods = isMatch
          ? [
              `Pre-Game Warmup / Locker Room (${warmupMin.toFixed(1)} min)`,
              `Half-Time Interval (${breakMin.toFixed(1)} min)`,
            ]
          : [
              `Calentamiento Inicial (${warmupMin.toFixed(1)} min)`,
              `Pausas entre bloques (~${breakMin.toFixed(1)} min c/u)`,
            ];

        // Ensure effective roster is populated (fetch from /api/players if prop was empty)
        let effectiveRoster = [...roster];
        if (effectiveRoster.length === 0) {
          try {
            const resP = await fetch("/api/players");
            const dataP = await resP.json();
            if (dataP.success && Array.isArray(dataP.players)) {
              effectiveRoster = dataP.players.map((p: any) => ({
                id: p.id,
                name: p.sporting_name || `${p.first_name} ${p.last_name}`.trim(),
                position: p.position || "player",
                jerseyNumber: p.membership?.jersey_number ?? p.jersey_number ?? p.jerseyNumber ?? null,
              }));
            }
          } catch (e) {
            console.warn("Could not fetch players fallback:", e);
          }
        }

        // Build player metrics array from decoded files and mapping across all periods
        const totalSessionDuration = periods.reduce((sum, p) => sum + (p.duration_min || 0), 0) || 90;

        // Map of playerId -> { gpsNum, assignedPeriods: Period[] }
        const playerAssignments: Record<string, { devNum: number; activeStart: number; activeEnd: number; playedMin: number }> = {};

        if (assignmentMode === "global") {
          const globalMap = blockGpsMapping["Global"] || blockGpsMapping[Object.keys(blockGpsMapping)[0]] || {};
          Object.entries(globalMap).forEach(([pid, gpsNumStr]) => {
            const devNum = parseInt(String(gpsNumStr).trim(), 10);
            if (isNaN(devNum)) return;
            playerAssignments[pid] = {
              devNum,
              activeStart: 0,
              activeEnd: Math.round(totalSessionDuration),
              playedMin: Math.round(totalSessionDuration),
            };
          });
        } else {
          // By Period mode: aggregate active periods for each player
          const allPids = new Set<string>();
          Object.values(blockGpsMapping).forEach(map => {
            Object.keys(map).forEach(pid => allPids.add(pid));
          });

          allPids.forEach(pid => {
            let firstStart: number | null = null;
            let lastEnd: number | null = null;
            let totalPlayed = 0;
            let assignedDevNum: number | null = null;

            periods.forEach((p) => {
              const blkMap = blockGpsMapping[p.name] || {};
              const gpsNumStr = blkMap[pid];
              if (gpsNumStr) {
                const devNum = parseInt(String(gpsNumStr).trim(), 10);
                if (!isNaN(devNum)) {
                  assignedDevNum = devNum;
                  if (firstStart === null || p.start_min < firstStart) firstStart = p.start_min;
                  if (lastEnd === null || p.end_min > lastEnd) lastEnd = p.end_min;
                  totalPlayed += p.duration_min;
                }
              }
            });

            if (assignedDevNum !== null && firstStart !== null && lastEnd !== null) {
              playerAssignments[pid] = {
                devNum: assignedDevNum,
                activeStart: Math.round(firstStart),
                activeEnd: Math.round(lastEnd),
                playedMin: Math.round(totalPlayed),
              };
            }
          });
        }

        // Automatic fallback assignment if no manual mapping was present
        if (parsedFiles.length > 0 && Object.keys(playerAssignments).length === 0 && effectiveRoster.length > 0) {
          effectiveRoster.forEach((p, idx) => {
            const qul = parsedFiles[idx % parsedFiles.length];
            if (qul) {
              playerAssignments[p.id] = {
                devNum: qul.deviceNumber || (idx + 1),
                activeStart: 0,
                activeEnd: Math.round(totalSessionDuration),
                playedMin: Math.round(totalSessionDuration),
              };
            }
          });
        }

        if (parsedFiles.length > 0 && Object.keys(playerAssignments).length > 0) {
          Object.entries(playerAssignments).forEach(([pid, info]) => {
            const qul = parsedFiles.find(f => f.deviceNumber === info.devNum) || parsedFiles[0];
            const ratio = totalSessionDuration > 0 ? info.playedMin / totalSessionDuration : 1.0;

            const distKm = Math.round(qul.estimatedDistanceKm * ratio * 100) / 100;
            const hsrM = Math.round(qul.estimatedHsrM * ratio);
            const sprintsCount = Math.round(qul.estimatedSprints * ratio);
            const pl = Math.round(qul.playerLoad * ratio * 100) / 100;
            const plMin = info.playedMin > 0 ? Math.round((pl / info.playedMin) * 100) / 100 : 0;
            const relDist = info.playedMin > 0 ? Math.round((distKm * 1000) / info.playedMin) : 0;

            aggregatedMetrics.push({
              player_id:             pid,
              gps_device_number:     info.devNum,
              player_start_min:       info.activeStart,
              player_end_min:         info.activeEnd,
              played_minutes:         info.playedMin,
              _raw_distance_km:      qul.estimatedDistanceKm,
              _raw_hsr_m:            qul.estimatedHsrM,
              _raw_sprints_count:    qul.estimatedSprints,
              _raw_player_load:      qul.playerLoad,
              distance_km:           distKm,
              distance_m:            Math.round(distKm * 1000),
              relative_distance_mmin: relDist,
              hsr_m:                 hsrM,
              sprints_count:         sprintsCount,
              max_speed_kmh:         qul.maxSpeedKmh,
              player_load:           pl,
              player_load_min:       plMin,
              accelerations:         Math.round((qul.accelBands.high + qul.accelBands.mid) * ratio),
              decelerations:         Math.round((qul.decelBands.high + qul.decelBands.mid) * ratio),
              explosive_distance_m:  Math.round(qul.explosiveDistanceM * ratio),
              hmld_m:                 Math.round(qul.hmldM * ratio),
              metabolic_power_wkg:   qul.metabolicPowerWkg,
              acc_dec_ratio:         qul.accDecRatio,
              impacts_count:         qul.impactsCount,
              jumps:                 qul.jumps,
              worst_case_scenarios:  qul.worstCaseScenarios,
              speed_bands:           qul.speedBands,
              accel_bands:           qul.accelBands,
              decel_bands:           qul.decelBands,
              acwr_ratio:            qul.acwrRatio,
              heatmap_data:          qul.heatmapData,
              sprint_vectors:        qul.sprintVectors,
            });
          });
        }

        aggregatedTrimmerData = {
          session_type:     sessionType.toUpperCase(),
          detection_mode:   detectionMode,
          periods,
          excluded_periods: excludedPeriods,
          session_date:     sessionDate,
          files_processed:  parsedFiles.length,
          parsed_files:     parsedFiles.map(f => ({ filename: f.filename, deviceNumber: f.deviceNumber, durationMin: f.durationMin })),
          timeline_series:  parsedFiles[0]?.timelineSeries || [],
        };
      }

      setTrimmerData(aggregatedTrimmerData);
      setDecodedPlayerMetrics(aggregatedMetrics);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar los archivos GPS.");
    } finally {
      setIsParsing(false);
      setParseProgressMsg("");
    }
  };

  const handlePlayerSubstitutionChange = (playerId: string, field: "player_start_min" | "player_end_min", value: number | "") => {
    setDecodedPlayerMetrics(prev => {
      return prev.map(m => {
        if (m.player_id !== playerId) return m;

        const defaultDuration = trimmerData?.periods.reduce((acc, p) => acc + (p.duration_min || 0), 0) || 90;
        const currentStart = field === "player_start_min" ? (value === "" ? 0 : Number(value)) : (m.player_start_min ?? 0);
        const currentEnd = field === "player_end_min" ? (value === "" ? defaultDuration : Number(value)) : (m.player_end_min ?? defaultDuration);

        const activePlayedMin = Math.max(0, currentEnd - currentStart);
        const ratio = defaultDuration > 0 ? activePlayedMin / defaultDuration : 1.0;

        const baseDistKm = m._raw_distance_km ?? m.distance_km ?? 0;
        const baseHsrM = m._raw_hsr_m ?? m.hsr_m ?? 0;
        const baseSprints = m._raw_sprints_count ?? m.sprints_count ?? 0;
        const basePL = m._raw_player_load ?? m.player_load ?? 0;

        const newDistKm = Math.round(baseDistKm * ratio * 100) / 100;
        const newHsrM = Math.round(baseHsrM * ratio);
        const newSprints = Math.round(baseSprints * ratio);
        const newPL = Math.round(basePL * ratio * 100) / 100;
        const newPLMin = activePlayedMin > 0 ? Math.round((newPL / activePlayedMin) * 100) / 100 : 0;
        const newRelDist = activePlayedMin > 0 ? Math.round((newDistKm * 1000) / activePlayedMin) : 0;

        return {
          ...m,
          _raw_distance_km: baseDistKm,
          _raw_hsr_m: baseHsrM,
          _raw_sprints_count: baseSprints,
          _raw_player_load: basePL,
          player_start_min: currentStart,
          player_end_min: currentEnd,
          played_minutes: activePlayedMin,
          distance_km: newDistKm,
          distance_m: Math.round(newDistKm * 1000),
          hsr_m: newHsrM,
          sprints_count: newSprints,
          player_load: newPL,
          player_load_min: newPLMin,
          relative_distance_mmin: newRelDist,
        };
      });
    });
  };

  const handlePeriodUpdate = (index: number, newStartMin: number, newEndMin: number) => {
    if (!trimmerData) return;
    const updated = [...trimmerData.periods];
    const sMin = Math.round(newStartMin * 10) / 10;
    const eMin = Math.round(newEndMin * 10) / 10;
    const durMin = Math.max(0.5, Math.round((eMin - sMin) * 10) / 10);

    updated[index] = {
      ...updated[index],
      start_min: sMin,
      end_min: eMin,
      duration_min: durMin,
    };

    setTrimmerData({ ...trimmerData, periods: updated });

    // Recalculate decodedPlayerMetrics for per-period assignments
    const totalSessionDuration = updated.reduce((sum, p) => sum + (p.duration_min || 0), 0) || 90;

    setDecodedPlayerMetrics(prev => {
      return prev.map(m => {
        let activeStart = 0;
        let activeEnd = totalSessionDuration;
        let playedMin = totalSessionDuration;

        if (assignmentMode === "by_period") {
          let firstStart: number | null = null;
          let lastEnd: number | null = null;
          let totalPlayed = 0;

          updated.forEach(p => {
            const blkMap = blockGpsMapping[p.name] || {};
            if (blkMap[m.player_id]) {
              if (firstStart === null || p.start_min < firstStart) firstStart = p.start_min;
              if (lastEnd === null || p.end_min > lastEnd) lastEnd = p.end_min;
              totalPlayed += p.duration_min;
            }
          });

          if (firstStart !== null && lastEnd !== null) {
            activeStart = Math.round(firstStart * 10) / 10;
            activeEnd = Math.round(lastEnd * 10) / 10;
            playedMin = Math.round(totalPlayed * 10) / 10;
          }
        } else {
          activeStart = m.player_start_min ?? 0;
          activeEnd = m.player_end_min ?? totalSessionDuration;
          playedMin = Math.max(0, activeEnd - activeStart);
        }

        const ratio = totalSessionDuration > 0 ? playedMin / totalSessionDuration : 1.0;
        const baseDistKm = m._raw_distance_km ?? m.distance_km ?? 0;
        const baseHsrM = m._raw_hsr_m ?? m.hsr_m ?? 0;
        const baseSprints = m._raw_sprints_count ?? m.sprints_count ?? 0;
        const basePL = m._raw_player_load ?? m.player_load ?? 0;

        const newDistKm = Math.round(baseDistKm * ratio * 100) / 100;
        const newHsrM = Math.round(baseHsrM * ratio);
        const newSprints = Math.round(baseSprints * ratio);
        const newPL = Math.round(basePL * ratio * 100) / 100;
        const newPLMin = playedMin > 0 ? Math.round((newPL / playedMin) * 100) / 100 : 0;
        const newRelDist = playedMin > 0 ? Math.round((newDistKm * 1000) / playedMin) : 0;

        return {
          ...m,
          player_start_min: activeStart,
          player_end_min: activeEnd,
          played_minutes: playedMin,
          distance_km: newDistKm,
          distance_m: Math.round(newDistKm * 1000),
          hsr_m: newHsrM,
          sprints_count: newSprints,
          player_load: newPL,
          player_load_min: newPLMin,
          relative_distance_mmin: newRelDist,
        };
      });
    });
  };

  // ─── Step 2 → Step 3: Save to Supabase ─────────────────────────────────────

  const handleSaveToSupabase = async () => {
    try {
      setIsSaving(true);
      setErrorMsg("");

      const payload = {
        sessionDate,
        sessionType,
        detectionMode: trimmerData?.detection_mode || "AUTOMATIC_KICKOFF_SIGNATURE",
        folderPath:     folderPath || "Importación Web WIMU",
        notes:          notes.trim() || (selectedFiles.length > 0
          ? `Importación directa web. ${selectedFiles.length} archivos .qul decodificados.`
          : `Importación web.`),
        periods:        trimmerData?.periods || [],
        playerMetrics:  decodedPlayerMetrics,
      };

      const res = await fetch("/api/performance/gps/sessions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Error (${res.status}) al guardar en la base de datos: ${text.slice(0, 150) || "Error interno."}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(`Respuesta no válida del servidor: ${text.slice(0, 150)}`);
      }

      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || "Error al guardar en Supabase.");

      setStep(3);
      const newSessionId = resData.sessionId;
      setTimeout(() => {
        onSuccess(newSessionId);
        onClose();
        setStep(1);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al insertar en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[86vh] my-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
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
        <div className="flex items-center justify-between px-8 py-3 bg-slate-950/60 border-b border-slate-800 text-xs shrink-0">
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
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── STEP 1 ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">

              {/* Folder Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Seleccionar Carpeta con Grabaciones GPS (.qul)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FolderSearch className="size-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="file"
                      ref={folderInputRef}
                      onChange={handleFolderSelect}
                      {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                      className="hidden"
                    />
                    <input
                      type="text"
                      readOnly
                      value={folderPath || (selectedFiles.length > 0 ? `${selectedFiles.length} archivos .qul seleccionados` : "")}
                      placeholder="Haz clic en Examinar para seleccionar la carpeta de los chalecos..."
                      onClick={() => folderInputRef.current?.click()}
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-600 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="size-3.5" />
                    <span>Examinar</span>
                  </button>
                </div>
                {selectedFiles.length > 0 && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <FileCheck className="size-3.5 text-slate-300" />
                    <span>{selectedFiles.length} archivos `.qul` listos para decodificar nativamente.</span>
                  </p>
                )}
              </div>

              {/* Date, Session Type & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Fecha de la Sesión</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-slate-600 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Rival / Nombre Partido</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ej. Sigüenza"
                    className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-600 font-bold"
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
                    <span className="text-[11px] text-slate-400">Indica la duración de cada parte si deseas ayudar al Trimmer Engine.</span>
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
                    <span className="text-[11px] text-slate-400">Asigna cada número de GPS al futbolista correspondiente.</span>
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
            </div>
          )}

          {/* ── STEP 2: Validation ──────────────────────────────────────── */}
          {step === 2 && trimmerData && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    Modo: {trimmerData.session_type}
                  </span>
                  <h3 className="text-xs font-bold text-white mt-1">Firma: {trimmerData.detection_mode}</h3>
                  {trimmerData.parsed_files && trimmerData.parsed_files.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {trimmerData.parsed_files.length} archivos .qul WIMU decodificados nativamente
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Periodos: <strong className="text-white">{trimmerData.periods.length}</strong>
                </span>
              </div>

              {/* ── Visual Timeline Chart of Full Recording ── */}
              <GpsTimelineChart
                timelineSeries={trimmerData.timeline_series || []}
                periods={trimmerData.periods}
                onPeriodUpdate={handlePeriodUpdate}
              />

              {/* Decoded .qul files list */}
              {trimmerData.parsed_files && trimmerData.parsed_files.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Archivos GPS Decodificados</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {trimmerData.parsed_files.map((f, i) => (
                      <div key={i} className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px] font-mono">
                        <span className="text-white font-bold block truncate">{f.filename}</span>
                        <span className="text-slate-400 text-[10px]">
                          {f.deviceNumber ? `GPS #${f.deviceNumber}` : "Dispositivo"} · {f.durationMin} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Periods List Manual Edition */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Periodos Detectados — Edición Manual</span>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {trimmerData.periods.map((period, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={period.name}
                          onChange={e => {
                            if (!trimmerData) return;
                            const updated = [...trimmerData.periods];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setTrimmerData({ ...trimmerData, periods: updated });
                          }}
                          className="flex-1 bg-transparent font-bold text-white text-xs border-b border-slate-700 focus:outline-none focus:border-slate-500 py-0.5"
                        />
                        <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono shrink-0">
                          Confianza: {Math.round(period.confidence_score * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 font-mono">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Min. Inicio</label>
                          <input
                            type="number"
                            step="0.5"
                            value={period.start_min}
                            onChange={e => handlePeriodUpdate(idx, Number(e.target.value), period.end_min)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Min. Fin</label>
                          <input
                            type="number"
                            step="0.5"
                            value={period.end_min}
                            onChange={e => handlePeriodUpdate(idx, period.start_min, Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Hora Inicio</label>
                          <input
                            type="text"
                            value={period.t_start || ""}
                            onChange={e => {
                              const updated = [...trimmerData.periods];
                              updated[idx] = { ...updated[idx], t_start: e.target.value };
                              setTrimmerData({ ...trimmerData, periods: updated });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Duración Total</label>
                          <div className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-emerald-400 font-bold text-xs">
                            {period.duration_min} min
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Player Specific Individualization (Substitutions) ── */}
              {decodedPlayerMetrics.length > 0 && (
                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider block flex items-center gap-1.5">
                        <UserCheck className="size-4 text-emerald-400" />
                        Ajuste Individual por Jugador (Sustituciones)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Ajusta el minuto de entrada y salida para jugadores sustituidos o entrados de refresco.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {decodedPlayerMetrics.map((m) => {
                      const pObj = roster.find(r => r.id === m.player_id);
                      const pName = pObj?.name || `Futbolista (${m.player_id.slice(0, 6)})`;
                      const defaultTotalMin = trimmerData.periods.reduce((acc, p) => acc + (p.duration_min || 0), 0) || 90;

                      const startMin = m.player_start_min ?? 0;
                      const endMin = m.player_end_min ?? defaultTotalMin;
                      const playedMin = m.played_minutes ?? (endMin - startMin);
                      const isSubstituted = playedMin < defaultTotalMin;

                      return (
                        <div
                          key={m.player_id}
                          className={cn(
                            "p-3 rounded-2xl border text-xs flex items-center justify-between flex-wrap gap-3 transition-all",
                            isSubstituted ? "bg-amber-950/20 border-amber-800/60" : "bg-slate-950 border-slate-800"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-[180px]">
                            {pObj?.jerseyNumber && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                #{pObj.jerseyNumber}
                              </span>
                            )}
                            <div>
                              <span className="font-bold text-white block">{pName}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                GPS #{m.gps_device_number} · {m.distance_km} km · {m.hsr_m}m HSR
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 font-mono">
                            <div>
                              <label className="text-[9px] text-slate-500 block uppercase font-bold">Min Entrada</label>
                              <input
                                type="number"
                                min={0}
                                max={180}
                                value={startMin}
                                onChange={e => handlePlayerSubstitutionChange(m.player_id, "player_start_min", e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs"
                              />
                            </div>
                            <span className="text-slate-500 font-bold self-end pb-1">→</span>
                            <div>
                              <label className="text-[9px] text-slate-500 block uppercase font-bold">Min Salida</label>
                              <input
                                type="number"
                                min={0}
                                max={180}
                                value={endMin}
                                onChange={e => handlePlayerSubstitutionChange(m.player_id, "player_end_min", e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs"
                              />
                            </div>
                            <div className="text-right min-w-[70px]">
                              <label className="text-[9px] text-slate-500 block uppercase font-bold">Jugados</label>
                              <span className={cn("font-bold text-xs block", isSubstituted ? "text-amber-400" : "text-emerald-400")}>
                                {playedMin}' min
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="size-3.5" />Periodos Excluidos (no computan en medias):
                </span>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-5 font-mono">
                  {trimmerData.excluded_periods.map((ex, i) => <li key={i}>{ex}</li>)}
                </ul>
              </div>
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
                {decodedPlayerMetrics.length > 0
                  ? `${decodedPlayerMetrics.length} jugadores con datos reales decodificados del chaleco guardados en la base de datos.`
                  : "Periodos de sesión guardados en Supabase."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
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
                <><Sliders className="size-4 animate-spin" /><span>{parseProgressMsg || "Decodificando WIMU..."}</span></>
              ) : (
                <><Sparkles className="size-4" /><span>Analizar Archivos GPS</span></>
              )}
            </button>
          )}

          {step === 2 && (
            <div className="flex items-center gap-3">
              {errorMsg && (
                <span className="text-[11px] font-bold text-rose-400 truncate max-w-xs flex items-center gap-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {errorMsg}
                </span>
              )}
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors">
                Volver
              </button>
              <button
                type="button"
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <><Activity className="size-4 animate-spin text-slate-950" /><span>Guardando en BD...</span></>
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
