"use client";

import { useState, useEffect } from "react";
import { POSITION_LABELS, getPositionLabel, type PositionKey } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

interface PlayerDot {
  playerId: string;
  name: string;
  lastName: string;
  sportingName?: string | null;
  isPrimary: boolean;
  status?: "green" | "yellow" | "red";
  signingStatus?: string;
  birthYear?: string;
  seasonStartYear?: string;
  adjective?: string;
}

interface FieldMapProps {
  assignments: Partial<Record<PositionKey, PlayerDot[]>>;
  selectedPosition?: PositionKey | null;
  interactive?: boolean;
  onPositionClick?: (position: PositionKey) => void;
  formation?: string;
  printMode?: boolean;
}

const FORMATIONS_COORDINATES: Record<string, Record<PositionKey, { x: number; y: number }>> = {
  "4-3-3": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 11, y: 76 },
    left_center_back: { x: 36.5, y: 79 },
    right_center_back: { x: 63.5, y: 79 },
    right_back: { x: 89, y: 76 },
    defensive_midfielder: { x: 50, y: 61 },
    playmaker_midfielder: { x: 30, y: 45 },
    attacking_midfielder: { x: 70, y: 45 },
    left_winger: { x: 11, y: 22 },
    striker: { x: 50, y: 13 },
    right_winger: { x: 89, y: 22 },
  },
  "4-4-2": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 11, y: 76 },
    left_center_back: { x: 36.5, y: 79 },
    right_center_back: { x: 63.5, y: 79 },
    right_back: { x: 89, y: 76 },
    defensive_midfielder: { x: 34, y: 58 },
    playmaker_midfielder: { x: 66, y: 58 },
    left_winger: { x: 11, y: 32 },
    right_winger: { x: 89, y: 32 },
    attacking_midfielder: { x: 35, y: 14 },
    striker: { x: 65, y: 14 },
  },
  "3-5-2": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 28, y: 79 },
    left_center_back: { x: 50, y: 81 },
    right_center_back: { x: 72, y: 79 },
    defensive_midfielder: { x: 50, y: 61 },
    playmaker_midfielder: { x: 32, y: 42 },
    attacking_midfielder: { x: 68, y: 42 },
    left_winger: { x: 10, y: 45 },
    right_winger: { x: 90, y: 45 },
    striker: { x: 35, y: 14 },
    right_back: { x: 65, y: 14 },
  },
  "3-4-3": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 28, y: 79 },
    left_center_back: { x: 50, y: 81 },
    right_center_back: { x: 72, y: 79 },
    defensive_midfielder: { x: 34, y: 58 },
    playmaker_midfielder: { x: 66, y: 58 },
    left_winger: { x: 10, y: 32 },
    right_winger: { x: 90, y: 32 },
    attacking_midfielder: { x: 30, y: 14 },
    right_back: { x: 70, y: 14 },
    striker: { x: 50, y: 13 },
  },
  "5-3-2": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 31, y: 78 },
    left_center_back: { x: 50, y: 80 },
    right_center_back: { x: 69, y: 78 },
    left_winger: { x: 10, y: 58 },
    right_winger: { x: 90, y: 58 },
    defensive_midfielder: { x: 33, y: 46 },
    playmaker_midfielder: { x: 67, y: 46 },
    attacking_midfielder: { x: 50, y: 28 },
    right_back: { x: 35, y: 14 },
    striker: { x: 65, y: 14 },
  },
  "4-2-3-1": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 11, y: 76 },
    left_center_back: { x: 36.5, y: 79 },
    right_center_back: { x: 63.5, y: 79 },
    right_back: { x: 89, y: 76 },
    defensive_midfielder: { x: 34, y: 60 },
    playmaker_midfielder: { x: 66, y: 60 },
    attacking_midfielder: { x: 50, y: 34.5 },
    left_winger: { x: 12, y: 34.5 },
    right_winger: { x: 88, y: 35.5 },
    striker: { x: 50, y: 10 },
  },
  "4-1-4-1": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 11, y: 76 },
    left_center_back: { x: 36.5, y: 79 },
    right_center_back: { x: 63.5, y: 79 },
    right_back: { x: 89, y: 76 },
    defensive_midfielder: { x: 50, y: 61 },
    left_winger: { x: 11, y: 36 },
    playmaker_midfielder: { x: 34, y: 41 },
    attacking_midfielder: { x: 66, y: 41 },
    right_winger: { x: 89, y: 36 },
    striker: { x: 50, y: 13 },
  },
  "4-5-1": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 11, y: 76 },
    left_center_back: { x: 36.5, y: 79 },
    right_center_back: { x: 63.5, y: 79 },
    right_back: { x: 89, y: 76 },
    defensive_midfielder: { x: 50, y: 61 },
    left_winger: { x: 11, y: 40 },
    playmaker_midfielder: { x: 34, y: 44 },
    attacking_midfielder: { x: 66, y: 44 },
    right_winger: { x: 89, y: 40 },
    striker: { x: 50, y: 13 },
  },
  "5-4-1": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 28, y: 79 },
    left_center_back: { x: 50, y: 81 },
    right_center_back: { x: 72, y: 79 },
    left_winger: { x: 10, y: 64 },
    right_winger: { x: 90, y: 64 },
    defensive_midfielder: { x: 34, y: 48 },
    playmaker_midfielder: { x: 66, y: 48 },
    attacking_midfielder: { x: 50, y: 28 },
    right_back: { x: 50, y: 48 },
    striker: { x: 50, y: 13 },
  },
  "3-6-1": {
    goalkeeper: { x: 50, y: 94 },
    left_back: { x: 28, y: 79 },
    left_center_back: { x: 50, y: 81 },
    right_center_back: { x: 72, y: 79 },
    defensive_midfielder: { x: 34, y: 60 },
    playmaker_midfielder: { x: 66, y: 60 },
    left_winger: { x: 10, y: 44 },
    right_winger: { x: 90, y: 44 },
    attacking_midfielder: { x: 30, y: 28 },
    right_back: { x: 70, y: 28 },
    striker: { x: 50, y: 13 },
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
  printMode = false,
}: FieldMapProps) {
  const [manualOrders, setManualOrders] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cl_manual_player_order");
        if (saved) {
          setManualOrders(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Error loading manual orders:", e);
      }
    }
  }, []);

  const saveManualOrder = (positionKey: string, newOrder: string[]) => {
    const updated = { ...manualOrders, [positionKey]: newOrder };
    setManualOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_manual_player_order", JSON.stringify(updated));
    }
  };

  const movePlayer = (positionKey: PositionKey, playerId: string, direction: "up" | "down") => {
    const eligible = assignments[positionKey] ?? [];
    const typeWeight = (status?: string) => {
      if (status === "yellow" || status === "red") return 2;
      return 1;
    };
    const statusWeight = (s?: string) => {
      if (s === "close") return 2;
      if (s === "difficult") return 3;
      return 1;
    };

    const baseSorted = [...eligible].sort((a, b) => {
      const tA = typeWeight(a.status);
      const tB = typeWeight(b.status);
      if (tA !== tB) return tA - tB;
      const wA = statusWeight(a.signingStatus);
      const wB = statusWeight(b.signingStatus);
      if (wA !== wB) return wA - wB;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return 0;
    });

    const customOrder = manualOrders[positionKey];
    let currentOrder = baseSorted.map(p => p.playerId);

    if (customOrder && customOrder.length > 0) {
      currentOrder = [...baseSorted]
        .sort((a, b) => {
          const idxA = customOrder.indexOf(a.playerId);
          const idxB = customOrder.indexOf(b.playerId);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return baseSorted.indexOf(a) - baseSorted.indexOf(b);
        })
        .map(p => p.playerId);
    }

    const index = currentOrder.indexOf(playerId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    const updatedOrder = [...currentOrder];
    const temp = updatedOrder[index];
    updatedOrder[index] = updatedOrder[newIndex];
    updatedOrder[newIndex] = temp;

    saveManualOrder(positionKey, updatedOrder);
  };

  const customCoords = typeof window !== "undefined" ? (window as any).cl_formation_coordinates : null;
  const coords = customCoords ?? (FORMATIONS_COORDINATES[formation] ?? FORMATIONS_COORDINATES["4-3-3"]);
  const positionsKeys = Object.keys(coords) as PositionKey[];

  return (
    <div
      className="relative w-full select-none"
      style={{ paddingBottom: "140%" }}
      aria-label="Campograma"
    >
      {/* Field background (with overflow-hidden for gradients/lines) */}
      <div className={cn(
        "absolute inset-0 rounded-2xl overflow-hidden",
        printMode
          ? "bg-[#1E3F20]"
          : "bg-gradient-to-b from-[oklch(30%_0.12_145)] to-[oklch(22%_0.10_145)]"
      )}>
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
      </div>

      {/* Position dots container (NO overflow-hidden, so goalkeeper's card/box can overflow bottom edge) */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl z-10">
        {positionsKeys.map((key) => {
          const { x, y } = coords[key];
          const eligible = assignments[key] ?? [];
          const isSelected = selectedPosition === key;
          const hasPlayers = eligible.length > 0;
          
          // Sort so: main team players first (signed, close, difficult), then reserves/youth below them
          const baseSorted = [...eligible].sort((a, b) => {
            const typeWeight = (status?: string) => {
              if (status === "yellow" || status === "red") return 2;
              return 1; // main first
            };
            const tA = typeWeight(a.status);
            const tB = typeWeight(b.status);
            if (tA !== tB) return tA - tB;

            const statusWeight = (s?: string) => {
              if (s === "close") return 2;
              if (s === "difficult") return 3;
              return 1; // "signed" first
            };
            const wA = statusWeight(a.signingStatus);
            const wB = statusWeight(b.signingStatus);
            if (wA !== wB) return wA - wB;
            
            // Fallback to primary position sorting if status is equal
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
            return 0;
          });

          // Apply manual order override if exists for this position key
          const customOrder = manualOrders[key];
          let sorted = baseSorted;
          if (customOrder && customOrder.length > 0) {
            sorted = [...baseSorted].sort((a, b) => {
              const idxA = customOrder.indexOf(a.playerId);
              const idxB = customOrder.indexOf(b.playerId);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return baseSorted.indexOf(a) - baseSorted.indexOf(b);
            });
          }

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
                  "h-8 w-8 rounded-full border-2 flex items-center justify-center text-[11px] font-extrabold",
                  printMode
                    ? "border-[var(--primary)] bg-white text-[var(--primary)]"
                    : cn(
                        "transition-all shadow-lg shadow-black/30",
                        isSelected
                          ? "border-[var(--primary)] bg-white text-[var(--primary)] scale-115 ring-4 ring-[var(--primary)]/35"
                          : "border-[var(--primary)] bg-white text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white",
                        interactive && "cursor-pointer"
                      )
                )}
                title={getPositionLabel(key)}
              >
                {POSITION_ROLES_SHORT[key] || "—"}
              </button>

              {/* Eligible players box */}
              {hasPlayers && (
                <div className={cn(
                  "mt-0.5 border rounded-xl p-1 flex flex-col gap-0.5 min-w-[120px] max-w-[155px] text-center pointer-events-auto z-10",
                  printMode
                    ? "bg-zinc-950 border-zinc-800 shadow-none"
                    : "bg-zinc-950/95 backdrop-blur-md border-zinc-800 shadow-2xl"
                )}>
                  {sorted.slice(0, 4).map((p) => {
                    const activeStartYear = p.seasonStartYear ? Number(p.seasonStartYear) : new Date().getFullYear();
                    const sub23Limit = activeStartYear - 22;
                    const isSub23 = p.birthYear && Number(p.birthYear) >= sub23Limit;
                    const displayName = p.sportingName || p.lastName.split(" ").pop();

                    // Text color mapping based on signing/active status or membership type
                    let nameColorClass = "text-white";
                    if (p.status === "yellow" || p.status === "red") {
                      nameColorClass = "text-purple-400 font-extrabold";
                    } else if (p.signingStatus === "close") {
                      nameColorClass = "text-amber-500 font-extrabold";
                    } else if (p.signingStatus === "difficult") {
                      nameColorClass = "text-red-500 font-extrabold";
                    } else if (!p.isPrimary) {
                      nameColorClass = "text-slate-400 font-medium";
                    }

                    return (
                      <div
                        key={p.playerId}
                        className={cn(
                          "flex items-center justify-between border rounded-lg p-1 w-full group/item",
                          printMode
                            ? "bg-zinc-900 border-zinc-800 shadow-none"
                            : "bg-zinc-900/60 border-zinc-800/80 shadow-sm"
                        )}
                      >
                        {/* Player Details */}
                        <div className="flex flex-col items-center flex-1 min-w-0 pr-1">
                          {/* Name (bold, larger by 10%) */}
                          <span
                            className={cn("text-[13px] font-extrabold leading-tight truncate w-full block text-center", nameColorClass)}
                            title={p.name}
                          >
                            {displayName}
                          </span>
                          {/* Details */}
                          <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[9.5px] font-medium leading-none flex-wrap w-full">
                            {p.birthYear && (
                              <span className={cn(isSub23 ? "text-blue-400 font-bold" : "text-slate-400")}>
                                {p.birthYear}
                              </span>
                            )}
                            {p.birthYear && p.adjective && <span className="text-slate-500">•</span>}
                            {p.adjective && (
                              <span className="text-slate-400" title={p.adjective}>
                                {p.adjective}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Order Controls (Side-by-Side to prevent row stretching) */}
                        {interactive && (
                          <div className="flex flex-row items-center gap-0.5 shrink-0 opacity-20 hover:opacity-100 group-hover/item:opacity-85 transition-opacity pointer-events-auto pl-1 border-l border-white/5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePlayer(key, p.playerId, "up");
                              }}
                              className="p-0 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer rounded"
                              title="Subir"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePlayer(key, p.playerId, "down");
                              }}
                              className="p-0 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer rounded"
                              title="Bajar"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {sorted.length > 4 && (
                    <span className="text-[7.5px] text-slate-500 font-extrabold leading-none pt-0.5">
                      +{sorted.length - 4} más
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
  selected: string[];
  onChange: (positions: string[]) => void;
}

export function PositionSelector({ selected, onChange }: PositionSelectorProps) {
  // Load custom positions from window if configured, else default keys
  const keys: string[] = typeof window !== "undefined" && (window as any).cl_custom_positions
    ? (window as any).cl_custom_positions.map((p: any) => p.key)
    : (Object.keys(POSITION_ROLES_SHORT) as string[]);

  const toggle = (pos: string) => {
    if (selected.includes(pos)) {
      onChange(selected.filter((p) => p !== pos));
    } else {
      onChange([...selected, pos]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pt-1.5">
      {keys.map((key) => {
        const isSelected = selected.includes(key);
        const isPrimary = selected[0] === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs transition-all cursor-pointer border flex items-center gap-1",
              isPrimary
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] font-bold shadow-lg shadow-black/30 scale-105"
                : isSelected
                ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-slate-200 font-semibold"
                : "border-white/10 bg-white/3 text-slate-500 hover:border-white/20 hover:text-white font-medium"
            )}
          >
            {isPrimary && <span className="text-[10px] opacity-90">★</span>}
            <span>{getPositionLabel(key)}</span>
          </button>
        );
      })}
    </div>
  );
}
