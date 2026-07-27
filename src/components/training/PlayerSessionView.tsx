"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  Timer,
  ChevronLeft,
  Users,
  AlertTriangle,
  Lightbulb,
  FileText,
  BookmarkCheck,
  CheckCircle,
  HelpCircle,
  Monitor,
  Smartphone,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerSessionViewProps {
  session: any;
  isPreview?: boolean;
  userRole?: string;
  isPlayer?: boolean;
  orgSettings?: any;
}

export function getExerciseTotalDuration(ex: any): number {
  if (!ex) return 0;
  const gs = ex.group_setup || {};
  if (gs.use_variable_series && Array.isArray(gs.series) && gs.series.length > 0) {
    return gs.series.reduce((sum: number, s: any) => sum + Number(s.duration_min || 0), 0);
  }
  if (ex.use_variable_series && Array.isArray(ex.series) && ex.series.length > 0) {
    return ex.series.reduce((sum: number, s: any) => sum + Number(s.duration_min || 0), 0);
  }
  const nSeries = Number(gs.num_series || ex.num_series || 1);
  const sDuration = Number(gs.series_duration_min || ex.series_duration_min || ex.duration_min || 15);
  return nSeries * sDuration;
}

export function isGoalkeeper(p: any): boolean {
  if (!p) return false;
  const playerObj = p.player || p;
  
  const positionsArray: string[] = 
    playerObj.membership?.positions || 
    playerObj.positions || 
    p.membership?.positions || 
    p.positions || 
    [];
  
  if (Array.isArray(positionsArray) && positionsArray.length > 0) {
    if (positionsArray.some((pos: string) => {
      const s = String(pos).toLowerCase();
      return s.includes("goalkeeper") || s.includes("por") || s === "gk";
    })) {
      return true;
    }
  }

  const posStr = String(
    playerObj.primary_position || 
    playerObj.position || 
    p.primary_position || 
    p.position || 
    ""
  ).toLowerCase();

  return (
    posStr.includes("goalkeeper") ||
    posStr.includes("portero") ||
    posStr.includes("por") ||
    posStr === "gk"
  );
}

export function PlayerSessionView({
  session,
  isPreview = false,
  userRole,
  isPlayer,
  orgSettings = {}
}: PlayerSessionViewProps) {
  const router = useRouter();

  // Smart device detector state
  const [deviceLayout, setDeviceLayout] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || window.innerWidth < 768;
      setDeviceLayout(isMobile ? "mobile" : "desktop");

      const handleResize = () => {
        if (window.innerWidth < 768) {
          setDeviceLayout("mobile");
        } else {
          setDeviceLayout("desktop");
        }
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Extract variables
  const title = session.title || "Sesión de Entrenamiento";
  const date = session.date ? new Date(session.date) : new Date();
  const startTime = session.start_time ? session.start_time.slice(0, 5) : "10:00";
  const durationMin = session.duration_min || 90;
  const exercises = session.exercises || [];
  const tacticalConcepts = session.tactical_concepts || [];
  const muscleGroups = session.muscle_groups || [];
  
  // Resolve facilities/installations names
  const facilityNames = session.facilities?.map((f: any) => f.name).join(", ") || "Campo Principal";

  const sessionStatus: "planned" | "completed" | "cancelled" = session.status || "planned";
  const playerCallStatus: "called" | "not_called" | "pending" = "called";

  // Check 2-hour pre-start lock for group training sessions ("training")
  const isPlayerUser = isPlayer ?? (userRole === "player");
  const isGroupTraining = session.session_type === "training";
  const dateStr = session.date || "";
  const rawTimeStr = session.start_time || "10:00:00";
  const timeStr = rawTimeStr.length === 5 ? `${rawTimeStr}:00` : rawTimeStr;
  const sessionStartMs = dateStr ? new Date(`${dateStr}T${timeStr}`).getTime() : 0;
  const twoHoursBeforeMs = sessionStartMs ? sessionStartMs - (2 * 60 * 60 * 1000) : 0;
  
  // The 2-hour lock applies ONLY to players and not when in preview mode
  const isLockedForPlayers = isPlayerUser && !isPreview && isGroupTraining && sessionStartMs > 0 && Date.now() < twoHoursBeforeMs;

  if (isLockedForPlayers) {
    const openObj = new Date(twoHoursBeforeMs);
    const openTimeStr = openObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const openDateStr = openObj.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

    return (
      <div className="bg-slate-950 text-white min-h-screen pb-16 flex flex-col font-sans">
        <div className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/90 border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-slate-300">Ficha de Entrenamiento</span>
          <div className="w-9" />
        </div>

        <div className="p-4 md:p-8 max-w-xl mx-auto w-full my-auto space-y-6 text-center">
          <div className="size-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Lock className="size-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">
              Contenido Reservado Hasta 2 Horas Antes
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
              Por política de preparación del cuerpo técnico, los contenidos y ejercicios de la sesión de entrenamiento grupal estarán disponibles para la plantilla <strong>2 horas antes de su inicio</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs text-left">
            <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-semibold">Apertura para jugadores:</span>
              <span className="font-extrabold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                {openTimeStr} hs ({openDateStr})
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Sesión:</span>
              <span className="font-bold text-white">{title}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Inicio de entrenamiento:</span>
              <span className="font-bold text-slate-200">{startTime} hs</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Lugar:</span>
              <span className="font-bold text-slate-200">{facilityNames}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-white min-h-screen pb-16 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* ── TOP NAV BAR ── */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/90 border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isPreview) {
                window.close();
              } else {
                router.back();
              }
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all text-slate-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-xs font-bold text-white block">
              {isPreview ? "Informe de Sesión (Vista Previa)" : "Ficha de Entrenamiento"}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block">{title}</span>
          </div>
        </div>

        {/* Smart Device Layout Switcher Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setDeviceLayout("desktop")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              deviceLayout === "desktop"
                ? "bg-emerald-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Vista Escritorio / PC</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceLayout("mobile")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              deviceLayout === "mobile"
                ? "bg-emerald-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Vista Móvil</span>
          </button>
        </div>
      </div>

      {/* ── BODY CONTAINER ── */}
      <div className={cn("p-4 md:p-8 space-y-6 flex-1", deviceLayout === "mobile" ? "max-w-md mx-auto w-full" : "max-w-6xl mx-auto w-full")}>
        
        {/* ── ALERT BANNER IF PREVIEW MODE ── */}
        {isPreview && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-2xl flex gap-3 items-start text-xs">
            <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Modo Simulación de Dispositivo Activo</p>
              <p className="text-[11px] text-emerald-400/80 leading-normal mt-0.5">
                Estás visualizando el informe del entrenamiento en formato <strong className="text-white">{deviceLayout === "desktop" ? "Escritorio / PC" : "Móvil"}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* ── TABLA DE CABECERA EXCLUSIVA PARA CUERPO TÉCNICO Y ADMIN ── */}
        {!isPlayerUser && (
          <div className="border-2 border-slate-700 bg-slate-900 rounded-2xl overflow-hidden text-white font-sans text-xs shadow-2xl mb-6">
            {(() => {
              const nonBlock0Exercises = exercises.filter((ex: any) => ex.block_type !== 'block_0');
              const nonBlock0Duration = nonBlock0Exercises.reduce(
                (acc: number, ex: any) => acc + getExerciseTotalDuration(ex),
                0
              );
              const block0Duration = exercises
                .filter((ex: any) => ex.block_type === 'block_0')
                .reduce((acc: number, ex: any) => acc + getExerciseTotalDuration(ex), 0);

              const effectiveDuration = nonBlock0Duration > 0 ? nonBlock0Duration : Math.max(0, Number(durationMin) - block0Duration);

              const attendanceList = Array.isArray(session.attendance) ? session.attendance : [];
              const squadList = attendanceList.map((att: any) => {
                const playerObj = att.player || att;
                const isGK = isGoalkeeper(att);
                return {
                  id: playerObj?.id || att.player_id,
                  name: playerObj?.first_name ? `${playerObj.first_name} ${playerObj.last_name?.charAt(0) || ""}.` : (playerObj?.sporting_name || "Jugador"),
                  position: playerObj?.primary_position || (playerObj?.positions?.[0]) || "",
                  status: att.status ?? "present",
                  isGK,
                };
              });

              const entrenaPlayers = squadList.filter((p: any) => p.status === "present");
              const lesionPlayers = squadList.filter((p: any) => p.status === "injured");
              const variosPlayers = squadList.filter((p: any) => p.status === "absent");
              const enfermoPlayers = squadList.filter((p: any) => p.status === "readaptation");
              const parcialPlayers = squadList.filter((p: any) => p.status === "partial");

              const presentGoalkeepers = entrenaPlayers.filter((p: any) => p.isGK);
              const presentFieldPlayersCount = entrenaPlayers.length - presentGoalkeepers.length;
              const presentGoalkeepersCount = presentGoalkeepers.length;
              const presentTotalCount = entrenaPlayers.length;

              const mesoVal = session.metrics?.meso || session.mesocycle || "1";
              const microVal = session.metrics?.micro || session.microcycle_day || "1";
              const weekSeqVal = session.session_week_seq || "1";
              const totalSeqVal = session.session_total_seq || "1";
              const seasonVal = session.season?.name || "2026-2027";

              return (
                <div className="w-full overflow-x-auto rounded-2xl border-2 border-slate-700">
                  <div className="min-w-[650px] divide-y-2 divide-slate-700">
                    {/* Row 1: Logo & Session Metadata Grid */}
                    <div className="flex flex-row">
                      {/* Club Logo Box */}
                      <div className="w-28 border-r-2 border-slate-700 p-2 flex flex-col items-center justify-center bg-slate-950 shrink-0">
                        {orgSettings.club_logo_url ? (
                          <img
                            src={orgSettings.club_logo_url}
                            alt="Escudo"
                            className="h-14 w-14 object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-black text-center uppercase tracking-tighter text-slate-300">CLUB LAB</span>
                        )}
                      </div>

                      {/* Metadata Table Grid */}
                      <div className="flex-1 grid grid-cols-8 divide-x divide-slate-700 text-center font-bold">
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">TEMPORADA</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{seasonVal}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">FECHA</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{date.toLocaleDateString("es-ES")}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">HORA</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{startTime}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">MESO</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{mesoVal}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">MICRO</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{microVal}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">ORDEN SEM.</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{weekSeqVal}</div>
                        </div>
                        <div className="flex flex-col p-1">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">SESIÓN</div>
                          <div className="py-1.5 text-xs font-black text-slate-100">{totalSeqVal}</div>
                        </div>
                        <div className="flex flex-col p-1 bg-sky-950/60">
                          <div className="bg-sky-600 text-white text-[9px] py-0.5 uppercase tracking-wider rounded-sm">DURACIÓN</div>
                          <div className="py-1.5 text-xs font-black text-sky-200">{effectiveDuration} min</div>
                        </div>
                      </div>
                    </div>

                  {/* Row 2: Objetivos Header */}
                  <div className="bg-slate-800 text-center py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                    OBJETIVOS DE LA SESIÓN
                  </div>

                  {/* Row 3: Objetivos Físicos */}
                  <div className="flex items-stretch">
                    <div className="w-28 bg-sky-700 text-white text-[10px] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-700 shrink-0 py-1.5">
                      FÍSICOS
                    </div>
                    <div className="flex-1 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide flex items-center text-slate-200">
                      {muscleGroups.length > 0
                        ? muscleGroups.map((mg: string) => mg.replace(/_/g, " ")).join(", ").toUpperCase()
                        : "—"}
                    </div>
                  </div>

                  {/* Row 4: Objetivos Tácticos */}
                  <div className="flex items-stretch">
                    <div className="w-28 bg-sky-700 text-white text-[10px] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-700 shrink-0 py-1.5">
                      TÁCTICOS
                    </div>
                    <div className="flex-1 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide flex items-center text-slate-200">
                      {tacticalConcepts.length > 0
                        ? tacticalConcepts.map((tc: string) => tc.replace(/_/g, " ")).join(", ").toUpperCase()
                        : "—"}
                    </div>
                  </div>

                  {/* Row 5: Convocatoria Grid */}
                  <div className="flex flex-col md:flex-row">
                    {/* Left Roster Counts Box */}
                    <div className="w-full md:w-32 border-b-2 md:border-b-0 md:border-r-2 border-slate-700 flex flex-row md:flex-col justify-between text-center shrink-0 bg-slate-950 p-1">
                      <div className="hidden md:block bg-sky-700 text-white text-[9px] font-extrabold py-0.5 uppercase tracking-wider rounded-sm">PLANTILLA</div>
                      <div className="py-1 px-2 md:px-0 border-r md:border-r-0 md:border-b border-slate-800 flex-1">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Jug. Dispo.</span>
                        <span className="text-xs font-extrabold text-white">{presentFieldPlayersCount}</span>
                      </div>
                      <div className="py-1 px-2 md:px-0 border-r md:border-r-0 md:border-b border-slate-800 flex-1">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Port. Dispo.</span>
                        <span className="text-xs font-extrabold text-white">{presentGoalkeepersCount}</span>
                      </div>
                      <div className="py-1 px-2 md:px-0 bg-sky-950 flex-1">
                        <span className="block text-[8px] font-bold text-sky-400 uppercase">Total Dispo.</span>
                        <span className="text-xs font-black text-sky-200">{presentTotalCount}</span>
                      </div>
                    </div>

                    {/* Right Attendance Grid of 5 Rows */}
                    {(() => {
                      const ROWS_COUNT = 5;
                      const totalPlayers = squadList.length;
                      const colsCount = Math.max(1, Math.ceil(totalPlayers / ROWS_COUNT));

                      const gridRows = Array.from({ length: ROWS_COUNT }, (_, rowIndex) => {
                        return Array.from({ length: colsCount }, (_, colIndex) => {
                          const playerIndex = colIndex * ROWS_COUNT + rowIndex;
                          return squadList[playerIndex] || null;
                        });
                      });

                      return (
                        <div className="flex-1 overflow-x-auto">
                          {/* Legend Header Bar */}
                          <div className="bg-slate-800 text-white px-2 py-1 flex items-center justify-around text-[9px] font-extrabold uppercase tracking-wider border-b-2 border-slate-700">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="bg-emerald-600 text-white px-1 rounded text-[7.5px]">S</span> ENTRENA
                            </span>
                            <span className="flex items-center gap-1 text-rose-400">
                              <span className="bg-rose-600 text-white px-1 rounded text-[7.5px]">L</span> LESIÓN
                            </span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <span className="bg-amber-600 text-white px-1 rounded text-[7.5px]">V</span> VARIOS
                            </span>
                            <span className="flex items-center gap-1 text-pink-400">
                              <span className="bg-pink-600 text-white px-1 rounded text-[7.5px]">E</span> ENFERMO / REA
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400">
                              <span className="bg-yellow-400 text-slate-950 px-1 rounded text-[7.5px]">P</span> PARCIAL
                            </span>
                          </div>

                          {/* 5-Row Grid Table */}
                          <div className="p-1.5 space-y-1 bg-slate-950">
                            {gridRows.map((row, rIdx) => (
                              <div key={rIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(100px, 1fr))` }}>
                                {row.map((p: any, cIdx: number) => {
                                  if (!p) return <div key={cIdx} className="h-6" />;

                                  const displayName = (p.isGK || isGoalkeeper(p)) && !p.name.includes("(P)") ? `${p.name} (P)` : p.name;

                                  let badgeLetter = "S";
                                  let badgeBg = "bg-emerald-600 text-white";
                                  let textColor = "text-emerald-300";
                                  let borderBg = "border-emerald-800/40 bg-emerald-950/40";

                                  if (p.status === "injured") {
                                    badgeLetter = "L";
                                    badgeBg = "bg-rose-600 text-white";
                                    textColor = "text-rose-300";
                                    borderBg = "border-rose-800/40 bg-rose-950/40";
                                  } else if (p.status === "absent") {
                                    badgeLetter = "V";
                                    badgeBg = "bg-amber-600 text-white";
                                    textColor = "text-amber-300";
                                    borderBg = "border-amber-800/40 bg-amber-950/40";
                                  } else if (p.status === "readaptation") {
                                    badgeLetter = "E";
                                    badgeBg = "bg-pink-600 text-white";
                                    textColor = "text-pink-300";
                                    borderBg = "border-pink-800/40 bg-pink-950/40";
                                  } else if (p.status === "partial") {
                                    badgeLetter = "P";
                                    badgeBg = "bg-yellow-400 text-slate-950";
                                    textColor = "text-yellow-300";
                                    borderBg = "border-yellow-800/40 bg-yellow-950/40";
                                  }

                                  return (
                                    <div
                                      key={p.id || cIdx}
                                      className={cn("flex justify-between items-center px-1.5 py-0.5 rounded border text-[9px] font-extrabold h-6", borderBg, textColor)}
                                    >
                                      <span className="truncate">{displayName}</span>
                                      <span className={cn("text-[7.5px] font-black rounded px-1 ml-0.5 shrink-0", badgeBg)}>
                                        {badgeLetter}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ENCABEZADO ESTÁNDAR PARA JUGADORES ── */}
        {isPlayerUser && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sessionStatus === "planned" && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      Próximo Entrenamiento
                    </span>
                  )}
                  {sessionStatus === "completed" && (
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                      Completado
                    </span>
                  )}
                  {playerCallStatus === "called" && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <BookmarkCheck className="h-3 w-3" />
                      Convocado
                    </span>
                  )}
                </div>

                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {title}
                </h1>
              </div>

              {orgSettings.club_logo_url && (
                <img
                  src={orgSettings.club_logo_url}
                  alt="Logo"
                  className="h-12 w-12 object-contain rounded-xl bg-slate-950 p-1 border border-slate-800 hidden md:block"
                />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-slate-800 pt-4 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <CalendarDays className="h-4 w-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Fecha</span>
                  <span className="font-semibold text-slate-200">{date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <Clock className="h-4 w-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Hora</span>
                  <span className="font-semibold text-slate-200">{startTime} h</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <Timer className="h-4 w-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Duración</span>
                  <span className="font-semibold text-slate-200">{durationMin} min</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Lugar</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[140px] block">{facilityNames}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EJERCICIOS AGRUPADOS POR BLOQUES (BLOQUE 0, BLOQUE 1, BLOQUE 2, BLOQUE 3) ── */}
        <div className="space-y-8">
          {exercises.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
              <HelpCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs font-semibold">No hay ejercicios publicados para esta sesión.</p>
            </div>
          ) : (
            ([
              {
                key: "block_0",
                blockLabel: "Bloque 0",
                title: "PREVIO AL ENTRENAMIENTO",
                icon: "⚡",
                badgeColor: "text-purple-400 bg-purple-400/10 border-purple-400/20",
              },
              {
                key: "warmup",
                blockLabel: "Bloque 1",
                title: "CALENTAMIENTO",
                icon: "🔥",
                badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
              },
              {
                key: "main",
                blockLabel: "Bloque 2",
                title: "PARTE PRINCIPAL",
                icon: "⚽",
                badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
              },
              {
                key: "cooldown",
                blockLabel: "Bloque 3",
                title: "VUELTA A LA CALMA",
                icon: "🧘",
                badgeColor: "text-sky-400 bg-sky-400/10 border-sky-400/20",
              },
            ] as const).map((blockConfig) => {
              const blockExercises = exercises.filter((ex: any) => {
                const bt = String(ex.block_type || ex.group_setup?.block_type || "").toLowerCase();
                const isB0 = bt === "block0" || bt === "block_0";
                const isWarmup = bt === "warmup";
                const isCooldown = bt === "cooldown";
                const isMain = bt === "main" || (!bt && !isB0 && !isWarmup && !isCooldown);

                if (blockConfig.key === "block_0") return isB0;
                if (blockConfig.key === "warmup") return isWarmup;
                if (blockConfig.key === "cooldown") return isCooldown;
                if (blockConfig.key === "main") return isMain;
                return false;
              });

              if (blockExercises.length === 0) return null;

              const blockTotalDuration = blockExercises.reduce(
                (acc: number, ex: any) => acc + getExerciseTotalDuration(ex),
                0
              );

              return (
                <div key={blockConfig.key} className="space-y-3 pt-1 w-full print:break-inside-avoid">
                  {/* Limpio Header de Bloque a Ancho Completo Sin Emoticonos */}
                  <div className="flex items-center justify-between gap-3 py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-800 w-full shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {blockConfig.blockLabel}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                        {blockConfig.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                      {blockExercises.length} tarea{blockExercises.length !== 1 ? 's' : ''} • {blockTotalDuration} min
                    </span>
                  </div>

                  {/* Grid Dinámico de Ejercicios del Bloque (Ajustado según cantidad 1, 2 o 3 tareas) */}
                  <div className={cn(
                    "grid gap-3 w-full",
                    deviceLayout === "mobile"
                      ? "grid-cols-1"
                      : blockExercises.length === 1
                      ? "grid-cols-1"
                      : blockExercises.length === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {blockExercises.map((ex: any, idx: number) => {
                      const gs = ex.group_setup || {};
                      const rawGroups = gs.groups || [];
                      const rules = gs.rules || "";
                      const notes = gs.objective_notes || "";

                      // Filter only groups with at least 1 assigned player
                      const assignedGroups = rawGroups.filter((g: any) => {
                        const playerIds = g.players ?? [];
                        return Array.isArray(playerIds) && playerIds.length > 0;
                      });

                      const totalExDuration = getExerciseTotalDuration(ex);
                      const numSeries = Number(gs.num_series || ex.num_series || 1);
                      const seriesDuration = Number(gs.series_duration_min || ex.series_duration_min || ex.duration_min || 15);

                      return (
                        <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between w-full min-w-0 overflow-hidden print:break-inside-avoid">
                          <div className="space-y-3 w-full min-w-0">
                            {/* Card Header Compacto */}
                            <div className="flex justify-between items-start gap-2 border-b border-slate-800/80 pb-2 w-full min-w-0">
                              <div className="flex gap-2 items-start min-w-0 flex-1">
                                <span className="h-5 w-5 rounded bg-slate-800 border border-slate-700 font-extrabold text-slate-300 text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-extrabold text-xs sm:text-sm text-white leading-snug break-words">{ex.title || ex.exercise?.title}</h4>
                                  <span className="inline-block rounded px-1.5 py-0.5 text-[8px] font-bold border mt-1 uppercase tracking-wider bg-slate-800 text-slate-300 border-slate-700">
                                    {ex.category || "General"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right text-[11px] font-bold text-slate-300 shrink-0 ml-1">
                                <span className="whitespace-nowrap">{totalExDuration} min</span>
                                {numSeries > 1 && (
                                  <p className="text-[9px] text-slate-400 font-normal mt-0.5 whitespace-nowrap">{numSeries}x{seriesDuration}m</p>
                                )}
                              </div>
                            </div>

                            {/* Whiteboard / Pitch Zone */}
                            {ex.whiteboard_data?.imageDataUrl ? (
                              <div className="border border-slate-800 rounded-lg bg-slate-950 w-full overflow-hidden flex items-center justify-center p-1.5">
                                <img
                                  src={ex.whiteboard_data.imageDataUrl}
                                  alt={`Pizarra táctica ${ex.title}`}
                                  className="w-full h-auto max-h-48 object-contain rounded"
                                />
                              </div>
                            ) : ex.pitch_zones && ex.pitch_zones.length > 0 && (
                              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center w-full">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Zonas del campo</span>
                                <span className="text-[10px] font-bold text-slate-300 mt-0.5 block">{ex.pitch_zones.join(", ")}</span>
                              </div>
                            )}

                            {/* Group Divisions - ONLY RENDERED IF PLAYERS ARE ASSIGNED */}
                            {assignedGroups.length > 0 && (
                              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5 w-full min-w-0">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                  <Users className="h-3 w-3 text-slate-400" />
                                  DISTRIBUCIÓN DE EQUIPOS / GRUPOS
                                </span>
                                <div className="grid grid-cols-1 gap-1.5 w-full min-w-0">
                                  {assignedGroups.map((g: any, gIdx: number) => {
                                    const playerNames = (g.players ?? []).map((pId: string) => {
                                      const pl = session.attendance?.find((at: any) => (at.player?.id || at.player_id) === pId)?.player;
                                      return pl ? (pl.sporting_name || pl.first_name) : "";
                                    }).filter(Boolean).join(", ");

                                    return (
                                      <div key={gIdx} className="bg-slate-900 border border-slate-800 p-1.5 rounded text-[10px] w-full min-w-0">
                                        <span className="block font-bold text-slate-300 uppercase tracking-wide text-[9px]">{g.name}</span>
                                        <p className="text-slate-400 leading-tight mt-0.5 font-medium break-words">{playerNames}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Rules / Notes - ONLY RENDERED IF NOT EMPTY */}
                            {(rules || notes) && (
                              <div className="space-y-1.5 border-t border-slate-800/80 pt-2 text-[10px] leading-snug w-full min-w-0">
                                {notes && (
                                  <div>
                                    <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px]">Pautas del Ejercicio</span>
                                    <p className="text-slate-300 whitespace-pre-wrap mt-0.5 bg-slate-950 border border-slate-800 rounded-lg p-2 font-medium break-words">{notes}</p>
                                  </div>
                                )}
                                {rules && (
                                  <div>
                                    <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px]">Normas / Consignas</span>
                                    <p className="text-slate-300 whitespace-pre-wrap mt-0.5 bg-slate-950 border border-slate-800 rounded-lg p-2 font-medium break-words">{rules}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
