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
import { ConfirmAttendanceWeightModal } from "@/components/player/ConfirmAttendanceWeightModal";
import { evalPlayerTemporalState } from "@/services/playerTemporalStateService";
import Link from "next/link";
import { Moon, HeartPulse, Zap, AlertCircle, PlusCircle, Calendar, MapPin, Clock, ChevronRight, X, CheckCircle2 } from "lucide-react";

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

  // Today's real session state & routine assignment
  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [realRoutine, setRealRoutine] = useState<any | null>(null);
  const [clubInfo, setClubInfo] = useState<{ name: string; logoUrl: string | null } | null>(null);
  const [hasCompletedCheckout, setHasCompletedCheckout] = useState(false);

  // Attendance & Weight state
  const [confirmAttendanceOpen, setConfirmAttendanceOpen] = useState(false);
  const [attendanceWeight, setAttendanceWeight] = useState<number | null>(null);

  // Physio Slot Modal state
  const [physioModalOpen, setPhysioModalOpen] = useState(false);
  const [physioSlots, setPhysioSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [physioBookedSuccess, setPhysioBookedSuccess] = useState(false);

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

    // Fetch dynamic organization branding
    supabase.auth.getUser().then(async ({ data: { user } }: any) => {
      if (user) {
        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select(`
            role,
            organization_id,
            organizations (
              name,
              logo_url,
              settings
            )
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orgRole?.organizations) {
          const org = orgRole.organizations as any;
          const logo = org.logo_url || org.settings?.club_logo_url || null;
          setClubInfo({
            name: org.name || "Club",
            logoUrl: logo,
          });
        }

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
          setSummary((prev: any) => ({
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
          setSummary((prev: any) => ({
            ...prev,
            checkinPending: false,
            status: "GOOD",
            statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
          }));
        }
      })
      .catch((err) => console.error("Error checking wellness status:", err));

    // Fetch physio slots
    fetch("/api/physio/slots")
      .then((res) => res.json())
      .then((data) => {
        if (data?.slots && Array.isArray(data.slots)) {
          setPhysioSlots(data.slots);
          const booked = data.slots.find((s: any) => s.isBookedByMe);
          if (booked) {
            setPhysioBookedSuccess(true);
            setSelectedSlotId(booked.id);
          }
        }
      })
      .catch((err) => console.error("Error loading physio slots:", err));

    // Check if player has already confirmed attendance with weight today
    const attendanceLocal = localStorage.getItem(`cl_player_attendance_confirmed_${todayStr}`);
    if (attendanceLocal) {
      try {
        const parsed = JSON.parse(attendanceLocal);
        if (parsed?.weight) setAttendanceWeight(parsed.weight);
      } catch (e) {}
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
    setSummary((prev: any) => ({
      ...prev,
      statusMessage: "Histórico lesional actualizado. Los servicios médicos han sido notificados.",
    }));
  };

  const handleCheckinSuccess = () => {
    setCheckinOpen(false);
    setHasCompletedCheckin(true);
    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
    setSummary((prev: any) => ({
      ...prev,
      checkinPending: false,
      status: "GOOD",
      statusMessage: "Check-in completado. Estás en un estado óptimo para entrenar.",
    }));
  };

  const handleCheckoutSuccess = () => {
    setCheckoutOpen(false);
    setSummary((prev: any) => ({
      ...prev,
      checkoutPending: false,
    }));
  };

  // Centralized evaluation of temporal state machine
  const temporalEval = evalPlayerTemporalState({
    session: todaySession,
    playerDaily: {
      hasCheckinToday: hasCompletedCheckin,
      hasCheckoutToday: hasCompletedCheckout,
    },
    nowTime: new Date(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-36 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Hero Status Card */}
      <HeroStatusCard
        playerName={summary.player.first_name || "Jugador"}
        status={summary.status}
        message={summary.statusMessage}
        clubLogoUrl={clubInfo?.logoUrl}
        clubName={clubInfo?.name}
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

        {/* Link to view full training session report */}
        <Link
          href={todaySession?.id ? `/training/${todaySession.id}` : "/training"}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer mt-1"
        >
          <span>Ver Informe Completo y Ejercicios</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Routine Assignment Status Banner — ONLY show if a REAL routine is assigned */}
      {realRoutine && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-foreground">
              Rutina Asignada por el Staff: <strong className="text-blue-400">{realRoutine.title}</strong>
            </span>
          </div>
          <span className="text-[10px] font-extrabold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-lg shrink-0">
            Asignada
          </span>
        </div>
      )}

      {/* Physio & Medical Consultation Notification Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-card to-card p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md shrink-0">
            🩺
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
              Consulta de Fisioterapia
            </span>
            <h4 className="text-xs font-bold text-foreground">
              Citas abiertas de fisioterapia
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {physioBookedSuccess ? "¡Reserva solicitada con éxito!" : "Solicita o confirma tu cita con el fisio."}
            </p>
          </div>
        </div>

        <button
          onClick={() => setPhysioModalOpen(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
        >
          {physioBookedSuccess ? "Ver Cita" : "Apuntarme"}
        </button>
      </div>

      {/* "What Should I Do Now?" Dynamic Priority Card driven by evalPlayerTemporalState */}
      {temporalEval.actionType === "checkout" ? (
        <WhatShouldIDoNowCard
          title={temporalEval.nextActionTitle}
          subtitle={temporalEval.nextActionSubtitle}
          estimatedSeconds={20}
          actionText="Completar Check-out RPE"
          onAction={() => setCheckoutOpen(true)}
          type="checkout"
        />
      ) : temporalEval.actionType === "checkin" ? (
        <WhatShouldIDoNowCard
          title={temporalEval.nextActionTitle}
          subtitle={temporalEval.nextActionSubtitle}
          estimatedSeconds={25}
          actionText="Completar Check-in"
          onAction={() => setCheckinOpen(true)}
          type="checkin"
        />
      ) : (
        <WhatShouldIDoNowCard
          title={temporalEval.nextActionTitle}
          subtitle={temporalEval.nextActionSubtitle}
          estimatedSeconds={15}
          actionText="Ver Ficha de Salud"
          onAction={() => setCheckinOpen(true)}
          type="checkin"
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

      {/* Confirm Attendance Weight Modal */}
      <ConfirmAttendanceWeightModal
        isOpen={confirmAttendanceOpen}
        onClose={() => setConfirmAttendanceOpen(false)}
        onSuccess={(weight) => setAttendanceWeight(weight)}
        initialWeight={attendanceWeight || ""}
        sessionId={todaySession?.id || null}
      />

      {/* Physio Slot Booking Modal */}
      {physioModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden p-5 space-y-4 mb-16 sm:mb-0 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">🩺</span>
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider block">Cita Fisioterapia</span>
                  <h3 className="text-sm font-bold text-foreground">Turnos de Fisioterapia</h3>
                </div>
              </div>
              <button onClick={() => setPhysioModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground block">Turnos disponibles para hoy / viernes:</label>
              {physioSlots.length === 0 ? (
                <div className="p-4 rounded-2xl bg-accent/40 text-center text-xs text-muted-foreground border border-border/40">
                  No hay turnos creados o disponibles en este momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {physioSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={slot.isFull && !slot.isBookedByMe}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-between ${
                        selectedSlotId === slot.id
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                          : slot.isBookedByMe
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                          : slot.isFull
                          ? "bg-accent/20 text-muted-foreground border-border/20 opacity-50 cursor-not-allowed"
                          : "bg-accent/40 text-foreground border-border/50 hover:bg-accent"
                      }`}
                    >
                      <span>{slot.startTime}h - {slot.endTime}h ({slot.physioName})</span>
                      <span className="text-[10px] uppercase tracking-wide">
                        {slot.isBookedByMe ? "Reservado por ti" : slot.isFull ? "Completo" : `Plazas: ${slot.availablePlaces}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlotId && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/physio/slots", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slotId: selectedSlotId }),
                    });
                    const data = await res.json();
                    if (data?.error) {
                      alert(data.error);
                    } else {
                      setPhysioBookedSuccess(true);
                      setPhysioModalOpen(false);
                    }
                  } catch (err: any) {
                    alert(err.message || "Error al realizar la reserva");
                  }
                }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                Confirmar Reserva Atómica en Supabase
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Glassmorphism Bottom Navigation */}
      <PlayerBottomNav />
    </div>
  );
}

