"use client";

import { POSITION_LABELS, type PositionKey } from "@/types";
import { cn } from "@/lib/utils";

// ============================================================
// FIELD POSITIONS MAP
// Layout: 4-3-3 / 4-2-3-1 adaptable
// ============================================================

interface FieldPosition {
  key: PositionKey;
  x: number; // percentage from left
  y: number; // percentage from top
}

const FIELD_POSITIONS: FieldPosition[] = [
  // GK
  { key: "goalkeeper",            x: 50,  y: 88 },
  // Defenders
  { key: "left_back",             x: 15,  y: 70 },
  { key: "left_center_back",      x: 35,  y: 74 },
  { key: "right_center_back",     x: 65,  y: 74 },
  { key: "right_back",            x: 85,  y: 70 },
  // Midfielders
  { key: "defensive_midfielder",  x: 50,  y: 55 },
  { key: "playmaker_midfielder",  x: 30,  y: 43 },
  { key: "attacking_midfielder",  x: 70,  y: 43 },
  // Forwards
  { key: "left_winger",           x: 15,  y: 25 },
  { key: "striker",               x: 50,  y: 18 },
  { key: "right_winger",          x: 85,  y: 25 },
];

// ============================================================
// PLAYER DOT
// ============================================================

interface PlayerDot {
  playerId: string;
  name: string;
  jerseyNumber?: number | null;
  status?: "green" | "yellow" | "red";
}

interface FieldMapProps {
  /** Map of position key → player(s) occupying it */
  assignments: Partial<Record<PositionKey, PlayerDot[]>>;
  /** Highlighted position (for form selection) */
  selectedPosition?: PositionKey | null;
  /** If true, clicking positions is allowed */
  interactive?: boolean;
  onPositionClick?: (position: PositionKey) => void;
}

const STATUS_COLORS = {
  green:  { ring: "ring-emerald-400", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  yellow: { ring: "ring-amber-400",   bg: "bg-amber-400/20",   text: "text-amber-300"   },
  red:    { ring: "ring-rose-400",    bg: "bg-rose-400/20",    text: "text-rose-300"     },
};

export function FieldMap({
  assignments,
  selectedPosition,
  interactive = false,
  onPositionClick,
}: FieldMapProps) {
  return (
    <div
      className="relative w-full select-none"
      style={{ paddingBottom: "140%" }} // portrait field ratio
      aria-label="Campograma"
    >
      {/* Field background */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden bg-gradient-to-b from-[oklch(30%_0.12_145)] to-[oklch(22%_0.10_145)]">
        {/* Field lines */}
        <svg
          viewBox="0 0 100 140"
          className="absolute inset-0 w-full h-full opacity-30"
          preserveAspectRatio="none"
        >
          {/* Outer border */}
          <rect x="4" y="4" width="92" height="132" fill="none" stroke="white" strokeWidth="0.8" />
          {/* Centre line */}
          <line x1="4" y1="70" x2="96" y2="70" stroke="white" strokeWidth="0.6" />
          {/* Centre circle */}
          <circle cx="50" cy="70" r="12" fill="none" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="70" r="0.8" fill="white" />
          {/* Penalty area top */}
          <rect x="24" y="4" width="52" height="22" fill="none" stroke="white" strokeWidth="0.6" />
          {/* Goal area top */}
          <rect x="36" y="4" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
          {/* Penalty area bottom */}
          <rect x="24" y="114" width="52" height="22" fill="none" stroke="white" strokeWidth="0.6" />
          {/* Goal area bottom */}
          <rect x="36" y="127" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
          {/* Penalty spot top */}
          <circle cx="50" cy="18" r="0.8" fill="white" />
          {/* Penalty spot bottom */}
          <circle cx="50" cy="122" r="0.8" fill="white" />
          {/* Goals */}
          <rect x="38" y="1.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="38" y="135.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
        </svg>

        {/* Position dots */}
        {FIELD_POSITIONS.map(({ key, x, y }) => {
          const players = assignments[key] ?? [];
          const isSelected = selectedPosition === key;
          const hasPlayers = players.length > 0;

          return (
            <div
              key={key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {hasPlayers ? (
                /* Player token */
                <div className="flex flex-col items-center gap-0.5">
                  {players.slice(0, 1).map((p) => {
                    const sc = STATUS_COLORS[p.status ?? "green"];
                    return (
                      <div key={p.playerId} className="flex flex-col items-center">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full ring-2 flex items-center justify-center text-[9px] font-bold text-white shadow-lg",
                            sc.ring, sc.bg
                          )}
                          title={`${p.name}${p.jerseyNumber ? ` #${p.jerseyNumber}` : ""}`}
                        >
                          {p.jerseyNumber ?? p.name.slice(0, 2)}
                        </div>
                        <span className="text-[8px] text-white/70 font-medium mt-0.5 max-w-[48px] truncate leading-none">
                          {p.name.split(" ").pop()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty position */
                <button
                  onClick={() => interactive && onPositionClick?.(key)}
                  disabled={!interactive}
                  className={cn(
                    "h-6 w-6 rounded-full border border-dashed transition-all",
                    isSelected
                      ? "border-emerald-400 bg-emerald-400/20 scale-125"
                      : "border-white/30 bg-white/5",
                    interactive && "cursor-pointer hover:border-white/60 hover:bg-white/10"
                  )}
                  title={POSITION_LABELS[key]}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// POSITION SELECTOR (for forms)
// ============================================================

interface PositionSelectorProps {
  selected: PositionKey[];
  onChange: (positions: PositionKey[]) => void;
}

export function PositionSelector({ selected, onChange }: PositionSelectorProps) {
  const toggle = (pos: PositionKey) => {
    if (selected.includes(pos)) {
      onChange(selected.filter((p) => p !== pos));
    } else {
      onChange([...selected, pos]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {FIELD_POSITIONS.map(({ key }) => {
        const isSelected = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
              isSelected
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20 hover:text-white"
            )}
          >
            {POSITION_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
