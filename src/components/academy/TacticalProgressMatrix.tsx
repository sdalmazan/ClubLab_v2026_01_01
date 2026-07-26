"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  BookOpen,
  Users,
  Award,
  Clock,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TacticalConceptProgress {
  categoryName: string; // e.g. "Juvenil A", "Cadete", "Infantil"
  salidaBalonMin: number;
  presionAltaMin: number;
  transicionesMin: number;
  balonParadoMin: number;
  rondoPosesionMin: number;
  compliancePct: number;
}

const INITIAL_TACTICAL_MATRIX: TacticalConceptProgress[] = [
  {
    categoryName: "Primer Equipo (S.D. Almazán)",
    salidaBalonMin: 180,
    presionAltaMin: 210,
    transicionesMin: 150,
    balonParadoMin: 90,
    rondoPosesionMin: 240,
    compliancePct: 95,
  },
  {
    categoryName: "Juvenil A (Liga Nacional)",
    salidaBalonMin: 140,
    presionAltaMin: 160,
    transicionesMin: 120,
    balonParadoMin: 60,
    rondoPosesionMin: 200,
    compliancePct: 88,
  },
  {
    categoryName: "Cadete Regional",
    salidaBalonMin: 120,
    presionAltaMin: 110,
    transicionesMin: 90,
    balonParadoMin: 45,
    rondoPosesionMin: 180,
    compliancePct: 82,
  },
  {
    categoryName: "Infantil Provincial",
    salidaBalonMin: 90,
    presionAltaMin: 80,
    transicionesMin: 75,
    balonParadoMin: 30,
    rondoPosesionMin: 160,
    compliancePct: 78,
  },
  {
    categoryName: "Alevín A (Fútbol 7)",
    salidaBalonMin: 60,
    presionAltaMin: 45,
    transicionesMin: 60,
    balonParadoMin: 15,
    rondoPosesionMin: 220,
    compliancePct: 85,
  }
];

export function TacticalProgressMatrix() {
  const [matrix, setMatrix] = useState<TacticalConceptProgress[]>(INITIAL_TACTICAL_MATRIX);

  return (
    <div className="space-y-5 text-white animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="size-4 text-emerald-400" />
              Matriz de Cumplimiento Metodológico por Categoría
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Minutos acumulados en conceptos tácticos clave durante las sesiones del mes actual
            </p>
          </div>

          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
            Objetivo Cantera: 80%+
          </span>
        </div>

        <div className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-white/5 border-b border-white/10 uppercase text-[10px] font-black text-slate-400 tracking-wider">
                <tr>
                  <th className="p-3.5">Categoría / Equipo</th>
                  <th className="p-3.5">Salida de Balón</th>
                  <th className="p-3.5">Presión Alta</th>
                  <th className="p-3.5">Transiciones</th>
                  <th className="p-3.5">Balón Parado (ABP)</th>
                  <th className="p-3.5">Rondos / Posesión</th>
                  <th className="p-3.5 text-right">Cumplimiento Metodológico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {matrix.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                    <td className="p-3.5 font-sans font-bold text-white">
                      {row.categoryName}
                    </td>

                    <td className="p-3.5">
                      <span className="text-emerald-400 font-bold">{row.salidaBalonMin}m</span>
                    </td>

                    <td className="p-3.5">
                      <span className="text-indigo-400 font-bold">{row.presionAltaMin}m</span>
                    </td>

                    <td className="p-3.5">
                      <span className="text-sky-400 font-bold">{row.transicionesMin}m</span>
                    </td>

                    <td className="p-3.5">
                      <span className="text-amber-400 font-bold">{row.balonParadoMin}m</span>
                    </td>

                    <td className="p-3.5">
                      <span className="text-purple-400 font-bold">{row.rondoPosesionMin}m</span>
                    </td>

                    <td className="p-3.5 text-right">
                      <span className={cn(
                        "text-xs font-bold px-2.5 py-1 rounded border",
                        row.compliancePct >= 85
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      )}>
                        {row.compliancePct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
