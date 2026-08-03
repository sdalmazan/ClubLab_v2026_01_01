"use client";

import React, { useState, useEffect } from "react";
import { HeroStatusCard } from "@/components/player/HeroStatusCard";
import { WhatShouldIDoNowCard } from "@/components/player/WhatShouldIDoNowCard";
import { WellnessCheckinModal, type WellnessCheckinValues } from "@/components/player/WellnessCheckinModal";
import { CheckoutRpeModal } from "@/components/player/CheckoutRpeModal";
import { ConfidentialInjuryModal } from "@/components/player/ConfidentialInjuryModal";
import { PlayerInjuryReminderModal } from "@/components/player/PlayerInjuryReminderModal";
import { PlayerProfileEditModal } from "@/components/player/PlayerProfileEditModal";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { ProfileCompletionBar } from "@/components/player/ProfileCompletionBar";
import { RecommendationCard } from "@/components/player/RecommendationCard";
import { calculatePlayerProfileCompletion } from "@/services/playerExperienceService";
import { TalksManagerCard } from "@/components/talks/TalksManagerCard";
import { ConfirmAttendanceWeightModal } from "@/components/player/ConfirmAttendanceWeightModal";
import { evalPlayerTemporalState } from "@/services/playerTemporalStateService";
import Link from "next/link";
import { Moon, HeartPulse, Zap, AlertCircle, PlusCircle, Calendar, MapPin, Clock, ChevronRight, X, CheckCircle2, Activity, Check, User } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

export default function PlayerTodayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasCompletedCheckin, setHasCompletedCheckin] = useState(false);
  const [summary, setSummary] = useState({
    player: {
      id: "",
      first_name: "",
      last_name: "",
      sporting_name: "",
      height_cm: null as number | null,
      weight_kg: null as number | null,
      dominant_foot: null as string | null,
      date_of_birth: null as string | null,
      nationality: null as string | null,
      avatar_url: null as string | null,
      physical_status: "green" as const,
      availability_status: "available" as const,
    },
    status: "PENDING" as "GOOD" | "READY" | "RECOVER" | "ATTENTION" | "PENDING",
    statusMessage: "Completa el check-in para activar tu panel de salud.",
    checkinPending: true,
    checkinWindowOpen: true,
    checkoutPending: false,
    checkoutWindowOpen: false,
    activeRecommendation: null as any,
    completionPercentage: 0,
    missingFields: [] as Array<{ key: string; label: string; explanation: string }>,
    metricsSummary: {
      sleepQuality: 0,
      fatigue: 0,
      weeklyLoadChangePercent: 0,
      hasDiscomfort: false,
      discomfortLocation: null as string | null,
      acwrRatio: 0,
      gpsDistanceKm: 0,
    },
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

  // Physio Slot & Availability Modal state
  const [physioModalOpen, setPhysioModalOpen] = useState(false);
  const [physioSlots, setPhysioSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [physioBookedSuccess, setPhysioBookedSuccess] = useState(false);
  const [preferredDay, setPreferredDay] = useState("Viernes");
  const [preferredShift, setPreferredShift] = useState("Mañana");
  const [physioReason, setPhysioReason] = useState("");
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>(["18:10", "18:20"]);
  const [submittingAvail, setSubmittingAvail] = useState(false);
  const [myPhysioAppointment, setMyPhysioAppointment] = useState<any | null>(null);

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

    // Fetch dynamic organization branding AND real player profile
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

        // Load real player profile data from the players table
        const { data: playerRow } = await supabase
          .from("players")
          .select("id, first_name, last_name, sporting_name, date_of_birth, height_cm, weight_kg, dominant_foot, nationality, avatar_url, organization_id")
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (playerRow) {
          const displayName = playerRow.sporting_name ||
            `${playerRow.first_name || ""} ${playerRow.last_name || ""}`.trim() ||
            user?.user_metadata?.full_name ||
            user?.email?.split("@")[0] || "Jugador";
          const firstName = playerRow.first_name ||
            (user?.user_metadata?.full_name || "").split(" ")[0] ||
            user?.email?.split("@")[0] || "Jugador";

          const { percentage, missingFields } = calculatePlayerProfileCompletion(
            playerRow,
            !!localStorage.getItem("cl_player_injury_history_done")
          );

          setSummary((prev: any) => ({
            ...prev,
            player: {
              id: playerRow.id,
              first_name: firstName,
              last_name: playerRow.last_name || "",
              sporting_name: displayName,
              date_of_birth: playerRow.date_of_birth || null,
              height_cm: playerRow.height_cm || null,
              weight_kg: playerRow.weight_kg || null,
              dominant_foot: playerRow.dominant_foot || null,
              nationality: playerRow.nationality || null,
              avatar_url: playerRow.avatar_url || null,
              physical_status: "green" as const,
              availability_status: "available" as const,
            },
            completionPercentage: percentage,
            missingFields,
          }));
        } else {
          // Fallback: use auth metadata only
          const rawName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Jugador";
          const firstName = rawName.trim().split(" ")[0] || "Jugador";
          setSummary((prev: any) => ({
            ...prev,
            player: { ...prev.player, first_name: firstName, sporting_name: rawName },
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

    // Verify DB checkin state directly and load real metrics if done
    fetch("/api/player/wellness")
      .then((res) => res.json())
      .then((data) => {
        if (data?.completed && data?.checkin) {
          const c = data.checkin;
          setHasCompletedCheckin(true);
          localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
          setSummary((prev: any) => ({
            ...prev,
            checkinPending: false,
            status: c.fatigue >= 3 || c.muscle_soreness >= 3 ? "FATIGADO" : "PREPARADO",
            statusMessage: c.has_discomfort
              ? `Check-in completado. Molestia reportada en ${c.discomfort_body_part || "zona desconocida"}.`
              : c.fatigue >= 3
              ? "Cuestionario completado. Has reportado fatiga acumulada; el preparador ha sido notificado."
              : "Check-in completado. Estás preparado para entrenar.",
            metricsSummary: {
              ...prev.metricsSummary,
              sleepQuality: c.sleep_quality ?? 0,
              fatigue: c.fatigue ?? 0,
              hasDiscomfort: !!c.has_discomfort,
              discomfortLocation: c.discomfort_body_part || null,
            },
          }));
        } else if (data?.completed) {
          setHasCompletedCheckin(true);
          localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
          setSummary((prev: any) => ({
            ...prev,
            checkinPending: false,
            status: "GOOD",
            statusMessage: "Check-in completado. Estás listo para entrenar.",
          }));
        }
      })
      .catch((err) => console.error("Error checking wellness status:", err));

    // Fetch physio slots & my appointments
    fetch("/api/physio/slots")
      .then((res) => res.json())
      .then((data) => {
        if (data?.slots && Array.isArray(data.slots)) {
          setPhysioSlots(data.slots);
        }
        if (data?.appointments && Array.isArray(data.appointments)) {
          const myApp = data.appointments.find(
            (a: any) => a.player_id === summary.player.id || a.player_name === summary.player.sporting_name
          );
          if (myApp) {
            setMyPhysioAppointment(myApp);
            setPhysioBookedSuccess(true);
            if (myApp.selected_time_slots) {
              setSelectedTimeSlots(myApp.selected_time_slots);
            }
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

    // Check if player has already completed or acknowledged injury history (Show popup ONLY ONCE on first visit ever)
    const isDone = localStorage.getItem("cl_player_injury_history_done");
    const alreadyShownFirstTime = localStorage.getItem("cl_player_injury_reminder_shown");

    if (!isDone && !alreadyShownFirstTime) {
      localStorage.setItem("cl_player_injury_reminder_shown", "true");
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

  const handleCheckinSuccess = (values: WellnessCheckinValues) => {
    setCheckinOpen(false);
    setHasCompletedCheckin(true);
    const todayStr = new Date().toISOString().split("T")[0];
    localStorage.setItem(`cl_player_checkin_done_${todayStr}`, "true");
    // Update metrics with real values from the form
    setSummary((prev: any) => ({
      ...prev,
      checkinPending: false,
      status: values.fatigue >= 3 || values.muscleSoreness >= 3 ? "FATIGADO" : "PREPARADO",
      statusMessage: values.hasDiscomfort
        ? `Check-in completado. Molestia reportada en ${values.discomfortPart || "zona desconocida"}. El fisio ha sido notificado.`
        : values.fatigue >= 3
        ? "Check-in completado. Nivel de fatiga registrado; el preparador ha sido notificado."
        : "Check-in completado. Estás preparado para entrenar.",
      metricsSummary: {
        ...prev.metricsSummary,
        sleepQuality: values.sleepQuality,
        fatigue: values.fatigue,
        hasDiscomfort: values.hasDiscomfort,
        discomfortLocation: values.discomfortPart,
      },
    }));
    // Weight entry is available on main dashboard card for locker room confirmation
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
        onOpenSettings={() => setEditProfileOpen(true)}
      />

      {/* Direct Check-in Action Bar (Always openable for testing & completion) */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">
              {hasCompletedCheckin ? "Check-in de Hoy Realizado" : "Check-in Pre-Entrenamiento"}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              {hasCompletedCheckin ? "Puedes modificar tus datos de sueño y fatiga cuando quieras" : "Registra tu sueño, fatiga y molestia para hoy"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setCheckinOpen(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{hasCompletedCheckin ? "Reabrir Check-in" : "Hacer Check-in"}</span>
        </button>
      </div>

      {/* Locker Room Attendance & Weight Entry Card (Available when checkin is done or anytime) */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">
              {attendanceWeight ? `Presencia Confirmada (${attendanceWeight} kg)` : "Confirmar Presencia en Vestuario"}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              {attendanceWeight
                ? "Has confirmado tu llegada al campo con tu peso de hoy. El cuerpo técnico está notificado."
                : "Al llegar al vestuario / campo, introduce tu peso de hoy para confirmar tu asistencia."}
            </span>
          </div>
        </div>
        <button
          onClick={() => setConfirmAttendanceOpen(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{attendanceWeight ? "Modificar Peso" : "Registrar Peso"}</span>
        </button>
      </div>

      {/* Profile Completion & Medical Antecedents Card */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Tu Perfil de Jugador</span>
          </div>
          <span className="text-[11px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
            {summary.completionPercentage}% completado
          </span>
        </div>
        <ProfileCompletionBar percentage={summary.completionPercentage} missingFields={summary.missingFields} />
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setAddInjuryOpen(true)}
            className="flex-1 py-2 px-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold text-xs rounded-xl border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Histórico Lesional</span>
          </button>
          <button
            onClick={() => setEditProfileOpen(true)}
            className="flex-1 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Editar Mi Perfil</span>
          </button>
        </div>
      </div>

      {/* Today's Training Session or Rest Day Card */}
      {todaySession?.session_type === "rest" || todaySession?.is_rest_day || temporalEval.state === "NO_SESSION" ? (
        <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-card to-card p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs">
                HOY
              </span>
              <div>
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider block">
                  Jornada de Descanso
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Sin sesión programada
                </h3>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              Descanso
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Hoy la plantilla no tiene entrenamiento. Jornada orientada a la recuperación, descanso e hidratación.
          </p>
        </div>
      ) : (
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
                  {todaySession?.title || "Entrenamiento de Plantilla"}
                </h3>
              </div>
            </div>
            <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {todaySession?.start_time ? todaySession.start_time.slice(0, 5) : "19:30"} hs
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-accent/40 p-3 rounded-2xl border border-border/40">
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              {todaySession?.duration_min || 90} min
            </span>
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              {todaySession?.location || "Instalaciones del club"}
            </span>
            {todaySession?.microcycle_day && (
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                {todaySession.microcycle_day} {todaySession?.planned_load ? `• Carga ${todaySession.planned_load}` : ""}
              </span>
            )}
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
      )}

      {/* Routine Assignment Status Banner */}
      {realRoutine ? (
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
      ) : (
        <div className="rounded-2xl border border-border/40 bg-accent/20 p-3 flex items-center gap-2.5 text-xs text-muted-foreground">
          <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>No hay rutinas asignadas actualmente.</span>
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
            <h4 className="text-xs font-bold text-foreground capitalize mt-0.5">
              {physioSlots[0]?.date ? new Date(physioSlots[0].date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Convocatoria Hoy"} • Inicio {physioSlots[0]?.startTime || "18:00"} hs
            </h4>
            <p className="text-[10px] font-medium mt-0.5">
              {myPhysioAppointment?.status === "scheduled" ? (
                <span className="text-emerald-400 font-bold">
                  ✓ Cita confirmada a las {myPhysioAppointment.scheduled_time} hs por el fisioterapeuta
                </span>
              ) : myPhysioAppointment?.status === "pending" || physioBookedSuccess ? (
                <span className="text-amber-400 font-semibold">
                  ⏳ Solicitud enviada ({myPhysioAppointment?.selected_time_slots?.join(", ") || selectedTimeSlots.join(", ")} hs) — Pendiente de confirmación por el fisio
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Elige las franjas de 10 min en las que puedes asistir antes de entrenar.
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setPhysioModalOpen(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
        >
          {myPhysioAppointment ? "Ver mi Cita" : "Apuntarme"}
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
          actionText="Ver Carga Acumulada y Mi Estado"
          onAction={() => router.push("/player/status")}
          type="checkin"
        />
      )}

      {/* Synthetic Resumen Metrics */}
      {temporalEval.state === "NO_SESSION" || todaySession?.session_type === "rest" || todaySession?.is_rest_day ? (
        <div className="rounded-3xl border border-blue-500/30 bg-card p-6 text-center space-y-3 shadow-md">
          <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <Activity className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Jornada de Descanso</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Hoy no hay entrenamientos ni check-in requeridos. Revisa tu carga acumulada y la tendencia de descanso en tu panel de salud.
            </p>
          </div>
          <Link
            href="/player/status"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Activity className="size-4" />
            <span>Ver Carga Acumulada y Tendencias</span>
          </Link>
        </div>
      ) : !hasCompletedCheckin ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center space-y-2 shadow-md">
          <div className="mx-auto size-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <HeartPulse className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Resumen Sintético de Salud</h3>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              Pendiente de Check-in hoy. Las métricas de sueño, fatiga y descanso se activarán automáticamente al registrar tu estado en el panel superior.
            </p>
          </div>
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
        playerId={summary.player.id || ""}
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
        sessionTitle={todaySession?.title ? `${todaySession.title} (${todaySession.start_time?.slice(0, 5) || "19:30"}h)` : "Entrenamiento de Plantilla (19:30h)"}
      />

      <CheckoutRpeModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmitSuccess={handleCheckoutSuccess}
        sessionTitle={todaySession?.title ? `${todaySession.title} (${todaySession.start_time?.slice(0, 5) || "19:30"}h)` : "Entrenamiento de Plantilla (19:30h)"}
      />

      {/* Confirm Attendance Weight Modal */}
      <ConfirmAttendanceWeightModal
        isOpen={confirmAttendanceOpen}
        onClose={() => setConfirmAttendanceOpen(false)}
        onSuccess={(weight) => setAttendanceWeight(weight)}
        initialWeight={attendanceWeight || ""}
        sessionId={todaySession?.id || null}
      />

      {/* Physio Slot & Availability Booking Modal */}
      {physioModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden p-5 space-y-4 mb-16 sm:mb-0 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">🩺</span>
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider block">Cita Fisioterapia</span>
                  <h3 className="text-sm font-bold text-foreground">Consulta de Fisioterapia (Turnos 10 min)</h3>
                </div>
              </div>
              <button onClick={() => setPhysioModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400 uppercase text-[10px]">Indica tu Disponibilidad (Franjas de 10 min)</span>
                  <span className="text-[10px] font-mono text-muted-foreground">18:00h a {todaySession?.start_time?.slice(0, 5) || "19:30"}h</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Selecciona todas las franjas horarias de 10 minutos en las que puedes asistir antes del entrenamiento. El fisioterapeuta confirmará la hora definitiva.
                </p>
              </div>

              {myPhysioAppointment && (
                <div className="p-3 rounded-xl bg-accent/40 border border-border/50 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase text-indigo-400 block">Estado Actual de tu Cita</span>
                  {myPhysioAppointment.status === "scheduled" ? (
                    <p className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Hora asignada: {myPhysioAppointment.scheduled_time} hs
                    </p>
                  ) : (
                    <p className="text-amber-400 font-medium text-[11px]">
                      ⏳ Solicitud pendiente de confirmación por el fisio ({myPhysioAppointment.selected_time_slots?.join(", ") || selectedTimeSlots.join(", ")} hs)
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1.5">
                    Selecciona las franjas que te vienen bien (Multiselección):
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {["18:00", "18:10", "18:20", "18:30", "18:40", "18:50", "19:00", "19:10", "19:20"].map((timeSlot) => {
                      const isSelected = selectedTimeSlots.includes(timeSlot);
                      return (
                        <button
                          key={timeSlot}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTimeSlots(selectedTimeSlots.filter((t) => t !== timeSlot));
                            } else {
                              setSelectedTimeSlots([...selectedTimeSlots, timeSlot]);
                            }
                          }}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-[1.02]"
                              : "bg-card border-border/50 text-foreground hover:bg-accent"
                          }`}
                        >
                          <span>{timeSlot}h</span>
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Motivo o Zona de Molestia</label>
                  <input
                    type="text"
                    placeholder="Ej. Sobrecarga en gemelo o revisión preventiva"
                    value={physioReason}
                    onChange={(e) => setPhysioReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  disabled={submittingAvail || selectedTimeSlots.length === 0}
                  onClick={async () => {
                    setSubmittingAvail(true);
                    try {
                      const res = await fetch("/api/physio/slots", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "request_availability",
                          date: todaySession?.date || new Date().toISOString().split("T")[0],
                          preferredDay,
                          preferredShift,
                          reason: physioReason,
                          selectedTimeSlots,
                          playerId: summary?.player?.id,
                          playerName: summary?.player?.sporting_name || `${summary?.player?.first_name || ""} ${summary?.player?.last_name || ""}`.trim(),
                        }),
                      });
                      const data = await res.json();
                      if (data?.success) {
                        setPhysioBookedSuccess(true);
                        if (data.appointment) {
                          setMyPhysioAppointment(data.appointment);
                        }
                        setPhysioModalOpen(false);
                        alert(data.message || `Disponibilidad enviada (${selectedTimeSlots.length} franjas seleccionadas).`);
                      } else {
                        alert(data?.error || "Error al enviar disponibilidad");
                      }
                    } catch (err: any) {
                      alert("Error de conexión");
                    } finally {
                      setSubmittingAvail(false);
                    }
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingAvail ? "Enviando..." : `Enviar Disponibilidad (${selectedTimeSlots.length} franjas)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Profile Edit Modal */}
      <PlayerProfileEditModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onSaved={() => {
          window.location.reload();
        }}
        onOpenAddInjury={() => setAddInjuryOpen(true)}
      />

      {/* Mobile Glassmorphism Bottom Navigation */}
      <PlayerBottomNav />
    </div>
  );
}

