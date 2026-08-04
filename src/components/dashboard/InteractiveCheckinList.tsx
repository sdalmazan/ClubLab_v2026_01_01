"use client";

import React, { useState } from "react";
import { HeartPulse, Activity, CheckCircle2, ChevronRight, Scale, AlertTriangle } from "lucide-react";
import { PlayerDailyCheckDetailModal } from "@/components/dashboard/PlayerDailyCheckDetailModal";

interface InteractiveCheckinListProps {
  players: any[];
  sessions?: any[];
  completedCheckinsCount: number;
  completedWeightsCount?: number;
  completedCheckoutsCount?: number;
  pendingCheckinCount: number;
  totalPlayers: number;
  selectedSessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export function InteractiveCheckinList({
  players = [],
  sessions = [],
  completedCheckinsCount,
  completedWeightsCount = 0,
  completedCheckoutsCount = 0,
  pendingCheckinCount,
  totalPlayers,
  selectedSessionId,
  onSessionChange,
}: InteractiveCheckinListProps) {
  const [selectedDetailPlayer, setSelectedDetailPlayer] = useState<any | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>(selectedSessionId || "all");

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (onSessionChange) onSessionChange(sessionId);
  };

  if (totalPlayers === 0) return null;

  return (
    <>
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <HeartPulse className="size-4 text-emerald-400" />
              Detalle Check-in y Check-out por Sesión
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Haz clic en cualquier futbolista para ver la ficha o selecciona la sesión que deseas revisar
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sessions.length > 0 && (
              <select
                value={activeSessionId}
                onChange={(e) => handleSessionSelect(e.target.value)}
                className="bg-slate-950 border border-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Todas las Sesiones del Día</option>
                {sessions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.title || "Sesión"} ({s.date || "Hoy"})
                  </option>
                ))}
              </select>
            )}

            <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
              {completedCheckinsCount} / {totalPlayers} Listos
            </span>
          </div>
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
                onClick={() => {
                  const playerSessions = sessions.map((s: any) => {
                    const sAtt = (s.session_attendance || []).find((att: any) => att.player_id === player.id);
                    return {
                      id: s.id,
                      title: s.title || "Sesión de Entrenamiento",
                      date: s.date,
                      session_type: s.session_type,
                      checkin: player.latest_wellness,
                      checkout: sAtt ? { rpe: sAtt.rpe, notes: sAtt.notes, status: sAtt.status } : player.latest_rpe,
                    };
                  });

                  setSelectedDetailPlayer({
                    id: player.id,
                    name: playerName,
                    jerseyNumber: jersey,
                    checkin: w,
                    checkout: r,
                    sessions: playerSessions,
                  });
                }}
                className={`px-4 py-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all hover:bg-slate-800/80 active:scale-[0.99] border-b border-white/[0.04] ${
                  hasCheckin ? "" : "bg-white/[0.01]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {jersey != null && (
                    <span className="text-[10px] font-mono font-medium text-slate-500 w-6 shrink-0 text-right">#{jersey}</span>
                  )}
                  <span className={`font-bold truncate ${hasCheckin ? "text-slate-200" : "text-slate-400"}`}>
                    {playerName}
                  </span>
                  {!hasCheckin && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Sleep */}
                  {hasCheckin && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-medium" title="Calidad de Sueño">
                      <Activity className="size-3.5 text-slate-400" />
                      {w.sleep_quality ?? "–"}/5
                    </span>
                  )}

                  {/* Fatigue */}
                  {hasCheckin && (
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold ${
                        (w.fatigue ?? 0) >= 4
                          ? "text-rose-400/90"
                          : (w.fatigue ?? 0) >= 3
                          ? "text-amber-400/90"
                          : "text-slate-300"
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
                      className="text-[9px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 truncate max-w-[110px]"
                      title={w.discomfort_body_part || "Molestia"}
                    >
                      ⚠ {w.discomfort_body_part || "Molestia"}
                    </span>
                  )}

                  {/* WEIGHT BADGE (MINIMALIST OBSIDIAN BADGES) */}
                  {hasWeight ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-white/10" title={`Peso registrado: ${w.weight_kg} kg`}>
                      <Scale className="size-3 text-emerald-400/90" />
                      <span>{w.weight_kg} kg</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-white/5" title="Sin peso registrado en báscula">
                      <Scale className="size-3 text-slate-500" />
                      <span>Sin peso</span>
                    </span>
                  )}

                  {/* Checkout RPE */}
                  {hasCheckout ? (
                    <span className="text-[9px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-white/10 shrink-0">
                      RPE {r.rpe}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500 shrink-0">RPE —</span>
                  )}

                  <ChevronRight className="size-3.5 text-slate-500 shrink-0" />
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
