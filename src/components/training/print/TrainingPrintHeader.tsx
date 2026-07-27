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
  const clubName = organizationSettings?.club_name || teamName || "SD ALMAZÁN";
  const logoUrl = organizationSettings?.club_logo_url;

  const dateObj = session.date ? new Date(session.date) : new Date();
  const dateStr = session.date ? dateObj.toLocaleDateString("es-ES") : "—";
  const startTime = session.start_time ? session.start_time.slice(0, 5) : "19:30";
  const durationMin = session.duration_min || 90;

  // Day of week in Spanish
  const daysOfWeek = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const dayOfWeek = daysOfWeek[dateObj.getDay()];

  const sessionMuscleGroups: string[] = session.muscle_groups || [];
  const sessionTacticalConcepts: string[] = session.tactical_concepts || [];

  const muscleLabels = sessionMuscleGroups.length
    ? sessionMuscleGroups.map(key => MUSCLE_GROUPS.find(m => m.key === key)?.label || key).join(" · ")
    : "—";

  const tacticalLabels = sessionTacticalConcepts.length
    ? sessionTacticalConcepts.map(key => TACTICAL_CONCEPTS.find(c => c.key === key)?.label || key).join(" · ")
    : "—";

  // Compact Header for Page 2+
  if (!isFirstPage) {
    return (
      <div className="w-full border-b border-slate-400 pb-1 mb-2 flex items-center justify-between text-[8.5pt] font-sans text-slate-900">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
          <span>{clubName}</span>
          <span>·</span>
          <span>{title}</span>
          <span>·</span>
          <span>{dateStr}</span>
        </div>
        <div className="font-extrabold text-slate-800">
          Página {pageIndex} de {totalPages}
        </div>
      </div>
    );
  }

  // Page 1 Header (Clean, Functional, No "SENIOR A")
  return (
    <div className="w-full mb-2.5 text-slate-900 font-sans border-b border-slate-400 pb-1.5 bg-white">
      {/* Top Club & Session Header */}
      <div className="flex items-center gap-3 mb-1.5">
        {/* Escudo Box */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Escudo Club"
            className="h-12 w-12 object-contain shrink-0"
          />
        ) : (
          <div className="h-11 w-11 border border-slate-400 rounded flex items-center justify-center text-[7pt] font-black text-center uppercase shrink-0">
            {clubName.slice(0, 4)}
          </div>
        )}

        {/* Club & Session Identity */}
        <div className="flex-1 min-w-0">
          <h2 className="text-[9.5pt] font-black uppercase tracking-widest text-slate-700 leading-tight">
            {clubName}
          </h2>
          <h1 className="text-[13pt] font-black uppercase tracking-wide text-slate-900 leading-none mt-0.5">
            {title}
          </h1>
          <div className="text-[8.5pt] font-bold text-slate-700 mt-1 uppercase tracking-wide">
            <span>{dateStr}</span>
            <span className="mx-1.5">·</span>
            <span>{startTime} h</span>
            <span className="mx-1.5">·</span>
            <span>{dayOfWeek}</span>
            <span className="mx-1.5">·</span>
            <span>{durationMin} MIN</span>
          </div>
        </div>
      </div>

      {/* Objectives Box */}
      <div className="border-t border-slate-300 pt-1 space-y-0.5 text-[8pt]">
        <div className="font-black text-slate-900 uppercase tracking-wider text-[7.5pt]">
          OBJETIVOS DE LA SESIÓN
        </div>
        <div className="flex gap-2 leading-tight">
          <span className="font-extrabold text-slate-900 shrink-0 uppercase text-[7.5pt]">FÍSICOS:</span>
          <span className="font-medium text-slate-800 truncate">{muscleLabels}</span>
        </div>
        <div className="flex gap-2 leading-tight">
          <span className="font-extrabold text-slate-900 shrink-0 uppercase text-[7.5pt]">TÁCTICOS:</span>
          <span className="font-medium text-slate-800 truncate">{tacticalLabels}</span>
        </div>
      </div>
    </div>
  );
}
