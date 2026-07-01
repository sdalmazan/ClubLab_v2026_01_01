import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, BarChart2, AlertTriangle, ShieldCheck, ArrowRight, BookOpen, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Dirección Metodológica — ClubLab",
  description: "Supervisa los contenidos metodológicos y alertas de la academia",
};

export default function AcademyDashboardPage() {
  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-emerald-500" />
            Dirección Metodológica
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Herramientas del coordinador de metodología para planificar, auditar y controlar el modelo de juego en los equipos de la academia.
          </p>
        </div>

        {/* Quick actions for coordinators */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <Link
            href="/training/exercises"
            className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-md"
          >
            <BookOpen className="h-4 w-4 text-emerald-500" />
            Biblioteca de Tareas
          </Link>
          <Link
            href="/training/templates"
            className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-md"
          >
            <FileText className="h-4 w-4 text-sky-500" />
            Plantillas de Sesión
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Card 1: Heatmap */}
        <div className="glass rounded-3xl border border-white/10 p-6 bg-gradient-to-br from-white/5 to-transparent flex flex-col justify-between hover:border-emerald-500/30 transition-all hover:-translate-y-0.5 group">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Mapa de Calor de Conceptos</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-medium">
                Audita qué conceptos tácticos (salida de balón, repliegue, ABP, etc.) se están entrenando más en cada equipo de la academia. Controla los minutos totales de trabajo.
              </p>
            </div>
          </div>
          <div className="border-t border-white/5 pt-4 mt-6">
            <Link
              href="/academy/concepts"
              className="flex items-center justify-between text-xs font-bold text-emerald-450 hover:text-emerald-400 transition-colors"
            >
              <span>Acceder al Monitor de Conceptos</span>
              <ArrowRight className="h-4 w-4 text-emerald-500" />
            </Link>
          </div>
        </div>

        {/* Card 2: Alerts */}
        <div className="glass rounded-3xl border border-white/10 p-6 bg-gradient-to-br from-white/5 to-transparent flex flex-col justify-between hover:border-amber-500/30 transition-all hover:-translate-y-0.5 group">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Alertas de Metodología</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-medium">
                Detecta de manera automática conceptos infra-entrenados (más de 21 días sin trabajar) o sobre-entrenados en la planificación semanal. Configura límites personalizados.
              </p>
            </div>
          </div>
          <div className="border-t border-white/5 pt-4 mt-6">
            <Link
              href="/academy/alerts"
              className="flex items-center justify-between text-xs font-bold text-amber-450 hover:text-amber-400 transition-colors"
            >
              <span>Ver Panel de Alertas</span>
              <ArrowRight className="h-4 w-4 text-amber-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-2xl bg-slate-950/40 border border-white/5 p-5 flex items-start gap-3 mt-6">
        <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Garantía del Modelo de Juego</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            El sistema recopila de forma automática la información de las tareas diseñadas en las planificaciones de todos los entrenadores. No requiere doble entrada de datos.
          </p>
        </div>
      </div>
    </div>
  );
}
