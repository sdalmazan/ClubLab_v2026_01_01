"use client";

import React, { useMemo } from "react";
import { TrainingPrintHeader } from "./TrainingPrintHeader";
import { TrainingPrintSquad } from "./TrainingPrintSquad";
import { TrainingPrintExerciseCard } from "./TrainingPrintExerciseCard";

interface TrainingSessionPrintDocumentProps {
  session: any;
  organizationSettings?: any;
  teamName?: string;
  activeSquadPlayers?: any[];
}

export function TrainingSessionPrintDocument({
  session,
  organizationSettings = {},
  teamName,
  activeSquadPlayers = [],
}: TrainingSessionPrintDocumentProps) {
  if (!session) return null;

  const exercises: any[] = session.exercises || [];

  // Group exercises into training blocks
  const blocks = [
    { key: "block_0", title: "PREVIO AL ENTRENAMIENTO" },
    { key: "warmup", title: "CALENTAMIENTO" },
    { key: "main", title: "PARTE PRINCIPAL" },
    { key: "cooldown", title: "VUELTA A LA CALMA" },
  ] as const;

  // Build squad list for assigned exercise groups lookup
  const attendanceList: any[] = session.attendance || [];
  const squadList = useMemo(() => {
    if (activeSquadPlayers.length > 0) {
      return activeSquadPlayers.map((p) => {
        const isGK = Boolean(
          p.membership?.positions?.some(
            (pos: string) => String(pos).toLowerCase().includes("por") || String(pos).toLowerCase().includes("gk")
          ) || p.primary_position?.toLowerCase().includes("por")
        );
        const displayName = `${p.first_name || ""} ${p.last_name ? p.last_name.charAt(0) + "." : ""}`.trim() + (isGK ? " (P)" : "");
        return { id: p.id, displayName, isGK };
      });
    }

    return attendanceList.map((at) => {
      const pl = at.player || {};
      const isGK = Boolean(
        pl.membership?.positions?.some(
          (pos: string) => String(pos).toLowerCase().includes("por") || String(pos).toLowerCase().includes("gk")
        ) || pl.primary_position?.toLowerCase().includes("por")
      );
      const name = pl.sporting_name || `${pl.first_name || ""} ${pl.last_name ? pl.last_name.charAt(0) + "." : ""}`.trim() || "Jugador";
      const displayName = name + (isGK ? " (P)" : "");
      return { id: pl.id || at.player_id, displayName, isGK };
    });
  }, [activeSquadPlayers, attendanceList]);

  // Determine if total exercises count is small (<= 4) to apply 2-column compact grid layout
  const isCompactSession = exercises.length <= 4;

  return (
    <div
      id="clublab-print-document"
      className="bg-white text-slate-900 font-sans mx-auto text-[8pt] w-full max-w-[194mm] print:w-[194mm] print:max-w-none print:m-0 print:p-0 select-text"
    >
      {/* Page 1 Header */}
      <TrainingPrintHeader
        session={session}
        organizationSettings={organizationSettings}
        teamName={teamName}
        isFirstPage={true}
        pageIndex={1}
        totalPages={1}
      />

      {/* Roster & Squad Availability Matrix */}
      <TrainingPrintSquad session={session} activeSquadPlayers={activeSquadPlayers} />

      {/* Exercises Section by Block */}
      <div className="space-y-3">
        {blocks.map((block) => {
          const blockExercises = exercises.filter((ex, exIdx) => {
            const bt = String(ex.block_type || ex.group_setup?.block_type || "").toLowerCase();
            if (block.key === "block_0") return bt === "block_0" || bt === "block0";
            if (block.key === "warmup") return bt === "warmup" || bt === "calentamiento" || (bt === "" && exIdx === 0);
            if (block.key === "main") return bt === "main" || bt === "principal" || (bt === "" && exIdx > 0 && exIdx < exercises.length - 1);
            if (block.key === "cooldown") return bt === "cooldown" || bt === "calma" || (bt === "" && exIdx === exercises.length - 1);
            return false;
          });

          if (blockExercises.length === 0) return null;

          return (
            <div key={block.key} className="space-y-1.5 print-break-avoid">
              {/* Block Title Header Bar */}
              <div className="bg-slate-900 text-white px-2 py-1 rounded text-[8.5pt] font-black uppercase tracking-wider flex justify-between items-center">
                <span>{block.title}</span>
                <span className="text-[7.5pt] text-slate-300 font-bold">
                  {blockExercises.length} {blockExercises.length === 1 ? "TAREA" : "TAREAS"}
                </span>
              </div>

              {/* Exercises Container: 2 columns if compact session, or 1 column if complex */}
              <div className={cn(isCompactSession && blockExercises.length >= 2 ? "grid grid-cols-2 gap-2" : "space-y-2")}>
                {blockExercises.map((ex, exIdx) => {
                  const globalIdx = exercises.indexOf(ex);
                  return (
                    <TrainingPrintExerciseCard
                      key={ex.id || globalIdx || exIdx}
                      exercise={ex}
                      index={globalIdx >= 0 ? globalIdx : exIdx}
                      squadList={squadList}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Minimalist Document Footer */}
      <div className="mt-4 border-t border-slate-300 pt-1 flex justify-between items-center text-[7pt] text-slate-600 uppercase tracking-widest font-bold">
        <span>ClubLab Official Staff Report</span>
        <span>SD Almazán • Informe de Entrenamiento</span>
      </div>
    </div>
  );
}
