"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AcademySubNav } from "@/components/academy/AcademySubNav";
import { Trophy, Calendar, CheckCircle2, Shield } from "lucide-react";

const YOUTH_RESULTS = [
  {
    category: "Juvenil A (Liga Nacional)",
    lastMatch: "S.D. Almazán 2 - 1 C.D. Numancia B",
    position: "Puesto #3",
    points: 38,
    status: "Victoria 🟩"
  },
  {
    category: "Cadete Regional",
    lastMatch: "Real Ávila 1 - 1 S.D. Almazán",
    position: "Puesto #5",
    points: 31,
    status: "Empate 🟨"
  },
  {
    category: "Infantil Provincial",
    lastMatch: "S.D. Almazán 3 - 0 Arandina C.F.",
    position: "Puesto #2",
    points: 42,
    status: "Victoria 🟩"
  },
  {
    category: "Alevín A (Fútbol 7)",
    lastMatch: "S.D. Almazán 4 - 2 Burgos Promesas",
    position: "Puesto #1 (Líder)",
    points: 45,
    status: "Victoria 🟩"
  }
];

export default function AcademyResultsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      <PageHeader
        title="Resultados & Clasificaciones de la Cantera"
        description="Resumen unificado de jornadas, marcadores y posiciones de los equipos de la S.D. Almazán"
      />
      <AcademySubNav />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {YOUTH_RESULTS.map((res, i) => (
          <div key={i} className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-200 flex items-center gap-1.5">
                <Trophy className="size-4 text-amber-400" /> {res.category}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {res.status}
              </span>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-medium block">Último Resultado:</span>
              <span className="text-sm font-black text-white block">{res.lastMatch}</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 font-mono">
              <span className="text-slate-400">Posición: <strong className="text-amber-400">{res.position}</strong></span>
              <span className="text-white font-bold">{res.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
