"use client";

import { useState } from "react";
import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { ReadinessGrid, type ReadinessPlayer } from "@/components/performance/ReadinessGrid";
import { PageHeader } from "@/components/ui/page-header";
import {
  RuleEngineProvider,
  DEFAULT_PERFORMANCE_RULES,
  DEFAULT_PERFORMANCE_THRESHOLDS
} from "@/lib/performance/ruleEngine";
import { PLAYER_STATE_LABELS, type PlayerPerformanceState, type PerformanceRecommendation } from "@/types/performance";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Users,
  Check,
  X,
  SlidersHorizontal,
  Clock,
  Pencil,
  Plus,
  HeartPulse,
  Send,
  Dumbbell,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhysioInboxSuggestion {
  id: string;
  player_id: string;
  player_name: string;
  suggestion_text: string;
  created_at: string;
  status: "pending" | "applied" | "dismissed";
}

const INITIAL_READINESS_PLAYERS: ReadinessPlayer[] = [];

const INITIAL_PHYSIO_INBOX: PhysioInboxSuggestion[] = [];


export default function PerformanceDashboardPage() {
  const [readinessPlayers, setReadinessPlayers] = useState<ReadinessPlayer[]>(INITIAL_READINESS_PLAYERS);
  const [physioInbox, setPhysioInbox] = useState<PhysioInboxSuggestion[]>(INITIAL_PHYSIO_INBOX);
  
  const ruleEngine = new RuleEngineProvider();

  // Handlers for Target Minutes
  const handleUpdateTargetMinutes = (playerId: string, minutes: number) => {
    setReadinessPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, targetMinutes: minutes } : p))
    );
  };

  // Handlers for Physio Suggestions Inbox
  const handleApplySuggestion = (suggId: string) => {
    setPhysioInbox(prev =>
      prev.map(s => (s.id === suggId ? { ...s, status: "applied" } : s))
    );
  };

  const handleDismissSuggestion = (suggId: string) => {
    setPhysioInbox(prev =>
      prev.map(s => (s.id === suggId ? { ...s, status: "dismissed" } : s))
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-white">
      {/* ── PAGE HEADER ── */}
      <PageHeader
        title="Performance & Readiness Center"
        description="Centro de mando del Preparador Físico: semáforo matutino de disponibilidad, control de cargas y sugerencias de Enfermería"
      />

      {/* ── SUBNAV ── */}
      <PerformanceSubNav />

      {/* ── BANDEJA DE SUGERENCIAS DE ENFERMERÍA (PHYSIO INBOX) ── */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Sugerencias e Indicaciones de Enfermería ({physioInbox.filter(s => s.status === "pending").length} pendientes)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Recibidas del Fisioterapeuta en tiempo real</span>
        </div>

        {physioInbox.filter(s => s.status === "pending").length === 0 ? (
          <p className="text-xs text-slate-400 italic">No hay sugerencias de Enfermería pendientes de atender.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {physioInbox.filter(s => s.status === "pending").map(sugg => (
              <div key={sugg.id} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-sm">{sugg.player_name}</span>
                  <span className="text-[10px] text-slate-400">{sugg.created_at}</span>
                </div>

                <p className="text-slate-300 leading-relaxed italic bg-black/20 p-2 rounded border border-white/5">
                  "{sugg.suggestion_text}"
                </p>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleDismissSuggestion(sugg.id)}
                    className="px-2.5 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplySuggestion(sugg.id)}
                    className="px-3.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 shadow transition-all cursor-pointer"
                  >
                    <Check className="size-3" />
                    <span>Aceptar Comentario (Leído)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MATRIZ DE DISPONIBILIDAD MATUTINA (READINESS GRID) ── */}
      <ReadinessGrid
        players={readinessPlayers}
        onUpdateTargetMinutes={handleUpdateTargetMinutes}
      />
    </div>
  );
}
