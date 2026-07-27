"use client";

import { useMemo } from "react";
import WhiteboardPrintRenderer from "./WhiteboardPrintRenderer";
import { TACTICAL_CONCEPTS, MUSCLE_GROUPS } from "@/lib/exercise-taxonomy";
import { cn } from "@/lib/utils";

interface SessionPrintReportProps {
  session: any;
  organizationSettings?: any;
  teamName?: string;
  activeSquadPlayers?: any[];
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

export function SessionPrintReport({
  session,
  organizationSettings = {},
  teamName,
  activeSquadPlayers = []
}: SessionPrintReportProps) {
  if (!session) return null;

  // Metadata calculations
  const title = session.title || "Sesión de Entrenamiento";
  const dateStr = session.date ? new Date(session.date).toLocaleDateString("es-ES") : "—";
  const startTime = session.start_time ? session.start_time.slice(0, 5) : "10:00";
  const durationMin = session.duration_min || 90;
  const exercises: any[] = session.exercises || [];

  // Objectives resolving
  const sessionMuscleGroups: string[] = session.muscle_groups || [];
  const sessionTacticalConcepts: string[] = session.tactical_concepts || [];

  const muscleLabels = useMemo(() => {
    if (!sessionMuscleGroups.length) return "—";
    return sessionMuscleGroups
      .map(key => MUSCLE_GROUPS.find(m => m.key === key)?.label || key)
      .join(", ")
      .toUpperCase();
  }, [sessionMuscleGroups]);

  const tacticalLabels = useMemo(() => {
    if (!sessionTacticalConcepts.length) return "—";
    return sessionTacticalConcepts
      .map(key => TACTICAL_CONCEPTS.find(c => c.key === key)?.label || key)
      .join(", ")
      .toUpperCase();
  }, [sessionTacticalConcepts]);

  // Duration excluding Block 0
  const nonBlock0Exercises = exercises.filter((ex) => {
    const bt = String(ex.block_type || ex.group_setup?.block_type || "").toLowerCase();
    return bt !== 'block_0' && bt !== 'block0';
  });
  const nonBlock0Duration = nonBlock0Exercises.reduce((acc, ex) => acc + getExerciseTotalDuration(ex), 0);
  const block0Duration = exercises
    .filter((ex) => {
      const bt = String(ex.block_type || ex.group_setup?.block_type || "").toLowerCase();
      return bt === 'block_0' || bt === 'block0';
    })
    .reduce((acc, ex) => acc + getExerciseTotalDuration(ex), 0);
  const effectiveDuration = nonBlock0Duration > 0 ? nonBlock0Duration : Math.max(0, Number(durationMin) - block0Duration);

  // Metrics
  const meso = session.metrics?.meso || session.mesocycle || "1";
  const micro = session.metrics?.micro || session.microcycle_day || "1";
  const weekSeq = session.week_sequence || session.sessionWeekSeq || "1";
  const totalSeq = session.total_sequence || session.sessionTotalSeq || "1";

  // Attendance calculation
  const attendanceList: any[] = session.attendance || [];

  // Build squad list from attendance or activeSquadPlayers prop
  const squadList = useMemo(() => {
    if (activeSquadPlayers.length > 0) {
      return activeSquadPlayers.map(p => {
        const atRecord = attendanceList.find(a => (a.player_id || a.player?.id) === p.id);
        const status = atRecord?.status ?? 'present';
        const isGK = Boolean(
          p.membership?.positions?.some((pos: string) => String(pos).toLowerCase().includes('por') || String(pos).toLowerCase().includes('gk')) ||
          p.primary_position?.toLowerCase().includes('por')
        );
        const displayName = `${p.first_name || ''} ${p.last_name ? p.last_name.charAt(0) + '.' : ''}`.trim() + (isGK ? ' (P)' : '');
        return { id: p.id, displayName, status, isGK };
      });
    }

    return attendanceList.map(at => {
      const pl = at.player || {};
      const isGK = Boolean(
        pl.membership?.positions?.some((pos: string) => String(pos).toLowerCase().includes('por') || String(pos).toLowerCase().includes('gk')) ||
        pl.primary_position?.toLowerCase().includes('por') ||
        pl.positions?.some((pos: string) => String(pos).toLowerCase().includes('por'))
      );
      const name = pl.sporting_name || `${pl.first_name || ''} ${pl.last_name ? pl.last_name.charAt(0) + '.' : ''}`.trim() || 'Jugador';
      const displayName = name + (isGK ? ' (P)' : '');
      return { id: pl.id || at.player_id, displayName, status: at.status || 'present', isGK };
    });
  }, [activeSquadPlayers, attendanceList]);

  const presentPlayers = squadList.filter(p => p.status === 'present');
  const presentGKCount = presentPlayers.filter(p => p.isGK).length;
  const presentFieldCount = presentPlayers.length - presentGKCount;

  // Grid distribution for attendance (5 rows max)
  const ROWS_COUNT = 5;
  const colsCount = Math.max(1, Math.ceil(squadList.length / ROWS_COUNT));
  const gridRows = Array.from({ length: ROWS_COUNT }, (_, rowIndex) => {
    return Array.from({ length: colsCount }, (_, colIndex) => {
      const playerIndex = colIndex * ROWS_COUNT + rowIndex;
      return squadList[playerIndex] || null;
    });
  });

  // Group exercises into blocks
  const blocks = [
    { key: "block_0", label: "Bloque 0", title: "PREVIO AL ENTRENAMIENTO" },
    { key: "warmup", label: "Bloque 1", title: "CALENTAMIENTO" },
    { key: "main", label: "Bloque 2", title: "PARTE PRINCIPAL" },
    { key: "cooldown", label: "Bloque 3", title: "VUELTA A LA CALMA" },
  ] as const;

  const totalExercisesCount = exercises.length;

  return (
    <div className="bg-white text-slate-900 p-4 font-sans max-w-[210mm] mx-auto session-print-container text-xs print:p-0 print:m-0 print:max-w-none print:w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10.5px !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all web UI chrome, headers, navigation bars and modal overlays */
          header, nav, aside, footer, button, .print\\:hidden, .no-print, [role="navigation"] {
            display: none !important;
          }
          .session-print-container {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* ── ALMAZÁN / CLUB REPORT HEADER GRID (BORDER LINEAL ECO-TINTA) ── */}
      <div className="w-full border-2 border-slate-900 mb-3 text-slate-900 font-sans text-xs rounded-lg overflow-hidden bg-white">
        {/* Row 1: Logo & Session Metadata Bar */}
        <div className="flex border-b-2 border-slate-900">
          {/* Club Logo Box */}
          <div className="w-24 border-r-2 border-slate-900 p-1 flex flex-col items-center justify-center bg-white shrink-0">
            {organizationSettings?.club_logo_url ? (
              <img
                src={organizationSettings.club_logo_url}
                alt="Escudo"
                className="h-12 w-12 object-contain"
              />
            ) : (
              <span className="text-[10px] font-black text-center uppercase tracking-tighter text-slate-900">
                {teamName || "CLUB LAB"}
              </span>
            )}
          </div>

          {/* Metadata Table Grid */}
          <div className="flex-1 grid grid-cols-8 divide-x-2 divide-slate-900 text-center font-bold">
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">TEMPORADA</div>
              <div className="py-1 text-[11px] font-black">2026-2027</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">FECHA</div>
              <div className="py-1 text-[11px] font-black">{dateStr}</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">HORA</div>
              <div className="py-1 text-[11px] font-black">{startTime} h</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">MESO</div>
              <div className="py-1 text-[11px] font-black">{meso}</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">MICRO</div>
              <div className="py-1 text-[11px] font-black">{micro}</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">ORDEN SEM.</div>
              <div className="py-1 text-[11px] font-black">{weekSeq}</div>
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">SESIÓN</div>
              <div className="py-1 text-[11px] font-black">#{totalSeq}</div>
            </div>
            <div className="flex flex-col bg-slate-50">
              <div className="bg-slate-200 text-slate-900 border-b border-slate-900 text-[8.5px] py-0.5 uppercase tracking-wider font-extrabold">DURACIÓN</div>
              <div className="py-1 text-[11px] font-black text-slate-900">{effectiveDuration} min</div>
            </div>
          </div>
        </div>

        {/* Row 2: Objetivos Header */}
        <div className="bg-slate-200 border-b-2 border-slate-900 text-center py-0.5 text-[9.5px] font-black uppercase tracking-widest text-slate-900">
          OBJETIVOS DE LA SESIÓN ({title})
        </div>

        {/* Row 3: Objetivos Físicos */}
        <div className="flex border-b border-slate-900">
          <div className="w-24 bg-slate-100 text-slate-900 text-[9px] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-900 shrink-0 py-0.5">
            FÍSICOS
          </div>
          <div className="flex-1 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide flex items-center text-slate-900">
            {muscleLabels}
          </div>
        </div>

        {/* Row 4: Objetivos Tácticos */}
        <div className="flex border-b-2 border-slate-900">
          <div className="w-24 bg-slate-100 text-slate-900 text-[9px] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-900 shrink-0 py-0.5">
            TÁCTICOS
          </div>
          <div className="flex-1 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide flex items-center text-slate-900">
            {tacticalLabels}
          </div>
        </div>

        {/* Row 5: Convocatoria Grid Table */}
        <div className="flex">
          {/* Left Roster Counts Box */}
          <div className="w-24 border-r-2 border-slate-900 flex flex-col justify-between text-center shrink-0 bg-slate-50">
            <div className="bg-slate-200 border-b border-slate-900 text-slate-900 text-[8.5px] font-black py-0.5 uppercase tracking-wider">PLANTILLA</div>
            <div className="py-0.5 border-b border-slate-300">
              <span className="block text-[7.5px] font-bold text-slate-600 uppercase leading-none">Jug. Dispo.</span>
              <span className="text-[11px] font-black text-slate-900">{presentFieldCount}</span>
            </div>
            <div className="py-0.5 border-b border-slate-300">
              <span className="block text-[7.5px] font-bold text-slate-600 uppercase leading-none">Port. Dispo.</span>
              <span className="text-[11px] font-black text-slate-900">{presentGKCount}</span>
            </div>
            <div className="py-0.5 bg-slate-200">
              <span className="block text-[7.5px] font-bold text-slate-900 uppercase leading-none">Total Dispo.</span>
              <span className="text-[12px] font-black text-slate-900">{presentPlayers.length}</span>
            </div>
          </div>

          {/* Right Attendance Matrix */}
          <div className="flex-1 overflow-hidden bg-white">
            {/* Minimalist Legend Header Bar */}
            <div className="bg-slate-100 text-slate-900 px-2 py-0.5 flex items-center justify-around text-[8.5px] font-extrabold uppercase tracking-wider border-b border-slate-900">
              <span className="flex items-center gap-1">
                <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7.5px] font-black">S</span> ENTRENA
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-slate-900 bg-slate-200 text-slate-900 px-1 rounded text-[7.5px] font-black">L</span> LESIÓN
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7.5px] font-black">V</span> VARIOS
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-slate-900 bg-slate-100 text-slate-900 px-1 rounded text-[7.5px] font-black">E</span> ENFERMO/REA
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7.5px] font-black">P</span> PARCIAL
              </span>
            </div>

            {/* 5-Row Grid Table */}
            <div className="p-1 space-y-0.5 bg-white">
              {gridRows.map((row, rIdx) => (
                <div key={rIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(85px, 1fr))` }}>
                  {row.map((p, cIdx) => {
                    if (!p) return <div key={cIdx} className="h-4" />;

                    let badgeLetter = "S";
                    let badgeClass = "bg-white text-slate-900 border border-slate-800";
                    let borderClass = "border-slate-300 bg-white text-slate-900 font-bold";

                    if (p.status === "injured") {
                      badgeLetter = "L";
                      badgeClass = "bg-slate-200 text-slate-900 border border-slate-900 font-black";
                      borderClass = "border-slate-400 bg-slate-100 text-slate-900 font-bold";
                    } else if (p.status === "absent") {
                      badgeLetter = "V";
                      badgeClass = "bg-white text-slate-900 border border-slate-800";
                      borderClass = "border-slate-300 bg-white text-slate-900 font-semibold";
                    } else if (p.status === "readaptation") {
                      badgeLetter = "E";
                      badgeClass = "bg-slate-100 text-slate-900 border border-slate-800";
                      borderClass = "border-slate-300 bg-slate-50 text-slate-900 font-semibold";
                    } else if (p.status === "partial") {
                      badgeLetter = "P";
                      badgeClass = "bg-white text-slate-900 border border-slate-800 font-black";
                      borderClass = "border-slate-300 bg-white text-slate-900 font-bold";
                    }

                    return (
                      <div
                        key={p.id || cIdx}
                        className={cn("flex justify-between items-center px-1 py-0.2 rounded border text-[8.5px] h-4", borderClass)}
                      >
                        <span className="truncate">{p.displayName}</span>
                        <span className={cn("text-[7px] font-extrabold rounded px-0.5 ml-0.5 shrink-0", badgeClass)}>
                          {badgeLetter}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOQUES Y TAREAS DE LA SESIÓN ── */}
      <div className="space-y-2.5">
        {blocks.map((blockConfig) => {
          const blockExercises = exercises.filter((ex) => {
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
            (sum, ex) => sum + getExerciseTotalDuration(ex),
            0
          );

          return (
            <div key={blockConfig.key} className="space-y-1.5 print-break-avoid">
              {/* Block Header Divider Bar */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-900 bg-slate-200 px-1.5 py-0.2 rounded border border-slate-400">
                    {blockConfig.label}
                  </span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider border bg-slate-100 text-slate-900 border-slate-300">
                    {blockConfig.title}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-800">
                  ({blockExercises.length} tarea{blockExercises.length !== 1 ? 's' : ''} — {blockTotalDuration} min)
                </span>
              </div>

              {/* Dynamic Grid of Exercises depending on total exercise count to maintain 1 single A4 sheet */}
              <div className={cn(
                "grid gap-2 w-full",
                totalExercisesCount <= 2
                  ? "grid-cols-1"
                  : blockExercises.length === 1
                  ? "grid-cols-1"
                  : blockExercises.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2"
              )}>
                {blockExercises.map((ex, idx) => {
                  const totalExDuration = getExerciseTotalDuration(ex);
                  const gs = ex.group_setup || {};
                  const nSeries = Number(gs.num_series || ex.num_series || 1);
                  const sDuration = Number(gs.series_duration_min || ex.series_duration_min || ex.duration_min || 15);
                  const sRecovery = Number(gs.series_recovery_min || ex.series_recovery_min || ex.recovery_min || 2);

                  const rawGroups = gs.groups || [];
                  const assignedGroups = rawGroups.filter((g: any) => {
                    const playerIds = g.players ?? [];
                    return Array.isArray(playerIds) && playerIds.length > 0;
                  });

                  const rules = gs.rules || ex.rules || "";
                  const notes = gs.objective_notes || ex.objective_notes || "";

                  const hasWhiteboardData = Boolean(ex.whiteboard_data && (ex.whiteboard_data.strokes?.length > 0 || ex.whiteboard_data.markers?.length > 0));
                  const hasImageDataUrl = Boolean(ex.whiteboard_data?.imageDataUrl);

                  return (
                    <div
                      key={idx}
                      className="border border-slate-400 rounded-lg p-2 bg-white shadow-none print-break-avoid flex flex-col justify-between space-y-1.5"
                    >
                      <div className="space-y-1.5">
                        {/* Header Box */}
                        <div className="flex justify-between items-start border-b border-slate-300 pb-1 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-4.5 w-4.5 rounded bg-slate-900 text-white font-black text-[9.5px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 text-[11px] leading-tight truncate">{ex.title || ex.exercise?.title}</h4>
                              <span className="inline-block rounded px-1 py-0.2 text-[7.5px] font-bold border mt-0.5 uppercase tracking-wide bg-slate-100 text-slate-800 border-slate-300">
                                {ex.category || ex.exercise?.category || "General"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right text-[9px] font-bold text-slate-900 shrink-0">
                            <span>{totalExDuration} min</span>
                            {nSeries > 1 && (
                              <p className="text-[7.5px] text-slate-600 font-medium leading-none mt-0.5">{nSeries}x{sDuration}m | Rec: {sRecovery}m</p>
                            )}
                          </div>
                        </div>

                        {/* Content Grid: Text Left, Whiteboard Diagram Right */}
                        <div className="grid grid-cols-12 gap-2 text-[8.5px] leading-tight">
                          {/* Details Column */}
                          <div className={cn(
                            (hasWhiteboardData || hasImageDataUrl) ? "col-span-7 space-y-1" : "col-span-12 space-y-1"
                          )}>
                            {notes && (
                              <div>
                                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7.5px]">Objetivos / Pautas:</span>
                                <p className="text-slate-800 whitespace-pre-wrap font-medium">{notes}</p>
                              </div>
                            )}
                            {rules && (
                              <div>
                                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7.5px]">Normas / Consignas:</span>
                                <p className="text-slate-800 whitespace-pre-wrap font-medium">{rules}</p>
                              </div>
                            )}

                            {/* Assigned Groups */}
                            {assignedGroups.length > 0 && (
                              <div className="space-y-0.5 border-t border-slate-200 pt-1">
                                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7.5px]">Equipos / Distribución</span>
                                <div className="grid grid-cols-2 gap-1">
                                  {assignedGroups.map((g: any, gIdx: number) => {
                                    const names = (g.players ?? []).map((pId: string) => {
                                      const found = squadList.find(pl => pl.id === pId);
                                      return found?.displayName || "";
                                    }).filter(Boolean).join(", ");

                                    return (
                                      <div key={gIdx} className="bg-slate-50 border border-slate-300 p-0.5 rounded">
                                        <span className="block font-bold text-slate-900 text-[8px]">{g.name}</span>
                                        <p className="text-slate-700 leading-tight truncate text-[7.5px]">{names}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Whiteboard / Pitch Zone Diagram Column */}
                          {(hasWhiteboardData || hasImageDataUrl) && (
                            <div className="col-span-5 flex items-center justify-center bg-white border border-slate-300 rounded p-1 overflow-hidden max-h-36">
                              {hasWhiteboardData ? (
                                <WhiteboardPrintRenderer
                                  value={ex.whiteboard_data}
                                  width={300}
                                  height={225}
                                />
                              ) : (
                                <img
                                  src={ex.whiteboard_data.imageDataUrl}
                                  alt={`Esquema ${ex.title}`}
                                  className="w-full h-auto max-h-32 object-contain rounded"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
