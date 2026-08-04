"use client";

import React, { useState, useEffect } from "react";
import { HeartPulse, Activity, CheckCircle2, ChevronRight, Scale, AlertTriangle, Search, Filter, X } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checkin_done" | "checkout_done" | "pending">("all");

  // Exclude rest sessions ("descansos")
  const validSessions = (sessions || []).filter(
    (s: any) => s.session_type !== "rest" && !s.title?.toLowerCase().includes("descanso")
  );

  useEffect(() => {
    if (validSessions.length > 0 && activeSessionId === "all") {
      const todayStr = new Date().toISOString().split("T")[0];
      const todayS = validSessions.find((s: any) => s.date === todayStr);
      if (todayS) {
        setActiveSessionId(todayS.id);
      }
    }
  }, [validSessions]);

  const selectedSession = validSessions.find((s: any) => s.id === activeSessionId);

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (onSessionChange) onSessionChange(sessionId);
  };

  // Helper to resolve player checkin & checkout for current view/session
  const getPlayerData = (player: any) => {
    const todayStr = new Date().toISOString().split("T")[0];

    let w = player.latest_wellness;
    if (activeSessionId !== "all" && selectedSession) {
      const sessionW = (selectedSession.wellness_checkins || []).find((cw: any) => cw.player_id === player.id);
      w = sessionW || (selectedSession.date === todayStr ? player.latest_wellness : null);
    }

    let r = player.latest_rpe;
    if (activeSessionId !== "all" && selectedSession) {
      const sAtt = (selectedSession.session_attendance || []).find((att: any) => att.player_id === player.id);
      const sRpe = (selectedSession.rpe_entries || []).find((rpe: any) => rpe.player_id === player.id);
      r = sAtt?.rpe != null
        ? { rpe: sAtt.rpe, notes: sAtt.notes, status: sAtt.status }
        : sRpe?.rpe != null
        ? { rpe: sRpe.rpe, notes: sRpe.notes }
        : null;
    }

    const hasCheckin = !!w;
    const hasCheckout = !!r;
    const isPending = !hasCheckin || !hasCheckout;

    return { w, r, hasCheckin, hasCheckout, isPending };
  };

  // Calculate dynamic stats for the active session
  let currentCheckinsCount = 0;
  let currentCheckoutsCount = 0;
  let currentPendingCount = 0;

  players.forEach((p) => {
    const { hasCheckin, hasCheckout, isPending } = getPlayerData(p);
    if (hasCheckin) currentCheckinsCount++;
    if (hasCheckout) currentCheckoutsCount++;
    if (isPending) currentPendingCount++;
  });

  // Filter players by Search & Status Filter
  const filteredPlayers = players.filter((player: any) => {
    const playerName = player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador";
    const jersey = player.membership?.jersey_number ?? player.jersey_number ?? "";

    const matchesSearch = !searchQuery || 
      playerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      jersey.toString().includes(searchQuery);

    if (!matchesSearch) return false;

    const { hasCheckin, hasCheckout, isPending } = getPlayerData(player);

    if (statusFilter === "checkin_done") return hasCheckin;
    if (statusFilter === "checkout_done") return hasCheckout;
    if (statusFilter === "pending") return isPending;

    return true;
  });

  if (totalPlayers === 0) return null;

  return (
    <>
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Widget Header & Session Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] gap-3">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <HeartPulse className="size-4 text-emerald-400" />
              Detalle Check-in y Check-out por Sesión
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Haz clic en cualquier futbolista para ver su ficha o selecciona la sesión a revisar
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {validSessions.length > 0 && (
              <select
                value={activeSessionId}
                onChange={(e) => handleSessionSelect(e.target.value)}
                className="bg-slate-950 border border-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Todas las Sesiones</option>
                {validSessions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.title || "Sesión de Entrenamiento"} ({s.date || "Hoy"})
                  </option>
                ))}
              </select>
            )}

            <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
              {currentCheckinsCount} / {totalPlayers} Check-in ✓
            </span>
          </div>
        </div>

        {/* Buscador por Nombre y Filtros de Estado */}
        <div className="p-3 border-b border-white/10 bg-slate-950/40 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por jugador o dorsal..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { key: "all", label: `Todos (${totalPlayers})` },
              { key: "checkin_done", label: `📋 Check-in (${currentCheckinsCount})` },
              { key: "checkout_done", label: `🏁 Check-out (${currentCheckoutsCount})` },
              { key: "pending", label: `⏳ Pendientes (${currentPendingCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.key
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player List */}
        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
          {filteredPlayers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-1">
              <AlertTriangle className="size-5 text-amber-400 mx-auto" />
              <p className="font-bold text-slate-300">No se encontraron futbolistas</p>
              <p className="text-[11px] text-slate-500">Intenta cambiando el filtro de búsqueda o el estado seleccionado.</p>
            </div>
          ) : (
            filteredPlayers.map((player: any) => {
              const { w, r, hasCheckin, hasCheckout } = getPlayerData(player);
              const playerName = player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador";
              const hasWeight = w?.weight_kg != null;
              const jersey = player.membership?.jersey_number ?? player.jersey_number ?? null;

              return (
                <div
                  key={player.id}
                  onClick={() => {
                    const playerSessions = validSessions.map((s: any) => {
                      const sAtt = (s.session_attendance || []).find((att: any) => att.player_id === player.id);
                      const sRpe = (s.rpe_entries || []).find((rpe: any) => rpe.player_id === player.id);
                      const sWellness = (s.wellness_checkins || []).find((cw: any) => cw.player_id === player.id) || player.latest_wellness;
                      const sCheckout = sAtt?.rpe != null
                        ? { rpe: sAtt.rpe, notes: sAtt.notes, status: sAtt.status }
                        : sRpe?.rpe != null
                        ? { rpe: sRpe.rpe, notes: sRpe.notes }
                        : null;

                      return {
                        id: s.id,
                        title: s.title || "Sesión de Entrenamiento",
                        date: s.date,
                        session_type: s.session_type,
                        checkin: sWellness,
                        checkout: sCheckout,
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
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                        Check-in Pendiente
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

                    {/* WEIGHT BADGE */}
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
                      <span className="text-[9px] font-bold text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30 shrink-0">
                        RPE {r.rpe}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">RPE —</span>
                    )}

                    <ChevronRight className="size-3.5 text-slate-500 shrink-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Daily Detail Modal */}
      <PlayerDailyCheckDetailModal
        isOpen={!!selectedDetailPlayer}
        onClose={() => setSelectedDetailPlayer(null)}
        player={selectedDetailPlayer}
        initialSessionId={activeSessionId !== "all" ? activeSessionId : null}
      />
    </>
  );
}
