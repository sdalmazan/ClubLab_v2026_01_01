"use client";

import React from "react";
import { TacticalSvgRenderer, hasWhiteboardData } from "./TacticalSvgRenderer";
import { cn } from "@/lib/utils";

/**
 * Strip basic markdown syntax from text to produce clean plain text
 * suitable for printing. Handles: headings, bold, italic, bullets,
 * horizontal rules, and extra blank lines.
 */
function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    // Remove ATX headings (#, ##, ###, ...)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic: **text**, __text__, *text*, _text_
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove horizontal rules (--- or ***)
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Normalise bullet points (keep the text, clean the marker)
    .replace(/^\s*[-*+]\s+/gm, "• ")
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

  const rules = stripMarkdown(gs.rules || ex.rules || ex.consignas || "");
  const notesRaw = gs.objective_notes || ex.objective_notes || ex.notes || ex.objective || ex.details || "";
  const notes = stripMarkdown(notesRaw);
  const organization = stripMarkdown(gs.organization || ex.organization || "");

  // Library/exercise description fallback
  const exerciseDescription = stripMarkdown(
    ex.exercise?.description || ex.description || ex.exercise_description || ""
  );
  const showDesc = exerciseDescription && exerciseDescription !== notes;

  const wbData = ex.whiteboard_data ?? (ex.whiteboard_data === undefined ? ex.exercise?.whiteboard_data : null);
  const hasWhiteboard = hasWhiteboardData(wbData);

  return (
    <div className="bg-white print-break-avoid text-[8pt] leading-tight w-full border-b border-slate-300 pb-2 mb-1.5 last:border-b-0 last:pb-0 last:mb-0">
      {/* ── CARD TOP HEADER BAR (Ink-saving outline badge) ── */}
      <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex h-4 w-5 rounded-sm border border-slate-900 bg-white text-slate-900 font-black text-[7.5pt] items-center justify-center shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex items-center gap-2">
            <h4 className="font-black text-slate-900 text-[9.5pt] leading-none truncate uppercase tracking-wide">
              {ex.title || ex.exercise?.title || `Ejercicio ${index + 1}`}
            </h4>
            <span className="inline-block rounded px-1 py-0.2 text-[6.5pt] font-bold border uppercase tracking-wider bg-slate-50 text-slate-800 border-slate-300 shrink-0">
              {ex.category || ex.exercise?.category || "General"}
            </span>
          </div>
        </div>

        <div className="text-right text-[8.5pt] font-bold text-slate-900 shrink-0 flex items-center gap-2">
          {nSeries > 1 && (
            <span className="text-[7.5pt] text-slate-700 font-semibold border-r border-slate-300 pr-2">
              {nSeries}x{sDuration}m · Rec {sRecovery}m
            </span>
          )}
          <span className="font-black text-slate-900">{totalExDuration} min</span>
        </div>
      </div>

      {/* ── MAIN CONTENT GRID LAYOUT ── */}
      <div className="grid grid-cols-12 gap-2.5 items-stretch">
        {/* Left Column: Text Information (Objetivo, Reglas, Organización, Equipos) */}
        <div className={cn(hasWhiteboard ? "col-span-7 space-y-1.5 flex flex-col justify-between" : "col-span-12 space-y-1.5")}>
          <div className="space-y-1.5">
            {/* DESCRIPCIÓN DEL EJERCICIO */}
            {showDesc && (
              <p className="text-slate-700 italic text-[7.5pt] leading-snug border-b border-slate-200 pb-1">
                {exerciseDescription}
              </p>
            )}

            {/* OBJETIVO / NOTAS */}
            {notes && (
              <div>
                <span className="block font-black text-slate-900 uppercase tracking-wider text-[7.5pt]">
                  OBJETIVO
                </span>
                <p className="text-slate-800 whitespace-pre-wrap font-medium text-[8pt] leading-snug">{notes}</p>
              </div>
            )}

            {/* REGLAS / PAUTAS */}
            {rules && (
              <div>
                <span className="block font-black text-slate-900 uppercase tracking-wider text-[7.5pt]">
                  REGLAS / PAUTAS
                </span>
                <p className="text-slate-800 whitespace-pre-wrap font-medium text-[8pt] leading-snug">{rules}</p>
              </div>
            )}

            {/* ORGANIZACIÓN */}
            {organization && (
              <div>
                <span className="block font-black text-slate-900 uppercase tracking-wider text-[7.5pt]">
                  ORGANIZACIÓN
                </span>
                <p className="text-slate-800 whitespace-pre-wrap font-medium text-[8pt] leading-snug">{organization}</p>
              </div>
            )}
          </div>

          {/* EQUIPOS / DISTRIBUCIÓN */}
          {assignedGroups.length > 0 && (
            <div className="space-y-0.5 border-t border-slate-200 pt-1">
              <span className="block font-black text-slate-900 uppercase tracking-wider text-[7pt]">
                EQUIPOS / DISTRIBUCIÓN
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
                    <div key={gIdx} className="bg-slate-50 border border-slate-300 px-1 py-0.5 rounded">
                      <span className="block font-bold text-slate-900 text-[7.5pt]">{g.name}</span>
                      <p className="text-slate-700 leading-tight truncate text-[7pt]">{names}</p>
                    </div>
                  );
                })}
              </div>
              {gs.series_rotations && (
                <div className="mt-1 p-1 rounded bg-amber-50 border border-amber-200 text-[7pt] text-amber-900 font-medium">
                  🔄 <strong>Cambios entre Series:</strong> {gs.series_rotations}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Tactical SVG Diagram */}
        {hasWhiteboard && (
          <div className="col-span-5 flex items-stretch h-full min-h-[140px]">
            <TacticalSvgRenderer
              value={wbData}
              width={400}
              height={300}
              className="w-full h-full rounded overflow-hidden border border-slate-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}
