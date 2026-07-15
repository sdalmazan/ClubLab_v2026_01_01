"use client";

import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import {
  Calendar,
  Plus,
  ChevronRight,
  Trash2,
  X,
  Save,
  Clock,
  MapPin,
  Shield,
  MessageSquare,
  Copy,
  Clipboard,
  Undo,
  Redo,
  ClipboardCheck,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SessionType = "training" | "rest" | "friendly" | "league";

interface PreseasonSession {
  id: string;
  date: string; // 'YYYY-MM-DD'
  type: SessionType;
  startTime?: string; // 'HH:MM'
  location?: string;
  opponent?: string;
  fieldType?: string;
  fieldDimensions?: string;
  comments?: string;
}

interface PreseasonPlannerProps {
  teams?: Array<{ id: string; name: string }>;
  organizationId?: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TYPE_LABELS: Record<SessionType, string> = {
  friendly: "Partido Amistoso",
  league: "Partido Liga",
  training: "Entrenamiento",
  rest: "Descanso",
};

const TYPE_STYLES: Record<SessionType, string> = {
  friendly:
    "bg-emerald-500/20 border-emerald-500/40 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.1)]",
  league:
    "bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-[0_0_8px_rgba(14,165,233,0.1)]",
  training:
    "bg-orange-500/20 border-orange-500/40 text-orange-200 shadow-[0_0_8px_rgba(249,115,22,0.1)]",
  rest: "bg-yellow-500/20 border-yellow-500/40 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)]",
};

const TYPE_DOT: Record<SessionType, string> = {
  friendly: "bg-emerald-400",
  league: "bg-sky-400",
  training: "bg-orange-400",
  rest: "bg-yellow-400",
};

const TYPE_BADGE: Record<SessionType, string> = {
  friendly: "bg-emerald-500/30 text-emerald-300",
  league: "bg-sky-500/30 text-sky-300",
  training: "bg-orange-500/30 text-orange-300",
  rest: "bg-yellow-500/30 text-yellow-300",
};

const ALL_SESSION_TYPES: SessionType[] = ["training", "rest", "friendly", "league"];

const FIELD_TYPES = [
  "Hierba Natural",
  "Hierba Artificial",
  "Interior",
  "Tierra",
];

const DAY_ABBRS = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const MONTH_NAMES_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d` */
function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  return result;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** Generate week rows between (inclusive) the Mondays covering startDate and endDate */
function generateWeeks(startDate: Date, endDate: Date): Date[][] {
  const firstMonday = getMondayOf(startDate);
  const weeks: Date[][] = [];
  let current = firstMonday;
  let safety = 0;
  while (current <= endDate && safety < 52) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(current, i));
    }
    weeks.push(week);
    current = addDays(current, 7);
    safety++;
  }
  return weeks;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────
// Default demo sessions (relative to today, mid-July 2026)
// ─────────────────────────────────────────────

const TODAY = new Date(2026, 6, 1); // 1 Jul 2026
const DEFAULT_START = toDateStr(new Date(2026, 6, 7)); // 7 Jul
const DEFAULT_END = toDateStr(new Date(2026, 7, 17)); // 17 Aug

function makeDemoSession(
  date: string,
  type: SessionType,
  extra: Partial<PreseasonSession> = {}
): PreseasonSession {
  return { id: newId(), date, type, ...extra };
}

const DEMO_SESSIONS: PreseasonSession[] = [
  makeDemoSession("2026-07-07", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-08", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-09", "rest"),
  makeDemoSession("2026-07-10", "training", {
    startTime: "10:00",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-11", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-12", "rest"),
  makeDemoSession("2026-07-13", "rest"),
  makeDemoSession("2026-07-14", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-15", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-16", "rest"),
  makeDemoSession("2026-07-17", "training", {
    startTime: "10:00",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-18", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-19", "friendly", {
    startTime: "18:00",
    opponent: "C.D. Soria",
    location: "Campo Municipal",
    fieldType: "Hierba Artificial",
    fieldDimensions: "100/60",
  }),
  makeDemoSession("2026-07-20", "rest"),
  makeDemoSession("2026-07-21", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-22", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-23", "rest"),
  makeDemoSession("2026-07-24", "training", {
    startTime: "10:00",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-25", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-26", "friendly", {
    startTime: "17:00",
    opponent: "Numancia B",
    location: "Ciudad Deportiva",
    fieldType: "Hierba Natural",
    fieldDimensions: "105/68",
  }),
  makeDemoSession("2026-07-27", "rest"),
  makeDemoSession("2026-07-28", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-29", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-07-30", "rest"),
  makeDemoSession("2026-07-31", "training", {
    startTime: "10:00",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-08-01", "training", {
    startTime: "19:30",
    location: "Campo Municipal",
  }),
  makeDemoSession("2026-08-02", "league", {
    startTime: "18:00",
    opponent: "S.D. Almazán",
    location: "Campo Virgen del Espino",
    fieldType: "Hierba Artificial",
    fieldDimensions: "100/65",
  }),
  makeDemoSession("2026-08-03", "rest"),
];

// ─────────────────────────────────────────────
// Modal form state type
// ─────────────────────────────────────────────

interface ModalState {
  open: boolean;
  date: string;
  editId: string | null;
  type: SessionType;
  startTime: string;
  location: string;
  opponent: string;
  fieldType: string;
  fieldDimensions: string;
  comments: string;
}

const EMPTY_MODAL: ModalState = {
  open: false,
  date: "",
  editId: null,
  type: "training",
  startTime: "19:30",
  location: "",
  opponent: "",
  fieldType: "",
  fieldDimensions: "",
  comments: "",
};

// ─────────────────────────────────────────────
// AddSession Modal
// ─────────────────────────────────────────────

interface AddSessionModalProps {
  modal: ModalState;
  onChange: (patch: Partial<ModalState>) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

function AddSessionModal({
  modal,
  onChange,
  onSave,
  onClose,
  onDelete,
}: AddSessionModalProps) {
  const isMatch = modal.type === "friendly" || modal.type === "league";
  const dateObj = parseDate(modal.date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg animate-fade-in text-slate-850 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {modal.editId ? "Editar sesión" : "Añadir sesión"}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {DAY_NAMES[(dateObj.getDay() + 6) % 7]},{" "}
              {dateObj.getDate()} de{" "}
              {MONTH_NAMES_FULL[dateObj.getMonth()]} {dateObj.getFullYear()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Tipo de sesión
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SESSION_TYPES.map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ type: t })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      modal.type === t
                        ? cn({
                            "border-amber-500 bg-amber-50 text-amber-700": t === "training",
                            "border-emerald-500 bg-emerald-50 text-emerald-700": t === "friendly",
                            "border-blue-500 bg-blue-50 text-blue-700": t === "league",
                            "border-slate-400 bg-slate-100 text-slate-800": t === "rest",
                          })
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        modal.type === t
                          ? cn({
                              "bg-amber-500": t === "training",
                              "bg-emerald-500": t === "friendly",
                              "bg-blue-500": t === "league",
                              "bg-slate-400": t === "rest",
                            })
                          : "bg-slate-300"
                      )}
                    />
                    {TYPE_LABELS[t]}
                  </button>
                )
              )}
            </div>
          </div>

          {modal.type !== "rest" && (
            <>
              {/* Time & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" /> Hora
                  </label>
                  <input
                    type="time"
                    value={modal.startTime}
                    onChange={(e) => onChange({ startTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 focus:outline-none focus:border-slate-350 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" /> Lugar
                  </label>
                  <input
                    type="text"
                    value={modal.location}
                    onChange={(e) => onChange({ location: e.target.value })}
                    placeholder="Campo Municipal…"
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:border-slate-350 transition-colors"
                  />
                </div>
              </div>

              {/* Match-specific fields */}
              {isMatch && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                      <Shield className="h-3 w-3 text-slate-400" /> Rival
                    </label>
                    <input
                      type="text"
                      value={modal.opponent}
                      onChange={(e) => onChange({ opponent: e.target.value })}
                      placeholder="Nombre del rival…"
                      className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:border-slate-350 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                        Tipo de campo
                      </label>
                      <div className="relative">
                        <select
                          value={modal.fieldType}
                          onChange={(e) => onChange({ fieldType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2.5 focus:outline-none focus:border-slate-350 transition-colors appearance-none cursor-pointer pr-8"
                        >
                          <option value="">— Seleccionar —</option>
                          {FIELD_TYPES.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                          <ChevronRight className="h-4 w-4 transform rotate-90" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                        Dimensiones
                      </label>
                      <input
                        type="text"
                        value={modal.fieldDimensions}
                        onChange={(e) =>
                          onChange({ fieldDimensions: e.target.value })
                        }
                        placeholder="105/68"
                        className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:border-slate-350 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Comments */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-slate-400" /> Observaciones
                </label>
                <textarea
                  value={modal.comments}
                  onChange={(e) => onChange({ comments: e.target.value })}
                  rows={2}
                  placeholder="Notas adicionales…"
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:border-slate-350 transition-colors resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div>
            {onDelete && modal.editId && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-250 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Day Cell
// ─────────────────────────────────────────────

interface DayCellProps {
  day: Date;
  sessions: PreseasonSession[];
  inRange: boolean;
  sessionNumber: number; // cumulative training session # up to this day (0 = not training)
  onAdd: (date: string) => void;
  onEdit: (session: PreseasonSession) => void;
  isToday: boolean;
  copyMode: "idle" | "selecting" | "pasting";
  onSessionSelectForCopy: (session: PreseasonSession) => void;
  onDayClick: (date: string) => void;
  onCellContextMenu: (e: React.MouseEvent, type: "session" | "day", target: any) => void;
  deleteMode: boolean;
  onSessionDelete: (sessionId: string) => void;
  leagueMatchdays: Record<string, number>;
}

function DayCell({
  day,
  sessions,
  inRange,
  sessionNumber,
  onAdd,
  onEdit,
  isToday,
  copyMode,
  onSessionSelectForCopy,
  onDayClick,
  onCellContextMenu,
  deleteMode,
  onSessionDelete,
  leagueMatchdays,
}: DayCellProps) {
  const dateStr = toDateStr(day);

  if (!inRange) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/10 h-[144px] opacity-20" />
    );
  }

  const isEmpty = sessions.length === 0;
  const isSingle = sessions.length === 1;
  const singleSession = isSingle ? sessions[0] : null;

  // Click handler for the whole cell when empty or single session
  const handleCellClick = (e: React.MouseEvent) => {
    if (copyMode === "pasting") {
      e.stopPropagation();
      onDayClick(dateStr);
    } else if (isEmpty) {
      onAdd(dateStr);
    } else if (isSingle && singleSession) {
      if (deleteMode) {
        onSessionDelete(singleSession.id);
      } else if (copyMode === "selecting") {
        onSessionSelectForCopy(singleSession);
      } else {
        onEdit(singleSession);
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col h-[144px] group transition-all relative overflow-hidden select-none",
        isSingle && singleSession
          ? cn("cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-transform", {
              "bg-amber-500/10 border-amber-500/35 text-amber-250 hover:bg-amber-500/20": singleSession.type === "training",
              "bg-emerald-500/10 border-emerald-500/35 text-emerald-250 hover:bg-emerald-500/20": singleSession.type === "friendly",
              "bg-blue-500/10 border-blue-500/35 text-blue-250 hover:bg-blue-500/20": singleSession.type === "league",
              "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10": singleSession.type === "rest",
            })
          : isEmpty
          ? "border-white/5 bg-white/2 hover:bg-white/5 cursor-pointer text-slate-400 hover:text-slate-200"
          : "border-white/10 bg-white/1 text-slate-200",
        isToday && "ring-2 ring-brand-500 border-brand-500",
        copyMode === "pasting" && "hover:border-brand-500/50 hover:bg-brand-500/5 cursor-pointer",
        isSingle && singleSession && deleteMode && "hover:border-rose-500 hover:ring-2 hover:ring-rose-500/50"
      )}
      onClick={handleCellClick}
      onContextMenu={(e) => {
        if (isSingle && singleSession) {
          e.preventDefault();
          onCellContextMenu(e, "session", singleSession);
        } else {
          onCellContextMenu(e, "day", dateStr);
        }
      }}
      title={
        deleteMode && isSingle
          ? "Hacer clic para eliminar sesión directamente"
          : copyMode === "selecting" && isSingle
          ? "Hacer clic para copiar esta sesión"
          : copyMode === "pasting"
          ? "Pegar sesión aquí"
          : isEmpty
          ? "Añadir sesión"
          : isSingle
          ? "Editar sesión"
          : undefined
      }
    >
      {/* Colored Top Bar for Single Session Cards */}
      {isSingle && singleSession && (
        <div
          className={cn("absolute top-0 left-0 right-0 h-1.5", {
            "bg-amber-500": singleSession.type === "training",
            "bg-emerald-500": singleSession.type === "friendly",
            "bg-blue-500": singleSession.type === "league",
            "bg-slate-300": singleSession.type === "rest",
          })}
        />
      )}

      {/* Day number */}
      <div className="flex items-center justify-between flex-shrink-0 z-10">
        <span
          className={cn(
            "text-[13px] font-extrabold h-5 w-5 flex items-center justify-center rounded-full transition-colors",
            isToday
              ? "bg-brand-500 text-white"
              : isEmpty
              ? "text-slate-500"
              : "text-white"
          )}
        >
          {day.getDate()}
        </span>
        {isEmpty && copyMode === "idle" && (
          <Plus className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Render Content based on count */}
      {isSingle && singleSession && (
        <div className="flex-grow flex flex-col justify-between mt-2.5 text-[10px] leading-tight text-slate-300">
          {/* Inner layout for single session */}
          <div className="space-y-1 w-full">
            {singleSession.type === "rest" ? (
              <div className="flex-1 flex flex-col justify-center items-center py-4">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-white/10 px-2 py-0.5 rounded">
                  DESCANSO
                </span>
              </div>
            ) : (
              <>
                {/* Category Accent */}
                <div className="flex items-center gap-1">
                  <span className={cn("text-[8px] font-bold uppercase tracking-wider", {
                    "text-amber-400": singleSession.type === "training",
                    "text-emerald-450": singleSession.type === "friendly",
                    "text-blue-400": singleSession.type === "league",
                  })}>
                    {(() => {
                      if (singleSession.type === "league") {
                        const jNum = leagueMatchdays[singleSession.id] || 1;
                        return `Jornada ${jNum}`;
                      }
                      return TYPE_LABELS[singleSession.type];
                    })()}
                  </span>
                </div>

                {/* Opponent / Title (opponent name is most prominent) */}
                <div className="pt-0.5">
                  <span className={cn("font-extrabold text-white block truncate leading-tight", 
                    (singleSession.type === "friendly" || singleSession.type === "league")
                      ? "text-xs"
                      : "text-[11px]"
                  )}>
                    {(singleSession.type === "friendly" || singleSession.type === "league")
                      ? (singleSession.opponent || TYPE_LABELS[singleSession.type])
                      : `Sesión ${sessionNumber}`
                    }
                  </span>
                </div>

                {/* Time & Location */}
                {singleSession.startTime && (
                  <div className="flex items-center gap-1 text-slate-400 text-[9px] pt-1">
                    <Clock className={cn("h-3 w-3 flex-shrink-0", {
                      "text-amber-500": singleSession.type === "training",
                      "text-emerald-500": singleSession.type === "friendly",
                      "text-blue-500": singleSession.type === "league",
                    })} />
                    <span className="truncate">
                      {singleSession.startTime}h
                      {singleSession.location ? ` · ${singleSession.location}` : ""}
                    </span>
                  </div>
                )}

                {/* Match extra info */}
                {(singleSession.type === "friendly" || singleSession.type === "league") &&
                  (singleSession.fieldType || singleSession.fieldDimensions) && (
                    <div className="text-[8px] text-slate-500 italic truncate pl-4">
                      {[singleSession.fieldType, singleSession.fieldDimensions]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Comments (Observations) */}
          {singleSession.comments && singleSession.type !== "rest" && (
            <div className="text-[8px] text-slate-400 leading-snug border-t border-white/5 pt-1 mt-1 truncate" title={singleSession.comments}>
              {singleSession.comments}
            </div>
          )}

          {/* Add session button at the bottom (visible on hover) */}
          {copyMode === "idle" && !deleteMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(dateStr);
              }}
              className="flex items-center justify-center h-5 w-full rounded-lg border border-dashed border-white/10 text-slate-400 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:border-white/20 hover:text-slate-200 cursor-pointer mt-1.5 flex-shrink-0"
            >
              <Plus className="h-2.5 w-2.5 mr-0.5" /> añadir sesión
            </button>
          )}
        </div>
      )}

      {/* Multiple Sessions */}
      {!isEmpty && !isSingle && (
        <div className="flex-grow overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none flex flex-col h-full mt-1.5">
          {sessions.map((session) => {
            const isMatch =
              session.type === "friendly" || session.type === "league";
            const isRest = session.type === "rest";

            return (
              <button
                key={session.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteMode) {
                    onSessionDelete(session.id);
                  } else if (copyMode === "selecting") {
                    onSessionSelectForCopy(session);
                  } else if (copyMode === "pasting") {
                    onDayClick(dateStr);
                  } else {
                    onEdit(session);
                  }
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  onCellContextMenu(e, "session", session);
                }}
                className={cn(
                  "relative w-full text-left rounded-lg border pt-2.5 pb-1.5 px-2.5 text-[10px] leading-tight transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                  {
                    "bg-orange-500/10 border-orange-500/20 text-orange-255 hover:bg-orange-500/20": session.type === "training",
                    "bg-emerald-500/10 border-emerald-500/20 text-emerald-250 hover:bg-emerald-500/20": session.type === "friendly",
                    "bg-blue-500/10 border-blue-500/20 text-blue-250 hover:bg-blue-500/20": session.type === "league",
                    "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10": session.type === "rest",
                  },
                  copyMode === "selecting" && "ring-2 ring-brand-500/50 hover:scale-105",
                  deleteMode && "hover:border-rose-500 hover:ring-2 hover:ring-rose-500/50"
                )}
                title={deleteMode ? "Hacer clic para eliminar sesión directamente" : copyMode === "selecting" ? "Hacer clic para copiar esta sesión" : "Editar sesión"}
              >
                {/* Colored Top Bar */}
                <div
                  className={cn("absolute top-0 left-0 right-0 h-1", {
                    "bg-amber-500": session.type === "training",
                    "bg-emerald-500": session.type === "friendly",
                    "bg-blue-500": session.type === "league",
                    "bg-slate-355": session.type === "rest",
                  })}
                />

                {isRest ? (
                  <span className="italic font-bold text-slate-400 text-[8px] uppercase tracking-wider py-0.5">DESCANSO</span>
                ) : (
                  <div className="w-full text-slate-200 space-y-0.5">
                    {/* Category Accent */}
                    <div className="text-[7.5px] font-bold uppercase tracking-wider">
                      <span className={cn({
                        "text-amber-400": session.type === "training",
                        "text-emerald-450": session.type === "friendly",
                        "text-blue-400": session.type === "league",
                      })}>
                        {session.type === "league" 
                          ? `Jornada ${leagueMatchdays[session.id] || 1}`
                          : TYPE_LABELS[session.type]
                        }
                      </span>
                    </div>

                    {/* Opponent / Title (opponent name is most prominent) */}
                    <div className="font-extrabold text-white truncate leading-tight text-[11px]">
                      {isMatch
                        ? (session.opponent || TYPE_LABELS[session.type])
                        : `Sesión ${sessionNumber}`
                      }
                    </div>

                    {/* Time & Location */}
                    {session.startTime && (
                      <div className="flex items-center gap-1 text-[8.5px] text-slate-400 pt-0.5">
                        <Clock className={cn("h-2.5 w-2.5 flex-shrink-0", {
                          "text-amber-500": session.type === "training",
                          "text-emerald-500": session.type === "friendly",
                          "text-blue-500": session.type === "league",
                        })} />
                        <span className="truncate">
                          {session.startTime}h
                          {session.location ? ` · ${session.location}` : ""}
                        </span>
                      </div>
                    )}

                    {/* Comments */}
                    {session.comments && (
                      <div className="text-[8px] text-slate-400 truncate border-t border-white/5 pt-0.5 mt-0.5">
                        {session.comments}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add button when cell has multiple sessions */}
      {!isEmpty && !isSingle && copyMode === "idle" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(dateStr);
          }}
          className="mt-auto flex items-center justify-center h-5 w-full rounded-lg border border-dashed border-white/10 text-slate-400 hover:text-slate-200 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:border-white/20 cursor-pointer flex-shrink-0"
        >
          <Plus className="h-2.5 w-2.5 mr-0.5" /> añadir
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3.5 no-print">
      {ALL_SESSION_TYPES.map(
        (t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span
              className={cn("h-2.5 w-2.5 rounded-sm border border-slate-200", {
                "bg-amber-500": t === "training",
                "bg-slate-300": t === "rest",
                "bg-emerald-500": t === "friendly",
                "bg-blue-500": t === "league",
              })}
            />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{TYPE_LABELS[t]}</span>
          </div>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function PreseasonPlanner({
  teams = [],
  organizationId = "",
}: PreseasonPlannerProps) {
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [sessions, setSessions] = useState<PreseasonSession[]>([]);
  const [history, setHistory] = useState<PreseasonSession[][]>(() => [[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [copyMode, setCopyMode] = useState<"idle" | "selecting" | "pasting">("idle");
  const [deleteMode, setDeleteMode] = useState(false);
  const [copiedSession, setCopiedSession] = useState<PreseasonSession | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    open: boolean;
    type: "session" | "day";
    session?: PreseasonSession;
    date?: string;
  }>({ x: 0, y: 0, open: false, type: "day" });
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);

  const [activeSeasonName, setActiveSeasonName] = useState<string>("");
  const [orgSettings, setOrgSettings] = useState<{ club_name: string; club_logo_url: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStart = localStorage.getItem("cl_preseason_start_date");
      const savedEnd = localStorage.getItem("cl_preseason_end_date");
      if (savedStart) setStartDate(savedStart);
      if (savedEnd) setEndDate(savedEnd);

      const savedSessions = localStorage.getItem("cl_preseason_sessions");
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed)) {
            setSessions(parsed);
            setHistory([parsed]);
            setHistoryIndex(0);
          }
        } catch (e) {
          console.error("Failed to parse preseason sessions", e);
        }
      }
    }

    async function loadPrintInfo() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (orgRole) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name, settings")
            .eq("id", orgRole.organization_id)
            .single();

          if (org) {
            setOrgSettings({
              club_name: org.settings?.club_name || org.name || "",
              club_logo_url: org.settings?.club_logo_url || "",
            });
          }

          const activeSeasonId = document.cookie
            .split("; ")
            .find((row) => row.startsWith("cl_active_season_id="))
            ?.split("=")[1];

          if (activeSeasonId) {
            const { data: season } = await supabase
              .from("seasons")
              .select("name")
              .eq("id", activeSeasonId)
              .single();
            if (season) {
              setActiveSeasonName(season.name);
            }
          } else {
            const { data: seasons } = await supabase
              .from("seasons")
              .select("name")
              .eq("is_active", true)
              .limit(1);
            if (seasons && seasons.length > 0) {
              setActiveSeasonName(seasons[0].name);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load print details:", e);
      }
    }
    loadPrintInfo();
  }, []);

  const handleStartDateChange = useCallback((val: string) => {
    setStartDate(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_preseason_start_date", val);
    }
  }, []);

  const handleEndDateChange = useCallback((val: string) => {
    setEndDate(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_preseason_end_date", val);
    }
  }, []);

  const updateSessionsWithHistory = useCallback((newSessions: PreseasonSession[]) => {
    setSessions(newSessions);
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_preseason_sessions", JSON.stringify(newSessions));
    }
    setHistory((prev) => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      return [...nextHistory, newSessions];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleSessionSelectForCopy = useCallback((session: PreseasonSession) => {
    setCopiedSession(session);
    setCopyMode("pasting");
    setDeleteMode(false);
  }, []);

  const handleDayClickToPaste = useCallback((targetDate: string) => {
    if (!copiedSession) return;
    const newSession: PreseasonSession = {
      ...copiedSession,
      id: newId(),
      date: targetDate,
    };
    updateSessionsWithHistory([...sessions, newSession]);
  }, [copiedSession, sessions, updateSessionsWithHistory]);

  const handleSessionDeleteDirect = useCallback((sessionId: string) => {
    updateSessionsWithHistory(sessions.filter((s) => s.id !== sessionId));
  }, [sessions, updateSessionsWithHistory]);

  const handleCellContextMenu = useCallback((e: React.MouseEvent, type: "session" | "day", target: any) => {
    e.preventDefault();
    setContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      type,
      session: type === "session" ? target : undefined,
      date: type === "day" ? target : undefined,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      if (contextMenu.open) closeContextMenu();
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [contextMenu.open, closeContextMenu]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const prevSessions = history[prevIndex];
      setSessions(prevSessions);
      if (typeof window !== "undefined") {
        localStorage.setItem("cl_preseason_sessions", JSON.stringify(prevSessions));
      }
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const nextSessions = history[nextIndex];
      setSessions(nextSessions);
      if (typeof window !== "undefined") {
        localStorage.setItem("cl_preseason_sessions", JSON.stringify(nextSessions));
      }
    }
  }, [historyIndex, history]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (isZ) {
          e.preventDefault();
          handleUndo();
        } else if (isY) {
          e.preventDefault();
          handleRedo();
        }
      }
      if (e.key === "Escape") {
        setCopyMode("idle");
        setDeleteMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // ── Build week grid ──────────────────────────────────
  const weeks = useMemo(() => {
    if (!startDate || !endDate) return [];
    return generateWeeks(parseDate(startDate), parseDate(endDate));
  }, [startDate, endDate]);

  const rangeStart = startDate ? parseDate(startDate) : null;
  const rangeEnd = endDate ? parseDate(endDate) : null;

  // Compute cumulative training session numbers keyed by date string
  const trainingNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let count = 0;
    const sorted = [...sessions]
      .filter((s) => s.type === "training")
      .sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((s) => {
      if (!map[s.date]) {
        count++;
        map[s.date] = count;
      }
    });
    return map;
  }, [sessions]);

  // Compute league matchday index mapping chronologically
  const leagueMatchdays = useMemo(() => {
    const map: Record<string, number> = {};
    const sorted = [...sessions]
      .filter((s) => s.type === "league")
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        const timeA = a.startTime || "00:00";
        const timeB = b.startTime || "00:00";
        return timeA.localeCompare(timeB);
      });
    sorted.forEach((s, idx) => {
      map[s.id] = idx + 1;
    });
    return map;
  }, [sessions]);

  // ── Modal helpers ────────────────────────────────────
  const openAdd = useCallback((date: string) => {
    setModal({ ...EMPTY_MODAL, open: true, date });
  }, []);

  const openEdit = useCallback((session: PreseasonSession) => {
    setModal({
      open: true,
      date: session.date,
      editId: session.id,
      type: session.type,
      startTime: session.startTime ?? "19:30",
      location: session.location ?? "",
      opponent: session.opponent ?? "",
      fieldType: session.fieldType ?? "",
      fieldDimensions: session.fieldDimensions ?? "",
      comments: session.comments ?? "",
    });
  }, []);
  const handleSave = useCallback(() => {
    const { editId, date, type, startTime, location, opponent, fieldType, fieldDimensions, comments } = modal;
    const payload: PreseasonSession = {
      id: editId ?? newId(),
      date,
      type,
      startTime: type !== "rest" ? startTime : undefined,
      location: type !== "rest" ? location : undefined,
      opponent: (type === "friendly" || type === "league") ? opponent : undefined,
      fieldType: (type === "friendly" || type === "league") ? fieldType : undefined,
      fieldDimensions: (type === "friendly" || type === "league") ? fieldDimensions : undefined,
      comments: comments || undefined,
    };

    if (editId) {
      updateSessionsWithHistory(sessions.map((s) => (s.id === editId ? payload : s)));
    } else {
      updateSessionsWithHistory([...sessions, payload]);
    }
    setModal(EMPTY_MODAL);
  }, [modal, sessions, updateSessionsWithHistory]);

  const handleDelete = useCallback(() => {
    if (modal.editId) {
      updateSessionsWithHistory(sessions.filter((s) => s.id !== modal.editId));
    }
    setModal(EMPTY_MODAL);
  }, [modal.editId, sessions, updateSessionsWithHistory]);

  // ── Stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const inRange = sessions.filter((s) => {
      if (!rangeStart || !rangeEnd) return true;
      const d = parseDate(s.date);
      return d >= rangeStart && d <= rangeEnd;
    });
    return {
      training: inRange.filter((s) => s.type === "training").length,
      rest: inRange.filter((s) => s.type === "rest").length,
      friendly: inRange.filter((s) => s.type === "friendly").length,
      league: inRange.filter((s) => s.type === "league").length,
    };
  }, [sessions, rangeStart, rangeEnd]);

  // ─────────────────────────────────────────────
  return (
    <div className="no-print-bg glass rounded-3xl border border-white/10 p-6 md:p-8 text-slate-100 font-sans max-w-7xl mx-auto space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          /* Scale text sizes by 8% on screen */
          .no-print-bg {
            font-size: 1.08em !important;
          }
          .no-print-bg .text-\\[13px\\] { font-size: 14.5px !important; }
          .no-print-bg .text-\\[11px\\] { font-size: 12px !important; }
          .no-print-bg .text-\\[10px\\] { font-size: 11px !important; }
          .no-print-bg .text-\\[9px\\] { font-size: 10px !important; }
          .no-print-bg .text-\\[8px\\] { font-size: 9px !important; }
          .no-print-bg .text-\\[7\\.5px\\] { font-size: 8.5px !important; }
          .no-print-bg .text-xs { font-size: 0.825rem !important; }
          .no-print-bg .text-sm { font-size: 0.96rem !important; }
          .no-print-bg .text-base { font-size: 1.1rem !important; }
          .no-print-bg .text-lg { font-size: 1.25rem !important; }
          .no-print-bg .text-xl { font-size: 1.375rem !important; }
        }

        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          /* Reset height of all parent containers to auto in print to eliminate blank trailing page */
          body, html, #__next, [class*="min-h-screen"], [class*="h-screen"], [class*="h-"], [class*="min-h-"] {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            padding: 4mm !important;
          }
          /* Hide parent layout extra spacing and wrappers in print */
          div[class*="max-w-7xl"],
          .flex-col.gap-6 {
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }
          .no-print, header, nav, aside, button, [data-sidebar], .sidebar-inset > header, .preseason-title-header {
            display: none !important;
          }
          /* Remove borders/glass padding that looks bad */
          .glass {
            background: white !important;
            border-color: #e5e7eb !important;
            box-shadow: none !important;
          }
          .no-print-bg {
            zoom: 0.74 !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: #0f172a !important;
            max-width: 100% !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Hide top accent bars in print */
          .no-print-bg [class*="absolute"][class*="top-0"][class*="h-1"] {
            display: none !important;
          }
          .no-print-bg [class*="absolute"][class*="top-0"][class*="h-1.5"] {
            display: none !important;
          }

          /* Day cell overrides for print: Force specific backgrounds and border colors matching type */
          .no-print-bg .rounded-xl,
          .no-print-bg .rounded-lg {
            background-color: white !important;
            background: white !important;
            border-color: #e5e7eb !important;
            box-shadow: none !important;
          }
          
          /* Training cells/cards in print (Soft amber background, amber border) */
          .no-print-bg [class*="bg-amber-500\\/10"],
          .no-print-bg [class*="bg-orange-500"] {
            background-color: #FFFBEB !important;
            background: #FFFBEB !important;
            border-color: #F59E0B !important;
          }
          /* Friendly cells/cards in print (Soft emerald background, emerald border) */
          .no-print-bg [class*="bg-emerald-500\\/10"] {
            background-color: #ECFDF5 !important;
            background: #ECFDF5 !important;
            border-color: #10B981 !important;
          }
          /* League cells/cards in print (Soft blue background, blue border) */
          .no-print-bg [class*="bg-blue-500\\/10"] {
            background-color: #EFF6FF !important;
            background: #EFF6FF !important;
            border-color: #3B82F6 !important;
          }
          /* Rest days: light neutral gray card and gray border in print */
          .no-print-bg [class*="bg-white\\/5"] {
            background-color: #F3F4F6 !important;
            background: #F3F4F6 !important;
            border-color: #D1D5DB !important;
          }
          /* Empty days: soft gray card in print */
          .no-print-bg [class*="bg-white\\/2"] {
            background-color: #FAFAFA !important;
            background: #FAFAFA !important;
            border-color: #E5E7EB !important;
          }
          /* Multiple sessions day cells: white container */
          .no-print-bg [class*="bg-white\\/1"] {
            background-color: white !important;
            background: white !important;
            border-color: #E5E7EB !important;
          }

          /* Rest Day "DESCANSO" badge background and text in print */
          .no-print-bg [class*="bg-white\\/5"] span[class*="bg-white\\/10"] {
            background-color: #E5E7EB !important;
            background: #E5E7EB !important;
            color: #4B5563 !important;
          }

          /* Force solid background colors for legend circles in print */
          .no-print-bg span[class*="bg-amber-500"] {
            background-color: #F59E0B !important;
            background: #F59E0B !important;
          }
          .no-print-bg span[class*="bg-emerald-500"] {
            background-color: #10B981 !important;
            background: #10B981 !important;
          }
          .no-print-bg span[class*="bg-blue-500"] {
            background-color: #3B82F6 !important;
            background: #3B82F6 !important;
          }
          .no-print-bg span[class*="bg-slate-300"] {
            background-color: #9CA3AF !important;
            background: #9CA3AF !important;
          }
          
          /* Stretch day cell grid wrappers and their DayCell children in print */
          .no-print-bg [class*="p-1\\.5"] {
            display: flex !important;
            flex-direction: column !important;
            padding: 1px 1px 4px 1px !important; /* Small 4px margin at the bottom */
            height: 100% !important;
          }
          .no-print-bg [class*="p-1\\.5"] > div {
            flex-grow: 1 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 5px !important;
          }
          
          /* Text overrides for print to match clean high-contrast white card aesthetic */
          .no-print-bg .text-white,
          .no-print-bg .text-slate-100,
          .no-print-bg .text-slate-200,
          .no-print-bg .text-slate-350 {
            color: #0f172a !important;
          }
          .no-print-bg .text-slate-400,
          .no-print-bg .text-slate-500,
          .no-print-bg .text-slate-650 {
            color: #475569 !important;
          }

          /* Enhance accent text readability on light printed backgrounds */
          .no-print-bg [class*="text-amber-400"] {
            color: #D97706 !important;
          }
          .no-print-bg [class*="text-emerald-450"] {
            color: #059669 !important;
          }
          .no-print-bg [class*="text-blue-400"] {
            color: #2563EB !important;
          }

          /* Card inner borders/separators in print */
          .no-print-bg hr, 
          .no-print-bg .border-t, 
          .no-print-bg .border-white\\/10, 
          .no-print-bg .border-white\\/5 {
            border-color: #e5e7eb !important;
          }

          /* Grid column borders and backgrounds */
          .no-print-bg .border-slate-200,
          .no-print-bg .border-white\\/10,
          .no-print-bg .border-white\\/5 {
            border-color: #e5e7eb !important;
          }
          .no-print-bg .bg-slate-50,
          .no-print-bg .bg-slate-50\\/30,
          .no-print-bg .bg-slate-50\\/10 {
            background-color: #f9fafb !important;
            background: #f9fafb !important;
          }
          /* Day number badge compact */
          .h-5.w-5, [class*="h-5"][class*="w-5"] {
            height: 15px !important;
            width: 15px !important;
            font-size: 9.5px !important;
          }
          .p-1\\.5 {
            padding: 1.5px !important;
          }
          .py-3 {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
          .px-2 {
            padding-left: 2px !important;
            padding-right: 2px !important;
          }
          .mb-6 {
            margin-bottom: 6px !important;
          }
          .pb-4 {
            padding-bottom: 3px !important;
          }
          .gap-5 {
            gap: 5px !important;
          }
          .space-y-5 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 5px !important;
          }
          .overflow-x-auto {
            overflow: visible !important;
          }
          /* Compact print header */
          .print\\:flex img {
            height: 32px !important;
            width: 32px !important;
          }
          .print\\:flex h1 {
            font-size: 13.5px !important;
          }
          .print\\:flex p {
            font-size: 8.5px !important;
          }
          
          /* Card inner borders/separators */
          [class*="bg-emerald-500"] hr, [class*="bg-emerald-500"] .border-t, [class*="bg-emerald-500"] .border-white\\/10, [class*="bg-emerald-500"] .border-white\\/5,
          [class*="bg-sky-500"] hr, [class*="bg-sky-500"] .border-t, [class*="bg-sky-500"] .border-white\\/10, [class*="bg-sky-500"] .border-white\\/5,
          [class*="bg-orange-500"] hr, [class*="bg-orange-500"] .border-t, [class*="bg-orange-500"] .border-white\\/10, [class*="bg-orange-500"] .border-white\\/5 {
            border-color: #e5e7eb !important;
          }
          [class*="bg-yellow-500"] hr, [class*="bg-yellow-500"] .border-t, [class*="bg-yellow-500"] .border-white\\/10, [class*="bg-yellow-500"] .border-white\\/5 {
            border-color: #e5e7eb !important;
          }

          /* Compact spacing for card contents inside print */
          [class*="bg-"] .mt-1 {
            margin-top: 2px !important;
          }
          [class*="bg-"] .space-y-1 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1px !important;
          }
          [class*="bg-"] .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1px !important;
          }
          [class*="bg-"] .py-1\\.5 {
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
          }
          [class*="bg-"] .px-2 {
            padding-left: 2px !important;
            padding-right: 2px !important;
          }

          /* Preserves CSS backgrounds for activities */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      ` }} />

      {/* Print/Screen Header (Unified and Premium) */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5 w-full">
        <div className="flex items-center gap-4">
          {orgSettings?.club_logo_url ? (
            <img
              src={orgSettings.club_logo_url}
              alt="Escudo"
              className="h-14 w-14 object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Shield className="h-7 w-7 text-slate-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-white leading-tight">
              {orgSettings?.club_name || "SD Almazán"}
            </h1>
            <h2 className="text-sm font-semibold text-slate-350 mt-0.5">
              Planning de Pretemporada
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Temporada {activeSeasonName || "2026/2027"}
            </p>
          </div>
        </div>

        {/* Legend in the upper-right corner (visible on print too!) */}
        <div className="flex flex-wrap items-center gap-3.5 bg-white/2 px-4 py-2.5 rounded-xl border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          {ALL_SESSION_TYPES.map(
            (t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className={cn("h-2.5 w-2.5 rounded-full border border-slate-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]", {
                    "bg-amber-500": t === "training",
                    "bg-slate-300": t === "rest",
                    "bg-emerald-500": t === "friendly",
                    "bg-blue-500": t === "league",
                  })}
                />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {TYPE_LABELS[t]}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Date range pickers & Toolbar - no-print */}
      <div className="flex flex-wrap items-center gap-4 justify-between bg-white/2 p-4 rounded-2xl border border-white/10 no-print">
        <div className="flex flex-wrap items-center gap-3">
          {/* Undo/Redo & Modes */}
          <div className="flex items-center gap-1.5 border-r border-white/5 pr-4">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Deshacer (Ctrl + Z)"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Rehacer (Ctrl + Y)"
            >
              <Redo className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (copyMode === "idle") {
                  setCopyMode("selecting");
                } else {
                  setCopyMode("idle");
                }
                setDeleteMode(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ml-1",
                copyMode !== "idle"
                  ? "border-brand-500 bg-brand-500/15 text-brand-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title="Copiar y Pegar Sesiones"
            >
              <Copy className="h-4 w-4" />
              <span>
                {copyMode === "selecting"
                  ? "Selecciona Sesión..."
                  : copyMode === "pasting"
                  ? "Pegar en Día..."
                  : "Copiar Sesión"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteMode(!deleteMode);
                setCopyMode("idle");
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ml-1.5",
                deleteMode
                  ? "border-rose-500 bg-rose-500/15 text-rose-450 shadow-[0_0_8px_rgba(239,68,68,0.04)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title="Eliminar Sesión directamente"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleteMode ? "Modo Eliminar..." : "Eliminar Sesión"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors cursor-pointer [color-scheme:dark]"
            />
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500" />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white font-bold text-xs transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          title="Exportar PDF"
        >
          <Printer className="h-4 w-4" />
          <span>Exportar PDF</span>
        </button>
      </div>

      {/* Stats row - no-print */}
      <div className="flex flex-wrap gap-5 no-print border-b border-white/5 pb-5">
        {ALL_SESSION_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", {
              "bg-amber-500": t === "training",
              "bg-slate-400": t === "rest",
              "bg-emerald-500": t === "friendly",
              "bg-blue-500": t === "league",
            })} />
            <span className="text-xs text-slate-400 font-medium">
              <span className={cn("font-bold text-sm mr-1", {
                "text-amber-450": t === "training",
                "text-slate-300": t === "rest",
                "text-emerald-450": t === "friendly",
                "text-blue-400": t === "league",
              })}>
                {stats[t]}
              </span>
              {TYPE_LABELS[t]}
              {t === "training" && "s"}
            </span>
          </div>
        ))}
      </div>

      {/* Copy/Delete mode active banners */}
      {copyMode !== "idle" && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 flex items-center justify-between text-xs text-slate-300 no-print animate-pulse">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-slate-455 flex-shrink-0" />
            <span>
              {copyMode === "selecting"
                ? "Modo Copiar activo: Haz clic sobre cualquier sesión del planning para seleccionarla y copiarla."
                : `Sesión copiada (${TYPE_LABELS[copiedSession?.type || "training"]}): Haz clic sobre cualquier día para pegarla. Puedes seguir pegándola en varios días.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCopyMode("idle")}
            className="px-3 py-1.5 rounded-xl bg-slate-700/50 hover:bg-slate-700/80 text-slate-250 font-bold transition-all cursor-pointer text-[10px]"
          >
            Cancelar Modo Copiar (Esc)
          </button>
        </div>
      )}

      {deleteMode && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 flex items-center justify-between text-xs text-rose-300 no-print animate-pulse">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span>
              Modo Eliminar activo: Haz clic sobre cualquier sesión del planning para eliminarla directamente.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteMode(false)}
            className="px-3 py-1.5 rounded-xl bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 font-bold transition-all cursor-pointer text-[10px]"
          >
            Cancelar Modo Eliminar (Esc)
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {weeks.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-10 text-center text-slate-500 text-sm">
          Selecciona un rango de fechas válido para generar el planning.
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 overflow-hidden w-full shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <div className="overflow-x-auto">
            <div className="min-w-[820px] grid" style={{ gridTemplateColumns: "110px repeat(7, minmax(0, 1fr))" }}>
              {/* Column headers */}
              <div className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 border-b border-white/10 text-center">
                Semana
              </div>
              {DAY_ABBRS.map((abbr, i) => (
                <div
                  key={abbr}
                  className={cn(
                    "py-3 text-center text-[10px] font-bold uppercase tracking-widest bg-white/5 border-b border-white/10",
                    i >= 5 ? "text-slate-500" : "text-slate-300"
                  )}
                >
                  {abbr}
                </div>
              ))}

              {/* Week rows */}
              {weeks.map((week, weekIdx) => {
                const weekStart = week[0];
                const weekEnd = week[6];
                const weekLabel = `Semana ${weekIdx + 1}`;
                const weekRange = `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`;

                return (
                  <Fragment key={weekIdx}>
                    {/* Week label column */}
                    <div className="px-2 py-3 flex flex-col justify-center items-center gap-1 border-r border-b border-white/5 bg-white/2 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-slate-200 uppercase tracking-wider">
                        Semana {weekIdx + 1}
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold mt-0.5 whitespace-nowrap">
                        {weekRange}
                      </span>
                    </div>

                    {/* Day cells */}
                    {week.map((day) => {
                      const dateStr = toDateStr(day);
                      const inRange =
                        rangeStart &&
                        rangeEnd &&
                        day >= rangeStart &&
                        day <= rangeEnd;
                      const daySessions = sessions.filter(
                        (s) => s.date === dateStr
                      );
                      const isToday =
                        dateStr === toDateStr(TODAY);
                      const sesNum = trainingNumbers[dateStr] ?? 0;

                      return (
                        <div
                          key={dateStr}
                          className="p-1.5 border-r border-b border-white/5 last:border-r-0"
                        >
                          <DayCell
                            day={day}
                            sessions={daySessions}
                            inRange={!!inRange}
                            sessionNumber={sesNum}
                            onAdd={openAdd}
                            onEdit={openEdit}
                            isToday={isToday}
                            copyMode={copyMode}
                            onSessionSelectForCopy={handleSessionSelectForCopy}
                            onDayClick={handleDayClickToPaste}
                            onCellContextMenu={handleCellContextMenu}
                            deleteMode={deleteMode}
                            onSessionDelete={handleSessionDeleteDirect}
                            leagueMatchdays={leagueMatchdays}
                          />
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modal.open && (
        <AddSessionModal
          modal={modal}
          onChange={(patch) => setModal((prev) => ({ ...prev, ...patch }))}
          onSave={handleSave}
          onClose={() => setModal(EMPTY_MODAL)}
          onDelete={handleDelete}
        />
      )}

      {/* ── Context Menu ── */}
      {contextMenu.open && (
        <div
          className="fixed z-50 bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[160px] animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "session" && (
            <button
              type="button"
              onClick={() => {
                if (contextMenu.session) {
                  setCopiedSession(contextMenu.session);
                  setCopyMode("pasting");
                }
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              Copiar Sesión
            </button>
          )}

          {contextMenu.type === "day" && (
            <button
              type="button"
              disabled={!copiedSession}
              onClick={() => {
                if (contextMenu.date) {
                  handleDayClickToPaste(contextMenu.date);
                }
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Clipboard className="h-3.5 w-3.5 text-slate-400" />
              Pegar Sesión
            </button>
          )}
        </div>
      )}
    </div>
  );
}
