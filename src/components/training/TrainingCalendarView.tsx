"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ArrowRight,
  FileText,
  Edit,
  Trash2,
  Calendar,
  Layers
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SESSION_TYPE_LABELS, LOAD_LEVEL_LABELS, type SessionType, type LoadLevel } from "@/types";

interface SessionItem {
  id: string;
  title: string | null;
  date: string;
  session_type: SessionType;
  duration_min: number | null;
  microcycle_day: string | null;
  planned_load: LoadLevel | null;
  notes: string | null;
  objectives: string[] | null;
}

interface TrainingCalendarViewProps {
  sessions: SessionItem[];
}

const SESSION_TYPE_BORDER_COLORS: Record<SessionType, string> = {
  training: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.1)]",
  individual: "border-sky-500/40 bg-sky-500/5 text-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.1)]",
  match: "border-rose-500/40 bg-rose-500/5 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.1)]",
};

const LOAD_COLORS: Record<LoadLevel, string> = {
  low: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  medium: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  medium_high: "text-orange-400 border-orange-500/20 bg-orange-500/5",
  high: "text-rose-400 border-rose-500/20 bg-rose-500/5",
  recovery: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
};

export function TrainingCalendarView({ sessions = [] }: TrainingCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Helper: get start of week (Monday)
  const getStartOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(new Date(currentDate));

  // Generate 7 days of the week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  // Navigate weeks
  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate days for Month view
  const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const startOfMonth = getStartOfMonth(currentDate);
  const endOfMonth = getEndOfMonth(currentDate);

  const monthDays = (() => {
    const days: Date[] = [];
    const firstDayIndex = (startOfMonth.getDay() + 6) % 7; // Monday-based index
    const totalDays = endOfMonth.getDate();
    
    // Previous month filler days
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd - i));
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }
    
    // Next month filler days
    const remaining = 42 - days.length; // 6 rows of 7 days
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i));
    }
    
    return days;
  })();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Formatter helpers
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="space-y-6">
      {/* ── CALENDAR VIEW CONTROLS ── */}
      <div className="glass-card rounded-2xl border border-white/10 p-4 bg-white/2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={viewMode === "week" ? handlePrevWeek : handlePrevMonth}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <button
            type="button"
            onClick={handleToday}
            className="px-3.5 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={viewMode === "week" ? handleNextWeek : handleNextMonth}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span className="text-sm font-extrabold text-white pl-2">
            {viewMode === "week"
              ? `Semana del ${weekDays[0].getDate()} al ${weekDays[6].getDate()} de ${monthNames[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
              : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </span>
        </div>

        {/* View mode toggle tabs */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "week"
                ? "bg-primary text-primary-foreground shadow-lg shadow-black/30"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Vista Semanal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "month"
                ? "bg-primary text-primary-foreground shadow-lg shadow-black/30"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            Vista Mensual
          </button>
        </div>
      </div>

      {/* ── WEEK VIEW (HORIZONTAL CALENDAR) ── */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const dateStr = formatDateKey(day);
            const daySessions = sessions.filter((s) => s.date === dateStr);
            const isCurrentToday = dateStr === formatDateKey(new Date());
            const weekdayName = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx];

            return (
              <div
                key={dateStr}
                className={cn(
                  "rounded-2xl border p-3 flex flex-col gap-2 min-h-[140px] transition-all glass-card bg-white/2",
                  isCurrentToday ? "border-primary/40 bg-primary/5" : "border-white/5"
                )}
              >
                {/* Header info */}
                <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {weekdayName}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-extrabold h-6 w-6 rounded-full flex items-center justify-center",
                      isCurrentToday ? "bg-primary text-primary-foreground" : "text-slate-300"
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Day sessions */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {daySessions.length === 0 ? (
                    <div className="text-[10px] text-slate-600 italic py-2 my-auto text-center">
                      Libre
                    </div>
                  ) : (
                    daySessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/training/${session.id}/edit`}
                        className={cn(
                          "rounded-xl border p-2 text-left hover:-translate-y-0.5 hover:shadow transition-all block",
                          SESSION_TYPE_BORDER_COLORS[session.session_type]
                        )}
                        title={`${session.title || "Sesión"} — Clic para ver`}
                      >
                        <p className="text-[11px] font-extrabold leading-tight truncate">
                          {session.title || "Sesión"}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[9px] opacity-75 font-semibold">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{session.duration_min || "--"} min</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW (CALENDAR GRID) ── */}
      {viewMode === "month" && (
        <div className="glass rounded-3xl border border-white/10 p-5 bg-white/2 overflow-x-auto shadow-2xl">
          <div className="min-w-[640px] grid grid-cols-7 border-b border-white/5 pb-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>
          
          <div className="min-w-[640px] grid grid-cols-7 grid-rows-6 gap-1.5 mt-2">
            {monthDays.map((day, idx) => {
              const dateStr = formatDateKey(day);
              const daySessions = sessions.filter((s) => s.date === dateStr);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isCurrentToday = dateStr === formatDateKey(new Date());

              return (
                <div
                  key={idx}
                  className={cn(
                    "border rounded-xl p-2 min-h-[90px] flex flex-col justify-between transition-all glass-card",
                    isCurrentMonth ? "bg-white/2 border-white/5" : "bg-transparent border-transparent opacity-25",
                    isCurrentToday && "border-primary/40 bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-extrabold self-end h-5 w-5 rounded-full flex items-center justify-center",
                      isCurrentToday ? "bg-primary text-primary-foreground" : "text-slate-400"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  
                  <div className="flex flex-col gap-1 mt-1.5 flex-1 justify-start">
                    {daySessions.map((session) => {
                      const typeStyles =
                        session.session_type === "training"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : session.session_type === "individual"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : session.session_type === "match"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-white/5 text-slate-300 border-white/5";

                      return (
                        <Link
                          key={session.id}
                          href={`/training/${session.id}/edit`}
                          className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded border truncate hover:scale-105 transition-transform block",
                            typeStyles
                          )}
                        >
                          {session.title || "Sesión"}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
