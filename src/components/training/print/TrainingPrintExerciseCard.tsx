"use client";

import React from "react";
import { TacticalSvgRenderer } from "./TacticalSvgRenderer";
import { cn } from "@/lib/utils";

interface TrainingPrintExerciseCardProps {
  exercise: any;
  index: number;
  squadList?: any[];
}

export function getExerciseTotalDuration(ex: any): number {
  if (!ex) return 0;
  const gs = ex.group_setup || {};
  if (gs.use_variable_series && Array.isArray(gs.series) && gs.series.length > 0) {
    return gs.series.reduce((sum: number, s: any) => sum + Number(s.duration_min || 0), 0);
  }
  if (ex.use_variable_series && Array.isArray(ex.series) && ex.series.length > 0) {
    return ex.series.reduce((sum: number, s: any) => sum + Number(s.duration_min || 0), 0);
  }
  const nSeries = Number(gs.num_series || ex.num_series || 1);
  const sDuration = Number(gs.series_duration_min || ex.series_duration_min || ex.duration_min || 15);
  return nSeries * sDuration;
}

export function TrainingPrintExerciseCard({
  exercise: ex,
  index,
  squadList = [],
}: TrainingPrintExerciseCardProps) {
  if (!ex) return null;

  const gs = ex.group_setup || {};
  const totalExDuration = getExerciseTotalDuration(ex);

  const nSeries = Number(gs.num_series || ex.num_series || 1);
  const sDuration = Number(gs.series_duration_min || ex.series_duration_min || ex.duration_min || 15);
  const sRecovery = Number(gs.recovery_duration_min || ex.recovery_duration_min || 1);

  const rawGroups = gs.groups || ex.groups || [];
  const assignedGroups = rawGroups.filter((g: any) => {
    const playerIds = g.players ?? [];
    return Array.isArray(playerIds) && playerIds.length > 0;
  });

  const rules = gs.rules || ex.rules || "";
  const notes = gs.objective_notes || ex.objective_notes || "";
  const hasWhiteboard = Boolean(ex.whiteboard_data);

  return (
    <div className="border border-slate-400 rounded-lg p-2 bg-white shadow-none print-break-avoid flex flex-col justify-between space-y-1.5 text-[8pt] leading-tight">
      <div className="space-y-1.5">
        {/* Header Bar */}
        <div className="flex justify-between items-start border-b border-slate-300 pb-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-4.5 w-4.5 rounded bg-slate-900 text-white font-black text-[8pt] flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h4 className="font-extrabold text-slate-900 text-[9.5pt] leading-tight truncate">
                {ex.title || ex.exercise?.title || `Ejercicio ${index + 1}`}
              </h4>
              <span className="inline-block rounded px-1 py-0.2 text-[7pt] font-bold border mt-0.5 uppercase tracking-wide bg-slate-100 text-slate-800 border-slate-300">
                {ex.category || ex.exercise?.category || "General"}
              </span>
            </div>
          </div>

          <div className="text-right text-[8.5pt] font-bold text-slate-900 shrink-0">
            <span>{totalExDuration} min</span>
            {nSeries > 1 && (
              <p className="text-[7pt] text-slate-600 font-medium leading-none mt-0.5">
                {nSeries}x{sDuration}m | Rec: {sRecovery}m
              </p>
            )}
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-12 gap-2">
          {/* Details Column */}
          <div className={cn(hasWhiteboard ? "col-span-7 space-y-1" : "col-span-12 space-y-1")}>
            {notes && (
              <div>
                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7pt]">
                  Objetivos / Pautas:
                </span>
                <p className="text-slate-800 whitespace-pre-wrap font-medium text-[8pt]">{notes}</p>
              </div>
            )}
            {rules && (
              <div>
                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7pt]">
                  Normas / Consignas:
                </span>
                <p className="text-slate-800 whitespace-pre-wrap font-medium text-[8pt]">{rules}</p>
              </div>
            )}

            {/* Assigned Groups */}
            {assignedGroups.length > 0 && (
              <div className="space-y-0.5 border-t border-slate-200 pt-1">
                <span className="block font-bold text-slate-900 uppercase tracking-wider text-[7pt]">
                  Equipos / Distribución
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {assignedGroups.map((g: any, gIdx: number) => {
                    const names = (g.players ?? [])
                      .map((pId: string) => {
                        const found = squadList.find((pl) => pl.id === pId);
                        return found?.displayName || "";
                      })
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div key={gIdx} className="bg-slate-50 border border-slate-300 p-0.5 rounded">
                        <span className="block font-bold text-slate-900 text-[7.5pt]">{g.name}</span>
                        <p className="text-slate-700 leading-tight truncate text-[7pt]">{names}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Whiteboard Vector SVG Column */}
          {hasWhiteboard && (
            <div className="col-span-5 flex items-center justify-center">
              <TacticalSvgRenderer value={ex.whiteboard_data} width={300} height={225} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
