"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageSquare,
  Smile,
  Zap,
  Moon,
  HeartPulse,
  Activity,
  Scale,
  Calendar,
} from "lucide-react";

export interface SessionCheckRecord {
  id: string;
  title: string;
  date: string;
  session_type?: string;
  checkin?: {
    sleep_quality?: number;
    fatigue?: number;
    mood?: number;
    muscle_soreness?: number;
    stress?: number;
    weight_kg?: number;
    has_discomfort?: boolean;
    discomfort_body_part?: string;
    discomfort_intensity?: number;
    notes?: string;
  } | null;
  checkout?: {
    rpe?: number;
    notes?: string;
  } | null;
}

export interface PlayerDailyCheckDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id: string;
    name: string;
    jerseyNumber?: number | string | null;
    checkin?: {
      sleep_quality?: number;
      fatigue?: number;
      mood?: number;
      muscle_soreness?: number;
      stress?: number;
      weight_kg?: number;
      has_discomfort?: boolean;
      discomfort_body_part?: string;
      discomfort_intensity?: number;
      notes?: string;
      created_at?: string;
    } | null;
    checkout?: {
      rpe?: number;
      notes?: string;
      created_at?: string;
    } | null;
    sessions?: SessionCheckRecord[];
  } | null;
  initialSessionId?: string | null;
}

export function PlayerDailyCheckDetailModal({
  isOpen,
  onClose,
  player,
  initialSessionId,
}: PlayerDailyCheckDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"checkin" | "checkout" | "history">("checkin");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId || null);
  const [fetchedSessions, setFetchedSessions] = useState<SessionCheckRecord[]>([]);
  const [playerHistory, setPlayerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (player?.sessions && player.sessions.length > 0) {
      setFetchedSessions(player.sessions);
    } else if (player?.id) {
      fetch(`/api/training/sessions?limit=30`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setFetchedSessions(data);
          } else if (data.sessions && Array.isArray(data.sessions)) {
            setFetchedSessions(data.sessions);
          }
        })
        .catch((err) => console.error("Error fetching player sessions:", err));
    }

    if (player?.id) {
      setLoadingHistory(true);
      fetch(`/api/player/history?playerId=${player.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.history && Array.isArray(data.history)) {
            setPlayerHistory(data.history);
          }
        })
        .catch((err) => console.error("Error fetching player history:", err))
        .finally(() => setLoadingHistory(false));
    }
  }, [player]);

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    } else if (fetchedSessions.length > 0) {
      setSelectedSessionId(fetchedSessions[0].id);
    }
  }, [initialSessionId, fetchedSessions]);

  if (!isOpen || !player) return null;

  // Exclude rest sessions ("descansos")
  const sessions = (fetchedSessions.length > 0 ? fetchedSessions : player.sessions || []).filter(
    (s) => s.session_type !== "rest" && !s.title?.toLowerCase().includes("descanso")
  );
  const currentSession = sessions.find((s) => s.id === selectedSessionId) || (sessions.length > 0 ? sessions[0] : null);

  const c = currentSession ? (currentSession.checkin !== undefined ? currentSession.checkin : player.checkin) : player.checkin;
  const r = currentSession ? currentSession.checkout : player.checkout;

  const getScoreColor = (val?: number, isInverse = false) => {
    if (!val) return "text-slate-400";
    if (isInverse) {
      return val >= 4 ? "text-rose-400 font-bold" : val >= 3 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold";
    }
    return val >= 4 ? "text-emerald-400 font-bold" : val >= 3 ? "text-amber-400 font-bold" : "text-rose-400 font-bold";
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-xl rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-accent/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-sm">
              #{player.jerseyNumber || "–"}
            </div>
            <div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest block">
                Detalle Diario & Histórico de Jugador
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

        {/* Session Selector Bar (Revisión por sesión seleccionable) */}
        {sessions.length > 0 && (
          <div className="bg-slate-900 border-b border-white/10 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Sesión a Revisar:
            </span>
            <select
              value={selectedSessionId || sessions[0]?.id || ""}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {sessions.map((s, idx) => {
                const sCheckin = s.checkin || player.checkin;
                const sCheckout = s.checkout;
                return (
                  <option key={s.id} value={s.id}>
                    {s.title || `Sesión ${idx + 1}`} ({s.date || "Hoy"}) — In: {sCheckin ? "✓" : "⏳"} | Out: {sCheckout ? `RPE ${sCheckout.rpe}` : "⏳ Pendiente"}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Tab Switcher: Check-in vs Check-out vs Histórico */}
        <div className="flex border-b border-border/40 bg-accent/10 px-5 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("checkin")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === "checkin"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Check-in Matutino {c ? "✓" : "(Pendiente)"}
          </button>
          <button
            onClick={() => setActiveTab("checkout")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === "checkout"
                ? "text-sky-400 border-b-2 border-sky-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🏁 Check-out / RPE Post-Entreno {r ? "✓" : "(Pendiente)"}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === "history"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📜 Histórico (30 Días)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "checkin" && (
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
                      {c.weight_kg != null ? `${c.weight_kg} kg` : "–"}
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

                {/* Weight & Vestuario Confirmation Status Card */}
                <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                  c.weight_kg
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Scale className={`w-4 h-4 shrink-0 ${c.weight_kg ? "text-emerald-400" : "text-rose-400"}`} />
                    <div>
                      <span className="font-bold block text-foreground">
                        {c.weight_kg ? `Peso Registrado hoy: ${c.weight_kg} kg` : "Peso en Báscula Pendiente"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {c.weight_kg
                          ? "✓ Asistencia y peso confirmados en báscula de vestuario."
                          : "El jugador ha realizado el check-in pero NO ha introducido aún su peso en vestuario."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discomfort Warning Box if reported */}
                {c.has_discomfort || c.discomfort_body_part ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Molestia reportada en: {c.discomfort_body_part || "Zona no especificada"}</span>
                    </div>
                    {c.notes && <p className="text-amber-200/80 text-[11px] italic">"{c.notes}"</p>}
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
          )}

          {activeTab === "checkout" && (
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

          {activeTab === "history" && (
            loadingHistory ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Clock className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
                <span>Cargando historial de registros...</span>
              </div>
            ) : playerHistory.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                    Histórico Completo (Check-in & Check-out • {playerHistory.length} fechas)
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Pulsa en una fila para ver el desglose completo de ese día
                  </span>
                </div>
                <div className="overflow-x-auto border border-white/10 rounded-2xl bg-slate-950">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/5 text-slate-400 font-extrabold uppercase border-b border-white/10 text-[9px]">
                      <tr>
                        <th className="p-2.5">Fecha</th>
                        <th className="p-2.5 text-center">Sueño</th>
                        <th className="p-2.5 text-center">Fatiga</th>
                        <th className="p-2.5 text-center text-amber-400">Estrés</th>
                        <th className="p-2.5 text-center">Dolor</th>
                        <th className="p-2.5 text-center">Peso</th>
                        <th className="p-2.5 text-center text-sky-400">Check-out (RPE)</th>
                        <th className="p-2.5">Notas / Molestias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {playerHistory.map((item) => {
                        const inData = item.checkin;
                        const outData = item.checkout;
                        const hasNotesOrDiscomfort = inData?.notes || inData?.discomfort_body_part || outData?.notes || outData?.post_feeling;

                        return (
                          <tr key={item.date} className="hover:bg-white/[0.04] transition-colors">
                            <td className="p-2.5 font-bold text-white whitespace-nowrap">
                              📅 {item.date}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-300">
                              {inData?.sleep_quality ? `${inData.sleep_quality}/5` : "–"}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-300">
                              {inData?.fatigue ? `${inData.fatigue}/5` : "–"}
                            </td>
                            <td className="p-2.5 text-center font-bold text-amber-300">
                              {inData?.stress ? `${inData.stress}/5` : "–"}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-300">
                              {inData?.muscle_soreness ? `${inData.muscle_soreness}/5` : "–"}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-300">
                              {inData?.weight_kg ? `${inData.weight_kg} kg` : "–"}
                            </td>
                            <td className="p-2.5 text-center font-bold">
                              {outData?.rpe ? (
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  RPE {outData.rpe}/10
                                </span>
                              ) : (
                                <span className="text-slate-500 font-sans italic text-[10px]">Sin RPE</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-300 max-w-[200px] truncate font-sans text-[10px]">
                              {inData?.discomfort_body_part && (
                                <span className="text-amber-400 font-bold mr-1">
                                  ⚠️ {inData.discomfort_body_part}
                                </span>
                              )}
                              {inData?.notes && <span>"{inData.notes}"</span>}
                              {outData?.notes && <span className="text-sky-300 ml-1">Out: "{outData.notes}"</span>}
                              {!hasNotesOrDiscomfort && <span className="text-slate-600 italic">–</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <AlertTriangle className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="font-bold text-foreground">Sin historial previo</p>
                <p>No se encontraron registros anteriores de check-in o check-out para este futbolista.</p>
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
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
