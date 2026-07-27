"use client";

import React, { useState, useEffect } from "react";
import { HeroStatusCard } from "@/components/player/HeroStatusCard";
import { WhatShouldIDoNowCard } from "@/components/player/WhatShouldIDoNowCard";
import { WellnessCheckinModal } from "@/components/player/WellnessCheckinModal";
import { CheckoutRpeModal } from "@/components/player/CheckoutRpeModal";
import { ConfidentialInjuryModal } from "@/components/player/ConfidentialInjuryModal";
import { PlayerInjuryReminderModal } from "@/components/player/PlayerInjuryReminderModal";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { ProfileCompletionBar } from "@/components/player/ProfileCompletionBar";
import { RecommendationCard } from "@/components/player/RecommendationCard";
import { getMockPlayerSummary } from "@/services/playerExperienceService";
import { TalksManagerCard } from "@/components/talks/TalksManagerCard";
import { Moon, HeartPulse, Zap, AlertCircle, PlusCircle } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

export default function PlayerTodayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasCompletedCheckin, setHasCompletedCheckin] = useState(false);
  const [summary, setSummary] = useState(() => {
    const base = getMockPlayerSummary();
    return {
      ...base,
      status: "PENDING" as "GOOD" | "READY" | "RECOVER" | "ATTENTION" | "PENDING",
      statusMessage: "Completa tu primer check-in pre-entrenamiento para registrar tus métricas de salud y recuperación de hoy.",
      checkinPending: true,
    };
  });
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Injury Reminder & Creation Modals
  const [injuryReminderOpen, setInjuryReminderOpen] = useState(false);
  const [addInjuryOpen, setAddInjuryOpen] = useState(false);

  useEffect(() => {
    // Load authenticated user name & check role from client Supabase session
    const { createClient } = require("@/lib/supabase/client");
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }: any) => {
      if (user) {
        // Fetch organization role
        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const userRole = orgRole?.role || "player";
        const isCoachRole = [
          "head_coach",
          "assistant_coach",
          "coach",
          "physical_coach",
          "club_admin",
          "super_admin",
          "physio",
          "sporting_director",
        ].includes(userRole);

        // Redirect coaches to dashboard unless preview query param is present
        const isPreview = searchParams.get("preview") === "1";
        if (isCoachRole && !isPreview) {
          router.replace("/dashboard");
          return;
        }

        if (user?.user_metadata?.full_name || user?.email) {
          const rawName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Jugador";
          const firstName = rawName.trim().split(" ")[0] || "Jugador";
          setSummary((prev) => ({
            ...prev,
            player: {
              ...prev.player,
              first_name: firstName,
              sporting_name: rawName,
            },
          }));
        }
      }
    });

    // Check if player has already completed checkin today in local session
    const todayStr = new Date().toISOString().split("T")[0];
    const completedToday = localStorage.getItem(`cl_player_checkin_done_${todayStr}`);
    if (completedToday) {
      setHasCompletedCheckin(true);
      setSummary((prev) => ({
        ...prev,
        checkinPending: false,
        status: "GOOD",
        statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
      }));
    }

    // Check if player has already completed or acknowledged injury history
    const isDone = localStorage.getItem("cl_player_injury_history_done");
    const dismissedThisSession = sessionStorage.getItem("cl_player_injury_reminder_dismissed");

    if (!isDone && !dismissedThisSession) {
      const timer = setTimeout(() => {
        setInjuryReminderOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCloseReminderLater = () => {
    setInjuryReminderOpen(false);
    sessionStorage.setItem("cl_player_injury_reminder_dismissed", "true");
  };

  const handleMarkAsClean = () => {
    setInjuryReminderOpen(false);
    localStorage.setItem("cl_player_injury_history_done", "true");
  };

  const handleOpenAddInjuryFromReminder = () => {
    setInjuryReminderOpen(false);
    setAddInjuryOpen(true);
  };

  const handleInjurySubmittedSuccess = () => {
    setAddInjuryOpen(false);
    localStorage.setItem("cl_player_injury_history_done", "true");
    setSummary((prev) => ({
      ...prev,
      statusMessage: "Histórico lesional actualizado. Los servicios médicos han sido notificados.",
    }));
  };

  const handleCheckinSuccess = () => {
    setCheckinOpen(false);
    setHasCompletedCheckin(true);
    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
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

      {/* Quick Button: Add Injury / Medical Antecedent */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2.5">
          <HeartPulse className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">Histórico de Lesiones</span>
            <span className="text-[10px] text-muted-foreground block">Registra antecedentes o molestias para el fisioterapeuta</span>
          </div>
        </div>
        <button
          onClick={() => setAddInjuryOpen(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Añadir</span>
        </button>
      </div>

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
      {!hasCompletedCheckin ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center space-y-3 shadow-md">
          <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <HeartPulse className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Resumen Sintético de Salud</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Sin registros hoy. Completa tu Check-in Pre-Entrenamiento para activar tus métricas de salud, descanso y fatiga.
            </p>
          </div>
          <button
            onClick={() => setCheckinOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <HeartPulse className="size-4" />
            <span>Completar Check-in Ahora</span>
          </button>
        </div>
      ) : (
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
      )}

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
        onCompleteField={(key) => {
          if (key === "injury_history") {
            setAddInjuryOpen(true);
          }
        }}
      />

      {/* Talks & Meetings Manager (Player Portal) */}
      <TalksManagerCard
        viewerRole="player"
        playerId={summary.player.id || "p-1"}
        playerName={summary.player.first_name || "Jugador"}
        title="💬 Mis Charlas con el Entrenador"
        subtitle="Solicita o responde citas individuales con el míster y cuerpo técnico"
      />

      {/* Injury Reminder Modal */}
      <PlayerInjuryReminderModal
        isOpen={injuryReminderOpen}
        onCloseLater={handleCloseReminderLater}
        onOpenInjuryModal={handleOpenAddInjuryFromReminder}
        onMarkAsClean={handleMarkAsClean}
      />

      {/* Confidential Injury Entry Modal */}
      <ConfidentialInjuryModal
        isOpen={addInjuryOpen}
        onClose={() => setAddInjuryOpen(false)}
        onSubmitSuccess={handleInjurySubmittedSuccess}
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

