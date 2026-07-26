"use client";

import React, { useState } from "react";
import { ShieldCheck, Dumbbell, Zap, RefreshCw, Activity, ArrowRight, Check } from "lucide-react";
import { PlayerRecommendation } from "@/types";

interface RecommendationCardProps {
  recommendation: PlayerRecommendation;
  onComplete?: () => void;
}

export function RecommendationCard({
  recommendation,
  onComplete,
}: RecommendationCardProps) {
  const [completed, setCompleted] = useState(recommendation.is_completed);

  const categoryConfig = {
    fuerza: { label: "Fuerza", icon: Dumbbell, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    prevencion: { label: "Prevención", icon: ShieldCheck, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    activacion: { label: "Activación", icon: Zap, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    movilidad: { label: "Movilidad", icon: Activity, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    recuperacion: { label: "Recuperación", icon: RefreshCw, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  };

  const cat = categoryConfig[recommendation.category] || categoryConfig.prevencion;
  const Icon = cat.icon;

  const handleStart = () => {
    setCompleted(true);
    if (onComplete) onComplete();
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg relative overflow-hidden flex flex-col justify-between transition-all hover:border-primary/40">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${cat.color}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{cat.label}</span>
          </div>

          {recommendation.estimated_minutes && (
            <span className="text-xs text-muted-foreground font-medium bg-accent px-2.5 py-1 rounded-full border border-border/40">
              ⏱️ {recommendation.estimated_minutes} min
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-foreground leading-snug">
          {recommendation.title}
        </h3>

        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          {recommendation.description}
        </p>

        {recommendation.reason_context && (
          <div className="mt-3.5 p-3 rounded-2xl bg-accent/40 border border-border/40 text-xs text-foreground/90">
            <span className="font-bold text-primary block mb-0.5">¿Por qué ves esto?</span>
            <span>"{recommendation.reason_context}"</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40">
        {completed ? (
          <div className="py-2.5 px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-emerald-500/20">
            <Check className="w-4 h-4" />
            <span>Rutina Completada</span>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full py-3 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all"
          >
            <span>Comenzar Rutina</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
