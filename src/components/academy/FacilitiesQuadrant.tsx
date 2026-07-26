"use client";

import { useState } from "react";
import {
  Building2,
  Clock,
  AlertTriangle,
  Users,
  CheckCircle2,
  Plus,
  Calendar,
  Sparkles,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PitchScheduleSlot {
  id: string;
  pitchName: string;
  timeSlot: string; // e.g. "16:30 - 18:00"
  teamName: string;
  categoryTag: string; // e.g. "Alevín A", "Juvenil A"
  coachName: string;
  halfPitchOnly: boolean;
}

const INITIAL_SCHEDULES: PitchScheduleSlot[] = [
  {
    id: "s-1",
    pitchName: "Campo Municipal La Arboleda (Césped Natural)",
    timeSlot: "17:30 - 19:15",
    teamName: "S.D. Almazán (Primer Equipo)",
    categoryTag: "Tercera RFEF",
    coachName: "Santiago Dalmazán",
    halfPitchOnly: false,
  },
  {
    id: "s-2",
    pitchName: "Anexo Campo 2 (Césped Artificial)",
    timeSlot: "16:30 - 18:00",
    teamName: "S.D. Almazán Alevín A",
    categoryTag: "Fútbol 7",
    coachName: "David García",
    halfPitchOnly: true,
  },
  {
    id: "s-3",
    pitchName: "Anexo Campo 2 (Césped Artificial)",
    timeSlot: "16:30 - 18:00",
    teamName: "S.D. Almazán Benjamín",
    categoryTag: "Fútbol 7",
    coachName: "Alberto Pérez",
    halfPitchOnly: true,
  },
  {
    id: "s-4",
    pitchName: "Anexo Campo 2 (Césped Artificial)",
    timeSlot: "18:00 - 19:30",
    teamName: "S.D. Almazán Infantil",
    categoryTag: "Fútbol 11",
    coachName: "Carlos Gómez",
    halfPitchOnly: false,
  },
  {
    id: "s-5",
    pitchName: "Anexo Campo 2 (Césped Artificial)",
    timeSlot: "19:30 - 21:00",
    teamName: "S.D. Almazán Juvenil A",
    categoryTag: "Liga Nacional",
    coachName: "Roberto Ruiz",
    halfPitchOnly: false,
  }
];

export function FacilitiesQuadrant() {
  const [schedules, setSchedules] = useState<PitchScheduleSlot[]>(INITIAL_SCHEDULES);
  const [selectedDay, setSelectedDay] = useState<string>("Martes");

  return (
    <div className="space-y-6 text-white animate-fade-in">
      {/* ── DAY SELECTOR BAR ── */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-white/10 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border",
                selectedDay === day
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
              )}
            >
              {day}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" />
          Instalaciones de La Arboleda
        </span>
      </div>

      {/* ── PITCH OCCUPATION GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PITCH 1: LA ARBOLEDA NATURAL */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <div>
                <h3 className="text-sm font-extrabold text-white">Campo 1: La Arboleda (Césped Natural)</h3>
                <span className="text-[10px] text-slate-400">Terreno principal de juego de competición</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Campo Completo
            </span>
          </div>

          <div className="space-y-3">
            {schedules
              .filter((s) => s.pitchName.includes("La Arboleda"))
              .map((slot) => (
                <div key={slot.id} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" /> {slot.timeSlot}
                    </span>
                    <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase">
                      {slot.categoryTag}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">{slot.teamName}</span>
                    <span className="text-xs text-slate-400">Entrenador: {slot.coachName}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* PITCH 2: ANEXO ARTIFICIAL */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sky-400" />
              <div>
                <h3 className="text-sm font-extrabold text-white">Campo 2: Anexo Césped Artificial</h3>
                <span className="text-[10px] text-slate-400">Terreno de entrenamiento divisible (Medios campos)</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Fútbol 11 / 2xF7
            </span>
          </div>

          <div className="space-y-3">
            {schedules
              .filter((s) => s.pitchName.includes("Anexo"))
              .map((slot) => (
                <div key={slot.id} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <Clock className="size-3.5 text-sky-400" /> {slot.timeSlot}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {slot.halfPitchOnly && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Medio Campo
                        </span>
                      )}
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                        {slot.categoryTag}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">{slot.teamName}</span>
                    <span className="text-xs text-slate-400">Entrenador: {slot.coachName}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
