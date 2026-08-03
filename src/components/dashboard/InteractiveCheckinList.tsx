"use client";

import React, { useState } from "react";
import { HeartPulse, Activity, CheckCircle2, ChevronRight, Scale, AlertTriangle } from "lucide-react";
import { PlayerDailyCheckDetailModal } from "@/components/dashboard/PlayerDailyCheckDetailModal";

interface InteractiveCheckinListProps {
  players: any[];
  completedCheckinsCount: number;
  completedWeightsCount?: number;
  completedCheckoutsCount?: number;
  pendingCheckinCount: number;
  totalPlayers: number;
}

export function InteractiveCheckinList({
  players = [],
  completedCheckinsCount,
  completedWeightsCount = 0,
  completedCheckoutsCount = 0,
  pendingCheckinCount,
  totalPlayers,
}: InteractiveCheckinListProps) {
  const [selectedDetailPlayer, setSelectedDetailPlayer] = useState<any | null>(null);

  if (totalPlayers === 0) return null;

  return (
    <>
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <HeartPulse className="size-4 text-emerald-400" />
              Detalle Check-in por Jugador
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Haz clic en cualquier futbolista para ver el informe de salud, pesaje y esfuerzo
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
            {completedCheckinsCount} / {totalPlayers} Listos
          </span>
        </div>

        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
          {players.map((player: any) => {
            const w = player.latest_wellness;
            const r = player.latest_rpe;
            const playerName = player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador";
            const hasCheckin = !!w;
            const hasCheckout = !!r;
            const hasWeight = w?.weight_kg != null;
            const jersey = player.membership?.jersey_number ?? player.jersey_number ?? null;

            return (
              <div
                key={player.id}
                onClick={() =>
                  setSelectedDetailPlayer({
                    id: player.id,
                    name: playerName,
                    jerseyNumber: jersey,
                    checkin: w,
                    checkout: r,
                  })
                }
                className={`px-4 py-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all hover:bg-white/10 active:scale-[0.99] ${
                  hasCheckin ? "" : "bg-amber-500/5 hover:bg-amber-500/10"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {jersey != null && (
                    <span className="text-[10px] font-black text-slate-400 w-6 shrink-0 text-right">#{jersey}</span>
                  )}
                  <span className={`font-bold truncate ${hasCheckin ? "text-slate-100" : "text-amber-300"}`}>
                    {playerName}
                  </span>
                  {!hasCheckin && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Sleep */}
                  {hasCheckin && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-300 font-medium" title="Calidad de Sueño">
                      <Activity className="size-3.5 text-indigo-400" />
                      {w.sleep_quality ?? "–"}/5
                    </span>
                  )}

                  {/* Fatigue */}
                  {hasCheckin && (
                    <span
                      className={`flex items-center gap-1 text-[11px] font-bold ${
                        (w.fatigue ?? 0) >= 4
                          ? "text-rose-400"
                          : (w.fatigue ?? 0) >= 3
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                      title="Nivel de Fatiga"
                    >
                      <HeartPulse className="size-3.5" />
                      {w.fatigue ?? "–"}/5
                    </span>
                  )}

                  {/* Discomfort */}
                  {hasCheckin && w.has_discomfort && (
                    <span
                      className="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30 truncate max-w-[110px]"
                      title={w.discomfort_body_part || "Molestia"}
                    >
                      ⚠ {w.discomfort_body_part || "Molestia"}
                    </span>
                  )}

                  {/* WEIGHT BADGE (GREEN IF RECORDED, RED IF MISSING) */}
                  {hasWeight ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30" title={`Peso registrado: ${w.weight_kg} kg`}>
                      <Scale className="size-3 text-emerald-400" />
                      <span>{w.weight_kg} kg</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20" title="Sin peso registrado en báscula">
                      <Scale className="size-3 text-rose-400" />
                      <span>Sin peso</span>
                    </span>
                  )}

                  {/* Checkout RPE */}
                  {hasCheckout ? (
                    <span className="text-[9px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/30 shrink-0">
                      RPE {r.rpe}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500 shrink-0 font-medium">RPE —</span>
                  )}

                  <ChevronRight className="size-4 text-slate-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Detail Modal */}
      <PlayerDailyCheckDetailModal
        isOpen={!!selectedDetailPlayer}
        onClose={() => setSelectedDetailPlayer(null)}
        player={selectedDetailPlayer}
      />
    </>
  );
}
