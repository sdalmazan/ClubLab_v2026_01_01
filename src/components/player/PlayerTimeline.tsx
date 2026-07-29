"use client";

import React from "react";
import { TrendingUp, ShieldCheck, Activity, Calendar } from "lucide-react";

export function PlayerTimeline() {
  const lastDays = [
    { day: "Jue", score: 85, label: "Óptimo", color: "bg-emerald-500" },
    { day: "Vie", score: 90, label: "Excelente", color: "bg-emerald-500" },
    { day: "Sáb", score: 72, label: "Recuperación", color: "bg-blue-500" },
    { day: "Dom", score: 95, label: "Excelente", color: "bg-emerald-500" },
    { day: "Lun", score: 80, label: "Bueno", color: "bg-emerald-500" },
    { day: "Mar", score: 88, label: "Óptimo", color: "bg-emerald-500" },
    { day: "Hoy", score: 92, label: "Excelente", color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Evolución 7 Días */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Evolución del Estado (Últimos 7 días)
            </h3>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            +8% esta semana
          </span>
        </div>

        {/* Dynamic 7-day Bar chart */}
        <div className="grid grid-cols-7 gap-2 pt-2 items-end h-28 px-1">
          {lastDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[9px] font-bold text-muted-foreground">{d.score}%</span>
              <div className="w-full bg-accent/40 rounded-t-xl h-20 flex items-end p-0.5">
                <div
                  className={`w-full ${d.color} rounded-t-lg transition-all duration-300`}
                  style={{ height: `${d.score}%` }}
                />
              </div>
              <span className={`text-[10px] font-bold ${i === 6 ? "text-blue-400 font-extrabold" : "text-muted-foreground"}`}>
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen Métricas Clave */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Métricas Semanales
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Recuperación</span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              🟢 Buena (88%)
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Carga Semanal</span>
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
              🟡 1,450 AU (+6%)
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Disponibilidad</span>
            <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 block">
              🟢 100% (Apto)
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Prevención</span>
            <span className="text-sm font-extrabold text-purple-600 dark:text-purple-400 mt-0.5 block">
              🔵 3 Rutinas OK
            </span>
          </div>
        </div>
      </div>

      {/* Tu Evolución Narrativa */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Informe de Tendencia
          </h3>
        </div>

        <p className="text-xs text-foreground/90 font-medium leading-relaxed bg-accent/40 rounded-2xl p-3.5 border border-border/40">
          "Tu calidad de descanso y recuperación ha mejorado un <strong>+12%</strong> en las últimas 3 semanas tras ajustar tus pautas de hidratación y sueño post-sesión."
        </p>
      </div>
    </div>
  );
}
