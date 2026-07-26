"use client";

import React, { useState } from "react";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { RecommendationCard } from "@/components/player/RecommendationCard";
import { PlayerRecommendation } from "@/types";
import { ShieldCheck, Filter } from "lucide-react";

export default function PlayerRecommendationsPage() {
  const [filter, setFilter] = useState<string>("all");

  const recommendations: PlayerRecommendation[] = [
    {
      id: "rec-1",
      organization_id: "org-1",
      player_id: "p-1",
      category: "prevencion",
      title: "Prevención Específica de Isquiotibiales",
      description: "Rutina excéntrica suave de 8 minutos para reforzar isquios tras la carga acumulada del partido.",
      reason_context: "Tu carga acumulada en los últimos 3 días ha sido superior a la media habitual (+8%).",
      exercise_routine_id: null,
      estimated_minutes: 8,
      is_completed: false,
      created_by: "staff-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "rec-2",
      organization_id: "org-1",
      player_id: "p-1",
      category: "activacion",
      title: "Rutina de Activación Glútea Pre-Sesión",
      description: "Ejercicios de banda elástica y movilidad de cadera antes de saltar al terreno de juego.",
      reason_context: "Recomendación preventiva estándar del preparador físico.",
      exercise_routine_id: null,
      estimated_minutes: 5,
      is_completed: false,
      created_by: "staff-1",
      created_at: new Date().toISOString(),
    },
    {
      id: "rec-3",
      organization_id: "org-1",
      player_id: "p-1",
      category: "recuperacion",
      title: "Protocolo de Movilidad y Contraste Térmico",
      description: "Movilidad articular en foam roller y contraste de agua fría/caliente.",
      reason_context: "Tu nivel de fatiga muscular reportado tras la sesión fue de 4/5.",
      exercise_routine_id: null,
      estimated_minutes: 12,
      is_completed: true,
      created_by: "staff-1",
      created_at: new Date().toISOString(),
    },
  ];

  const filteredRecs = recommendations.filter((r) => {
    if (filter === "all") return true;
    return r.category === filter;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
            Cuerpo Técnico & Médico
          </span>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Recomendaciones
          </h1>
        </div>
        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: "all", label: "Todas" },
          { key: "prevencion", label: "Prevención" },
          { key: "activacion", label: "Activación" },
          { key: "recuperacion", label: "Recuperación" },
          { key: "fuerza", label: "Fuerza" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`py-2 px-3.5 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
              filter === item.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card hover:bg-card/80 border border-border/50 text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </div>

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
