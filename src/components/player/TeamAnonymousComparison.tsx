"use client";

import React from "react";
import { Users, HelpCircle } from "lucide-react";
import { TeamComparisonData } from "@/services/playerExperienceService";

interface TeamAnonymousComparisonProps {
  comparisons: TeamComparisonData[];
}

export function TeamAnonymousComparison({ comparisons }: TeamAnonymousComparisonProps) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Comparativa Anónima de Equipo
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-accent px-2.5 py-1 rounded-full border border-border/40">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Sin nombres ajenos</span>
        </div>
      </div>

      <div className="space-y-4 pt-1">
        {comparisons.map((item, idx) => {
          const range = item.teamMax - item.teamMin || 1;
          const playerPercent = Math.min(
            100,
            Math.max(0, ((item.playerValue - item.teamMin) / range) * 100)
          );
          const avgPercent = Math.min(
            100,
            Math.max(0, ((item.teamAverage - item.teamMin) / range) * 100)
          );

          return (
            <div key={idx} className="bg-accent/30 rounded-2xl p-4 border border-border/40 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{item.metricLabel}</span>
                <span className="font-extrabold text-primary">
                  Tú: {item.playerValue} {item.unit}
                </span>
              </div>

              {/* Progress track representing range min to max */}
              <div className="relative w-full bg-accent h-3 rounded-full overflow-hidden border border-border/40 mt-2">
                {/* Team Average Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-amber-500 z-10"
                  style={{ left: `${avgPercent}%` }}
                  title={`Media Equipo: ${item.teamAverage}`}
                />

                {/* Player Value Fill */}
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${playerPercent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                <span>Mín: {item.teamMin} {item.unit}</span>
                <span className="text-amber-500 font-bold">Media Eq: {item.teamAverage} {item.unit}</span>
                <span>Máx: {item.teamMax} {item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
