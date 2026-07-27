"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TrainingPrintSquadProps {
  session: any;
  activeSquadPlayers?: any[];
}

export function TrainingPrintSquad({
  session,
  activeSquadPlayers = [],
}: TrainingPrintSquadProps) {
  if (!session) return null;

  const attendanceList: any[] = session.attendance || [];

  const squadList = useMemo(() => {
    if (activeSquadPlayers.length > 0) {
      return activeSquadPlayers.map((p) => {
        const atRecord = attendanceList.find((a) => (a.player_id || a.player?.id) === p.id);
        const status = atRecord?.status ?? "present";
        const notes = atRecord?.notes || "";
        const isGK = Boolean(
          p.membership?.positions?.some(
            (pos: string) => String(pos).toLowerCase().includes("por") || String(pos).toLowerCase().includes("gk")
          ) || p.primary_position?.toLowerCase().includes("por")
        );
        const displayName = `${p.first_name || ""} ${p.last_name ? p.last_name.charAt(0) + "." : ""}`.trim() + (isGK ? " (P)" : "");
        return { id: p.id, displayName, status, notes, isGK };
      });
    }

    return attendanceList.map((at) => {
      const pl = at.player || {};
      const isGK = Boolean(
        pl.membership?.positions?.some(
          (pos: string) => String(pos).toLowerCase().includes("por") || String(pos).toLowerCase().includes("gk")
        ) ||
        pl.primary_position?.toLowerCase().includes("por") ||
        pl.positions?.some((pos: string) => String(pos).toLowerCase().includes("por"))
      );
      const name = pl.sporting_name || `${pl.first_name || ""} ${pl.last_name ? pl.last_name.charAt(0) + "." : ""}`.trim() || "Jugador";
      const displayName = name + (isGK ? " (P)" : "");
      return { id: pl.id || at.player_id, displayName, status: at.status || "present", notes: at.notes || "", isGK };
    });
  }, [activeSquadPlayers, attendanceList]);

  const presentPlayers = squadList.filter((p) => p.status === "present");
  const presentGKCount = presentPlayers.filter((p) => p.isGK).length;
  const presentFieldCount = presentPlayers.length - presentGKCount;

  // Grid distribution for attendance (5 rows max, cols scale)
  const ROWS_COUNT = 5;
  const colsCount = Math.max(1, Math.ceil(squadList.length / ROWS_COUNT));
  const gridRows = Array.from({ length: ROWS_COUNT }, (_, rowIndex) => {
    return Array.from({ length: colsCount }, (_, colIndex) => {
      const playerIndex = colIndex * ROWS_COUNT + rowIndex;
      return squadList[playerIndex] || null;
    });
  });

  return (
    <div className="w-full border-2 border-slate-900 mb-3 text-slate-900 font-sans rounded-lg overflow-hidden bg-white text-[8pt] print-break-avoid">
      <div className="flex">
        {/* Left Squad Counts Box */}
        <div className="w-24 border-r-2 border-slate-900 flex flex-col justify-between text-center shrink-0 bg-slate-50">
          <div className="bg-slate-200 border-b border-slate-900 text-slate-900 text-[7pt] font-black py-0.5 uppercase tracking-wider">
            PLANTILLA
          </div>
          <div className="py-0.5 border-b border-slate-300">
            <span className="block text-[6.5pt] font-bold text-slate-600 uppercase leading-none">Jug. Dispo.</span>
            <span className="text-[10pt] font-black text-slate-900">{presentFieldCount}</span>
          </div>
          <div className="py-0.5 border-b border-slate-300">
            <span className="block text-[6.5pt] font-bold text-slate-600 uppercase leading-none">Port. Dispo.</span>
            <span className="text-[10pt] font-black text-slate-900">{presentGKCount}</span>
          </div>
          <div className="py-0.5 bg-slate-200">
            <span className="block text-[6.5pt] font-bold text-slate-900 uppercase leading-none">Total Dispo.</span>
            <span className="text-[11pt] font-black text-slate-900">{presentPlayers.length}</span>
          </div>
        </div>

        {/* Right Convocatoria Matrix */}
        <div className="flex-1 overflow-hidden bg-white">
          {/* Universal Symbol Legend Bar */}
          <div className="bg-slate-100 text-slate-900 px-2 py-0.5 flex items-center justify-around text-[7.5pt] font-extrabold uppercase tracking-wider border-b border-slate-900">
            <span className="flex items-center gap-1">
              <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7pt] font-black">✓</span> ENTRENA
            </span>
            <span className="flex items-center gap-1">
              <span className="border border-slate-900 bg-slate-200 text-slate-900 px-1 rounded text-[7pt] font-black">⚕</span> LESIÓN
            </span>
            <span className="flex items-center gap-1">
              <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7pt] font-black">×</span> AUSENTE
            </span>
            <span className="flex items-center gap-1">
              <span className="border border-slate-900 bg-slate-100 text-slate-900 px-1 rounded text-[7pt] font-black">—</span> REAP/ENF
            </span>
            <span className="flex items-center gap-1">
              <span className="border border-slate-900 bg-white text-slate-900 px-1 rounded text-[7pt] font-black">○</span> PARCIAL
            </span>
          </div>

          {/* 5-Row Squad Matrix */}
          <div className="p-1 space-y-0.5 bg-white">
            {gridRows.map((row, rIdx) => (
              <div key={rIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(80px, 1fr))` }}>
                {row.map((p, cIdx) => {
                  if (!p) return <div key={cIdx} className="h-4" />;

                  let symbol = "✓";
                  let badgeClass = "bg-white text-slate-900 border border-slate-800 font-black";
                  let borderClass = "border-slate-300 bg-white text-slate-900 font-bold";

                  if (p.status === "injured") {
                    symbol = "⚕";
                    badgeClass = "bg-slate-200 text-slate-900 border border-slate-900 font-black";
                    borderClass = "border-slate-400 bg-slate-100 text-slate-900 font-bold";
                  } else if (p.status === "absent") {
                    symbol = "×";
                    badgeClass = "bg-white text-slate-900 border border-slate-800 font-black";
                    borderClass = "border-slate-300 bg-white text-slate-900 font-semibold";
                  } else if (p.status === "readaptation") {
                    symbol = "—";
                    badgeClass = "bg-slate-100 text-slate-900 border border-slate-800 font-black";
                    borderClass = "border-slate-300 bg-slate-50 text-slate-900 font-semibold";
                  } else if (p.status === "partial") {
                    symbol = "○";
                    badgeClass = "bg-white text-slate-900 border border-slate-800 font-black";
                    borderClass = "border-slate-300 bg-white text-slate-900 font-bold";
                  }

                  return (
                    <div
                      key={p.id || cIdx}
                      className={cn("flex justify-between items-center px-1 py-0.2 rounded border text-[8pt] h-4", borderClass)}
                      title={p.notes ? `${p.displayName}: ${p.notes}` : p.displayName}
                    >
                      <span className="truncate">{p.displayName}</span>
                      <span className={cn("text-[7pt] font-extrabold rounded px-0.5 ml-0.5 shrink-0", badgeClass)}>
                        {symbol}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
