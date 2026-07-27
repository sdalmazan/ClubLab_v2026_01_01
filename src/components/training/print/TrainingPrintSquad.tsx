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

  if (squadList.length === 0) return null;

  const presentPlayers = squadList.filter((p) => p.status === "present");
  const presentGKCount = presentPlayers.filter((p) => p.isGK).length;
  const presentFieldCount = presentPlayers.length - presentGKCount;

  // Grid distribution for attendance matrix
  const ROWS_COUNT = 4;
  const colsCount = Math.max(1, Math.ceil(squadList.length / ROWS_COUNT));
  const gridRows = Array.from({ length: ROWS_COUNT }, (_, rowIndex) => {
    return Array.from({ length: colsCount }, (_, colIndex) => {
      const playerIndex = colIndex * ROWS_COUNT + rowIndex;
      return squadList[playerIndex] || null;
    });
  });

  return (
    <div className="w-full border-b border-slate-400 pb-2 mb-3 text-slate-900 font-sans text-[8pt] print-break-avoid bg-white">
      {/* Title & Squad Counts Bar */}
      <div className="flex justify-between items-center mb-1 pb-0.5 border-b border-slate-300">
        <span className="font-black text-slate-900 uppercase tracking-wider text-[8pt]">
          CONVOCATORIA DE PLANTILLA
        </span>
        <div className="font-bold text-slate-700 text-[7.5pt] uppercase tracking-wide space-x-2">
          <span>JUG: <strong>{presentFieldCount}</strong></span>
          <span>·</span>
          <span>PORT: <strong>{presentGKCount}</strong></span>
          <span>·</span>
          <span>TOTAL DISPO: <strong>{presentPlayers.length} / {squadList.length}</strong></span>
        </div>
      </div>

      {/* Symbol Legend Bar */}
      <div className="flex items-center justify-start gap-3 text-[7pt] font-bold uppercase tracking-wider text-slate-700 mb-1">
        <span><strong className="text-slate-900 font-black">✓</strong> Convocado</span>
        <span><strong className="text-slate-900 font-black">⚕</strong> Lesión</span>
        <span><strong className="text-slate-900 font-black">×</strong> Ausente</span>
        <span><strong className="text-slate-900 font-black">—</strong> Readaptación</span>
        <span><strong className="text-slate-900 font-black">○</strong> Parcial</span>
      </div>

      {/* Squad Matrix */}
      <div className="space-y-0.5">
        {gridRows.map((row, rIdx) => (
          <div key={rIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(75px, 1fr))` }}>
            {row.map((p, cIdx) => {
              if (!p) return <div key={cIdx} className="h-3.5" />;

              let symbol = "✓";
              let badgeStyle = "font-black text-slate-900";

              if (p.status === "injured") {
                symbol = "⚕";
              } else if (p.status === "absent") {
                symbol = "×";
              } else if (p.status === "readaptation") {
                symbol = "—";
              } else if (p.status === "partial") {
                symbol = "○";
              }

              return (
                <div
                  key={p.id || cIdx}
                  className="flex justify-between items-center px-1 border border-slate-300 rounded text-[7.5pt] h-3.5 bg-slate-50/50"
                  title={p.notes ? `${p.displayName}: ${p.notes}` : p.displayName}
                >
                  <span className="truncate text-slate-900 font-medium">{p.displayName}</span>
                  <span className={cn("text-[7pt] ml-1 shrink-0", badgeStyle)}>
                    {symbol}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
