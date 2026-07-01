"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  training: "Entrenamiento",
  rest: "Descanso",
  friendly: "Partido Amistoso",
  league: "Partido Liga",
};

const TYPE_STYLES: Record<SessionType, string> = {
  training:
    "bg-orange-500/20 border-orange-500/40 text-orange-200 shadow-[0_0_8px_rgba(249,115,22,0.1)]",
  rest: "bg-yellow-500/20 border-yellow-500/40 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)]",
  friendly:
    "bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-[0_0_8px_rgba(14,165,233,0.1)]",
  league:
    "bg-rose-600/20 border-rose-600/40 text-rose-200 shadow-[0_0_8px_rgba(225,29,72,0.1)]",
};

const TYPE_DOT: Record<SessionType, string> = {
  training: "bg-orange-400",
  rest: "bg-yellow-400",
  friendly: "bg-sky-400",
  league: "bg-rose-400",
};

const TYPE_BADGE: Record<SessionType, string> = {
  training: "bg-orange-500/30 text-orange-300",
  rest: "bg-yellow-500/30 text-yellow-300",
  friendly: "bg-sky-500/30 text-sky-300",
  league: "bg-rose-500/30 text-rose-300",
};

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 glass rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">
              {modal.editId ? "Editar sesión" : "Añadir sesión"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {DAY_NAMES[(dateObj.getDay() + 6) % 7]},{" "}
              {dateObj.getDate()} de{" "}
              {MONTH_NAMES_FULL[dateObj.getMonth()]} {dateObj.getFullYear()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
              Tipo de sesión
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["training", "rest", "friendly", "league"] as SessionType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ type: t })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                      modal.type === t
                        ? TYPE_STYLES[t]
                        : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        modal.type === t ? TYPE_DOT[t] : "bg-slate-600"
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
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Hora
                  </label>
                  <input
                    type="time"
                    value={modal.startTime}
                    onChange={(e) => onChange({ startTime: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Lugar
                  </label>
                  <input
                    type="text"
                    value={modal.location}
                    onChange={(e) => onChange({ location: e.target.value })}
                    placeholder="Campo Municipal…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
                  />
                </div>
              </div>

              {/* Match-specific fields */}
              {isMatch && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Rival
                    </label>
                    <input
                      type="text"
                      value={modal.opponent}
                      onChange={(e) => onChange({ opponent: e.target.value })}
                      placeholder="Nombre del rival…"
                      className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                        Tipo de campo
                      </label>
                      <select
                        value={modal.fieldType}
                        onChange={(e) => onChange({ fieldType: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-slate-800 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="">— Seleccionar —</option>
                        {FIELD_TYPES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                        Dimensiones
                      </label>
                      <input
                        type="text"
                        value={modal.fieldDimensions}
                        onChange={(e) =>
                          onChange({ fieldDimensions: e.target.value })
                        }
                        placeholder="105/68"
                        className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Comments */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Observaciones
                </label>
                <textarea
                  value={modal.comments}
                  onChange={(e) => onChange({ comments: e.target.value })}
                  rows={2}
                  placeholder="Notas adicionales…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div>
            {onDelete && modal.editId && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
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
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-900/40 cursor-pointer"
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
}

function DayCell({
  day,
  sessions,
  inRange,
  sessionNumber,
  onAdd,
  onEdit,
  isToday,
}: DayCellProps) {
  const dateStr = toDateStr(day);

  if (!inRange) {
    return (
      <div className="rounded-xl border border-white/3 bg-white/1 min-h-[80px] opacity-20" />
    );
  }

  const isEmpty = sessions.length === 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-2 flex flex-col gap-1.5 min-h-[88px] group transition-all relative",
        isEmpty
          ? "border-white/5 bg-white/2 hover:border-white/15 hover:bg-white/5 cursor-pointer"
          : "border-white/8 bg-white/3 hover:bg-white/5",
        isToday && "ring-1 ring-brand-500/40 border-brand-500/30"
      )}
      onClick={isEmpty ? () => onAdd(dateStr) : undefined}
      title={isEmpty ? "Añadir sesión" : undefined}
    >
      {/* Day number */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-extrabold rounded-full h-5 w-5 flex items-center justify-center",
            isToday
              ? "bg-brand-500 text-white"
              : isEmpty
              ? "text-slate-600"
              : "text-slate-300"
          )}
        >
          {day.getDate()}
        </span>
        {isEmpty && (
          <Plus className="h-3 w-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Sessions */}
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
              onEdit(session);
            }}
            className={cn(
              "w-full text-left rounded-lg border px-2 py-1.5 text-[10px] leading-tight transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
              TYPE_STYLES[session.type]
            )}
          >
            {isRest ? (
              <span className="italic font-semibold opacity-80">DESCANSO</span>
            ) : (
              <>
                {/* Title row */}
                <div className="flex items-center gap-1 mb-0.5">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", TYPE_DOT[session.type])}
                  />
                  <span className="font-bold truncate">
                    {isMatch
                      ? session.opponent || TYPE_LABELS[session.type]
                      : `Sesión ${sessionNumber}`}
                  </span>
                </div>

                {/* Time + location */}
                {session.startTime && (
                  <div className="flex items-center gap-1 opacity-70 mt-0.5">
                    <Clock className="h-2 w-2 flex-shrink-0" />
                    <span className="truncate">
                      {session.startTime}h
                      {session.location ? ` · ${session.location}` : ""}
                    </span>
                  </div>
                )}

                {/* Match extra info */}
                {isMatch && (session.fieldType || session.fieldDimensions) && (
                  <div className="text-[9px] italic opacity-60 mt-0.5 truncate">
                    {[session.fieldType, session.fieldDimensions]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}

      {/* Add button when cell has sessions */}
      {!isEmpty && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(dateStr);
          }}
          className="mt-auto flex items-center justify-center h-5 w-full rounded-lg border border-dashed border-white/10 text-slate-700 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity hover:border-white/20 hover:text-slate-500 cursor-pointer"
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
    <div className="flex flex-wrap items-center gap-3">
      {(["training", "rest", "friendly", "league"] as SessionType[]).map(
        (t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-sm border",
                TYPE_STYLES[t].split(" ").slice(0, 2).join(" ")
              )}
            />
            <span className="text-xs text-slate-400">{TYPE_LABELS[t]}</span>
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
  const [sessions, setSessions] = useState<PreseasonSession[]>(DEMO_SESSIONS);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);

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
      setSessions((prev) => prev.map((s) => (s.id === editId ? payload : s)));
    } else {
      setSessions((prev) => [...prev, payload]);
    }
    setModal(EMPTY_MODAL);
  }, [modal]);

  const handleDelete = useCallback(() => {
    if (modal.editId) {
      setSessions((prev) => prev.filter((s) => s.id !== modal.editId));
    }
    setModal(EMPTY_MODAL);
  }, [modal.editId]);

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
    <>
      <div className="space-y-5 animate-fade-in">
        {/* ── Header card ── */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-start gap-5 justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/15 border border-brand-500/30">
                <Calendar className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Planificador de Pretemporada
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Organiza las sesiones, descansos y partidos del periodo
                  preparatorio
                </p>
              </div>
            </div>

            {/* Date range pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                  Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors cursor-pointer [color-scheme:dark]"
                />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                  Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-4">
            {(["training", "rest", "friendly", "league"] as SessionType[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", TYPE_DOT[t])} />
                <span className="text-xs text-slate-400">
                  <span className={cn("font-bold text-sm mr-1", {
                    "text-orange-300": t === "training",
                    "text-yellow-300": t === "rest",
                    "text-sky-300": t === "friendly",
                    "text-rose-300": t === "league",
                  })}>
                    {stats[t]}
                  </span>
                  {TYPE_LABELS[t]}
                  {t === "training" && "s"}
                </span>
              </div>
            ))}
            <div className="ml-auto">
              <Legend />
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        {weeks.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-10 text-center text-slate-500 text-sm">
            Selecciona un rango de fechas válido para generar el planning.
          </div>
        ) : (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[820px] grid" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
                {/* Column headers */}
                <div className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/2 border-b border-white/8">
                  Semana
                </div>
                {DAY_ABBRS.map((abbr, i) => (
                  <div
                    key={abbr}
                    className={cn(
                      "py-3 text-center text-xs font-bold uppercase tracking-widest bg-white/2 border-b border-white/8",
                      i >= 5 ? "text-slate-600" : "text-slate-400"
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
                      <div className="px-4 py-3 flex flex-col justify-center gap-0.5 border-r border-b border-white/5 bg-white/1">
                        <span className="text-xs font-bold text-slate-300">
                          {weekLabel}
                        </span>
                        <span className="text-[10px] text-slate-650 font-semibold mt-0.5">
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
      </div>

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
    </>
  );
}
