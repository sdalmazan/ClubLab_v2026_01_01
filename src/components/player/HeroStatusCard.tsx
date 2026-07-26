"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Zap } from "lucide-react";

interface HeroStatusCardProps {
  playerName: string;
  status: "GOOD" | "READY" | "RECOVER" | "ATTENTION";
  message: string;
}

export function HeroStatusCard({ playerName, status, message }: HeroStatusCardProps) {
  const statusConfig = {
    GOOD: {
      label: "ÓPTIMO",
      badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
      icon: CheckCircle2,
      glowColor: "from-blue-600/20 via-transparent to-transparent",
    },
    READY: {
      label: "LISTO",
      badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
      icon: Zap,
      glowColor: "from-blue-600/20 via-transparent to-transparent",
    },
    RECOVER: {
      label: "RECUPERACIÓN",
      badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
      icon: RefreshCw,
      glowColor: "from-amber-500/20 via-transparent to-transparent",
    },
    ATTENTION: {
      label: "VIGILAR",
      badgeBg: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
      icon: AlertTriangle,
      glowColor: "from-rose-500/20 via-transparent to-transparent",
    },
  };

  const config = statusConfig[status] || statusConfig.READY;
  const Icon = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-blue-500/20 bg-card/90 p-6 backdrop-blur-xl shadow-xl transition-all`}>
      {/* Background Gradient Ambient Light (SD Almazán Corporate Blue) */}
      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${config.glowColor} rounded-full blur-3xl pointer-events-none -mr-16 -mt-16`} />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-blue-500">
              Tu Estado de Hoy
            </p>
            <h1 className="text-2xl font-black tracking-tight text-foreground mt-0.5">
              Hola, {playerName}
            </h1>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${config.badgeBg} font-extrabold text-xs tracking-wide shadow-sm`}>
            <Icon className="w-4 h-4 animate-pulse" />
            <span>{config.label}</span>
          </div>
        </div>

        <p className="text-sm text-foreground/90 font-medium leading-relaxed bg-accent/40 rounded-2xl p-3.5 border border-border/40">
          "{message}"
        </p>
      </div>
    </div>
  );
}
