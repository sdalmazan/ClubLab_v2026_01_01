"use client";

import React from "react";
import { TrendingUp, ShieldCheck, Activity, Calendar } from "lucide-react";

export function PlayerTimeline() {
  return (
    <div className="space-y-4">
      {/* Esta Semana */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Esta Semana
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Recuperación</span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              🟢 Buena (84%)
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
            Tu Evolución
          </h3>
        </div>

        <p className="text-xs text-foreground/90 font-medium leading-relaxed bg-accent/40 rounded-2xl p-3.5 border border-border/40">
          "Tu calidad de descanso ha mejorado un <strong>+12%</strong> en las últimas 3 semanas tras ajustar tus pautas de hidratación."
        </p>
      </div>
    </div>
  );
}
