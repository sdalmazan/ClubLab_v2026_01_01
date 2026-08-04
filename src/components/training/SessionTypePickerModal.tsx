"use client";

import React from "react";
import { Users, User, Trophy, Activity, Moon, X, ChevronRight } from "lucide-react";
import type { SessionType } from "@/types";

interface SessionTypeOption {
  type: SessionType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badge: string;
}

const SESSION_TYPE_OPTIONS: SessionTypeOption[] = [
  {
    type: "training",
    title: "Entrenamiento Grupal",
    description: "Diseña tareas de calentamiento, bloque principal, situaciones tácticas y volumen de trabajo.",
    icon: Users,
    color: "from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/30",
    badge: "⚽ Grupal",
  },
  {
    type: "test",
    title: "Sesión de Test & Valoración Física",
    description: "Toma de medidas y marcas (CMJ, Sprint 20m, % Grasa, 1RM) en tabla masiva por jugador.",
    icon: Activity,
    color: "from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30",
    badge: "🧪 Test Físico",
  },
  {
    type: "match",
    title: "Partido Oficial / Amistoso",
    description: "Configura alineación, formación táctica, campograma, convocados y estrategia ABP.",
    icon: Trophy,
    color: "from-rose-500/20 to-rose-600/10 text-rose-400 border-rose-500/30",
    badge: "🏆 Partido",
  },
  {
    type: "individual",
    title: "Entrenamiento Individual / Readaptación",
    description: "Planifica trabajo específico fuera del grupo para futbolistas en proceso de recuperación.",
    icon: User,
    color: "from-sky-500/20 to-sky-600/10 text-sky-400 border-sky-500/30",
    badge: "👤 Individual",
  },
  {
    type: "rest",
    title: "Jornada de Descanso",
    description: "Marca el día como libre o de reposo para la plantilla sin tareas programadas.",
    icon: Moon,
    color: "from-slate-500/20 to-slate-600/10 text-slate-400 border-slate-500/30",
    badge: "💤 Descanso",
  },
];

interface SessionTypePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: SessionType) => void;
  selectedDate?: string;
}

export function SessionTypePickerModal({
  isOpen,
  onClose,
  onSelectType,
  selectedDate,
}: SessionTypePickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-white/15 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
              Planificación de Sesión {selectedDate ? `• ${selectedDate}` : ""}
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">¿Qué tipo de sesión deseas crear?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-6 space-y-3 overflow-y-auto max-h-[70vh]">
          {SESSION_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  onSelectType(option.type);
                  onClose();
                }}
                className={`w-full p-4 rounded-2xl border bg-gradient-to-r ${option.color} hover:scale-[1.01] active:scale-[0.99] transition-all text-left flex items-center justify-between gap-4 cursor-pointer group shadow-md`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {option.title}
                      </h3>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/10 text-white shrink-0">
                        {option.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="size-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
