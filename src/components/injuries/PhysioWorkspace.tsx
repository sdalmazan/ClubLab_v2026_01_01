"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  HeartPulse, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Paperclip, 
  UserCheck, 
  ChevronRight, 
  Sparkles, 
  X, 
  Activity,
  Send,
  MessageSquare,
  History,
  Dumbbell,
  User,
  HelpCircle,
  FilePlus,
  Upload,
  Pencil,
  Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { 
  INJURY_PHASE_LABELS, 
  type InjuryPhase, 
  type ActiveInjuryRecord, 
  type PhysioConsultation, 
  type PhysioAppointment,
  type MedicalReport
} from "@/services/injuries";

interface PhysioWorkspaceProps {
  squadPlayers: any[];
  userRole?: string;
  currentUserId?: string;
}

export interface PhysioSuggestion {
  id: string;
  player_id: string;
  player_name: string;
  suggestion_text: string;
  target_role: "fitness_coach" | "head_coach";
  created_at: string;
}

const INITIAL_INJURIES: ActiveInjuryRecord[] = [];

const INITIAL_CONSULTATION: PhysioConsultation | null = null;

const INITIAL_APPOINTMENTS: PhysioAppointment[] = [];


export function PhysioWorkspace({
  squadPlayers = [],
  userRole = "physio",
  currentUserId = "",
}: PhysioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"appointments" | "rtp_board">("appointments");
  
  // Core state
  const [consultation, setConsultation] = useState<PhysioConsultation | null>(INITIAL_CONSULTATION);
  const [appointments, setAppointments] = useState<PhysioAppointment[]>(INITIAL_APPOINTMENTS);
  const [injuries, setInjuries] = useState<ActiveInjuryRecord[]>(INITIAL_INJURIES);
  const [suggestions, setSuggestions] = useState<PhysioSuggestion[]>([]);

  // Modals state
  const [isOpeningConsultation, setIsOpeningConsultation] = useState(false);
  const [newConsDate, setNewConsDate] = useState(new Date().toISOString().split("T")[0]);
  const [newConsStartTime, setNewConsStartTime] = useState("18:00");
  const [newConsEndTime, setNewConsEndTime] = useState("20:30");
  const [newConsSlotMin, setNewConsSlotMin] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cl_default_physio_slot_min");
      if (saved) return Number(saved);
    }
    return 10;
  });

  // Edit Consultation state
  const [isEditingConsultation, setIsEditingConsultation] = useState(false);
  const [editConsDate, setEditConsDate] = useState("");
  const [editConsStartTime, setEditConsStartTime] = useState("");
  const [editConsEndTime, setEditConsEndTime] = useState("20:30");
  const [editConsSlotMin, setEditConsSlotMin] = useState(10);

  // Direct Injury Creation Modal state
  const [isNewInjuryModalOpen, setIsNewInjuryModalOpen] = useState(false);
  const [newInjuryPlayerId, setNewInjuryPlayerId] = useState("");
  const [newInjuryBodyPart, setNewInjuryBodyPart] = useState("");
  const [newInjurySeverity, setNewInjurySeverity] = useState<"light" | "medium" | "severe">("medium");
  const [newInjuryPhase, setNewInjuryPhase] = useState<InjuryPhase>(1);
  const [newInjuryReturnDate, setNewInjuryReturnDate] = useState("");
  const [newInjuryDescription, setNewInjuryDescription] = useState("");
  const [isSubmittingInjury, setIsSubmittingInjury] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  const filteredSquadPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return squadPlayers;
    const q = playerSearchQuery.toLowerCase().trim();
    return squadPlayers.filter((p: any) => {
      const name = (p.sporting_name || `${p.first_name || ""} ${p.last_name || ""}`).toLowerCase();
      const jersey = String(p.membership?.jersey_number || p.jersey_number || "");
      return name.includes(q) || jersey.includes(q);
    });
  }, [squadPlayers, playerSearchQuery]);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingPlayerId, setBookingPlayerId] = useState("");
  const [bookingReason, setBookingReason] = useState("");

  // "Tratado" Modal
  const [treatingAppointment, setTreatingAppointment] = useState<PhysioAppointment | null>(null);
  const [fitnessOutcome, setFitnessOutcome] = useState<"apto" | "adaptado" | "no_apto">("apto");
  const [wantsFormalInjury, setWantsFormalInjury] = useState<boolean | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<InjuryPhase>(3);
  const [returnDate, setReturnDate] = useState("");
  const [injuryBodyPart, setInjuryBodyPart] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [treatmentStartTime, setTreatmentStartTime] = useState("");
  const [treatmentEndTime, setTreatmentEndTime] = useState("");

  const addMinutesToTime = (timeStr: string | undefined, mins: number) => {
    if (!timeStr) return "18:20";
    const parts = timeStr.split(":").map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return "18:20";
    const date = new Date();
    date.setHours(parts[0], parts[1] + mins, 0, 0);
    const newH = String(date.getHours()).padStart(2, "0");
    const newM = String(date.getMinutes()).padStart(2, "0");
    return `${newH}:${newM}`;
  };

  const handleUpdateEndTime = (appId: string, endTime: string) => {
    setAppointments(prev =>
      prev.map(app => (app.id === appId ? { ...app, end_time: endTime } : app))
    );

    try {
      fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_appointment",
          appointmentId: appId,
          end_time: endTime,
        }),
      });
    } catch (e) {}
  };

  const handleUpdatePlayerDuration = (appId: string, newDurationMin: number) => {
    const targetApp = appointments.find(a => a.id === appId);
    if (!targetApp) return;

    const startTime = targetApp.scheduled_time || "18:00";
    const endTime = addMinutesToTime(startTime, newDurationMin);

    setAppointments(prev =>
      prev.map(app =>
        app.id === appId
          ? { ...app, duration_min: newDurationMin, end_time: endTime }
          : app
      )
    );

    try {
      fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_appointment",
          appointmentId: appId,
          duration_min: newDurationMin,
          end_time: endTime,
        }),
      });
    } catch (e) {}
  };

  // Reports Modal (bound to a specific injury)
  const [reportingInjury, setReportingInjury] = useState<ActiveInjuryRecord | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Player Medical History & Suggestion Modal
  const [historyPlayer, setHistoryPlayer] = useState<any | null>(null);
  const [suggestionText, setSuggestionText] = useState("");
  const [targetStaffRole, setTargetStaffRole] = useState<"fitness_coach" | "head_coach">("fitness_coach");

  useEffect(() => {
    // 1. Fetch Physio Slot
    fetch("/api/physio/slots")
      .then((res) => res.json())
      .then((data) => {
        if (data?.slots && Array.isArray(data.slots) && data.slots.length > 0) {
          const first = data.slots[0];
          setConsultation({
            id: first.id,
            date: first.date,
            start_time: first.startTime,
            slot_duration_min: first.slotMin || 10,
            is_open: true,
          });
        } else {
          setConsultation(null);
        }

        if (data?.appointments && Array.isArray(data.appointments)) {
          setAppointments(data.appointments);
        }
      })
      .catch(() => {});

    // 2. Fetch Active Injuries from /api/injuries API
    fetch("/api/injuries")
      .then((res) => res.json())
      .then((data) => {
        if (data?.injuries && Array.isArray(data.injuries)) {
          setInjuries(data.injuries);
        }
      })
      .catch((err) => console.error("Error fetching injuries:", err));
  }, []);

  // Open new consultation
  const handleOpenConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCons = {
      id: `cons-${Date.now()}`,
      date: newConsDate,
      start_time: newConsStartTime,
      end_time: newConsEndTime,
      slot_duration_min: newConsSlotMin,
      is_open: true,
    };
    setConsultation(newCons);
    setIsOpeningConsultation(false);

    try {
      await fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_consultation",
          date: newConsDate,
          startTime: newConsStartTime,
          endTime: newConsEndTime,
          slotMin: newConsSlotMin,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit Consultation Modal
  const handleOpenEditConsultation = () => {
    if (!consultation) return;
    setEditConsDate(consultation.date || new Date().toISOString().split("T")[0]);
    setEditConsStartTime(consultation.start_time || "18:00");
    setEditConsEndTime(consultation.end_time || "20:30");
    setEditConsSlotMin(consultation.slot_duration_min || 10);
    setIsEditingConsultation(true);
  };

  // Save Edit Consultation
  const handleSaveEditConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedCons = {
      id: consultation?.id || `cons-${Date.now()}`,
      date: editConsDate,
      start_time: editConsStartTime,
      end_time: editConsEndTime,
      slot_duration_min: editConsSlotMin,
      is_open: true,
    };
    setConsultation(updatedCons);
    setIsEditingConsultation(false);

    try {
      await fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_consultation",
          date: editConsDate,
          startTime: editConsStartTime,
          endTime: editConsEndTime,
          slotMin: editConsSlotMin,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Cancel & Delete Open Consultation
  const handleDeleteConsultation = async () => {
    if (!confirm("¿Estás seguro de cancelar y eliminar la consulta de fisioterapia abierta?")) return;
    setConsultation(null);
    setAppointments([]);

    try {
      await fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_consultation" }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Direct Addition of Active Injury (Without requiring a prior consultation)
  const handleCreateDirectInjury = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInjuryPlayerId || !newInjuryBodyPart.trim()) return;

    setIsSubmittingInjury(true);
    const selectedP = squadPlayers.find((p) => p.id === newInjuryPlayerId);
    const pName = selectedP ? (selectedP.sporting_name || `${selectedP.first_name || ""} ${selectedP.last_name || ""}`.trim()) : "Jugador";

    const newInjRecord: ActiveInjuryRecord = {
      id: `inj-${Date.now()}`,
      player_id: newInjuryPlayerId,
      player_name: pName,
      body_part: newInjuryBodyPart.trim(),
      severity: newInjurySeverity,
      status: "active",
      recovery_phase: newInjuryPhase,
      expected_return_date: newInjuryReturnDate || undefined,
      description: newInjuryDescription.trim(),
      reports: [],
      updated_at: new Date().toISOString(),
    };

    setInjuries((prev) => [newInjRecord, ...prev]);

    try {
      await fetch("/api/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: newInjuryPlayerId,
          playerName: pName,
          bodyPart: newInjuryBodyPart.trim(),
          severity: newInjurySeverity,
          recoveryPhase: newInjuryPhase,
          expectedReturnDate: newInjuryReturnDate || null,
          notes: newInjuryDescription.trim() || null,
        }),
      });
    } catch (err) {
      console.error("Error creating injury via API:", err);
    } finally {
      setIsSubmittingInjury(false);
      setIsNewInjuryModalOpen(false);
      setNewInjuryPlayerId("");
      setNewInjuryBodyPart("");
      setNewInjuryReturnDate("");
      setNewInjuryDescription("");
    }
  };

  // Physio manually adds player to appointment list
  const handlePhysioAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingReason || !bookingPlayerId) return;

    const playerObj = squadPlayers.find(p => p.id === bookingPlayerId) || {
      first_name: "Jugador",
      last_name: "Plantilla",
      membership: { jersey_number: 7 }
    };

    const pName = playerObj.sporting_name || `${playerObj.first_name || ""} ${playerObj.last_name || ""}`.trim();
    const pJersey = playerObj.membership?.jersey_number || null;



    const newApp: PhysioAppointment = {
      id: `app-${Date.now()}`,
      consultation_id: consultation?.id || "cons-1",
      player_id: bookingPlayerId,
      player_name: pName,
      jersey_number: pJersey,
      reason: bookingReason,
      status: "pending",
      created_at: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    };

    setAppointments(prev => [...prev, newApp]);
    setIsBookingModalOpen(false);
    setBookingReason("");
    setBookingPlayerId("");

    try {
      fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_appointment",
          playerId: bookingPlayerId,
          playerName: pName,
          jerseyNumber: pJersey,
          reason: bookingReason,
          date: consultation?.date || new Date().toISOString().split("T")[0],
        }),
      });
    } catch (e) {}
  };

  // Time slot assignment
  const handleAssignTimeSlot = (appId: string, time: string) => {
    setAppointments(prev =>
      prev.map(app => (app.id === appId ? { ...app, scheduled_time: time, status: "scheduled" } : app))
    );

    try {
      fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_appointment",
          appointmentId: appId,
          scheduled_time: time,
          status: "scheduled",
        }),
      });
    } catch (e) {}
  };

  // Open "Tratado" Modal
  const handleOpenTreatmentModal = (app: PhysioAppointment) => {
    setTreatingAppointment(app);
    setTreatmentStartTime(app.scheduled_time || "18:00");
    setTreatmentEndTime(app.end_time || (app.scheduled_time ? addMinutesToTime(app.scheduled_time, 20) : "18:20"));
    const existingInj = injuries.find(i => i.player_id === app.player_id);
    if (existingInj) {
      setSelectedPhase(existingInj.recovery_phase);
      setReturnDate(existingInj.expected_return_date || "");
      setInjuryBodyPart(existingInj.body_part);
      setFitnessOutcome(existingInj.recovery_phase === 4 ? "apto" : existingInj.recovery_phase >= 2 ? "adaptado" : "no_apto");
      setWantsFormalInjury(true);
    } else {
      setSelectedPhase(1);
      setFitnessOutcome("apto");
      setWantsFormalInjury(null);
      setReturnDate("");
      setInjuryBodyPart(app.reason);
    }
    setTreatmentNotes("");
  };

  // Confirm Treatment Outcome
  const handleConfirmTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatingAppointment) return;

    setAppointments(prev =>
      prev.map(app =>
        app.id === treatingAppointment.id
          ? {
              ...app,
              status: "treated",
              fitness_result: fitnessOutcome,
              notes: treatmentNotes,
              scheduled_time: treatmentStartTime || app.scheduled_time,
              end_time: treatmentEndTime || app.end_time,
            }
          : app
      )
    );

    try {
      fetch("/api/physio/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_appointment",
          appointmentId: treatingAppointment.id,
          status: "treated",
          fitness_result: fitnessOutcome,
          notes: treatmentNotes,
          scheduled_time: treatmentStartTime || treatingAppointment.scheduled_time,
          end_time: treatmentEndTime || treatingAppointment.end_time,
        }),
      });
    } catch (e) {}

    if (fitnessOutcome === "apto") {
      setInjuries(prev => prev.filter(i => i.player_id !== treatingAppointment.player_id));
    } else if (fitnessOutcome === "adaptado" && wantsFormalInjury === false) {
      setInjuries(prev => prev.filter(i => i.player_id !== treatingAppointment.player_id));
    } else {
      setInjuries(prev => {
        const existingIdx = prev.findIndex(i => i.player_id === treatingAppointment.player_id);
        const newRecord: ActiveInjuryRecord = {
          id: existingIdx >= 0 ? prev[existingIdx].id : `inj-${Date.now()}`,
          player_id: treatingAppointment.player_id,
          player_name: treatingAppointment.player_name,
          body_part: injuryBodyPart || treatingAppointment.reason,
          severity: selectedPhase === 1 ? "severe" : "medium",
          status: fitnessOutcome === "adaptado" ? "readaptation" : "active",
          recovery_phase: selectedPhase,
          expected_return_date: returnDate,
          description: treatmentNotes || treatingAppointment.reason,
          updated_at: new Date().toISOString().split("T")[0],
          reports: existingIdx >= 0 ? prev[existingIdx].reports : []
        };

        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newRecord;
          return updated;
        } else {
          return [...prev, newRecord];
        }
      });
    }

    setTreatingAppointment(null);
  };

  // Advance / Change Phase in RTP Board
  const handleChangeInjuryPhase = async (injuryId: string, newPhase: InjuryPhase) => {
    setInjuries((prev) =>
      prev.map((inj) => {
        if (inj.id === injuryId) {
          return {
            ...inj,
            recovery_phase: newPhase,
            status: newPhase >= 2 ? "readaptation" : "active",
          };
        }
        return inj;
      })
    );

    const targetInj = injuries.find((i) => i.id === injuryId);
    try {
      await fetch("/api/injuries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          injuryId,
          playerId: targetInj?.player_id,
          recoveryPhase: newPhase,
          status: newPhase >= 2 ? "readaptation" : "active",
        }),
      });
    } catch (err) {
      console.error("Error updating injury phase via API:", err);
    }
  };

  // File selection for medical report
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportFileName(file.name);
    }
  };

  // Add Medical Report to specific injury
  const handleAddMedicalReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingInjury || !reportText) return;

    const newReport: MedicalReport = {
      id: `rep-${Date.now()}`,
      injury_id: reportingInjury.id,
      created_at: new Date().toISOString().split("T")[0],
      text_summary: reportText,
      file_name: reportFileName || undefined,
      author_name: "Fisioterapeuta"
    };

    setInjuries(prev =>
      prev.map(inj =>
        inj.id === reportingInjury.id
          ? { ...inj, reports: [newReport, ...inj.reports] }
          : inj
      )
    );

    setReportingInjury(null);
    setReportText("");
    setReportFileName("");
  };

  // Send Exercise Suggestion to Technical Staff
  const handleSendSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyPlayer || !suggestionText) return;

    const newSugg: PhysioSuggestion = {
      id: `sugg-${Date.now()}`,
      player_id: historyPlayer.id,
      player_name: historyPlayer.name,
      suggestion_text: suggestionText,
      target_role: targetStaffRole,
      created_at: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    };

    setSuggestions(prev => [newSugg, ...prev]);
    setSuggestionText("");
    alert(`Sugerencia enviada correctamente al ${targetStaffRole === "fitness_coach" ? "Preparador Físico" : "Entrenador"}.`);
  };

  // Time Slots helper
  const timeSlots = useMemo(() => {
    if (!consultation) return [];
    const slots: string[] = [];
    const [startHour, startMin] = consultation.start_time.split(":").map(Number);
    let currentMinutes = startHour * 60 + startMin;

    for (let i = 0; i < 12; i++) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      currentMinutes += consultation.slot_duration_min;
    }
    return slots;
  }, [consultation]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ── PAGE HEADER ── */}
      <PageHeader
        title="Enfermería"
        description="Panel del fisioterapeuta: consultas de fisio, asignación de dictámenes y sincronización de fases RTP con el Preparador Físico"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsNewInjuryModalOpen(true)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <HeartPulse className="size-4 mr-1.5 text-rose-400" />
            + Registrar Lesión Activa
          </button>
          <button
            type="button"
            onClick={() => setIsOpeningConsultation(true)}
            className={buttonVariants({ size: "sm" })}
          >
            <Clock className="size-4 mr-1.5" />
            Abrir Consulta Fisio
          </button>
        </div>
      </PageHeader>

      {/* ── QUICK SUMMARY BAR OF ACTIVE INJURIES (AT-A-GLANCE) ── */}
      {/* ── QUICK SUMMARY BAR OF ACTIVE INJURIES (AT-A-GLANCE) ── */}
      <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 space-y-3 text-white shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-4 text-rose-400/90" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Lesiones Activas & Fases RTP ({injuries.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Sincronizado con Preparador Físico</span>
        </div>

        {injuries.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No hay bajas médicas ni lesiones activas en la plantilla.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {injuries.map(inj => {
              const phaseInfo = INJURY_PHASE_LABELS[inj.recovery_phase];
              return (
                <div
                  key={inj.id}
                  className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.07] hover:border-white/20 min-w-[240px] text-left transition-all group shrink-0 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <button
                        type="button"
                        onClick={() => setHistoryPlayer({ id: inj.player_id, name: inj.player_name })}
                        className="text-xs font-bold text-white hover:text-slate-300 transition-colors text-left"
                      >
                        {inj.player_name}
                      </button>
                      <span className="text-[11px] text-rose-400 font-medium truncate block mt-0.5">
                        {inj.body_part}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReportingInjury(inj)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0 transition-all"
                      title="Adjuntar informe médico"
                    >
                      <FilePlus className="size-3" />
                      <span>+ Informe</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded uppercase border-0", phaseInfo.badge)}>
                      Fase {inj.recovery_phase}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      RTP: {inj.expected_return_date || "Pendiente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PHYSIO NAVIGATION TABS (MINIMALIST OBSIDIAN SWITCHER) ── */}
      <div className="flex bg-slate-950 border border-white/[0.08] rounded-2xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          className={cn(
            "flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "appointments"
              ? "bg-slate-800 text-white shadow-md border border-white/10"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Clock className="size-3.5" />
          <span>Consulta y Citas del Día ({appointments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rtp_board")}
          className={cn(
            "flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "rtp_board"
              ? "bg-slate-800 text-white shadow-md border border-white/10"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <HeartPulse className="size-3.5 text-slate-400" />
          <span>Pipeline Lesiones (RTP 4 Fases) ({injuries.length})</span>
        </button>
      </div>

      {/* ── TAB 1: CONSULTA Y CITAS DEL FISIOTERAPEUTA ── */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          {/* Active Consultation Banner */}
          {consultation ? (
            <div className="bg-slate-900 rounded-lg border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold">
                    Consulta Abierta Hoy ({consultation.date})
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Disponibilidad total: <strong className="text-emerald-400 font-mono font-bold">{consultation.start_time} hs a {consultation.end_time || "20:30"} hs</strong> • Duración por defecto por jugador: <strong className="text-white">{consultation.slot_duration_min || 10} min</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (timeSlots.length === 0) return;
                    let assignedIndex = 0;
                    setAppointments(prev =>
                      prev.map((app) => {
                        if (app.status === "treated") return app;
                        const proposedTime = timeSlots[assignedIndex % timeSlots.length] || "08:30";
                        assignedIndex++;
                        return {
                          ...app,
                          scheduled_time: app.scheduled_time || proposedTime,
                          status: app.status === "pending" ? "scheduled" : app.status,
                        };
                      })
                    );
                  }}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Calendar className="size-3.5 mr-1 text-sky-400" />
                  Auto-Asignar Horas
                </button>
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <UserPlus className="size-3.5 mr-1" />
                  + Añadir Cita
                </button>
                <button
                  type="button"
                  onClick={handleOpenEditConsultation}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil className="size-3.5 mr-1 text-emerald-400" />
                  Editar Consulta
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConsultation}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancelar Consulta
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg border border-dashed border-white/20 p-8 text-center space-y-3">
              <Clock className="size-8 text-slate-500 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">No hay consulta médica abierta hoy</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Abre la consulta de fisioterapia definiendo la hora de inicio, hora de fin y la duración por franja para que los jugadores puedan solicitar asistencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpeningConsultation(true)}
                className={buttonVariants({ size: "sm" })}
              >
                + Abrir Consulta de Fisioterapia
              </button>
            </div>
          )}

          {/* List of Today's Physio Appointments */}
          <div className="bg-slate-900 rounded-lg border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="size-4 text-emerald-400" />
                Citas de Fisioterapia para Hoy ({appointments.length})
              </h3>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-400 italic">No hay futbolistas apuntados a la consulta por el momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {appointments.map((app) => {
                  const isTreated = app.status === "treated";

                  return (
                    <div
                      key={app.id}
                      className={cn(
                        "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                        isTreated ? "bg-white/[0.01] opacity-70" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {app.jersey_number != null && (
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              #{app.jersey_number}
                            </span>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => setHistoryPlayer({ id: app.player_id, name: app.player_name })}
                            className="text-sm font-bold text-white hover:text-primary transition-colors text-left"
                            title="Ver histórico de lesiones y enviar sugerencia al preparador"
                          >
                            {app.player_name}
                          </button>
                          
                          {isTreated ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Tratado ({app.fitness_result === "apto" ? "Apto" : app.fitness_result === "adaptado" ? "Adaptado" : "No Apto"})
                            </span>
                          ) : app.scheduled_time ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                                <Clock className="size-3" /> {app.scheduled_time} - {app.end_time || addMinutesToTime(app.scheduled_time, app.duration_min || 10)}
                              </span>

                              {/* Modificar duración de tratamiento de este jugador (por defecto 10 min) */}
                              <div className="flex items-center gap-1.5 text-[10px] bg-slate-950 px-2.5 py-1 rounded-xl border border-white/10">
                                <span className="text-slate-400 font-semibold">Tratamiento:</span>
                                <span className="text-white font-mono font-extrabold">{app.duration_min || 10} min</span>
                                <div className="flex items-center gap-1 ml-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePlayerDuration(app.id, Math.max(5, (app.duration_min || 10) - 5))}
                                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[9px] transition-colors cursor-pointer"
                                    title="Disminuir 5 min"
                                  >
                                    -5m
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePlayerDuration(app.id, (app.duration_min || 10) + 5)}
                                    className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-bold text-[9px] transition-colors cursor-pointer"
                                    title="Aumentar 5 min (ampliar tratamiento)"
                                  >
                                    +5m
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePlayerDuration(app.id, (app.duration_min || 10) + 15)}
                                    className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-bold text-[9px] transition-colors cursor-pointer"
                                    title="Aumentar 15 min (extensión lesionados)"
                                  >
                                    +15m
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pendiente Hora
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed italic bg-white/5 p-2 rounded border border-white/5">
                          "{app.reason}"
                        </p>

                        {app.selected_time_slots && app.selected_time_slots.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 w-fit">
                            <span>🎯 Franjas solicitadas por el jugador:</span>
                            <span className="font-mono font-bold text-white">
                              {app.selected_time_slots.map((t) => `${t}h`).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {!isTreated && (
                          <select
                            value={app.scheduled_time || ""}
                            onChange={(e) => handleAssignTimeSlot(app.id, e.target.value)}
                            className="text-xs rounded-md bg-slate-950 border border-white/10 px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                          >
                            <option value="">-- Asignar Hora --</option>
                            {timeSlots.map((slot) => {
                              const isRequested = app.selected_time_slots?.includes(slot);
                              return (
                                <option key={slot} value={slot}>
                                  {slot}h {isRequested ? "★ (Solicitada por jugador)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenTreatmentModal(app)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow",
                            isTreated
                              ? "bg-white/10 text-slate-300 hover:text-white border border-white/10"
                              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95"
                          )}
                        >
                          <CheckCircle2 className="size-4" />
                          <span>{isTreated ? "Revisar Dictamen" : "TRATADO"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: PIPELINE DE READAPTACIÓN (RTP BOARD EN 4 FASES) ── */}
      {activeTab === "rtp_board" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {([1, 2, 3, 4] as InjuryPhase[]).map((phaseNum) => {
              const phaseConfig = INJURY_PHASE_LABELS[phaseNum];
              const phaseInjuries = injuries.filter(i => i.recovery_phase === phaseNum);

              return (
                <div key={phaseNum} className="bg-slate-900 rounded-lg border border-white/10 p-4 flex flex-col gap-3 text-white">
                  <div className="pb-2 border-b border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold border", phaseConfig.badge)}>
                        Fase {phaseNum}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{phaseInjuries.length}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{phaseConfig.name}</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">{phaseConfig.desc}</p>
                    
                    <div className="pt-1 text-[9.5px] text-emerald-400/90 font-medium">
                      <span>⚡ Prep. Físico: <strong>{phaseConfig.fitnessState}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-3 flex-1">
                    {phaseInjuries.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-4 text-center">Sin jugadores en esta fase</p>
                    ) : (
                      phaseInjuries.map(inj => (
                        <div key={inj.id} className="p-3.5 rounded-lg border border-white/10 bg-white/3 space-y-3">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <button
                                type="button"
                                onClick={() => setHistoryPlayer({ id: inj.player_id, name: inj.player_name })}
                                className="text-xs font-bold text-white hover:text-primary transition-colors text-left"
                              >
                                {inj.player_name}
                              </button>
                              <span className="text-[11px] text-destructive font-semibold block">{inj.body_part}</span>
                            </div>

                            {/* Button to attach medical report directly to this injury */}
                            <button
                              type="button"
                              onClick={() => setReportingInjury(inj)}
                              className="px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0"
                              title="Adjuntar informe médico (PDF / Imagen / Texto) a esta lesión"
                            >
                              <FilePlus className="size-3" />
                              <span>+ Informe</span>
                            </button>
                          </div>

                          {inj.expected_return_date && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Calendar className="size-3 text-emerald-400" />
                              <span>Retorno est.: <strong>{inj.expected_return_date}</strong></span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                            {phaseNum > 1 ? (
                              <button
                                type="button"
                                onClick={() => handleChangeInjuryPhase(inj.id, (phaseNum - 1) as InjuryPhase)}
                                className="text-slate-400 hover:text-white font-medium"
                              >
                                ← Fase {phaseNum - 1}
                              </button>
                            ) : <span />}

                            <span className="text-slate-400 text-[9.5px]">
                              {inj.reports.length} informe{inj.reports.length === 1 ? "" : "s"}
                            </span>

                            {phaseNum < 4 && (
                              <button
                                type="button"
                                onClick={() => handleChangeInjuryPhase(inj.id, (phaseNum + 1) as InjuryPhase)}
                                className="text-emerald-400 hover:text-emerald-300 font-bold"
                              >
                                Fase {phaseNum + 1} →
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: ABRIR CONSULTA (FISIO) ── */}
      {isOpeningConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Abrir Consulta de Fisioterapia
              </h3>
              <button type="button" onClick={() => setIsOpeningConsultation(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleOpenConsultation} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-white block mb-1">Fecha de la consulta:</label>
                <input
                  type="date"
                  value={newConsDate}
                  onChange={(e) => setNewConsDate(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-white block mb-1">Hora de inicio:</label>
                  <input
                    type="time"
                    value={newConsStartTime}
                    onChange={(e) => setNewConsStartTime(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-white block mb-1">Hora de fin (Consulta total):</label>
                  <input
                    type="time"
                    value={newConsEndTime}
                    onChange={(e) => setNewConsEndTime(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Duración por franja (minutos):</label>
                <select
                  value={newConsSlotMin}
                  onChange={(e) => setNewConsSlotMin(Number(e.target.value))}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={10}>10 minutos (Estándar recomendado)</option>
                  <option value={5}>5 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                  <option value={30}>30 minutos</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setIsOpeningConsultation(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cancelar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Confirmar y Abrir Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: APUNTAR JUGADOR MANUALMENTE (FISIO) ── */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                Apuntar Jugador a Consulta
              </h3>
              <button type="button" onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handlePhysioAddAppointment} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-white block mb-1">Seleccionar Jugador:</label>
                <select
                  value={bookingPlayerId}
                  onChange={(e) => setBookingPlayerId(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Seleccionar Jugador --</option>
                  {squadPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} {p.membership?.jersey_number ? `(#${p.membership.jersey_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Motivo de la consulta:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sobrecarga isquiotibiales"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cancelar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Añadir Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DICTAMEN DE TRATAMIENTO ("TRATADO") ── */}
      {treatingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-slate-900/95 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-white max-h-[92vh] overflow-y-auto backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <HeartPulse className="size-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                    Dictamen de Tratamiento
                  </span>
                  <h3 className="text-base font-extrabold text-white">
                    {treatingAppointment.player_name}
                  </h3>
                  {treatingAppointment.reason && (
                    <span className="text-[11px] text-slate-400 block mt-0.5 italic">
                      Motivo: "{treatingAppointment.reason}"
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTreatingAppointment(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTreatment} className="space-y-6 text-xs">
              {/* Horario de Atención y Extensión para Lesionados */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="size-3.5" /> Horario de Atención & Extensión de Sesión
                  </label>
                  <span className="text-[9px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Ajuste libre para fisio
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Hora Inicio</span>
                    <input
                      type="time"
                      value={treatmentStartTime}
                      onChange={(e) => setTreatmentStartTime(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Hora Finalización</span>
                    <div className="flex gap-1.5">
                      <input
                        type="time"
                        value={treatmentEndTime}
                        onChange={(e) => setTreatmentEndTime(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setTreatmentEndTime(addMinutesToTime(treatmentEndTime || treatmentStartTime, 15))}
                        className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-xl transition-all shrink-0 cursor-pointer"
                        title="Añadir 15 min de extensión"
                      >
                        +15m
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreatmentEndTime(addMinutesToTime(treatmentEndTime || treatmentStartTime, 30))}
                        className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-xl transition-all shrink-0 cursor-pointer"
                        title="Añadir 30 min de extensión"
                      >
                        +30m
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Dictamen de Aptitud (3 Minimalist Glow Cards) */}
              <div className="space-y-2.5">
                <label className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px] block">
                  1. Dictamen de Aptitud del Futbolista:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* APTO */}
                  <button
                    type="button"
                    onClick={() => {
                      setFitnessOutcome("apto");
                      setWantsFormalInjury(null);
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold flex flex-col items-center justify-between gap-2 shadow-sm",
                      fitnessOutcome === "apto"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/40 scale-[1.02]"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", fitnessOutcome === "apto" ? "bg-emerald-500 text-slate-950" : "bg-emerald-500/10 text-emerald-400")}>
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div>
                      <span className="block font-black text-xs text-white">APTO</span>
                      <span className="text-[9px] font-normal text-slate-400 block">Disponible 100%</span>
                    </div>
                  </button>

                  {/* ADAPTADO */}
                  <button
                    type="button"
                    onClick={() => setFitnessOutcome("adaptado")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold flex flex-col items-center justify-between gap-2 shadow-sm",
                      fitnessOutcome === "adaptado"
                        ? "bg-amber-500/20 text-amber-300 border-amber-400 ring-2 ring-amber-500/40 scale-[1.02]"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", fitnessOutcome === "adaptado" ? "bg-amber-500 text-slate-950" : "bg-amber-500/10 text-amber-400")}>
                      <Activity className="size-4" />
                    </div>
                    <div>
                      <span className="block font-black text-xs text-white">ADAPTADO</span>
                      <span className="text-[9px] font-normal text-slate-400 block">Cargas parciales</span>
                    </div>
                  </button>

                  {/* NO APTO */}
                  <button
                    type="button"
                    onClick={() => {
                      setFitnessOutcome("no_apto");
                      setWantsFormalInjury(true);
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold flex flex-col items-center justify-between gap-2 shadow-sm",
                      fitnessOutcome === "no_apto"
                        ? "bg-rose-500/20 text-rose-300 border-rose-400 ring-2 ring-rose-500/40 scale-[1.02]"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", fitnessOutcome === "no_apto" ? "bg-rose-500 text-white" : "bg-rose-500/10 text-rose-400")}>
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <span className="block font-black text-xs text-white">NO APTO</span>
                      <span className="text-[9px] font-normal text-slate-400 block">Baja / Reposo</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-pregunta para ADAPTADO */}
              {fitnessOutcome === "adaptado" && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 animate-in fade-in duration-200">
                  <span className="font-bold text-amber-300 flex items-center gap-2 text-xs">
                    <HelpCircle className="size-4 shrink-0 text-amber-400" />
                    ¿Deseas registrar una lesión médica formal para seguimiento RTP?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWantsFormalInjury(true)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                        wantsFormalInjury === true
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                          : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                      )}
                    >
                      Sí, añadir RTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantsFormalInjury(false)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                        wantsFormalInjury === false
                          ? "bg-slate-800 text-white border-white/20 shadow-md"
                          : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                      )}
                    >
                      No, sólo aviso
                    </button>
                  </div>
                </div>
              )}

              {/* Panel de Lesión y Fases RTP */}
              {(fitnessOutcome === "no_apto" || (fitnessOutcome === "adaptado" && wantsFormalInjury === true)) && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4 shadow-inner animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                    <HeartPulse className="size-4 text-rose-400 shrink-0" />
                    <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                      Diagnóstico y Evolución de Lesión (RTP)
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block text-[11px]">Diagnóstico / Zona Afectada:</label>
                    <input
                      type="text"
                      required
                      value={injuryBodyPart}
                      onChange={(e) => setInjuryBodyPart(e.target.value)}
                      placeholder="Ej. Sobrecarga en gemelo interno derecho"
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block text-[11px]">Fase de Evolución (1 al 4):</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([1, 2, 3, 4] as InjuryPhase[]).map((pNum) => (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setSelectedPhase(pNum)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-between gap-1",
                            selectedPhase === pNum
                              ? "bg-indigo-600 text-white border-indigo-400 font-bold shadow-md scale-[1.01]"
                              : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                          )}
                        >
                          <span>Fase {pNum}: {INJURY_PHASE_LABELS[pNum].name.split(":")[1]}</span>
                          {selectedPhase === pNum && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block text-[11px]">Fecha Prevista de Vuelta (RTP):</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Observaciones y Tratamiento Realizado */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block text-[11px]">Observaciones / Tratamiento realizado:</label>
                <textarea
                  rows={3}
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  placeholder="Tratamiento de descarga, terapia manual, ultrasonidos o sensaciones del futbolista..."
                  className="w-full rounded-2xl bg-slate-950/80 border border-white/15 p-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTreatingAppointment(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Guardar Dictamen</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MENÚ DE LESIÓN E INFORMES CLÍNICOS (FISIO MOBILE) ── */}
      {reportingInjury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <FileText className="size-4 text-emerald-400" />
                  Menú de Lesión: {reportingInjury.player_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-destructive font-bold">{reportingInjury.body_part}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    Fase {reportingInjury.recovery_phase}
                  </span>
                  {reportingInjury.expected_return_date && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      RTP: {reportingInjury.expected_return_date}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setReportingInjury(null)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Informes Asignados a esta Lesión ({reportingInjury.reports.length})</span>
              {reportingInjury.reports.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin informes médicos cargados para esta lesión.</p>
              ) : (
                reportingInjury.reports.map(rep => (
                  <div key={rep.id} className="p-3 rounded bg-white/5 border border-white/10 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{rep.author_name || "Médico"}</span>
                      <span className="text-[10px] text-slate-400">{rep.created_at}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{rep.text_summary}</p>
                    {rep.file_name && (
                      <div className="text-[11px] text-primary flex items-center gap-1 pt-1 font-semibold">
                        <Paperclip className="size-3" /> {rep.file_name}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddMedicalReport} className="space-y-3 text-xs pt-3 border-t border-white/10">
              <span className="font-bold text-white block">+ Adjuntar Nuevo Informe Clínico (PDF / Imagen / Texto):</span>
              
              <textarea
                required
                rows={3}
                placeholder="Resumen del informe médico, resonancia, ecografía o evolución..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full rounded-md bg-slate-950 border border-white/10 p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="space-y-1.5">
                <label className="font-semibold text-white block">Adjuntar Archivo (PDF, Ecografía, Resonancia):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="size-3.5 text-primary" />
                    <span>{reportFileName ? "Cambiar Archivo" : "Seleccionar Archivo PDF/Imagen"}</span>
                  </button>
                  {reportFileName && (
                    <span className="text-xs text-emerald-400 font-mono truncate max-w-[200px]">
                      {reportFileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setReportingInjury(null)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cerrar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Guardar y Adjuntar Informe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HISTÓRICO DEL JUGADOR & ENVIAR SUGERENCIA AL CUERPO TÉCNICO ── */}
      {historyPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <User className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-extrabold text-white">{historyPlayer.name}</h3>
                  <span className="text-xs text-slate-400">Ficha de Fisioterapia & Histórico Clínico</span>
                </div>
              </div>
              <button type="button" onClick={() => setHistoryPlayer(null)} className="text-slate-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="size-4 text-emerald-400" /> Histórico de Lesiones & Partes
              </h4>

              {injuries.filter(i => i.player_id === historyPlayer.id).length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-white/5 p-3 rounded-lg border border-white/10">
                  Sin lesiones activas registradas para este futbolista.
                </p>
              ) : (
                injuries.filter(i => i.player_id === historyPlayer.id).map(inj => (
                  <div key={inj.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-destructive text-sm">{inj.body_part}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Fase {inj.recovery_phase}
                      </span>
                    </div>
                    <p className="text-slate-300">{inj.description}</p>
                    {inj.expected_return_date && (
                      <span className="text-[10px] text-emerald-400 block font-mono">
                        Fecha Prevista Vuelta: {inj.expected_return_date}
                      </span>
                    )}

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {inj.reports.length} informe{inj.reports.length === 1 ? "" : "s"} registrados
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPlayer(null);
                          setReportingInjury(inj);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                      >
                        <FilePlus className="size-3.5" />
                        <span>+ Añadir Informe Clínico</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendSuggestion} className="space-y-3 pt-4 border-t border-white/10 text-xs">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Dumbbell className="size-4 text-indigo-400" />
                Enviar Sugerencia de Ejercicios / Carga al Cuerpo Técnico
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Envía sugerencias de trabajo preventivo o adaptación de carga directamente al preparador físico o al entrenador.
              </p>

              <div>
                <label className="font-semibold text-white block mb-1">Destinatario:</label>
                <select
                  value={targetStaffRole}
                  onChange={(e) => setTargetStaffRole(e.target.value as any)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="fitness_coach">Preparador Físico (Recomendado)</option>
                  <option value="head_coach">Entrenador Principal</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Sugerencia de Ejercicio / Adaptación:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. Realizar 3x10 rep. de excéntricos de isquiotibiales en gimnasio antes de salir al césped..."
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setHistoryPlayer(null)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cerrar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  <Send className="size-3.5 mr-1" /> Enviar Sugerencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR CONSULTA ABIERTA (FISIO) ── */}
      {isEditingConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="size-4 text-emerald-400" />
                Editar Consulta de Fisioterapia Abierta
              </h3>
              <button type="button" onClick={() => setIsEditingConsultation(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditConsultation} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-white block mb-1">Fecha de la consulta:</label>
                <input
                  type="date"
                  value={editConsDate}
                  onChange={(e) => setEditConsDate(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-white block mb-1">Hora de inicio:</label>
                  <input
                    type="time"
                    value={editConsStartTime}
                    onChange={(e) => setEditConsStartTime(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-white block mb-1">Hora de fin (Consulta total):</label>
                  <input
                    type="time"
                    value={editConsEndTime}
                    onChange={(e) => setEditConsEndTime(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Duración por franja (minutos):</label>
                <select
                  value={editConsSlotMin}
                  onChange={(e) => setEditConsSlotMin(Number(e.target.value))}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value={10}>10 minutos (Estándar recomendado)</option>
                  <option value={5}>5 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                  <option value={30}>30 minutos</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setIsEditingConsultation(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cancelar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR NUEVA LESIÓN ACTIVA DIRECTA ── */}
      {isNewInjuryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HeartPulse className="size-4 text-destructive" />
                Registrar Nueva Lesión Activa en Plantilla
              </h3>
              <button type="button" onClick={() => setIsNewInjuryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectInjury} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-white block mb-1">Futbolista Afectado *</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar por nombre o dorsal..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <select
                    required
                    value={newInjuryPlayerId}
                    onChange={(e) => setNewInjuryPlayerId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">
                      {filteredSquadPlayers.length === 0
                        ? "No se encontraron jugadores"
                        : `Seleccionar jugador (${filteredSquadPlayers.length} en plantilla)...`}
                    </option>
                    {filteredSquadPlayers.map((p) => {
                      const jersey = p.membership?.jersey_number || p.jersey_number;
                      const displayName = p.sporting_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
                      return (
                        <option key={p.id} value={p.id}>
                          {displayName} {jersey ? `#${jersey}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Diagnóstico / Zona del Cuerpo Afectada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sobrecarga en isquiotibiales, Esguince tobillo derecho..."
                  value={newInjuryBodyPart}
                  onChange={(e) => setNewInjuryBodyPart(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-white block mb-1">Gravedad de la Lesión</label>
                  <select
                    value={newInjurySeverity}
                    onChange={(e) => setNewInjurySeverity(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="light">Leve (Molestia / &lt; 1 semana)</option>
                    <option value="medium">Media (Baja parcial / 1-3 semanas)</option>
                    <option value="severe">Grave (Baja prolongada / &gt; 3 semanas)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-white block mb-1">Fase Inicial RTP</label>
                  <select
                    value={newInjuryPhase}
                    onChange={(e) => setNewInjuryPhase(Number(e.target.value) as InjuryPhase)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value={1}>Fase 1: Fisioterapia / Reposo</option>
                    <option value={2}>Fase 2: Readaptación Campo (Césped)</option>
                    <option value={3}>Fase 3: Integración Parcial (Sin contacto)</option>
                    <option value={4}>Fase 4: Alta Competitiva</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Fecha Prevista de Alta / Retorno</label>
                <input
                  type="date"
                  value={newInjuryReturnDate}
                  onChange={(e) => setNewInjuryReturnDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Notas u Observaciones Médicas Iniciales</label>
                <textarea
                  rows={3}
                  placeholder="Detalles sobre el mecanismo de la lesión, indicación de reposo, pruebas a realizar..."
                  value={newInjuryDescription}
                  onChange={(e) => setNewInjuryDescription(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setIsNewInjuryModalOpen(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingInjury} className={buttonVariants({ size: "sm" })}>
                  {isSubmittingInjury ? "Guardando..." : "Registrar Lesión en Enfermería"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
