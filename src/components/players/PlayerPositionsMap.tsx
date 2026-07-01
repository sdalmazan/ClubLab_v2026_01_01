"use client";

import { useState } from "react";
import { Target, Map } from "lucide-react";
import { FieldMap } from "./FieldMap";
import type { PositionKey } from "@/types";
import { POSITION_LABELS } from "@/types";

interface PlayerPositionsMapProps {
  playerId: string;
  playerName: string;
  jerseyNumber?: number | null;
  positions: PositionKey[];
}

export function PlayerPositionsMap({
  playerId,
  playerName,
  jerseyNumber,
  positions,
}: PlayerPositionsMapProps) {
  const [showMap, setShowMap] = useState(false);

  // Group positions into assignments for the FieldMap component
  const playerAssignments: Partial<Record<PositionKey, { playerId: string; name: string; lastName: string; isPrimary: boolean; status: "green" | "yellow" }[]>> = {};
  positions.forEach((pos, idx) => {
    playerAssignments[pos] = [
      {
        playerId,
        name: playerName,
        lastName: playerName.split(" ").pop() || "",
        isPrimary: idx === 0,
        status: idx === 0 ? "green" : "yellow", // Primary green, secondary yellow
      },
    ];
  });

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-500" />
          Posiciones
        </h2>
        {positions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-350 transition-colors cursor-pointer"
          >
            <Map className="h-3.5 w-3.5" />
            {showMap ? "Ocultar Campograma" : "Ver Campograma"}
          </button>
        )}
      </div>

      {positions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {positions.map((pos, i) => (
              <span
                key={pos}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  i === 0
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 text-slate-400 bg-white/2"
                }`}
              >
                {i === 0 && <span className="mr-1.5 text-emerald-500">★</span>}
                {POSITION_LABELS[pos]}
              </span>
            ))}
          </div>

          {showMap && (
            <div className="max-w-[220px] mx-auto w-full border border-white/5 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/60 p-2 animate-fade-in">
              <FieldMap assignments={playerAssignments} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-500 text-sm italic">Sin posición asignada</p>
      )}
    </div>
  );
}
