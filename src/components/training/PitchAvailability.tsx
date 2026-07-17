"use client";

import React from "react";
import { FieldMap } from "@/components/players/FieldMap";
import { resolveCampogramaSlot, type PositionKey } from "@/types";

interface PlayerObj {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  membership?: {
    jersey_number?: number | null;
    positions?: string[] | null;
  } | null;
}

interface AttendanceEntry {
  id: string;
  player_id: string;
  status: "present" | "absent" | "injured" | "rest" | "other";
  player?: PlayerObj | null;
}

interface PitchAvailabilityProps {
  attendance: AttendanceEntry[];
}

export function PitchAvailability({ attendance }: PitchAvailabilityProps) {
  // Extract present players
  const presentPlayers = attendance
    .filter((a) => a.status === "present" && a.player)
    .map((a) => a.player as PlayerObj);

  // Map present players to their campograma slots
  const playerAssignments: Partial<Record<PositionKey, any[]>> = {};
  
  presentPlayers.forEach((p) => {
    const positions = p.membership?.positions || [];
    positions.forEach((pos, idx) => {
      const slot = resolveCampogramaSlot(pos);
      if (!playerAssignments[slot]) {
        playerAssignments[slot] = [];
      }
      playerAssignments[slot]!.push({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        lastName: p.last_name,
        sportingName: `${p.first_name} ${p.last_name.slice(0, 1)}.`,
        isPrimary: idx === 0,
        status: "green"
      });
    });
  });

  return (
    <div className="glass rounded-2xl border border-white/10 p-5 flex flex-col gap-4 shadow-xl print:border-slate-350 print:rounded-none">
      <div>
        <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider print:text-slate-800">
          Disponibilidad Táctica en Campo (Campograma)
        </h3>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5 print:text-slate-600">
          Ubicación de los convocados presentes ({presentPlayers.length}) en sus posiciones habituales.
        </p>
      </div>

      {/* Styled campograma field */}
      <div className="max-w-[280px] mx-auto w-full border border-white/5 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/60 p-2 print:border-slate-400">
        <FieldMap assignments={playerAssignments} hideMetadata={true} interactive={false} />
      </div>
    </div>
  );
}
