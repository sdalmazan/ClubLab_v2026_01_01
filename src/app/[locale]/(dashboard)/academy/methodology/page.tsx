"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AcademySubNav } from "@/components/academy/AcademySubNav";
import { BookOpen, Sparkles, CheckCircle2, Shield } from "lucide-react";

const STAGES = [
  {
    stage: "Etapa Iniciación (Benjamín & Alevín — Fútbol 7)",
    focus: "Desarrollo técnico individual, control-pase, juego de posición básico y diversión sin presión competitiva.",
    principles: ["Dominio de balón con ambas piernas", "Espaciamiento ofensivo", "Regla de 3 segundos para recuperar tras pérdida"]
  },
  {
    stage: "Etapa Perfeccionamiento (Infantil & Cadete — Fútbol 11)",
    focus: "Comprensión táctica colectiva, ocupación de espacios, perfiles de recepción y transiciones ataque-defensa.",
    principles: ["Salida de balón desde iniciación corta", "Presión tras pérdida en bloque medio-alto", "Ataque de espacios libres"]
  },
  {
    stage: "Etapa Alto Rendimiento (Juvenil A & Primer Equipo)",
    focus: "Competitividad máxima, preparación táctica según rival, ABP defensiva/ofensiva e intensidad física.",
    principles: ["Bloque defensivo adaptativo", "Transiciones verticales de alta velocidad", "Dominio del juego directo y segunda jugada"]
  }
];

export default function AcademyMethodologyPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      <PageHeader
        title="Biblioteca de Metodología del Club"
        description="Libro de estilo metodológico y principios del juego de la S.D. Almazán por etapas de formación"
      />
      <AcademySubNav />

      <div className="space-y-4">
        {STAGES.map((s, i) => (
          <div key={i} className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-emerald-400" />
              <h3 className="text-sm font-extrabold text-white">{s.stage}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
              {s.focus}
            </p>
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Principios Clave del Juego:</span>
              <div className="flex flex-wrap gap-2">
                {s.principles.map((p, j) => (
                  <span key={j} className="text-xs font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-400" /> {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
