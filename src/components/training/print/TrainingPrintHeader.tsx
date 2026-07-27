"use client";

import React from "react";
import { TACTICAL_CONCEPTS, MUSCLE_GROUPS } from "@/lib/exercise-taxonomy";

interface TrainingPrintHeaderProps {
  session: any;
  organizationSettings?: any;
  teamName?: string;
  isFirstPage?: boolean;
  pageIndex?: number;
  totalPages?: number;
}

export function TrainingPrintHeader({
  session,
  organizationSettings = {},
  teamName,
  isFirstPage = true,
  pageIndex = 1,
  totalPages = 1,
}: TrainingPrintHeaderProps) {
  if (!session) return null;

  const title = session.title || "Sesión de Entrenamiento";
  const dateStr = session.date ? new Date(session.date).toLocaleDateString("es-ES") : "—";
  const startTime = session.start_time ? session.start_time.slice(0, 5) : "10:00";
  const durationMin = session.duration_min || 90;

  const sessionMuscleGroups: string[] = session.muscle_groups || [];
  const sessionTacticalConcepts: string[] = session.tactical_concepts || [];

  const muscleLabels = sessionMuscleGroups.length
    ? sessionMuscleGroups.map(key => MUSCLE_GROUPS.find(m => m.key === key)?.label || key).join(", ").toUpperCase()
    : "—";

  const tacticalLabels = sessionTacticalConcepts.length
    ? sessionTacticalConcepts.map(key => TACTICAL_CONCEPTS.find(c => c.key === key)?.label || key).join(", ").toUpperCase()
    : "—";

  const meso = session.metrics?.meso || session.mesocycle || "1";
  const micro = session.metrics?.micro || session.microcycle_day || "1";
  const weekSeq = session.week_sequence || session.sessionWeekSeq || "1";
  const totalSeq = session.total_sequence || session.sessionTotalSeq || "1";

  // Compact Header for Page 2+
  if (!isFirstPage) {
    return (
      <div className="w-full border-b-2 border-slate-900 pb-1 mb-3 flex items-center justify-between text-[8.5pt] font-sans text-slate-900">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
          <span>{organizationSettings?.club_name || teamName || "CLUB LAB"}</span>
          <span>•</span>
          <span>{title}</span>
          <span>({dateStr})</span>
        </div>
        <div className="font-extrabold text-slate-800">
          Página {pageIndex} de {totalPages}
        </div>
      </div>
    );
  }

  // Full Page 1 Header
  return (
    <div className="w-full border-2 border-slate-900 mb-3 text-slate-900 font-sans rounded-lg overflow-hidden bg-white text-[8.5pt]">
      {/* Row 1: Logo & Metadata Bar */}
      <div className="flex border-b-2 border-slate-900">
        {/* Escudo Box */}
        <div className="w-24 border-r-2 border-slate-900 p-1 flex flex-col items-center justify-center bg-white shrink-0">
          {organizationSettings?.club_logo_url ? (
            <img
              src={organizationSettings.club_logo_url}
              alt="Escudo"
              className="h-12 w-12 object-contain"
            />
          ) : (
            <span className="text-[8pt] font-black text-center uppercase tracking-tighter text-slate-900 leading-tight">
              {organizationSettings?.club_name || teamName || "CLUB LAB"}
            </span>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="flex-1 grid grid-cols-8 divide-x-2 divide-slate-900 text-center font-bold">
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">TEMPORADA</div>
            <div className="py-1 text-[9.5pt] font-black">2026-2027</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">FECHA</div>
            <div className="py-1 text-[9.5pt] font-black">{dateStr}</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">HORA</div>
            <div className="py-1 text-[9.5pt] font-black">{startTime} h</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">MESO</div>
            <div className="py-1 text-[9.5pt] font-black">{meso}</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">MICRO</div>
            <div className="py-1 text-[9.5pt] font-black">{micro}</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">ORDEN SEM.</div>
            <div className="py-1 text-[9.5pt] font-black">{weekSeq}</div>
          </div>
          <div className="flex flex-col">
            <div className="bg-slate-100 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">SESIÓN</div>
            <div className="py-1 text-[9.5pt] font-black">#{totalSeq}</div>
          </div>
          <div className="flex flex-col bg-slate-50">
            <div className="bg-slate-200 text-slate-900 border-b border-slate-900 text-[7pt] py-0.5 uppercase tracking-wider font-extrabold">DURACIÓN</div>
            <div className="py-1 text-[9.5pt] font-black text-slate-900">{durationMin} min</div>
          </div>
        </div>
      </div>

      {/* Row 2: Title & Objectives Bar */}
      <div className="bg-slate-200 border-b-2 border-slate-900 text-center py-0.5 text-[8.5pt] font-black uppercase tracking-widest text-slate-900">
        OBJETIVOS DE LA SESIÓN: {title}
      </div>

      {/* Row 3: Objetivos Físicos */}
      <div className="flex border-b border-slate-900">
        <div className="w-24 bg-slate-100 text-slate-900 text-[7.5pt] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-900 shrink-0 py-0.5">
          FÍSICOS
        </div>
        <div className="flex-1 px-2.5 py-0.5 text-[8.5pt] font-bold uppercase tracking-wide flex items-center text-slate-900 truncate">
          {muscleLabels}
        </div>
      </div>

      {/* Row 4: Objetivos Tácticos */}
      <div className="flex">
        <div className="w-24 bg-slate-100 text-slate-900 text-[7.5pt] font-extrabold flex items-center justify-center uppercase tracking-wider border-r-2 border-slate-900 shrink-0 py-0.5">
          TÁCTICOS
        </div>
        <div className="flex-1 px-2.5 py-0.5 text-[8.5pt] font-bold uppercase tracking-wide flex items-center text-slate-900 truncate">
          {tacticalLabels}
        </div>
      </div>
    </div>
  );
}
