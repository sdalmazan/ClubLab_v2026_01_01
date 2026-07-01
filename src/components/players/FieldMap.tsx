"use client";

import { POSITION_LABELS, type PositionKey } from "@/types";
import { cn } from "@/lib/utils";

interface PlayerDot {
  playerId: string;
  name: string;
  lastName: string;
  isPrimary: boolean;
  status?: "green" | "yellow" | "red";
}

interface FieldMapProps {
  assignments: Partial<Record<PositionKey, PlayerDot[]>>;
  selectedPosition?: PositionKey | null;
  interactive?: boolean;
  onPositionClick?: (position: PositionKey) => void;
  formation?: string;
}

const FORMATIONS_COORDINATES: Record<string, Record<PositionKey, { x: number; y: number }>> = {
  "4-3-3": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 15, y: 70 },
    left_center_back: { x: 35, y: 74 },
    right_center_back: { x: 65, y: 74 },
    right_back: { x: 85, y: 70 },
    defensive_midfielder: { x: 50, y: 56 },
    playmaker_midfielder: { x: 30, y: 44 },
    attacking_midfielder: { x: 70, y: 44 },
    left_winger: { x: 15, y: 25 },
    striker: { x: 50, y: 18 },
    right_winger: { x: 85, y: 25 },
  },
  "4-4-2": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 15, y: 70 },
    left_center_back: { x: 35, y: 74 },
    right_center_back: { x: 65, y: 74 },
    right_back: { x: 85, y: 70 },
    defensive_midfielder: { x: 35, y: 52 },
    playmaker_midfielder: { x: 65, y: 52 },
    left_winger: { x: 15, y: 44 },
    right_winger: { x: 85, y: 44 },
    attacking_midfielder: { x: 35, y: 20 },
    striker: { x: 65, y: 20 },
  },
  "3-5-2": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 26, y: 74 },
    left_center_back: { x: 50, y: 76 },
    right_center_back: { x: 74, y: 74 },
    defensive_midfielder: { x: 50, y: 54 },
    playmaker_midfielder: { x: 32, y: 42 },
    attacking_midfielder: { x: 68, y: 42 },
    left_winger: { x: 12, y: 45 },
    right_winger: { x: 88, y: 45 },
    striker: { x: 35, y: 18 },
    right_back: { x: 65, y: 18 },
  },
  "3-4-3": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 26, y: 74 },
    left_center_back: { x: 50, y: 76 },
    right_center_back: { x: 74, y: 74 },
    defensive_midfielder: { x: 35, y: 52 },
    playmaker_midfielder: { x: 65, y: 52 },
    left_winger: { x: 12, y: 44 },
    right_winger: { x: 88, y: 44 },
    attacking_midfielder: { x: 25, y: 22 },
    right_back: { x: 75, y: 22 },
    striker: { x: 50, y: 18 },
  },
  "5-3-2": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 30, y: 75 },
    left_center_back: { x: 50, y: 77 },
    right_center_back: { x: 70, y: 75 },
    left_winger: { x: 12, y: 62 },
    right_winger: { x: 88, y: 62 },
    defensive_midfielder: { x: 32, y: 48 },
    playmaker_midfielder: { x: 68, y: 48 },
    attacking_midfielder: { x: 50, y: 36 },
    right_back: { x: 35, y: 18 },
    striker: { x: 65, y: 18 },
  },
  "4-2-3-1": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 15, y: 70 },
    left_center_back: { x: 35, y: 74 },
    right_center_back: { x: 65, y: 74 },
    right_back: { x: 85, y: 70 },
    defensive_midfielder: { x: 35, y: 56 },
    playmaker_midfielder: { x: 65, y: 56 },
    attacking_midfielder: { x: 50, y: 38 },
    left_winger: { x: 18, y: 32 },
    right_winger: { x: 82, y: 32 },
    striker: { x: 50, y: 18 },
  },
  "4-1-4-1": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 15, y: 70 },
    left_center_back: { x: 35, y: 74 },
    right_center_back: { x: 65, y: 74 },
    right_back: { x: 85, y: 70 },
    defensive_midfielder: { x: 50, y: 58 },
    left_winger: { x: 15, y: 40 },
    playmaker_midfielder: { x: 35, y: 42 },
    attacking_midfielder: { x: 65, y: 42 },
    right_winger: { x: 85, y: 40 },
    striker: { x: 50, y: 18 },
  },
  "4-5-1": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 15, y: 70 },
    left_center_back: { x: 35, y: 74 },
    right_center_back: { x: 65, y: 74 },
    right_back: { x: 85, y: 70 },
    defensive_midfielder: { x: 50, y: 56 },
    left_winger: { x: 15, y: 44 },
    playmaker_midfielder: { x: 32, y: 44 },
    attacking_midfielder: { x: 68, y: 44 },
    right_winger: { x: 85, y: 44 },
    striker: { x: 50, y: 22 },
  },
  "5-4-1": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 28, y: 74 },
    left_center_back: { x: 50, y: 76 },
    right_center_back: { x: 72, y: 74 },
    left_winger: { x: 12, y: 64 },
    right_winger: { x: 88, y: 64 },
    defensive_midfielder: { x: 35, y: 48 },
    playmaker_midfielder: { x: 65, y: 48 },
    attacking_midfielder: { x: 50, y: 35 },
    right_back: { x: 50, y: 48 },
    striker: { x: 50, y: 20 },
  },
  "3-6-1": {
    goalkeeper: { x: 50, y: 88 },
    left_back: { x: 28, y: 74 },
    left_center_back: { x: 50, y: 76 },
    right_center_back: { x: 72, y: 74 },
    defensive_midfielder: { x: 35, y: 58 },
    playmaker_midfielder: { x: 65, y: 58 },
    left_winger: { x: 15, y: 44 },
    right_winger: { x: 85, y: 44 },
    attacking_midfielder: { x: 35, y: 34 },
    right_back: { x: 65, y: 34 },
    striker: { x: 50, y: 18 },
  },
};

const POSITION_ROLES_SHORT: Record<PositionKey, string> = {
  goalkeeper: "POR",
  left_back: "LI",
  left_center_back: "DFC",
  right_center_back: "DFC",
  right_back: "LD",
  defensive_midfielder: "MCD",
  playmaker_midfielder: "MC",
  attacking_midfielder: "MCO",
  left_winger: "EI",
  right_winger: "ED",
  striker: "DC",
};

export function FieldMap({
  assignments,
  selectedPosition,
  interactive = false,
  onPositionClick,
  formation = "4-3-3",
}: FieldMapProps) {
  const coords = FORMATIONS_COORDINATES[formation] ?? FORMATIONS_COORDINATES["4-3-3"];
  const positionsKeys = Object.keys(coords) as PositionKey[];

  return (
    <div
      className="relative w-full select-none"
      style={{ paddingBottom: "140%" }}
      aria-label="Campograma"
    >
      {/* Field background */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden bg-gradient-to-b from-[oklch(30%_0.12_145)] to-[oklch(22%_0.10_145)]">
        {/* Field lines */}
        <svg
          viewBox="0 0 100 140"
          className="absolute inset-0 w-full h-full opacity-35"
          preserveAspectRatio="none"
        >
          <rect x="4" y="4" width="92" height="132" fill="none" stroke="white" strokeWidth="0.8" />
          <line x1="4" y1="70" x2="96" y2="70" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="70" r="12" fill="none" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="70" r="0.8" fill="white" />
          <rect x="24" y="4" width="52" height="22" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="36" y="4" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="24" y="114" width="52" height="22" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="36" y="127" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="18" r="0.8" fill="white" />
          <circle cx="50" cy="122" r="0.8" fill="white" />
          <rect x="38" y="1.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="38" y="135.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
        </svg>

        {/* Position dots */}
        {positionsKeys.map((key) => {
          const { x, y } = coords[key];
          const eligible = assignments[key] ?? [];
          const isSelected = selectedPosition === key;
          const hasPlayers = eligible.length > 0;

          // Sort so primary positions come first
          const sorted = [...eligible].sort((a, b) =>
            a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1
          );

          return (
            <div
              key={key}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <button
                type="button"
                onClick={() => interactive && onPositionClick?.(key)}
                disabled={!interactive}
                className={cn(
                  "h-7 w-7 rounded-full border transition-all flex items-center justify-center text-[9px] font-bold shadow-lg",
                  isSelected
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 scale-110"
                    : "border-white/20 bg-slate-900/90 text-slate-400 hover:border-white/50",
                  interactive && "cursor-pointer"
                )}
                title={POSITION_LABELS[key]}
              >
                {POSITION_ROLES_SHORT[key] || "—"}
              </button>

              {/* Eligible players box */}
              {hasPlayers && (
                <div className="mt-1 bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-lg p-1 flex flex-col gap-0.5 max-w-[90px] text-center shadow-2xl pointer-events-none">
                  {sorted.slice(0, 4).map((p) => (
                    <span
                      key={p.playerId}
                      className={cn(
                        "text-[8px] truncate leading-none px-1 block",
                        p.isPrimary ? "text-emerald-400 font-extrabold" : "text-slate-400/60 font-medium"
                      )}
                    >
                      {p.lastName.split(" ").pop()}
                    </span>
                  ))}
                  {sorted.length > 4 && (
                    <span className="text-[7px] text-slate-500 font-bold leading-none">
                      +{sorted.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PositionSelectorProps {
  selected: PositionKey[];
  onChange: (positions: PositionKey[]) => void;
}

export function PositionSelector({ selected, onChange }: PositionSelectorProps) {
  const keys = Object.keys(POSITION_ROLES_SHORT) as PositionKey[];
  const toggle = (pos: PositionKey) => {
    if (selected.includes(pos)) {
      onChange(selected.filter((p) => p !== pos));
    } else {
      onChange([...selected, pos]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => {
        const isSelected = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
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
