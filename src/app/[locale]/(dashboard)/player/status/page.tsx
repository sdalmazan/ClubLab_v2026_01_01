"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { PlayerTimeline } from "@/components/player/PlayerTimeline";
import { TeamAnonymousComparison } from "@/components/player/TeamAnonymousComparison";
import { ConfidentialInjuryModal } from "@/components/player/ConfidentialInjuryModal";
import { getMockTeamComparisons, ConfidentialInjuryInput } from "@/services/playerExperienceService";
import { Activity, ShieldCheck, HeartPulse, Sparkles, Plus, Lock, Clock, CalendarDays } from "lucide-react";

export default function PlayerStatusPage() {
  const comparisons = getMockTeamComparisons();
  const [injuryModalOpen, setInjuryModalOpen] = useState(false);

  // Check if GPS data exists in database (default false if no GPS device integrated)
  const [hasGpsData, setHasGpsData] = useState<boolean>(false);

  const [injuries, setInjuries] = useState([
    {
      id: "inj-1",
      injuryType: "Sobrecarga Isquiotibial Izquierda",
      bodyPart: "Isquiotibiales",
      occurredDate: "2026-06-10",
      isConfidential: true,
      notes: "En tratamiento con fisioterapia del club",
      status: "Resuelta",
    },
  ]);

  const handleAddInjury = (newInjury: ConfidentialInjuryInput) => {
    setInjuries((prev) => [
      {
        id: `inj-${Date.now()}`,
        injuryType: newInjury.injuryType,
        bodyPart: newInjury.bodyPart,
        occurredDate: newInjury.occurredDate,
        isConfidential: newInjury.isConfidential,
        notes: newInjury.notes || "",
        status: "En seguimiento",
      },
      ...prev,
    ]);
    setInjuryModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
            Análisis de Cargas, Métricas & Salud
          </span>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Estado Físico
          </h1>
        </div>
        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
          <Activity className="w-6 h-6" />
        </div>
      </div>

      {/* ── CONSULTA FISIO ABIERTA BANNER ── */}
      <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider">Consulta de Fisio Abierta Hoy</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
            16:00 hs
          </span>
        </div>
        <p className="text-xs text-foreground leading-relaxed">
          El fisioterapeuta ha abierto consulta para hoy. Apúntate indicando tu molestia para asignarte hora.
        </p>
        <Link
          href="/injuries"
          className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-md active:scale-95"
        >
          <HeartPulse className="w-4 h-4" />
          <span>Apuntarme a la Consulta de Fisio</span>
        </Link>
      </div>

      {/* ── REGISTRO DE PESO MATUTINO & CONFIRMACIÓN DE ASISTENCIA ── */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-white/10 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-wider">Confirmación de Asistencia & Pesaje</span>
          </div>
          <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/30">
            Instalaciones Club
          </span>
        </div>
        
        <p className="text-xs text-slate-300 leading-relaxed">
          Introduce tu peso matutino en las instalaciones del club para confirmar tu asistencia al entrenamiento de hoy.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("¡Peso de 74.5 kg registrado correctamente! Tu asistencia al entrenamiento queda confirmada.");
          }}
          className="flex items-center gap-2 pt-1"
        >
          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              required
              placeholder="Ej. 74.5"
              className="w-full text-xs rounded-2xl bg-slate-950 border border-white/10 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400 font-mono"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">kg</span>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer shrink-0"
          >
            Confirmar Peso
          </button>
        </form>
      </div>

      {/* Grid Physical Status Overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-lg space-y-1">
          <div className="flex items-center gap-2 text-blue-500">
            <HeartPulse className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Carga ACWR</span>
          </div>
          <p className="text-lg font-black text-foreground">1.05 (Óptimo)</p>
          <span className="text-[11px] text-muted-foreground">Riesgo de lesión bajo</span>
        </div>

        {/* Dynamic Metric: GPS if available, Basic Metrics (Hours / Minutes) if no GPS */}
        {hasGpsData ? (
          <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-lg space-y-1">
            <div className="flex items-center gap-2 text-emerald-500">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Distancia GPS</span>
            </div>
            <p className="text-lg font-black text-foreground">6.8 km / ses</p>
            <span className="text-[11px] text-muted-foreground">Top 15% del equipo</span>
          </div>
        ) : (
          <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-lg space-y-1">
            <div className="flex items-center gap-2 text-emerald-500">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Horas Sesión</span>
            </div>
            <p className="text-lg font-black text-foreground">14.5 h / mes</p>
            <span className="text-[11px] text-muted-foreground">18 sesiones completadas</span>
          </div>
        )}

        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-lg space-y-1">
          <div className="flex items-center gap-2 text-purple-500">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Tests Físicos</span>
          </div>
          <p className="text-lg font-black text-foreground">Percentil 88</p>
          <span className="text-[11px] text-muted-foreground">Sprint 30m: 3.92s</span>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-lg space-y-1">
          <div className="flex items-center gap-2 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Disponibilidad</span>
          </div>
          <p className="text-lg font-black text-foreground">100% Apto</p>
          <span className="text-[11px] text-muted-foreground">Sin limitaciones</span>
        </div>
      </div>

      {/* 1. SECCIÓN ESTA SEMANA (PLAYER TIMELINE) COLOCADA ANTES DE LESIONES */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold text-blue-500 uppercase tracking-wider px-1">
          Evolución & Tendencias
        </h3>
        <PlayerTimeline />
      </div>

      {/* 2. SECCIÓN HISTÓRICO DE LESIONES (COLOCADA DESPUÉS DE ESTA SEMANA) */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Histórico de Lesiones
            </h3>
          </div>
          <button
            onClick={() => setInjuryModalOpen(true)}
            className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Lesión</span>
          </button>
        </div>

        <div className="space-y-2 pt-1">
          {injuries.map((inj) => (
            <div
              key={inj.id}
              className="p-3.5 rounded-2xl bg-accent/30 border border-border/40 space-y-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{inj.injuryType}</span>
                {inj.isConfidential && (
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/20">
                    <Lock className="w-3 h-3" />
                    Confidencial Médico
                  </span>
                )}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Zona: {inj.bodyPart} • {inj.occurredDate}</span>
                <span className="font-semibold text-emerald-500">{inj.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. COMPARATIVA ANÓNIMA DEL EQUIPO */}
      <TeamAnonymousComparison comparisons={comparisons} />

      {/* Modal for adding confidential injury */}
      <ConfidentialInjuryModal
        isOpen={injuryModalOpen}
        onClose={() => setInjuryModalOpen(false)}
        onSubmitSuccess={handleAddInjury}
      />

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
