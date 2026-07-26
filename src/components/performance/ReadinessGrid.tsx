"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Clock, 
  User, 
  Dumbbell, 
  Sliders, 
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Flame,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadinessPlayer {
  id: string;
  name: string;
  position: string;
  jerseyNumber?: number;
  readinessState: "ready" | "adapted" | "unavailable";
  wellnessScore: number; // 0 to 25
  acwrRatio: number;
  targetMinutes: number;
  restrictionNote?: string;
  physioNote?: string;
}

interface ReadinessGridProps {
  players: ReadinessPlayer[];
  onUpdateTargetMinutes?: (playerId: string, minutes: number) => void;
  onUpdateState?: (playerId: string, state: "ready" | "adapted" | "unavailable") => void;
}

export function ReadinessGrid({
  players = [],
  onUpdateTargetMinutes,
  onUpdateState,
}: ReadinessGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "ready" | "adapted" | "unavailable">("all");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState<number>(60);

  const readyPlayers = players.filter(p => p.readinessState === "ready");
  const adaptedPlayers = players.filter(p => p.readinessState === "adapted");
  const unavailablePlayers = players.filter(p => p.readinessState === "unavailable");

  const filteredPlayers = players.filter(p => {
    if (selectedCategory === "ready") return p.readinessState === "ready";
    if (selectedCategory === "adapted") return p.readinessState === "adapted";
    if (selectedCategory === "unavailable") return p.readinessState === "unavailable";
    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── MATRIZ RESUMEN DE DISPONIBILIDAD (SEMÁFORO MATUTINO) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Category 1: LISTO 100% */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === "ready" ? "all" : "ready")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 relative overflow-hidden",
            selectedCategory === "ready"
              ? "bg-emerald-500/15 border-emerald-500/40 ring-2 ring-emerald-500/30"
              : "bg-slate-900 border-white/10 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="size-4" /> Listo 100% (Aptos)
            </span>
            <span className="text-xl font-black text-white">{readyPlayers.length}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Disponibles para entrenamiento completo sin restricciones de carga.
          </p>
        </button>

        {/* Category 2: CARGA REDUCIDA / ADAPTADO */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === "adapted" ? "all" : "adapted")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 relative overflow-hidden",
            selectedCategory === "adapted"
              ? "bg-amber-500/15 border-amber-500/40 ring-2 ring-amber-500/30"
              : "bg-slate-900 border-white/10 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Activity className="size-4" /> Carga Reducida / Adaptado
            </span>
            <span className="text-xl font-black text-white">{adaptedPlayers.length}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Recomendación de limitar minutos, evitar contactos o trabajo específico.
          </p>
        </button>

        {/* Category 3: BAJA MÉDICA / NO DISPONIBLE */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === "unavailable" ? "all" : "unavailable")}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 relative overflow-hidden",
            selectedCategory === "unavailable"
              ? "bg-destructive/15 border-destructive/40 ring-2 ring-destructive/30"
              : "bg-slate-900 border-white/10 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-4" /> Baja Médica / Reposo
            </span>
            <span className="text-xl font-black text-white">{unavailablePlayers.length}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            En tratamiento o readaptación individual con Enfermería (Fase 1/2).
          </p>
        </button>
      </div>

      {/* ── LISTADO DE DISPONIBILIDAD MATUTINA DE FUTBOLISTAS ── */}
      <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden text-white shadow-xl">
        <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Dumbbell className="size-4 text-primary" />
              Semáforo Matutino de la Plantilla ({filteredPlayers.length} jugadores)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ajuste dinámico de minutos proyectados y restricciones antes del entrenamiento
            </p>
          </div>

          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              Ver todos los jugadores ({players.length})
            </button>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {filteredPlayers.map(player => {
            const isEditing = editingPlayerId === player.id;

            return (
              <div
                key={player.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Left: Player info & status pill */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {player.jerseyNumber != null && (
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        #{player.jerseyNumber}
                      </span>
                    )}

                    <span className="text-sm font-bold text-white leading-tight">
                      {player.name}
                    </span>

                    <span className="text-[10px] text-slate-400 font-medium">
                      ({player.position})
                    </span>

                    {/* Readiness Status Badge */}
                    {player.readinessState === "ready" && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        🟩 Listo 100%
                      </span>
                    )}
                    {player.readinessState === "adapted" && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                        🟧 Carga Reducida
                      </span>
                    )}
                    {player.readinessState === "unavailable" && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 uppercase">
                        🔴 Baja Médica
                      </span>
                    )}
                  </div>

                  {/* Physical metrics pills: Wellness & ACWR */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 font-mono">
                      Wellness: <strong className={player.wellnessScore < 12 ? "text-amber-400" : "text-emerald-400"}>{player.wellnessScore}/25</strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      ACWR: <strong className={player.acwrRatio > 1.4 ? "text-rose-400" : "text-emerald-400"}>{player.acwrRatio}</strong>
                    </span>
                    {player.physioNote && (
                      <span className="text-amber-300 italic bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        🩺 Fisio: "{player.physioNote}"
                      </span>
                    )}
                  </div>

                  {player.restrictionNote && (
                    <p className="text-xs text-slate-300 italic bg-white/5 p-2 rounded border border-white/5">
                      "Indicación: {player.restrictionNote}"
                    </p>
                  )}
                </div>

                {/* Right: Target minutes & 1-Click action controls */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Min.</span>
                    <span className="text-base font-black text-white font-mono">{player.targetMinutes} min</span>
                  </div>

                  {/* Quick minute buttons */}
                  <div className="flex gap-1">
                    {[90, 60, 45, 30, 0].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onUpdateTargetMinutes && onUpdateTargetMinutes(player.id, m)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border",
                          player.targetMinutes === m
                            ? "bg-primary text-primary-foreground border-primary shadow"
                            : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                        )}
                      >
                        {m === 0 ? "0m" : `${m}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
