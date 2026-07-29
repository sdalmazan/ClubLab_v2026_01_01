"use client";

import { useState, useMemo, useRef } from "react";
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
  Upload
} from "lucide-react";
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
  const [newConsStartTime, setNewConsStartTime] = useState("16:00");
  const [newConsSlotMin, setNewConsSlotMin] = useState(15);

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

  // Reports Modal (bound to a specific injury)
  const [reportingInjury, setReportingInjury] = useState<ActiveInjuryRecord | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Player Medical History & Suggestion Modal
  const [historyPlayer, setHistoryPlayer] = useState<any | null>(null);
  const [suggestionText, setSuggestionText] = useState("");
  const [targetStaffRole, setTargetStaffRole] = useState<"fitness_coach" | "head_coach">("fitness_coach");

  // Open new consultation
  const handleOpenConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    setConsultation({
      id: `cons-${Date.now()}`,
      date: newConsDate,
      start_time: newConsStartTime,
      slot_duration_min: newConsSlotMin,
      is_open: true,
    });
    setIsOpeningConsultation(false);
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

    const newApp: PhysioAppointment = {
      id: `app-${Date.now()}`,
      consultation_id: consultation?.id || "cons-1",
      player_id: bookingPlayerId,
      player_name: `${playerObj.first_name} ${playerObj.last_name}`,
      jersey_number: playerObj.membership?.jersey_number,
      reason: bookingReason,
      status: "pending",
      created_at: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    };

    setAppointments(prev => [...prev, newApp]);
    setIsBookingModalOpen(false);
    setBookingReason("");
    setBookingPlayerId("");
  };

  // Time slot assignment
  const handleAssignTimeSlot = (appId: string, time: string) => {
    setAppointments(prev =>
      prev.map(app => (app.id === appId ? { ...app, scheduled_time: time, status: "scheduled" } : app))
    );
  };

  // Open "Tratado" Modal
  const handleOpenTreatmentModal = (app: PhysioAppointment) => {
    setTreatingAppointment(app);
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
          ? { ...app, status: "treated", fitness_result: fitnessOutcome, notes: treatmentNotes }
          : app
      )
    );

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
  const handleChangeInjuryPhase = (injuryId: string, newPhase: InjuryPhase) => {
    setInjuries(prev =>
      prev.map(inj => {
        if (inj.id === injuryId) {
          return {
            ...inj,
            recovery_phase: newPhase,
            status: newPhase >= 2 ? "readaptation" : "active"
          };
        }
        return inj;
      })
    );
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
            onClick={() => setIsOpeningConsultation(true)}
            className={buttonVariants({ size: "sm" })}
          >
            <Clock className="size-4 mr-1.5" />
            Abrir Consulta Fisio
          </button>
        </div>
      </PageHeader>

      {/* ── QUICK SUMMARY BAR OF ACTIVE INJURIES (AT-A-GLANCE) ── */}
      <div className="bg-slate-900 border border-white/10 rounded-xl p-4 space-y-3 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-4 text-destructive" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
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
                  className="flex flex-col justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 min-w-[240px] text-left transition-all group shrink-0 space-y-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <button
                        type="button"
                        onClick={() => setHistoryPlayer({ id: inj.player_id, name: inj.player_name })}
                        className="text-xs font-bold text-white hover:text-primary transition-colors text-left"
                      >
                        {inj.player_name}
                      </button>
                      <span className="text-[11px] text-destructive font-semibold truncate block">
                        {inj.body_part}
                      </span>
                    </div>

                    {/* Prominent Button to Attach Medical Report to THIS Injury */}
                    <button
                      type="button"
                      onClick={() => setReportingInjury(inj)}
                      className="px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0"
                      title="Adjuntar informe médico en PDF/Imagen/Texto a esta lesión"
                    >
                      <FilePlus className="size-3" />
                      <span>+ Informe</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded border uppercase", phaseInfo.badge)}>
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

      {/* ── PHYSIO NAVIGATION TABS (STRICTLY 2 TABS FOR PHYSIO) ── */}
      <div className="flex bg-slate-900 border border-white/10 rounded-lg p-1 gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          className={cn(
            "flex-1 min-w-[160px] rounded-md px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "appointments"
              ? "bg-primary text-primary-foreground shadow"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Clock className="size-4" />
          <span>Consulta y Citas del Día ({appointments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rtp_board")}
          className={cn(
            "flex-1 min-w-[160px] rounded-md px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === "rtp_board"
              ? "bg-primary text-primary-foreground shadow"
              : "text-slate-400 hover:text-white"
          )}
        >
          <HeartPulse className="size-4 text-destructive" />
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
                  Inicio a las <strong className="text-white">{consultation.start_time}</strong> • Franjas de {consultation.slot_duration_min} min por jugador
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
                  className={buttonVariants({ variant: "secondary", size: "xs" })}
                >
                  <Sparkles className="size-3.5 mr-1 text-amber-400" />
                  Calcular Propuesta de Horas
                </button>
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className={buttonVariants({ variant: "outline", size: "xs" })}
                >
                  <Plus className="size-3.5 mr-1" /> Apuntar Jugador
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg border border-dashed border-white/10 p-6 text-center space-y-3 text-white">
              <Clock className="size-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-xs font-semibold">No hay consulta de fisioterapia abierta hoy.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Abre consulta fijando la hora de inicio para que los futbolistas elijan sus franjas de 15 min.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpeningConsultation(true)}
                className={buttonVariants({ size: "sm" })}
              >
                Abrir Consulta Ahora
              </button>
            </div>
          )}

          {/* List of Player Appointments */}
          <div className="bg-slate-900 rounded-lg border border-white/10 overflow-hidden text-white">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Solicitudes y Citas de Fisioterapia ({appointments.length})
              </h3>
              <span className="text-[11px] text-slate-400">El programa propone las horas y el fisio confirma la asignación final</span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay citas ni solicitudes pendientes de jugadores.
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
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                              <Clock className="size-3" /> {app.scheduled_time}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pendiente Hora
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed italic bg-white/5 p-2 rounded border border-white/5">
                          "{app.reason}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {!isTreated && (
                          <select
                            value={app.scheduled_time || ""}
                            onChange={(e) => handleAssignTimeSlot(app.id, e.target.value)}
                            className="text-xs rounded-md bg-slate-950 border border-white/10 px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">-- Hora --</option>
                            {timeSlots.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
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

              <div>
                <label className="font-semibold text-white block mb-1">Hora de inicio:</label>
                <input
                  type="time"
                  value={newConsStartTime}
                  onChange={(e) => setNewConsStartTime(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-semibold text-white block mb-1">Duración por franja (minutos):</label>
                <select
                  value={newConsSlotMin}
                  onChange={(e) => setNewConsSlotMin(Number(e.target.value))}
                  className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={15}>15 minutos (Estándar)</option>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Dictamen de Tratamiento: {treatingAppointment.player_name}
                </h3>
                <p className="text-xs text-slate-400">Motivo: "{treatingAppointment.reason}"</p>
              </div>
              <button type="button" onClick={() => setTreatingAppointment(null)} className="text-slate-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTreatment} className="space-y-5 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-white block">1. Dictamen de Aptitud del Futbolista:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFitnessOutcome("apto");
                      setWantsFormalInjury(null);
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all cursor-pointer font-bold flex flex-col items-center gap-1.5",
                      fitnessOutcome === "apto"
                        ? "bg-emerald-500 text-slate-950 border-emerald-400 ring-2 ring-emerald-500/40"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    <CheckCircle2 className="size-5" />
                    <span>🟩 APTO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitnessOutcome("adaptado")}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all cursor-pointer font-bold flex flex-col items-center gap-1.5",
                      fitnessOutcome === "adaptado"
                        ? "bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-500/40"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    <Activity className="size-5" />
                    <span>🟧 ADAPTADO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFitnessOutcome("no_apto");
                      setWantsFormalInjury(true);
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all cursor-pointer font-bold flex flex-col items-center gap-1.5",
                      fitnessOutcome === "no_apto"
                        ? "bg-destructive text-white border-destructive ring-2 ring-destructive/40"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    <AlertTriangle className="size-5" />
                    <span>🔴 NO APTO</span>
                  </button>
                </div>
              </div>

              {fitnessOutcome === "adaptado" && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="size-4" />
                    ¿Deseas registrar una lesión médica formal para este jugador?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWantsFormalInjury(true)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border",
                        wantsFormalInjury === true
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                      )}
                    >
                      Sí, añadir diagnóstico y fase RTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantsFormalInjury(false)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all border",
                        wantsFormalInjury === false
                          ? "bg-slate-700 text-white border-white/20"
                          : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                      )}
                    >
                      No, sólo aviso de trabajo adaptado
                    </button>
                  </div>
                </div>
              )}

              {(fitnessOutcome === "no_apto" || (fitnessOutcome === "adaptado" && wantsFormalInjury === true)) && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <HeartPulse className="size-4 text-destructive" />
                    Diagnóstico y Evolución de Lesión (RTP)
                  </h4>

                  <div>
                    <label className="font-semibold text-white block mb-1">Diagnóstico / Zona Afectada:</label>
                    <input
                      type="text"
                      required
                      value={injuryBodyPart}
                      onChange={(e) => setInjuryBodyPart(e.target.value)}
                      placeholder="Ej. Sobrecarga en isquiotibiales"
                      className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-white block mb-1">Fase de Evolución (1 al 4):</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([1, 2, 3, 4] as InjuryPhase[]).map((pNum) => (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setSelectedPhase(pNum)}
                          className={cn(
                            "p-2 rounded border text-left text-[11px] font-semibold transition-all cursor-pointer",
                            selectedPhase === pNum
                              ? "bg-primary text-primary-foreground border-primary font-bold"
                              : "bg-slate-950 border-white/10 text-slate-400 hover:text-white"
                          )}
                        >
                          Fase {pNum}: {INJURY_PHASE_LABELS[pNum].name.split(":")[1]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-white block mb-1">Fecha Prevista de Vuelta (RTP):</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-white block mb-1">Observaciones / Tratamiento realizado:</label>
                <textarea
                  rows={3}
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  placeholder="Tratamiento de descarga, ultrasonidos o sensaciones del futbolista..."
                  className="w-full rounded-md bg-slate-950 border border-white/10 p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button type="button" onClick={() => setTreatingAppointment(null)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Cancelar
                </button>
                <button type="submit" className={buttonVariants({ size: "sm" })}>
                  Guardar Dictamen
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
    </div>
  );
}
