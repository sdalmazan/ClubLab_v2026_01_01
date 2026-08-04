"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Copy,
  Trash2,
  Calendar as CalendarIcon,
  Layers,
  FileText,
  Edit
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SESSION_TYPE_LABELS, type SessionType, type LoadLevel } from "@/types";

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

// Calm, non-glowing semantic styles
const SESSION_TYPE_STYLES: Record<SessionType, { badge: string; border: string }> = {
  training: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    border: "border-border hover:border-primary/50 bg-card text-foreground"
  },
  individual: {
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    border: "border-border hover:border-primary/50 bg-card text-foreground"
  },
  match: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    border: "border-border hover:border-primary/50 bg-card text-foreground"
  },
  rest: {
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    border: "border-border hover:border-primary/50 bg-card text-foreground"
  },
  test: {
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    border: "border-border hover:border-primary/50 bg-card text-foreground"
  },
};

export function TrainingCalendarView({ sessions = [] }: TrainingCalendarViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  // Helper: get start of week (Monday)
  const getStartOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(new Date(currentDate));

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

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

  // Month calculation
  const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const startOfMonth = getStartOfMonth(currentDate);
  const endOfMonth = getEndOfMonth(currentDate);

  const monthDays = (() => {
    const days: Date[] = [];
    const firstDayIndex = (startOfMonth.getDay() + 6) % 7;
    const totalDays = endOfMonth.getDate();
    
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd - i));
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }
    const remaining = 42 - days.length;
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

  // Actions: Delete and Clone session
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("¿Seguro que deseas eliminar esta sesión de entrenamiento?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/training/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error al eliminar sesión:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloneSession = async (e: React.MouseEvent, session: SessionItem) => {
    e.preventDefault();
    e.stopPropagation();

    setCloningId(session.id);
    try {
      const res = await fetch("/api/training/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${session.title || "Sesión"} (Copia)`,
          date: session.date,
          session_type: session.session_type,
          duration_min: session.duration_min,
          notes: session.notes,
          microcycle_day: session.microcycle_day,
          planned_load: session.planned_load,
        }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error al clonar sesión:", err);
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── CALENDAR CONTROLS ── */}
      <div className="bg-card rounded-lg border border-border p-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={viewMode === "week" ? handlePrevWeek : handlePrevMonth}
            className="p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
          
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={viewMode === "week" ? handleNextWeek : handleNextMonth}
            className="p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>

          <span className="text-xs font-semibold text-foreground pl-2">
            {viewMode === "week"
              ? `Semana del ${weekDays[0].getDate()} al ${weekDays[6].getDate()} de ${monthNames[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
              : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </span>
        </div>

        {/* View mode toggle tabs */}
        <div className="flex bg-muted/60 border border-border rounded-md p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "week"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5" />
            Vista Semanal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "month"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarIcon className="size-3.5" />
            Vista Mensual
          </button>
        </div>
      </div>

      {/* ── WEEK VIEW (HORIZONTAL CALENDAR) ── */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2.5">
          {weekDays.map((day, idx) => {
            const dateStr = formatDateKey(day);
            const daySessions = sessions.filter((s) => s.date === dateStr);
            const isCurrentToday = dateStr === formatDateKey(new Date());
            const weekdayName = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx];

            return (
              <div
                key={dateStr}
                className={cn(
                  "rounded-lg border p-3 flex flex-col gap-2 min-h-[150px] transition-all bg-card group relative",
                  isCurrentToday ? "border-primary/50 bg-primary/5" : "border-border"
                )}
              >
                {/* Header info + Direct Add Button */}
                <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    {weekdayName}
                  </span>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/training/new?date=${dateStr}`}
                      className="p-0.5 text-muted-foreground hover:text-primary transition-colors rounded opacity-0 group-hover:opacity-100"
                      title={`Añadir sesión el ${dateStr}`}
                    >
                      <Plus className="size-3.5" />
                    </Link>
                    <span
                      className={cn(
                        "text-xs font-semibold h-5 w-5 rounded-full flex items-center justify-center",
                        isCurrentToday ? "bg-primary text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </div>

                {/* Day sessions list */}
                <div className="flex-1 flex flex-col gap-2">
                  {daySessions.length === 0 ? (
                    <Link 
                      href={`/training/new?date=${dateStr}`}
                      className="flex-1 flex flex-col items-center justify-center text-[11px] text-muted-foreground/60 hover:text-primary transition-colors py-4 rounded border border-dashed border-transparent hover:border-border"
                    >
                      <span>Libre</span>
                      <span className="text-[10px] font-medium text-primary mt-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                        <Plus className="size-3" /> Añadir
                      </span>
                    </Link>
                  ) : (
                    daySessions.map((session) => {
                      const typeConfig = SESSION_TYPE_STYLES[session.session_type] || {
                        badge: "bg-muted text-muted-foreground border-border",
                        border: "border-border bg-card text-foreground"
                      };

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            "rounded-md border p-2 text-left transition-all relative group/card",
                            typeConfig.border,
                            deletingId === session.id && "opacity-40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <Link href={`/training/${session.id}`} className="flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-tight truncate hover:text-primary transition-colors">
                                {session.title || "Sesión"}
                              </p>
                            </Link>

                            {/* Actions: Clone / Delete */}
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleCloneSession(e, session)}
                                disabled={cloningId === session.id}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                title="Clonar sesión"
                              >
                                <Copy className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(e, session.id)}
                                disabled={deletingId === session.id}
                                className="p-0.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                title="Eliminar sesión"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium border", typeConfig.badge)}>
                              {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                            </span>
                            {session.duration_min && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-2.5" />
                                {session.duration_min}m
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW (CALENDAR GRID) ── */}
      {viewMode === "month" && (
        <div className="bg-card rounded-lg border border-border p-4 overflow-x-auto">
          <div className="min-w-[640px] grid grid-cols-7 border-b border-border/40 pb-2 text-center text-xs font-medium text-muted-foreground uppercase">
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
                    "border rounded-md p-2 min-h-[90px] flex flex-col justify-between transition-all bg-card group relative",
                    isCurrentMonth ? "border-border" : "border-transparent opacity-30",
                    isCurrentToday && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <Link
                      href={`/training/new?date=${dateStr}`}
                      className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      title={`Añadir sesión el ${dateStr}`}
                    >
                      <Plus className="size-3" />
                    </Link>
                    <span
                      className={cn(
                        "text-[10px] font-semibold h-4.5 w-4.5 rounded-full flex items-center justify-center",
                        isCurrentToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-1 flex-1 justify-start">
                    {daySessions.map((session) => (
                      <div key={session.id} className="group/mitem flex items-center justify-between text-[10px] bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded">
                        <Link
                          href={`/training/${session.id}`}
                          className="truncate hover:text-primary font-medium flex-1"
                        >
                          {session.title || "Sesión"}
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="opacity-0 group-hover/mitem:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                          title="Eliminar"
                        >
                          <Trash2 className="size-2.5" />
                        </button>
                      </div>
                    ))}
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
