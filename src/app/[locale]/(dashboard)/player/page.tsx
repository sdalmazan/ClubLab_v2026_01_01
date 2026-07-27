"use client";

import React, { useState, useEffect } from "react";
import { HeroStatusCard } from "@/components/player/HeroStatusCard";
import { WhatShouldIDoNowCard } from "@/components/player/WhatShouldIDoNowCard";
import { WellnessCheckinModal } from "@/components/player/WellnessCheckinModal";
import { CheckoutRpeModal } from "@/components/player/CheckoutRpeModal";
import { ConfidentialInjuryModal } from "@/components/player/ConfidentialInjuryModal";
import { PlayerInjuryReminderModal } from "@/components/player/PlayerInjuryReminderModal";
import { PlayerProfileEditModal } from "@/components/player/PlayerProfileEditModal";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { ProfileCompletionBar } from "@/components/player/ProfileCompletionBar";
import { RecommendationCard } from "@/components/player/RecommendationCard";
import { getMockPlayerSummary } from "@/services/playerExperienceService";
import { TalksManagerCard } from "@/components/talks/TalksManagerCard";
import { Moon, HeartPulse, Zap, AlertCircle, PlusCircle, Calendar, MapPin, Clock } from "lucide-react";

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

  // Profile Edit Modal State
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editFocusedField, setEditFocusedField] = useState<string | undefined>();

  // Injury Reminder & Creation Modals
  const [injuryReminderOpen, setInjuryReminderOpen] = useState(false);
  const [addInjuryOpen, setAddInjuryOpen] = useState(false);

  // Today's real session state
  const [todaySession, setTodaySession] = useState<any | null>(null);

  useEffect(() => {
    // Load authenticated user name & check role from client Supabase session
    const { createClient } = require("@/lib/supabase/client");
    const supabase = createClient();

    const todayStr = new Date().toISOString().split("T")[0];
    supabase
      .from("training_sessions")
      .select("*")
      .eq("date", todayStr)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setTodaySession(data);
      });

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

    // Check if player has already completed checkin today in DB or local session
    const todayStr = new Date().toISOString().split("T")[0];
    const completedLocal = localStorage.getItem(`cl_player_checkin_done_${todayStr}`);
    if (completedLocal) {
      setHasCompletedCheckin(true);
      setSummary((prev) => ({
        ...prev,
        checkinPending: false,
        status: "GOOD",
        statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
      }));
    }

    // Verify DB checkin state directly
    fetch("/api/player/wellness")
      .then((res) => res.json())
      .then((data) => {
        if (data?.completed) {
          setHasCompletedCheckin(true);
          localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
          setSummary((prev) => ({
            ...prev,
            checkinPending: false,
            status: "GOOD",
            statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
          }));
        }
      })
      .catch((err) => console.error("Error checking wellness status:", err));

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

      {/* Today's Training Session Card (Loaded Automatically 2h before or active) */}
      <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
              HOY
            </span>
            <div>
              <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider block">
                Sesión de Entrenamiento
              </span>
              <h3 className="text-sm font-bold text-foreground">
                {todaySession?.title || "Entrenamiento de Plantilla — Senior A"}
              </h3>
            </div>
          </div>
          <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            {todaySession?.start_time ? todaySession.start_time.slice(0, 5) : "10:00"} hs
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-accent/40 p-3 rounded-2xl border border-border/40">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            {todaySession?.duration_min || 90} min
          </span>
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            Campo La Arboleda
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            {todaySession?.microcycle_day || "MD-2"} • Carga {todaySession?.planned_load || "Media-Alta"}
          </span>
        </div>

        {todaySession?.notes && (
          <p className="text-xs text-muted-foreground italic px-1">
            "{todaySession.notes}"
          </p>
        )}
      </div>

      {/* Routine Assignment Status Banner */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-foreground">
            Rutina de Prevención Asignada por el Staff: <strong className="text-blue-400">8 min Isquiotibiales & Core</strong>
          </span>
        </div>
        <span className="text-[10px] font-extrabold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-lg shrink-0">
          Asignada
        </span>
      </div>

      {/* Physio & Medical Consultation Notification Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-card to-card p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md shrink-0">
            🩺
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
              Consulta de Fisioterapia Abierta
            </span>
            <h4 className="text-xs font-bold text-foreground">
              Cita disponible para este Viernes (Tratamiento & Valoración)
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Revisa la sección de charlas o responde a tu propuesta individual abajo.
            </p>
          </div>
        </div>
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
          } else {
            setEditFocusedField(key);
            setEditProfileOpen(true);
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

      {/* Player Profile Edit Modal */}
      <PlayerProfileEditModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        initialFieldFocus={editFocusedField}
      />

      {/* Check-in & Check-out Modals */}
      <WellnessCheckinModal
        isOpen={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSubmitSuccess={handleCheckinSuccess}
        sessionTitle={todaySession?.title ? `${todaySession.title} (${todaySession.start_time?.slice(0, 5) || "10:00"}h)` : "Entrenamiento Matinal (10:00h)"}
      />

      <CheckoutRpeModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmitSuccess={handleCheckoutSuccess}
        sessionTitle={todaySession?.title ? `${todaySession.title} (${todaySession.start_time?.slice(0, 5) || "10:00"}h)` : "Entrenamiento Matinal (10:00h)"}
      />

      {/* Mobile Glassmorphism Bottom Navigation */}
      <PlayerBottomNav />
    </div>
  );
}

