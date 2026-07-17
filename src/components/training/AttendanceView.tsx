"use client";

import React, { useState } from "react";
import { Users, LayoutGrid, Calendar } from "lucide-react";
import { PitchAvailability } from "./PitchAvailability";

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
  notes?: string | null;
  player?: PlayerObj | null;
}

interface AttendanceViewProps {
  present: AttendanceEntry[];
  absent: AttendanceEntry[];
  injured: AttendanceEntry[];
  attendance: AttendanceEntry[];
}

export function AttendanceView({ present, absent, injured, attendance }: AttendanceViewProps) {
  const [viewMode, setViewMode] = useState<"list" | "pitch">("list");

  return (
    <div className="glass rounded-2xl p-6 space-y-4 print:border-b print:pb-6 print:rounded-none print-break-avoid">
      <div className="flex items-center justify-between border-b border-white/5 pb-3.5 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 print:text-slate-800">
          <Users className="h-4 w-4 corp-icon" />
          Convocatoria y Asistencia ({present.length} de {attendance.length} presentes)
        </h2>

        {/* Toggle Mode Switcher (Hidden in print) */}
        <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-white/5 no-print">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-white/5 border border-white/10 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-350"
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pitch")}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "pitch"
                ? "bg-white/5 border border-white/10 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-350"
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>Campo</span>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
          {/* Presentes */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              Presentes ({present.length})
            </span>
            {present.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-slate-300 space-y-1 print:text-slate-700">
                {present.map((a) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{a.player?.first_name} {a.player?.last_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ausentes */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Ausentes ({absent.length})
            </span>
            {absent.length === 0 ? (
              <p className="text-xs text-slate-500/50 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-slate-400 space-y-1 print:text-slate-600">
                {absent.map((a) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    <span>
                      {a.player?.first_name} {a.player?.last_name}
                      {a.notes && <span className="text-[10px] text-slate-500 ml-1">({a.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lesionados / Bajas */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-2">
              Lesionados / Bajas ({injured.length})
            </span>
            {injured.length === 0 ? (
              <p className="text-xs text-slate-500/50 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-rose-300 space-y-1 print:text-rose-700">
                {injured.map((a) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    <span>
                      {a.player?.first_name} {a.player?.last_name}
                      {a.notes && <span className="text-[10px] text-rose-400/60 print:text-rose-700/60 ml-1">({a.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <PitchAvailability attendance={attendance} />
        </div>
      )}
    </div>
  );
}
