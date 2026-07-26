"use client";

import React, { useState } from "react";
import { HeroStatusCard } from "@/components/player/HeroStatusCard";
import { WhatShouldIDoNowCard } from "@/components/player/WhatShouldIDoNowCard";
import { WellnessCheckinModal } from "@/components/player/WellnessCheckinModal";
import { CheckoutRpeModal } from "@/components/player/CheckoutRpeModal";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { ProfileCompletionBar } from "@/components/player/ProfileCompletionBar";
import { RecommendationCard } from "@/components/player/RecommendationCard";
import { getMockPlayerSummary } from "@/services/playerExperienceService";
import { TalksManagerCard } from "@/components/talks/TalksManagerCard";
import { Moon, HeartPulse, Zap, AlertCircle } from "lucide-react";

export default function PlayerTodayPage() {
  const [summary, setSummary] = useState(getMockPlayerSummary());
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleCheckinSuccess = () => {
    setCheckinOpen(false);
    setSummary((prev) => ({
      ...prev,
      checkinPending: false,
      status: "GOOD",
      statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
    }));
  };

  const handleCheckoutSuccess = () => {
    setCheckoutOpen(false);
    setSummary((prev) => ({
      ...prev,
      checkoutPending: false,
    }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Hero Status Card */}
      <HeroStatusCard
        playerName={summary.player.first_name || "Jugador"}
        status={summary.status}
        message={summary.statusMessage}
      />

      {/* "What Should I Do Now?" Dynamic Priority Card */}
      {summary.checkinPending ? (
        <WhatShouldIDoNowCard
          title="Completa tu Check-in Pre-Entrenamiento"
          subtitle="Registra cómo te sientes hoy antes del entrenamiento de la plantilla."
          estimatedSeconds={25}
          actionText="Completar Check-in"
          onAction={() => setCheckinOpen(true)}
          type="checkin"
        />
      ) : summary.checkoutPending ? (
        <WhatShouldIDoNowCard
          title="Completa tu Check-out RPE Post-Sesión"
          subtitle="Evalúa la percepción del esfuerzo del entrenamiento reciéntemente finalizado."
          estimatedSeconds={20}
          actionText="Completar Check-out"
          onAction={() => setCheckoutOpen(true)}
          type="checkout"
        />
      ) : (
        <WhatShouldIDoNowCard
          title="Prevención Recomendada para Hoy"
          subtitle="El staff recomienda realizar 8 minutos de prevención de isquiotibiales."
          estimatedSeconds={8 * 60}
          actionText="Ver Rutina Recomendada"
          onAction={() => {}}
          type="recommendation"
        />
      )}

      {/* Synthetic Resumen Metrics */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Resumen Sintético de Salud
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 flex items-center gap-3">
            <Moon className="w-5 h-5 text-indigo-500" />
            <div>
              <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Sueño</span>
              <span className="text-sm font-bold text-foreground">
                {summary.metricsSummary.sleepQuality} / 5 (Bueno)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 flex items-center gap-3">
            <HeartPulse className="w-5 h-5 text-emerald-500" />
            <div>
              <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Fatiga</span>
              <span className="text-sm font-bold text-foreground">
                {summary.metricsSummary.fatigue} / 5 (Baja)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Carga Semanal</span>
              <span className="text-sm font-bold text-foreground">
                +{summary.metricsSummary.weeklyLoadChangePercent}% (Óptimo)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/40 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            <div>
              <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Molestias</span>
              <span className="text-sm font-bold text-foreground">
                {summary.metricsSummary.hasDiscomfort ? "Sí" : "Ninguna"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Staff Recommendation */}
      {summary.activeRecommendation && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider px-1">
            Recomendación del Staff
          </h3>
          <RecommendationCard recommendation={summary.activeRecommendation} />
        </div>
      )}

      {/* Guided Experience Profile Completion Bar */}
      <ProfileCompletionBar
        percentage={summary.completionPercentage}
        missingFields={summary.missingFields}
      />

      {/* Talks & Meetings Manager (Player Portal) */}
      <TalksManagerCard
        viewerRole="player"
        playerId={summary.player.id || "p-1"}
        playerName={summary.player.first_name || "Jugador"}
        title="💬 Mis Charlas con el Entrenador"
        subtitle="Solicita o responde citas individuales con el míster y cuerpo técnico"
      />

      {/* Check-in & Check-out Modals */}
      <WellnessCheckinModal
        isOpen={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSubmitSuccess={handleCheckinSuccess}
      />

      <CheckoutRpeModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmitSuccess={handleCheckoutSuccess}
      />

      {/* Mobile Glassmorphism Bottom Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
