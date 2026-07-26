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
  orgSettings?: any;
}

export function PlayerSessionView({
  session,
  isPreview = false,
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
  const isGroupTraining = session.session_type === "training";
  const dateStr = session.date || "";
  const rawTimeStr = session.start_time || "10:00:00";
  const timeStr = rawTimeStr.length === 5 ? `${rawTimeStr}:00` : rawTimeStr;
  const sessionStartMs = dateStr ? new Date(`${dateStr}T${timeStr}`).getTime() : 0;
  const twoHoursBeforeMs = sessionStartMs ? sessionStartMs - (2 * 60 * 60 * 1000) : 0;
  const isLockedForPlayers = isGroupTraining && sessionStartMs > 0 && Date.now() < twoHoursBeforeMs;

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

        {/* ── ENCABEZADO PRINCIPAL DE LA SESIÓN ── */}
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

        {/* ── FOCUS / OBJETIVOS ── */}
        {(tacticalConcepts.length > 0 || muscleGroups.length > 0) && (
          <div className="space-y-2">
            <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">Enfoque de la Sesión</span>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-2">
              {tacticalConcepts.map((concept: string) => (
                <span key={concept} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                  {concept.replace(/_/g, " ")}
                </span>
              ))}
              {muscleGroups.map((mg: string) => (
                <span key={mg} className="bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-bold">
                  {mg.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── EJERCICIOS LIST (RESPONSIVE GRID FOR DESKTOP / PC) ── */}
        <div className="space-y-4">
          <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">Ejercicios de la Sesión ({exercises.length})</span>
          
          {exercises.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
              <HelpCircle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs font-semibold">No hay ejercicios publicados para esta sesión.</p>
            </div>
          ) : (
            <div className={cn("grid gap-6", deviceLayout === "desktop" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
              {exercises.map((ex: any, idx: number) => {
                const blockLabel = ex.block_type === 'warmup' ? 'Calentamiento' : ex.block_type === 'cooldown' ? 'Vuelta a la Calma' : 'Parte Principal';
                const blockBadge = ex.block_type === 'warmup'
                  ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                  : ex.block_type === 'cooldown'
                    ? 'text-slate-400 bg-slate-800 border-slate-700'
                    : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';

                const gs = ex.group_setup || {};
                const groups = gs.groups || [];
                const rules = gs.rules || "";
                const notes = gs.objective_notes || "";

                return (
                  <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-2.5 items-start">
                          <span className="h-6 w-6 rounded-lg bg-slate-800 border border-slate-700 font-bold text-slate-300 text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">{ex.title || ex.exercise?.title}</h4>
                            <span className={cn("inline-block rounded px-2 py-0.5 text-[9px] font-bold border mt-1 uppercase tracking-wider", blockBadge)}>
                              {blockLabel}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs font-bold text-slate-300 shrink-0">
                          <span>⏱️ {ex.duration_min} min</span>
                        </div>
                      </div>

                      {/* Draw Pitch */}
                      {ex.whiteboard_data?.imageDataUrl ? (
                        <div className="border border-slate-800 rounded-xl bg-slate-950 aspect-[16/9] w-full overflow-hidden flex items-center justify-center p-2">
                          <img
                            src={ex.whiteboard_data.imageDataUrl}
                            alt={`Pizarra táctica ${ex.title}`}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                      ) : ex.pitch_zones && ex.pitch_zones.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Zonas del campo</span>
                          <span className="text-xs font-bold text-slate-300 mt-0.5 block">{ex.pitch_zones.join(", ")}</span>
                        </div>
                      )}

                      {/* Group Divisions */}
                      {groups.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-emerald-400" />
                            Distribución de Equipos / Grupos
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {groups.map((g: any, gIdx: number) => (
                              <div key={gIdx} className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs">
                                <span className="block font-bold text-emerald-400 uppercase tracking-wide text-[10px]">{g.name}</span>
                                <p className="text-slate-300 leading-relaxed mt-1 font-medium">
                                  {(g.players ?? []).map((pId: string) => {
                                    const pl = session.attendance?.find((at: any) => at.player?.id === pId)?.player;
                                    return pl ? (pl.sporting_name || pl.first_name) : "";
                                  }).filter(Boolean).join(", ") || "Sin jugadores asignados"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rules / Notes */}
                      {(rules || notes) && (
                        <div className="space-y-2 border-t border-slate-800 pt-3 text-xs leading-relaxed">
                          {notes && (
                            <div>
                              <span className="block font-bold text-slate-400 uppercase tracking-wider text-[10px]">Pautas del Ejercicio</span>
                              <p className="text-slate-300 whitespace-pre-wrap mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-medium">{notes}</p>
                            </div>
                          )}
                          {rules && (
                            <div>
                              <span className="block font-bold text-slate-400 uppercase tracking-wider text-[10px]">Normas / Consignas</span>
                              <p className="text-slate-300 whitespace-pre-wrap mt-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-medium">{rules}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
