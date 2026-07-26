"use client";

import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { Dumbbell, ArrowRight, ClipboardList, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function GymPerformancePage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-2">
          <Dumbbell className="h-7 w-7 text-slate-500" />
          Gimnasio & Fuerza (Desactivado)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Módulo de supervisión avanzada VBT y gimnasio en tiempo real.
        </p>
      </div>

      <PerformanceSubNav />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="p-3 rounded-full bg-slate-800 text-slate-400 w-fit mx-auto">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-base font-bold text-white">Módulo de Gimnasio Inactivo</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Este módulo ha sido deshabilitado por el preparador físico para simplificar la gestión. La asignación y programación de trabajo físico se realiza directamente desde la <strong className="text-slate-200">Biblioteca de Rutinas Físicas</strong>.
        </p>

        <Link
          href="/performance/routines"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 text-xs font-extrabold transition-all shadow-lg cursor-pointer"
        >
          <ClipboardList className="h-4 w-4" />
          Ir a Rutinas Físicas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
