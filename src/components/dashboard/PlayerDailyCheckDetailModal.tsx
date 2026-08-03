"use client";

import React, { useState } from "react";
import { X, Moon, HeartPulse, Activity, Scale, Smile, Zap, MessageSquare, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface PlayerDailyCheckDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id: string;
    name: string;
    jerseyNumber?: number | string | null;
    checkin?: {
      date?: string;
      sleep_quality?: number;
      fatigue?: number;
      mood?: number;
      muscle_soreness?: number;
      stress?: number;
      has_discomfort?: boolean;
      discomfort_body_part?: string | null;
      discomfort_intensity?: number | null;
      weight_kg?: number | null;
      notes?: string | null;
      created_at?: string;
    } | null;
    checkout?: {
      rpe?: number;
      fatigue_post?: number;
      notes?: string | null;
      created_at?: string;
    } | null;
  } | null;
}

export function PlayerDailyCheckDetailModal({
  isOpen,
  onClose,
  player,
}: PlayerDailyCheckDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"checkin" | "checkout">("checkin");

  if (!isOpen || !player) return null;

  const c = player.checkin;
  const r = player.checkout;

  const getScoreColor = (val?: number, isInverse = false) => {
    if (!val) return "text-slate-400";
    if (isInverse) {
      return val >= 4 ? "text-rose-400 font-bold" : val >= 3 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold";
    }
    return val >= 4 ? "text-emerald-400 font-bold" : val >= 3 ? "text-amber-400 font-bold" : "text-rose-400 font-bold";
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-accent/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-sm">
              #{player.jerseyNumber || "–"}
            </div>
            <div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest block">
                Detalle Diario de Jugador
              </span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{player.name}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Check-in vs Check-out */}
        <div className="flex border-b border-border/40 bg-accent/10 px-5 pt-3 gap-3">
          <button
            onClick={() => setActiveTab("checkin")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "checkin"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Check-in Matutino {c ? "✓" : "(Pendiente)"}
          </button>
          <button
            onClick={() => setActiveTab("checkout")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "checkout"
                ? "text-sky-400 border-b-2 border-sky-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🏁 Check-out / RPE Post-Entreno {r ? "✓" : "(Pendiente)"}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "checkin" ? (
            c ? (
              <div className="space-y-4">
                {/* Highlights Summary Bar */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-accent/40 border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Sueño</span>
                    <span className={`text-base ${getScoreColor(c.sleep_quality)}`}>
                      {c.sleep_quality ?? "–"}/5
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-accent/40 border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Fatiga</span>
                    <span className={`text-base ${getScoreColor(c.fatigue, true)}`}>
                      {c.fatigue ?? "–"}/5
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-accent/40 border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block">Peso hoy</span>
                    <span className="text-base font-bold text-foreground">
                      {c.weight_kg ? `${c.weight_kg} kg` : "–"}
                    </span>
                  </div>
                </div>

                {/* Detailed Metrics Table */}
                <div className="space-y-2 rounded-2xl bg-accent/20 p-4 border border-border/30 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" /> Calidad de Sueño
                    </span>
                    <span className={getScoreColor(c.sleep_quality)}>{c.sleep_quality ?? "No registrado"}/5</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Nivel de Fatiga
                    </span>
                    <span className={getScoreColor(c.fatigue, true)}>{c.fatigue ?? "No registrado"}/5</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Smile className="w-3.5 h-3.5 text-blue-400" /> Estado de Ánimo
                    </span>
                    <span className={getScoreColor(c.mood)}>{c.mood ?? "No registrado"}/5</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> Dolor / Soreness Muscular
                    </span>
                    <span className={getScoreColor(c.muscle_soreness, true)}>{c.muscle_soreness ?? "No registrado"}/5</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" /> Estrés
                    </span>
                    <span className={getScoreColor(c.stress, true)}>{c.stress ?? "No registrado"}/5</span>
                  </div>
                </div>

                {/* Discomfort Warning Card */}
                {c.has_discomfort ? (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Molestia reportada: {c.discomfort_body_part || "Zona corporal"}</span>
                    </div>
                    {c.discomfort_intensity && (
                      <p className="text-[11px] text-rose-300/80">
                        Intensidad dolor: <strong className="text-white">{c.discomfort_intensity}/10</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Sin molestias ni dolor muscular localizado hoy.</span>
                  </div>
                )}

                {/* Notes & Weight Entry Confirmation */}
                {c.notes && (
                  <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Comentarios del jugador
                    </span>
                    <p className="text-foreground text-xs italic">"{c.notes}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="font-bold text-foreground">Check-in no realizado hoy</p>
                <p>El jugador aún no ha completado el formulario de salud y fatiga matutino.</p>
              </div>
            )
          ) : (
            r ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">RPE Esfuerzo Sesión</span>
                    <span className="text-xl font-black text-sky-300">RPE {r.rpe}/10</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${((r.rpe || 0) / 10) * 100}%` }}
                    />
                  </div>
                </div>

                {r.notes && (
                  <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Comentarios Post-Entrenamiento
                    </span>
                    <p className="text-foreground text-xs italic">"{r.notes}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Clock className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="font-bold text-foreground">Check-out / RPE Pendiente</p>
                <p>El jugador completará la valoración de esfuerzo (RPE) al finalizar el entrenamiento.</p>
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/40 bg-accent/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
