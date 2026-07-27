"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Plus,
  Clock,
  Send,
  UserCheck,
  UserX,
  Sparkles,
  ShieldAlert,
  ClipboardList,
  Filter,
  Check,
  Search,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachMobileViewProps {
  clubName: string;
  userRole: string;
  totalPlayers: number;
  availableCount: number;
  injuredCount: number;
  readaptCount: number;
  fatiguedCount: number;
  availabilityRate: number;
  completedCheckinsCount: number;
  checkinPct: number;
  pendingCheckinCount: number;
  completedCheckoutsCount: number;
  checkoutPct: number;
  pendingCheckoutCount: number;
  todaySession: any;
  weekSessions: any[];
  alertsList: any[];
  injuredList: any[];
  players: any[];
}

export function CoachMobileView({
  clubName,
  userRole,
  totalPlayers,
  availableCount,
  injuredCount,
  readaptCount,
  fatiguedCount,
  availabilityRate,
  completedCheckinsCount,
  checkinPct,
  pendingCheckinCount,
  completedCheckoutsCount,
  checkoutPct,
  pendingCheckoutCount,
  todaySession,
  weekSessions,
  alertsList,
  injuredList,
  players,
}: CoachMobileViewProps) {
  const [activeTab, setActiveTab] = useState<"today" | "checkin" | "squad" | "medical">("today");
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceState, setAttendanceState] = useState<Record<string, "present" | "absent" | "injured" | "late">>({});

  // Helper role label
  const roleLabel =
    userRole === "head_coach"
      ? "Primer Entrenador"
      : userRole === "assistant_coach"
      ? "Segundo Entrenador"
      : userRole === "physical_coach"
      ? "Preparador Físico"
      : userRole === "physio"
      ? "Fisioterapeuta"
      : "Cuerpo Técnico";

  const handleToggleAttendance = (playerId: string, status: "present" | "absent" | "injured" | "late") => {
    setAttendanceState((prev) => ({
      ...prev,
      [playerId]: prev[playerId] === status ? "present" : status,
    }));
  };

  const getShareWhatsAppText = () => {
    if (!todaySession) return `Entrenamiento ${clubName}: Sin sesión programada hoy.`;
    const title = todaySession.title || "Sesión de Entrenamiento";
    const notes = todaySession.notes ? `\n📌 Indicaciones: ${todaySession.notes}` : "";
    return encodeURIComponent(
      `⚽ *${clubName.toUpperCase()} — CONVOCATORIA DE HOY*\n` +
      `📅 Fecha: ${new Date().toLocaleDateString("es-ES")}\n` +
      `📋 Plan: ${title}${notes}\n\n` +
      `💪 ¡Puntualidad y máxima concentración equipo!`
    );
  };

  return (
    <div className="md:hidden space-y-4 pb-20 animate-fade-in font-sans">
      {/* ── MOBILE HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 p-4 border border-emerald-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Hub Móvil de Entrenador
              </span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">{clubName}</h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span>{roleLabel}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{availabilityRate}% plantilla lista</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Link
              href="/training/new"
              className="flex items-center gap-1 bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus className="size-3.5" />
              <span>Sesión</span>
            </Link>
            <span className="text-[10px] text-slate-400 font-medium">
              {totalPlayers} futbolistas
            </span>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/10 text-center">
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <span className="block text-xs font-black text-white">{availableCount}</span>
            <span className="text-[9px] font-bold uppercase text-emerald-400">Listos</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <span className="block text-xs font-black text-white">{injuredCount + readaptCount}</span>
            <span className="text-[9px] font-bold uppercase text-amber-400">Bajas</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <span className="block text-xs font-black text-white">{fatiguedCount}</span>
            <span className="text-[9px] font-bold uppercase text-yellow-400">Fatiga</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5">
            <span className="block text-xs font-black text-white">{completedCheckinsCount}/{totalPlayers}</span>
            <span className="text-[9px] font-bold uppercase text-sky-400">Check-in</span>
          </div>
        </div>
      </div>

      {/* ── MOBILE NAVIGATION SEGMENT TABS ── */}
      <div className="flex items-center justify-between p-1 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl">
        <button
          onClick={() => setActiveTab("today")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1.5",
            activeTab === "today"
              ? "bg-emerald-500 text-slate-950 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <CalendarDays className="size-3.5" />
          <span>Hoy</span>
        </button>

        <button
          onClick={() => setActiveTab("checkin")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1.5 relative",
            activeTab === "checkin"
              ? "bg-emerald-500 text-slate-950 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Activity className="size-3.5" />
          <span>Control</span>
          {pendingCheckinCount > 0 && (
            <span className="ml-0.5 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950">
              {pendingCheckinCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("squad")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1.5",
            activeTab === "squad"
              ? "bg-emerald-500 text-slate-950 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Users className="size-3.5" />
          <span>Plantilla</span>
        </button>

        <button
          onClick={() => setActiveTab("medical")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1.5 relative",
            activeTab === "medical"
              ? "bg-emerald-500 text-slate-950 shadow-lg"
              : "text-slate-400 hover:text-white"
          )}
        >
          <HeartPulse className="size-3.5" />
          <span>Médico</span>
          {injuredCount > 0 && (
            <span className="ml-0.5 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-destructive text-white">
              {injuredCount}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB CONTENT 1: HOY (TODAY) ── */}
      {activeTab === "today" && (
        <div className="space-y-4">
          {/* Today's Main Card */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="size-4 text-emerald-400" />
                <span>
                  {new Date().toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {todaySession ? todaySession.session_type : "Descanso / Preparación"}
              </span>
            </div>

            {todaySession ? (
              <div className="space-y-3 pt-1">
                <div>
                  <h3 className="text-base font-black text-white">{todaySession.title || "Sesión de Hoy"}</h3>
                  {todaySession.notes && (
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">{todaySession.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => setAttendanceModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all"
                  >
                    <UserCheck className="size-4" />
                    <span>Pasar Lista Rápidamente</span>
                  </button>

                  <a
                    href={`https://wa.me/?text=${getShareWhatsAppText()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-2.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-xl border border-emerald-500/40 active:scale-95 transition-all"
                    title="Compartir Convocatoria por WhatsApp"
                  >
                    <Send className="size-4" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-slate-400">Sin sesión agendada para el día de hoy.</p>
                <Link
                  href="/training/new"
                  className="inline-flex items-center gap-1.5 bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all"
                >
                  <Plus className="size-3.5" />
                  <span>Crear Sesión para Hoy</span>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/training"
              className="bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 rounded-xl p-3 flex items-center gap-3 transition-all"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <CalendarDays className="size-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs font-extrabold text-white truncate">Calendario</span>
                <span className="text-[10px] text-slate-400 block truncate">Microciclo semanal</span>
              </div>
            </Link>

            <Link
              href="/performance/monitoring"
              className="bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 rounded-xl p-3 flex items-center gap-3 transition-all"
            >
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                <Activity className="size-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs font-extrabold text-white truncate">Cargas & RPE</span>
                <span className="text-[10px] text-slate-400 block truncate">Monitorización RPE</span>
              </div>
            </Link>

            <Link
              href="/players"
              className="bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 rounded-xl p-3 flex items-center gap-3 transition-all"
            >
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                <Users className="size-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs font-extrabold text-white truncate">Plantilla</span>
                <span className="text-[10px] text-slate-400 block truncate">Fichas de futbolistas</span>
              </div>
            </Link>

            <Link
              href="/injuries"
              className="bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 rounded-xl p-3 flex items-center gap-3 transition-all"
            >
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <HeartPulse className="size-5" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-xs font-extrabold text-white truncate">Enfermería</span>
                <span className="text-[10px] text-slate-400 block truncate">Bajas y readaptación</span>
              </div>
            </Link>
          </div>

          {/* Active Alerts */}
          {alertsList.length > 0 && (
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Novedades del Día</span>
              </div>
              <div className="space-y-2">
                {alertsList.slice(0, 3).map((a) => (
                  <div key={a.id} className="text-xs text-slate-300 flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span>{a.message}</span>
                    <ChevronRight className="size-3 text-slate-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Week sessions schedule */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Planificación Semanal
              </span>
              <Link href="/training" className="text-[11px] text-emerald-400 font-bold hover:underline">
                Ver todo
              </Link>
            </div>

            <div className="space-y-2">
              {weekSessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Sin entrenamientos planificados esta semana.</p>
              ) : (
                weekSessions.map((s) => {
                  const sDate = new Date(s.date + "T00:00:00");
                  const dayName = sDate.toLocaleDateString("es-ES", { weekday: "short" });
                  const dayNum = sDate.getDate();
                  const isToday = s.date === new Date().toISOString().split("T")[0];

                  return (
                    <Link
                      key={s.id}
                      href={`/training/${s.id}`}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all",
                        isToday
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-950/40 border-white/5 text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-center shrink-0">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">{dayName}</span>
                          <span className="text-xs font-black">{dayNum}</span>
                        </div>
                        <span className="font-semibold line-clamp-1">{s.title || "Sesión"}</span>
                      </div>
                      <ChevronRight className="size-3.5 text-slate-500 shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: CHECKIN (CONTROL DE ASISTENCIA & SALUD) ── */}
      {activeTab === "checkin" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">Monitoreo Diario de Plantilla</h3>
                <p className="text-[11px] text-slate-400">Estado de cuestionarios Pre-entreno (Wellness) y Post-entreno (RPE)</p>
              </div>
            </div>

            {/* Check-in Wellness Status */}
            <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Check-in Pre-Entreno
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {completedCheckinsCount} / {totalPlayers} ({checkinPct}%)
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${checkinPct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400">
                {pendingCheckinCount === 0
                  ? "✅ Todos los jugadores al día con su estado físico."
                  : `⚠️ ${pendingCheckinCount} futbolistas pendientes de enviar el cuestionario.`}
              </p>
            </div>

            {/* Check-out RPE Status */}
            <div className="bg-slate-950/80 border border-white/5 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                  Check-out Post-Entreno (RPE)
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  {completedCheckoutsCount} / {totalPlayers} ({checkoutPct}%)
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div className="bg-sky-400 h-full transition-all duration-500" style={{ width: `${checkoutPct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400">
                {pendingCheckoutCount === 0
                  ? "✅ Valoración de RPE registrada por toda la plantilla."
                  : `⏳ ${pendingCheckoutCount} futbolistas faltan por enviar la percepción de esfuerzo (RPE).`}
              </p>
            </div>

            <Link
              href="/performance/monitoring"
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-slate-950 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-emerald-400 transition-all"
            >
              <Activity className="size-4" />
              <span>Ver Gráficas y Cargas Individuales</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: SQUAD (PLANTILLA) ── */}
      {activeTab === "squad" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Estado de Disponibilidad</h3>
              <span className="text-xs font-bold text-slate-400">{players.length} jugadores</span>
            </div>

            <div className="divide-y divide-white/5">
              {players.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Cargando futbolistas...</p>
              ) : (
                players.slice(0, 15).map((p: any) => {
                  const isInjured = p.active_injury?.status === "active";
                  const isReadapt = p.active_injury?.status === "readaptation";
                  const isFatigued = p.physical_status === "yellow";

                  return (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-white block">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {p.position || "Jugador"} {p.number ? `(#${p.number})` : ""}
                        </span>
                      </div>

                      <div>
                        {isInjured ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-red-400 border border-red-500/30">
                            Baja Médica
                          </span>
                        ) : isReadapt ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Readaptación
                          </span>
                        ) : isFatigued ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            Carga Alta
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Disponible
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Link
              href="/players"
              className="w-full flex items-center justify-center gap-1.5 bg-white/10 text-white py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all mt-2"
            >
              <span>Ver Plantilla Completa</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 4: MEDICAL (ENFERMERÍA & BAJAS) ── */}
      {activeTab === "medical" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-wider">
                <HeartPulse className="size-4" />
                <span>Parte Médico Activo</span>
              </div>
              <span className="text-xs font-bold text-slate-400">{injuredList.length} lesionados</span>
            </div>

            {injuredList.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">¡Plantilla 100% disponible!</p>
                <p className="text-[11px] text-slate-400">No hay partes de baja ni readaptaciones en curso.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {injuredList.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-950/80 border border-white/5 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">
                        {p.first_name} {p.last_name}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          p.active_injury?.status === "readaptation"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-destructive/20 text-red-400"
                        )}
                      >
                        {p.active_injury?.status === "readaptation" ? "Readaptación" : "Baja Médica"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{p.active_injury?.body_part || "Enfermería"}</span>
                      {p.active_injury?.expected_return && (
                        <span>Alta est.: {p.active_injury.expected_return}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/injuries"
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 text-slate-950 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-emerald-400 transition-all"
            >
              <span>Gestión de Enfermería y Readaptación</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── QUICK ATTENDANCE MODAL (PASAR LISTA MÓVIL) ── */}
      {attendanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-4 space-y-4 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">Control de Asistencia Móvil</h3>
                <p className="text-[11px] text-slate-400">Marca la presencia del equipo en 1 toque</p>
              </div>
              <button
                onClick={() => setAttendanceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
              {players.map((p: any) => {
                const currentStatus = attendanceState[p.id] || "present";

                return (
                  <div key={p.id} className="pt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-white truncate max-w-[140px]">
                      {p.first_name} {p.last_name}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleAttendance(p.id, "present")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                          currentStatus === "present"
                            ? "bg-emerald-500 text-slate-950 shadow"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        )}
                      >
                        Presente
                      </button>

                      <button
                        onClick={() => handleToggleAttendance(p.id, "absent")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                          currentStatus === "absent"
                            ? "bg-destructive text-white shadow"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        )}
                      >
                        Falta
                      </button>

                      <button
                        onClick={() => handleToggleAttendance(p.id, "late")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                          currentStatus === "late"
                            ? "bg-amber-400 text-slate-950 shadow"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        )}
                      >
                        Retraso
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => setAttendanceModalOpen(false)}
                className="w-full bg-emerald-500 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg hover:bg-emerald-400 active:scale-95 transition-all"
              >
                Guardar Registro de Asistencia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
