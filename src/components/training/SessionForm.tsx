"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Gauge,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Target,
  PenTool,
  Check,
  AlertCircle,
  ListTodo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PitchGridSelector } from "./PitchGridSelector";
import { EquipmentSelector } from "./EquipmentSelector";
import { GroupPlanner } from "./GroupPlanner";
import { MatchGamePlan } from "./MatchGamePlan";
import { TaskWhiteboard, type WhiteboardData } from "./TaskWhiteboard";
import { TacticalConceptsSelector } from "./TacticalConceptsSelector";
import { MuscleGroupsSelector } from "./MuscleGroupsSelector";
import { CustomTooltip } from "../ui/custom-tooltip";
import type { PlayerWithMembership } from "@/services/players";
import type { ExerciseLibraryItem } from "@/services/tasks";
import type { SessionTemplate, SessionType, LoadLevel, MicrocycleDay } from "@/types";

interface SessionFormProps {
  organizationId: string;
  userId: string;
  teams: any[];
  squadPlayers: PlayerWithMembership[];
  templates: SessionTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  initialData?: any; // If editing
  organizationSettings?: any;
}

export function SessionForm({
  organizationId,
  userId,
  teams = [],
  squadPlayers = [],
  templates = [],
  exerciseLibrary = [],
  initialData,
  organizationSettings,
}: SessionFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  // 1. Basic Fields State
  const [teamId, setTeamId] = useState(initialData?.team_id ?? teams[0]?.id ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(() => initialData?.date ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(() => {
    if (initialData?.start_time) {
      return initialData.start_time.slice(0, 5);
    }
    return organizationSettings?.default_training_time ?? "10:00";
  });
  const [durationMin, setDurationMin] = useState(initialData?.duration_min ?? 90);
  const [sessionType, setSessionType] = useState<SessionType>(initialData?.session_type ?? "training");
  const [microcycleDay, setMicrocycleDay] = useState<MicrocycleDay | "">(initialData?.microcycle_day ?? "MD-1");
  const [plannedLoad, setPlannedLoad] = useState<LoadLevel | "">(initialData?.planned_load ?? "medium");
  const [plannedIntensity, setPlannedIntensity] = useState(initialData?.planned_intensity ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialData?.template_id ?? "");
  
  // Call timings state
  const [checkinHoursBefore, setCheckinHoursBefore] = useState(
    initialData?.checkin_hours_before ?? organizationSettings?.default_checkin_hours_before ?? 8
  );
  const [checkinCloseMinsBefore, setCheckinCloseMinsBefore] = useState(
    initialData?.checkin_close_mins_before ?? organizationSettings?.default_checkin_close_mins_before ?? 15
  );
  const [checkoutMinsAfter, setCheckoutMinsAfter] = useState(
    initialData?.checkout_mins_after ?? organizationSettings?.default_checkout_mins_after ?? 30
  );
  const [checkoutCloseHoursAfter, setCheckoutCloseHoursAfter] = useState(
    initialData?.checkout_close_hours_after ?? organizationSettings?.default_checkout_close_hours_after ?? 16
  );
  const [showTimingsAccordion, setShowTimingsAccordion] = useState(false);
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  // New: Mesocycle and session sequence
  const [mesocycle, setMesocycle] = useState(initialData?.mesocycle ?? "");
  const [sessionWeekSeq, setSessionWeekSeq] = useState<number>(initialData?.session_week_seq ?? 1);
  const [sessionTotalSeq, setSessionTotalSeq] = useState<number | null>(initialData?.session_total_seq ?? null);

  // New: Facilities management
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>(initialData?.facility_ids ?? []);

  useEffect(() => {
    async function loadFacilities() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("facilities")
          .select("*")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        if (data) setFacilities(data);
      } catch (err) {
        console.error("Error loading facilities:", err);
      }
    }
    loadFacilities();
  }, []);

  // Copy/paste exercise clipboard
  const [copiedExercise, setCopiedExercise] = useState<any | null>(null);

  // Whiteboard modal state
  const [whiteboardExerciseIndex, setWhiteboardExerciseIndex] = useState<number | null>(null);

  const [matchGamePlan, setMatchGamePlan] = useState<any>(() => {
    return initialData?.match_game_plan ?? {
      formation: "4-3-3",
      lineup: {},
      substitutes: [],
      instructions: "",
      set_pieces_offensive: "",
      set_pieces_defensive: ""
    };
  });

  // Objectives (array of tags)
  const [objectiveInput, setObjectiveInput] = useState("");
  const [objectives, setObjectives] = useState<string[]>(initialData?.objectives ?? []);

  // Filter out inactive players (bajas)
  const activeSquadPlayers = squadPlayers.filter((p) => p.membership?.status !== "inactive");

  // 2. Attendance State (Default: all players present, unless marked injured)
  const [attendance, setAttendance] = useState<Record<string, { status: any; notes: string }>>(() => {
    if (initialData?.attendance) {
      const records: Record<string, { status: any; notes: string }> = {};
      initialData.attendance.forEach((att: any) => {
        records[att.player_id] = {
          status: att.status,
          notes: att.notes ?? "",
        };
      });
      return records;
    }

    const defaultRecords: Record<string, { status: any; notes: string }> = {};
    activeSquadPlayers.forEach((p) => {
      const activeInjury = p.active_injury;
      const isInjured = activeInjury && activeInjury.status === "active";
      defaultRecords[p.id] = {
        status: isInjured ? "injured" : "present",
        notes: isInjured && activeInjury ? `Lesión: ${activeInjury.body_part} (${activeInjury.severity})` : "",
      };
    });
    return defaultRecords;
  });

  // Computed: list of present player objects
  const presentPlayers = activeSquadPlayers
    .filter((p) => attendance[p.id]?.status === "present")
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      membership: p.membership,
      active_injury: p.active_injury,
    }));

  // 3. Session Exercises List State
  const [exercises, setExercises] = useState<any[]>(() => {
    if (initialData?.exercises) {
      return initialData.exercises.map((ex: any) => ({
        exercise_id: ex.exercise_id,
        title: ex.exercise?.title ?? "Ejercicio",
        category: ex.exercise?.category ?? "General",
        duration_min: ex.duration_min,
        recovery_min: ex.recovery_min,
        pitch_zones: ex.pitch_zones ?? [],
        equipment: ex.equipment ?? [],
        group_setup: ex.group_setup ?? { groups: [] },
        whiteboard_data: ex.whiteboard_data ?? null,
        whiteboard_zone: ex.whiteboard_zone ?? "full_field",
        space_dimensions: ex.space_dimensions ?? "",
        tactical_concepts: ex.tactical_concepts ?? [],
        muscle_groups: ex.muscle_groups ?? [],
      }));
    }
    return [];
  });

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline exercise creator states
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [newExTitle, setNewExTitle] = useState("");
  const [newExCategory, setNewExCategory] = useState("General");
  const [newExDifficulty, setNewExDifficulty] = useState("intermediate");
  const [newExDesc, setNewExDesc] = useState("");
  const [creatingExLoading, setCreatingExLoading] = useState(false);

  const handleCreateExerciseInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExTitle.trim()) return;

    setCreatingExLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/training/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newExTitle.trim(),
          category: newExCategory,
          difficulty: newExDifficulty,
          description: newExDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al crear el ejercicio");
      }

      // Add to session exercises list directly
      addExercise({
        id: data.id,
        title: data.title,
        category: data.category,
        difficulty: data.difficulty,
        description: data.description,
      } as any);

      // Reset form states
      setNewExTitle("");
      setNewExCategory("General");
      setNewExDifficulty("intermediate");
      setNewExDesc("");
      setIsCreatingExercise(false);
    } catch (err: any) {
      setError(err.message ?? "Error en la petición");
    } finally {
      setCreatingExLoading(false);
    }
  };

  // Auto-update duration based on sum of exercise times (+ transitions)
  useEffect(() => {
    if (exercises.length > 0) {
      const total = exercises.reduce(
        (sum, ex) => sum + (ex.duration_min || 0) + (ex.recovery_min || 0),
        0
      );
      setDurationMin(total);
    }
  }, [exercises]);

  // Handle Template Import on-demand
  const handleImportTemplate = async () => {
    if (!selectedTemplateId) return;

    try {
      const res = await fetch(`/api/training/templates/${selectedTemplateId}`);
      if (!res.ok) throw new Error("Error al obtener la plantilla");
      
      const templateData = await res.json();
      
      // Populate basic properties if not set
      if (templateData.title && !title) setTitle(templateData.title);
      if (templateData.session_type) setSessionType(templateData.session_type);
      if (templateData.duration_min) setDurationMin(templateData.duration_min);
      if (templateData.objectives && templateData.objectives.length > 0) {
        setObjectives(templateData.objectives);
      }
      if (templateData.description && !notes) setNotes(templateData.description);

      // Populate exercises
      if (templateData.exercises && templateData.exercises.length > 0) {
        const imported = templateData.exercises.map((ex: any) => {
          // Initialize template groups mapping
          const groupsSetup = ex.group_setup || { groups: [] };
          // In a template, groups are generic. We map them.
          return {
            exercise_id: ex.exercise_id,
            title: ex.exercise?.title ?? "Ejercicio",
            category: ex.exercise?.category ?? "General",
            duration_min: ex.duration_min,
            recovery_min: ex.recovery_min,
            pitch_zones: ex.pitch_zones ?? [],
            equipment: ex.equipment ?? [],
            group_setup: groupsSetup,
          };
        });
        setExercises(imported);
      }
    } catch (err: any) {
      setError("No se pudo cargar la plantilla seleccionada: " + err.message);
    }
  };

  // Add exercise from library
  const addExercise = (item: ExerciseLibraryItem) => {
    const exists = exercises.some((ex) => ex.exercise_id === item.id);
    if (exists) return; // Prevent duplicates

    // If needs_groups is true, pre-fill groups based on item.num_groups
    const defaultGroups: any[] = [];
    const groupCount = item.num_groups ?? 2;
    if (item.needs_groups) {
      for (let i = 0; i < groupCount; i++) {
        defaultGroups.push({
          name: `Equipo ${String.fromCharCode(65 + i)}`,
          players: [],
        });
      }
    }

    setExercises([
      ...exercises,
      {
        exercise_id: item.id,
        title: item.title,
        category: item.category ?? "General",
        duration_min: 15,
        recovery_min: 2,
        pitch_zones: [],
        equipment: [],
        group_setup: { groups: defaultGroups },
        needs_groups: !!item.needs_groups,
        num_groups: item.num_groups ?? 2,
        players_per_group: item.players_per_group ?? "",
        image_url: item.image_url ?? "",
        video_url: item.video_url ?? "",
        whiteboard_data: item.whiteboard_data ?? null,
        whiteboard_zone: item.whiteboard_zone ?? "full_field",
        space_dimensions: item.space_dimensions ?? "",
        tactical_concepts: item.tactical_concepts ?? [],
        muscle_groups: item.muscle_groups ?? [],
      },
    ]);
    setIsLibraryOpen(false);
  };

  // Remove exercise
  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, idx) => idx !== index));
  };

  // Move exercise up or down in order
  const moveExercise = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= exercises.length) return;

    const copy = [...exercises];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setExercises(copy);
  };

  // Copy exercise to clipboard
  const copyExercise = (index: number) => {
    const ex = exercises[index];
    setCopiedExercise({ ...ex, exercise_id: ex.exercise_id + '_copy_' + Date.now() });
  };

  // Paste exercise from clipboard
  const pasteExercise = () => {
    if (!copiedExercise) return;
    const pastedEx = {
      ...copiedExercise,
      exercise_id: copiedExercise.exercise_id.split('_copy_')[0] + '_copy_' + Date.now(),
      group_setup: {
        ...copiedExercise.group_setup,
        // Reset player assignments when pasting - keep group names only
        groups: (copiedExercise.group_setup?.groups ?? []).map((g: any) => ({
          name: g.name,
          players: [],
        })),
      },
    };
    setExercises([...exercises, pastedEx]);
  };

  // Duplicate exercise in-place
  const duplicateExercise = (index: number) => {
    const ex = exercises[index];
    const duplicated = {
      ...ex,
      exercise_id: ex.exercise_id + '_dup_' + Date.now(),
      group_setup: {
        ...ex.group_setup,
        groups: (ex.group_setup?.groups ?? []).map((g: any) => ({
          name: g.name,
          players: [],
        })),
      },
    };
    const newExercises = [...exercises];
    newExercises.splice(index + 1, 0, duplicated);
    setExercises(newExercises);
  };

  // Update specific exercise field state
  const updateExerciseField = (index: number, field: string, value: any) => {
    const updated = exercises.map((ex, idx) => {
      if (idx === index) {
        return { ...ex, [field]: value };
      }
      return ex;
    });
    setExercises(updated);
  };

  // Attendance handlers
  const handleAttendanceChange = (playerId: string, status: any) => {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        status,
      },
    }));
  };

  const handleAttendanceNotes = (playerId: string, notes: string) => {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        notes,
      },
    }));
  };

  // Objectives handling
  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectiveInput.trim() && !objectives.includes(objectiveInput.trim())) {
      setObjectives([...objectives, objectiveInput.trim()]);
      setObjectiveInput("");
    }
  };

  const handleRemoveObjective = (tag: string) => {
    setObjectives(objectives.filter((o) => o !== tag));
  };

  // Save session form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor, introduce el título de la sesión.");
      return;
    }

    setSaving(true);
    setError(null);

    // Format payload using active squad players only
    const attendancePayload = activeSquadPlayers.map((p) => ({
      player_id: p.id,
      status: attendance[p.id]?.status ?? "present",
      notes: attendance[p.id]?.notes ?? null,
    }));

    const exercisesPayload = exercises.map((ex, index) => {
      // Clean players assigned to groups who might have been marked absent
      const cleanedGroups = (ex.group_setup?.groups ?? []).map((group: any) => ({
        ...group,
        players: (group.players ?? []).filter((id: string) =>
          attendance[id]?.status === "present"
        ),
      }));

      return {
        exercise_id: ex.exercise_id,
        order_index: index,
        duration_min: Number(ex.duration_min),
        recovery_min: Number(ex.recovery_min),
        pitch_zones: ex.pitch_zones,
        equipment: ex.equipment,
        group_setup: { groups: cleanedGroups },
        needs_groups: !!ex.needs_groups,
        num_groups: ex.num_groups !== undefined ? Number(ex.num_groups) : 2,
        players_per_group: ex.players_per_group || null,
        image_url: ex.image_url || null,
        video_url: ex.video_url || null,
        whiteboard_data: ex.whiteboard_data || null,
        whiteboard_zone: ex.whiteboard_zone || "full_field",
        space_dimensions: ex.space_dimensions || null,
        tactical_concepts: ex.tactical_concepts || [],
        muscle_groups: ex.muscle_groups || [],
      };
    });

    const activeTeam = teams.find((t) => t.id === teamId);
    const seasonId = activeTeam?.season_id ?? null;

    const payload = {
      team_id: teamId,
      season_id: seasonId,
      title: title.trim(),
      date,
      start_time: startTime + ":00",
      duration_min: Number(durationMin),
      session_type: sessionType,
      microcycle_day: microcycleDay || null,
      planned_load: plannedLoad || null,
      planned_intensity: plannedIntensity.trim() || null,
      mesocycle: mesocycle.trim() || null,
      session_week_seq: sessionWeekSeq || null,
      session_total_seq: sessionTotalSeq || null,
      objectives,
      notes: notes.trim() || null,
      template_id: selectedTemplateId || null,
      attendance: attendancePayload,
      exercises: sessionType === "match" ? [] : exercisesPayload,
      match_game_plan: sessionType === "match" ? matchGamePlan : null,
      checkin_hours_before: Number(checkinHoursBefore),
      checkin_close_mins_before: Number(checkinCloseMinsBefore),
      checkout_mins_after: Number(checkoutMinsAfter),
      checkout_close_hours_after: Number(checkoutCloseHoursAfter),
      facility_ids: selectedFacilityIds,
    };

    try {
      const url = isEdit ? `/api/training/sessions/${initialData.id}` : "/api/training/sessions";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error ?? "Error al guardar la sesión.");
      }

      router.push("/training");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Error en la petición");
      setSaving(false);
    }
  };

  const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all";
  const selectClass =
    "w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all cursor-pointer";

  return (
    <>
      <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-5xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Style date & time picker indicators for dark mode */
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(0.8) grayscale(1);
          cursor: pointer;
        }
        input[type="date"],
        input[type="time"] {
          color-scheme: dark !important;
        }
        /* Hide number spinners */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}} />
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── SECCIÓN 1: DATOS BÁSICOS & TEMPLATE IMPORT ── */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
          <PenTool className="h-5 w-5 text-emerald-500" />
          Datos Generales de la Sesión
        </h2>

        {/* Template Quick Import Selector */}
        {!isEdit && templates.length > 0 && (
          <div className="p-4 rounded-xl border border-white/5 bg-white/2 flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="import-template" className={labelClass}>Precargar Plantilla de Sesión</label>
              <select
                id="import-template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className={selectClass}
              >
                <option value="" className="bg-slate-900">-- Ninguna plantilla --</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id} className="bg-slate-900">
                    {tpl.title} ({tpl.session_type})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={handleImportTemplate}
              className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold px-4 py-3 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Importar plantilla
            </button>
          </div>
        )}

        {/* Row 1: Title & Team */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="session-title" className={labelClass}>Título de la Sesión *</label>
            <input
              id="session-title"
              type="text"
              required
              placeholder="Ej: Sesión MD-1 Activación y Velocidad"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="session-team" className={labelClass}>Equipo</label>
            <select
              id="session-team"
              disabled={isEdit}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={selectClass}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900">
                  {t.name} ({t.category || "General"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date, Duration, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="session-date" className={labelClass}>Fecha</label>
              <div className="relative">
                <input
                  id="session-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={cn(inputClass, "pl-10")}
                />
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label htmlFor="session-time" className={labelClass}>Hora</label>
              <div className="relative">
                <input
                  id="session-time"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(inputClass, "pl-10")}
                />
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="session-duration" className={labelClass}>Duración (min)</label>
            <input
              id="session-duration"
              type="number"
              required
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="session-type" className={labelClass}>Tipo de Sesión</label>
            <select
              id="session-type"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className={selectClass}
            >
              <option value="training" className="bg-slate-900">Entrenamiento Grupal</option>
              <option value="individual" className="bg-slate-900">Entrenamiento Individual</option>
              <option value="match" className="bg-slate-900">Partido</option>
            </select>
          </div>
        </div>

        {/* Timings Collapsible Accordion */}
        <div className="glass rounded-2xl border border-white/10 bg-white/2 overflow-hidden transition-all no-print">
          <button
            type="button"
            onClick={() => setShowTimingsAccordion(!showTimingsAccordion)}
            className="w-full flex items-center justify-between p-4 text-left font-bold text-xs text-slate-300 uppercase tracking-wider hover:bg-white/5 transition-all cursor-pointer"
          >
            <span>Timings de Convocatoria (Check-in / Check-out)</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showTimingsAccordion && "rotate-180")} />
          </button>

          {showTimingsAccordion && (
            <div className="p-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-black/10 animate-in slide-in-from-top-1 duration-150">
              <div>
                <label className={labelClass}>Envío Check-in</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={checkinHoursBefore}
                    onChange={(e) => setCheckinHoursBefore(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-500 font-semibold">h antes</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Cierre Check-in</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={checkinCloseMinsBefore}
                    onChange={(e) => setCheckinCloseMinsBefore(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-500 font-semibold">min antes</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Envío Check-out</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={checkoutMinsAfter}
                    onChange={(e) => setCheckoutMinsAfter(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-500 font-semibold">min después</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Cierre Check-out</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={checkoutCloseHoursAfter}
                    onChange={(e) => setCheckoutCloseHoursAfter(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-500 font-semibold">h después</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Mesociclo + Numeración de Sesión - ONLY for training type */}
        {sessionType !== "match" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="session-mesocycle" className={labelClass}>Mesociclo</label>
              <input
                id="session-mesocycle"
                type="text"
                placeholder="Ej: Pretemporada, Competición"
                value={mesocycle}
                onChange={(e) => setMesocycle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="session-week-seq" className={labelClass}>Nº Sesión (Semana)</label>
              <input
                id="session-week-seq"
                type="number"
                min="1"
                max="20"
                placeholder="1"
                value={sessionWeekSeq}
                onChange={(e) => setSessionWeekSeq(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="session-total-seq" className={labelClass}>Nº Sesión (Total)</label>
              <input
                id="session-total-seq"
                type="number"
                min="1"
                placeholder="Auto"
                value={sessionTotalSeq ?? ""}
                onChange={(e) => setSessionTotalSeq(e.target.value ? Number(e.target.value) : null)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="session-microcycle" className={labelClass}>Día de Microciclo</label>
              <select
                id="session-microcycle"
                value={microcycleDay}
                onChange={(e) => setMicrocycleDay(e.target.value as MicrocycleDay)}
                className={selectClass}
              >
                <option value="" className="bg-slate-900">Ninguno</option>
                <option value="MD-4" className="bg-slate-900">MD-4</option>
                <option value="MD-3" className="bg-slate-900">MD-3</option>
                <option value="MD-2" className="bg-slate-900">MD-2</option>
                <option value="MD-1" className="bg-slate-900">MD-1</option>
                <option value="MD" className="bg-slate-900">MD</option>
                <option value="MD+1" className="bg-slate-900">MD+1</option>
                <option value="MD+2" className="bg-slate-900">MD+2</option>
              </select>
            </div>
          </div>
        )}

        {/* Row 4: Load, Intensity - HIDDEN for match type */}
        {sessionType !== "match" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-load" className={labelClass}>Carga Planificada</label>
              <select
                id="session-load"
                value={plannedLoad}
                onChange={(e) => setPlannedLoad(e.target.value as LoadLevel)}
                className={selectClass}
              >
                <option value="" className="bg-slate-900">Sin carga</option>
                <option value="recovery" className="bg-slate-900">Recuperación</option>
                <option value="low" className="bg-slate-900">Baja</option>
                <option value="medium" className="bg-slate-900">Media</option>
                <option value="medium_high" className="bg-slate-900">Media-Alta</option>
                <option value="high" className="bg-slate-900">Alta</option>
              </select>
            </div>
            <div>
              <label htmlFor="session-intensity" className={labelClass}>Intensidad Percibida</label>
              <input
                id="session-intensity"
                type="text"
                placeholder="Ej: Media (140-160 ppm)"
                value={plannedIntensity}
                onChange={(e) => setPlannedIntensity(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Row 5: Instalaciones / Campos */}
        <div className="space-y-1.5 pt-2">
          <label className={labelClass}>Instalaciones / Campos Asignados</label>
          <div className="flex flex-wrap gap-2">
            {facilities.map((fac) => {
              const isSelected = selectedFacilityIds.includes(fac.id);
              return (
                <button
                  key={fac.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedFacilityIds(selectedFacilityIds.filter((id) => id !== fac.id));
                    } else {
                      setSelectedFacilityIds([...selectedFacilityIds, fac.id]);
                    }
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {fac.name} ({fac.type === "field" ? "Campo" : fac.type === "gym" ? "Gimnasio" : "Instalación"})
                </button>
              );
            })}
            {facilities.length === 0 && (
              <p className="text-xs text-slate-500 italic">No hay instalaciones configuradas. Puedes gestionarlas en Ajustes.</p>
            )}
          </div>
        </div>

        {/* Objectives (Tag list) - Hidden for match */}
        {sessionType !== "match" && (
        <div>
          <label className={labelClass}>Objetivos del Entrenamiento</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {objectives.map((obj, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 font-semibold"
              >
                {obj}
                <button
                  type="button"
                  onClick={() => handleRemoveObjective(obj)}
                  className="hover:text-rose-400 text-slate-500 ml-1 font-bold text-xs"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: Transición Ofensiva, Repliegue rápido..."
              value={objectiveInput}
              onChange={(e) => setObjectiveInput(e.target.value)}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
            <button
              type="button"
              onClick={handleAddObjective}
              className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold px-4 py-2 transition-all cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="session-notes" className={labelClass}>Observaciones / Notas de la sesión</label>
          <textarea
            id="session-notes"
            rows={3}
            placeholder="Añadir observaciones sobre el clima, organización del vestuario, o foco táctico general."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* ── SECCIÓN 2: CONTROL DE ASISTENCIA ── */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-500" />
          Convocatoria y Asistencia ({presentPlayers.length} activos)
        </h2>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase font-bold tracking-wider bg-white/2">
                <th className="p-3 pl-4">Jugador</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeSquadPlayers.map((p) => {
                const attRecord = attendance[p.id] || { status: "present", notes: "" };
                const isInjured = p.active_injury && p.active_injury.status === "active";
                const isChecked = attRecord.status === "present";

                const handleCheckboxChange = (checked: boolean) => {
                  handleAttendanceChange(p.id, checked ? "present" : "absent");
                };

                return (
                  <tr key={p.id} className="text-xs hover:bg-white/2">
                    <td className="p-3 pl-4 font-semibold text-white flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 border border-white/5">
                        {p.first_name.slice(0, 1)}{p.last_name.slice(0, 1)}
                      </div>
                      <span>{p.first_name} {p.last_name}</span>
                    </td>
                    <td className="p-3 text-center">
                      {isInjured ? (
                        <span className="text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded px-2 py-0.5 uppercase tracking-wide">
                          Lesionado
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleCheckboxChange(e.target.checked)}
                          className="h-4 w-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-550/50 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder={isInjured ? "Cargado automáticamente: lesionado" : "Motivo de baja o notas..."}
                        value={attRecord.notes}
                        onChange={(e) => handleAttendanceNotes(p.id, e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-white/10 focus:border-emerald-500/30 py-0.5 text-slate-300 focus:outline-none placeholder-slate-600"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECCIÓN: PLAN DE PARTIDO (Solo para partido) ── */}
      {sessionType === "match" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Plan de Partido (Alineación y ABP)
          </h2>
          <MatchGamePlan
            presentPlayers={presentPlayers}
            value={matchGamePlan}
            onChange={setMatchGamePlan}
            interactive={true}
            organizationSettings={organizationSettings}
          />
        </div>
      )}

      {/* ── SECCIÓN 3: EXERCISES TIMELINE BUILDER ── */}
      {sessionType !== "match" && (
        <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-emerald-500" />
            Planificación de Tareas / Ejercicios
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold px-4 py-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Añadir Ejercicio
            </button>
            {copiedExercise && (
              <button
                type="button"
                onClick={pasteExercise}
                className="flex items-center gap-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></svg>
                Pegar Tarea
              </button>
            )}
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/2 glass-card">
            <CalendarDays className="h-8 w-8 text-slate-500 mb-2 animate-pulse" />
            <p className="text-sm text-slate-400 font-semibold mb-2">No has añadido ningún ejercicio todavía</p>
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
            >
              Seleccionar de la biblioteca <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((ex, index) => (
              <div
                key={ex.exercise_id + "-" + index}
                className="glass rounded-2xl border border-white/10 p-5 bg-white/2 space-y-5"
              >
                {/* Exercise Header */}
                <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-extrabold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-white leading-tight">{ex.title}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        {ex.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Reorder Buttons */}
                    <CustomTooltip content="Mover arriba">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveExercise(index, "up")}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronDown className="h-4.5 w-4.5 rotate-180" />
                      </button>
                    </CustomTooltip>
                    <CustomTooltip content="Mover abajo">
                      <button
                        type="button"
                        disabled={index === exercises.length - 1}
                        onClick={() => moveExercise(index, "down")}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronDown className="h-4.5 w-4.5" />
                      </button>
                    </CustomTooltip>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <CustomTooltip content="Duplicar tarea">
                      <button
                        type="button"
                        onClick={() => duplicateExercise(index)}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-sky-400 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                    </CustomTooltip>
                    <CustomTooltip content="Copiar tarea">
                      <button
                        type="button"
                        onClick={() => copyExercise(index)}
                        className={cn("p-1 rounded hover:bg-white/5 transition-all", copiedExercise?.exercise_id?.startsWith(ex.exercise_id) ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></svg>
                      </button>
                    </CustomTooltip>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    {/* Delete Button */}
                    <CustomTooltip content="Eliminar de la sesión">
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="p-1 rounded hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CustomTooltip>
                  </div>
                </div>

                {/* Subrow: Duration & Recovery */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <span>Duración de la tarea</span>
                      <span className="text-emerald-400 font-extrabold">{ex.duration_min} minutos</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={ex.duration_min}
                      onChange={(e) =>
                        updateExerciseField(index, "duration_min", Number(e.target.value))
                      }
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <span>Tiempo de recuperación / Intervalo</span>
                      <span className="text-amber-400 font-extrabold">{ex.recovery_min} minutos</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={ex.recovery_min}
                      onChange={(e) =>
                        updateExerciseField(index, "recovery_min", Number(e.target.value))
                      }
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                {/* Subrow: Special Configuration (Parallel & Strength) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
                  <div className="flex items-start gap-3">
                    <input
                      id={`parallel-${index}`}
                      type="checkbox"
                      checked={ex.group_setup?.parallel ?? false}
                      onChange={(e) => {
                        const newGroupSetup = { ...ex.group_setup, parallel: e.target.checked };
                        updateExerciseField(index, "group_setup", newGroupSetup);
                      }}
                      className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 h-4 w-4 mt-0.5"
                    />
                    <div>
                      <label htmlFor={`parallel-${index}`} className="block text-xs font-bold text-slate-350 uppercase tracking-wider cursor-pointer">
                        Ejecutar en paralelo con la siguiente tarea
                      </label>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                        Activa esta opción si se realiza simultáneamente con la siguiente tarea de la sesión.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        id={`strength-${index}`}
                        type="checkbox"
                        checked={ex.group_setup?.is_strength ?? false}
                        onChange={(e) => {
                          const newGroupSetup = {
                            ...ex.group_setup,
                            is_strength: e.target.checked,
                            strength_sets: ex.group_setup?.strength_sets ?? 3,
                            strength_reps: ex.group_setup?.strength_reps ?? 10,
                            strength_time: ex.group_setup?.strength_time ?? "45s",
                          };
                          updateExerciseField(index, "group_setup", newGroupSetup);
                        }}
                        className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 h-4 w-4 mt-0.5"
                      />
                      <div>
                        <label htmlFor={`strength-${index}`} className="block text-xs font-bold text-slate-350 uppercase tracking-wider cursor-pointer">
                          Pautas de Fuerza y Acondicionamiento
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                          Habilita series, repeticiones y tiempos para esta tarea.
                        </p>
                      </div>
                    </div>

                    {ex.group_setup?.is_strength && (
                      <div className="grid grid-cols-3 gap-2 pl-7 pt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Series (Sets)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={ex.group_setup?.strength_sets ?? 3}
                            onChange={(e) => {
                              const newGroupSetup = { ...ex.group_setup, strength_sets: Number(e.target.value) };
                              updateExerciseField(index, "group_setup", newGroupSetup);
                            }}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Reps
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={ex.group_setup?.strength_reps ?? 10}
                            onChange={(e) => {
                              const newGroupSetup = { ...ex.group_setup, strength_reps: Number(e.target.value) };
                              updateExerciseField(index, "group_setup", newGroupSetup);
                            }}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Tiempo
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: 45s"
                            value={ex.group_setup?.strength_time ?? "45s"}
                            onChange={(e) => {
                              const newGroupSetup = { ...ex.group_setup, strength_time: e.target.value };
                              updateExerciseField(index, "group_setup", newGroupSetup);
                            }}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white placeholder-slate-650"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subrow: Zonas del campo */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Zonas del Campo Utilizadas
                  </span>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <PitchGridSelector
                      selectedZones={ex.pitch_zones}
                      onChange={(zones) => updateExerciseField(index, "pitch_zones", zones)}
                      interactive={true}
                    />
                    <div className="flex-1 w-full space-y-2">
                      <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                        Selecciona en la cuadrícula táctica los cuadrantes del campo que se utilizarán para el montaje de este ejercicio.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ex.pitch_zones.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic">
                            Ninguna zona seleccionada (por defecto se asume todo el campo)
                          </span>
                        ) : (
                          ex.pitch_zones.map((zone: string) => (
                            <span
                              key={zone}
                              className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-extrabold text-[10px] px-2 py-0.5"
                            >
                              Zona {zone}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subrow: Material y Equipamiento */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Material Requerido
                  </span>
                  <EquipmentSelector
                    value={ex.equipment}
                    onChange={(equip) => updateExerciseField(index, "equipment", equip)}
                    interactive={true}
                  />
                </div>

                {/* Subrow: Planificador de Grupos */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Distribución de Equipos y Grupos
                    </span>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ex.needs_groups ?? false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateExerciseField(index, "needs_groups", checked);
                          if (checked && (!ex.group_setup?.groups || ex.group_setup.groups.length === 0)) {
                            // Initialize default groups
                            const defaultGroups = [];
                            const groupCount = ex.num_groups ?? 2;
                            for (let i = 0; i < groupCount; i++) {
                              defaultGroups.push({
                                name: `Equipo ${String.fromCharCode(65 + i)}`,
                                players: [],
                              });
                            }
                            updateExerciseField(index, "group_setup", { groups: defaultGroups });
                          }
                        }}
                        className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 h-4 w-4"
                      />
                      ¿Requiere Equipos?
                    </label>
                  </div>

                  {(ex.needs_groups ?? false) && (
                    <div className="space-y-3.5">
                      <div className="flex flex-wrap items-center gap-4 bg-white/2 p-2.5 rounded-xl border border-white/5 animate-fade-in">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Nº de Equipos:</span>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={ex.group_setup?.groups?.length ?? ex.num_groups ?? 2}
                            onChange={(e) => {
                              const targetNum = Math.max(1, Math.min(5, Number(e.target.value)));
                              updateExerciseField(index, "num_groups", targetNum);
                              const currentGroups = ex.group_setup?.groups ?? [];
                              let newGroups = [...currentGroups];
                              if (targetNum > currentGroups.length) {
                                for (let i = currentGroups.length; i < targetNum; i++) {
                                  const name = `Equipo ${String.fromCharCode(65 + i)}`;
                                  newGroups.push({ name, players: [] });
                                }
                              } else if (targetNum < currentGroups.length) {
                                newGroups = newGroups.slice(0, targetNum);
                              }
                              updateExerciseField(index, "group_setup", { groups: newGroups });
                            }}
                            className="w-12 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Jugadores/Equipo:</span>
                          <input
                            type="text"
                            placeholder="Ej: 5 ó 4v4+2"
                            value={ex.players_per_group ?? ""}
                            onChange={(e) => updateExerciseField(index, "players_per_group", e.target.value)}
                            className="w-24 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-slate-700 focus:outline-none"
                          />
                        </div>
                      </div>
                      <GroupPlanner
                        presentPlayers={presentPlayers}
                        value={ex.group_setup}
                        onChange={(groupsVal) => updateExerciseField(index, "group_setup", groupsVal)}
                        interactive={true}
                      />
                    </div>
                  )}
                </div>

                {/* Subrow: Material Físico (Vídeo / Imagen Explicativa) */}
                {(ex.image_url || ex.video_url) && (
                  <div className="flex gap-2 text-[10px] border-t border-white/5 pt-4">
                    {ex.image_url && (
                      <a
                        href={ex.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg font-bold hover:bg-sky-500/15 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        Ver Imagen Fuerza
                      </a>
                    )}
                    {ex.video_url && (
                      <a
                        href={ex.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-bold hover:bg-amber-500/15 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                        Ver Vídeo Demostración
                      </a>
                    )}
                  </div>
                )}

                {/* Conceptos Tácticos y Grupos Musculares */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Conceptos Tácticos
                    </span>
                    <TacticalConceptsSelector
                      value={ex.tactical_concepts || []}
                      onChange={(concepts) => updateExerciseField(index, "tactical_concepts", concepts)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Grupos Musculares
                    </span>
                    <MuscleGroupsSelector
                      value={ex.muscle_groups || []}
                      onChange={(muscles) => updateExerciseField(index, "muscle_groups", muscles)}
                    />
                  </div>
                </div>

                {/* Subrow: Pizarra Táctica */}
                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pizarra Táctica de la Tarea
                    </span>
                    <button
                      type="button"
                      onClick={() => setWhiteboardExerciseIndex(index)}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 text-xs font-semibold px-3 py-1.5 transition-all cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      {ex.whiteboard_data ? "Editar Dibujo" : "Dibujar Ejercicio"}
                    </button>
                  </div>
                  {ex.whiteboard_data?.imageDataUrl && (
                    <div className="mt-2">
                      <img
                        src={ex.whiteboard_data.imageDataUrl}
                        alt="Vista previa pizarra"
                        className="rounded-xl border border-white/10 max-h-32 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── FORM ACTIONS ── */}
      <div className="flex gap-4 pt-4 border-t border-white/5 no-print">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-semibold text-sm py-3 transition-all cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => setIsPrintPreview(true)}
          className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm py-3 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Previsualizar / Exportar PDF
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold text-sm py-3 transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Sesión"}
        </button>
      </div>
    </form>

    {/* Print Preview Overlay */}
      {isPrintPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto text-white p-6 md:p-10 no-scrollbar">
          <div className="max-w-4xl mx-auto flex items-center justify-between bg-slate-900 border border-white/10 rounded-2xl p-4 mb-8 no-print shadow-2xl">
            <div>
              <h3 className="font-extrabold text-sm text-white">Vista Previa del Informe</h3>
              <p className="text-[10px] text-slate-400">Pulsa 'Imprimir' para guardar como PDF en tu dispositivo</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPrintPreview(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold cursor-pointer"
              >
                Volver a la edición
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg cursor-pointer"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl print:shadow-none print:p-0 print:rounded-none min-h-[297mm]">
            <div className="border-b border-slate-200 pb-6 mb-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Informe de Entrenamiento</span>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{title || "Sin título"}</h1>
                  <p className="text-xs text-slate-500 mt-1">Equipo: {teams.find(t => t.id === teamId)?.name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-slate-900">{new Date(date).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Hora: {startTime} h</p>
                  <p className="text-xs text-slate-500 mt-0.5">Duración: {durationMin} min</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Carga Planificada</span>
                  <span className="font-extrabold text-slate-800">{plannedLoad || "—"}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Intensidad</span>
                  <span className="font-extrabold text-slate-800">{plannedIntensity || "—"}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Día Microciclo</span>
                  <span className="font-extrabold text-slate-800">{microcycleDay || "—"}</span>
                </div>
              </div>
            </div>

            {(objectives.length > 0 || notes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 mb-6 border-b border-slate-200 text-xs">
                {objectives.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-2">Objetivos</h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-650">
                      {objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                    </ul>
                  </div>
                )}
                {notes && (
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-2">Notas y Observaciones</h3>
                    <p className="text-slate-655 leading-relaxed whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="pb-6 mb-6 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-3">Convocatoria de la Sesión</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                {presentPlayers.map(p => (
                  <div key={p.id} className="p-2 border border-slate-100 rounded-lg bg-slate-50 flex items-center gap-1.5 font-semibold text-slate-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate">{p.first_name} {p.last_name}</span>
                  </div>
                ))}
                {(matchGamePlan.substitutes as string[] ?? []).map((id: string) => {
                  const p = presentPlayers.find(pl => pl.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="p-2 border border-slate-100 rounded-lg bg-slate-50 flex items-center gap-1.5 font-semibold text-slate-700">
                      <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      <span className="truncate">{p.first_name} {p.last_name} (Suplente)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {sessionType === "match" && (
              <div className="pb-6 mb-6 border-b border-slate-200 print:break-before-page">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Plan de Partido Táctico</h2>
                <MatchGamePlan
                  presentPlayers={presentPlayers}
                  value={matchGamePlan}
                  interactive={false}
                  organizationSettings={organizationSettings}
                />
              </div>
            )}

            {sessionType !== "match" && exercises.length > 0 && (
              <div className="space-y-6 print:break-before-page">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Fichas Técnicas de Ejercicios ({exercises.length} tareas)</h2>
                {exercises.map((ex, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-2xl p-5 space-y-4 print:break-inside-avoid">
                    <div className="flex justify-between items-start border-b border-slate-150 pb-2.5">
                      <div>
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          Tarea {idx + 1}
                        </span>
                        <h4 className="font-extrabold text-slate-900 mt-1">{ex.title}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{ex.category}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500 font-semibold">
                        <p>Duración: {ex.duration_min} min</p>
                        <p>Recuperación: {ex.recovery_min} min</p>
                        {ex.group_setup?.parallel && (
                          <span className="inline-block text-[8px] font-extrabold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 border border-amber-100">
                            En paralelo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-1">Áreas del campo</span>
                        <div className="flex flex-wrap gap-1">
                          {ex.pitch_zones.length === 0 ? (
                            <span className="text-slate-500 italic">Todo el campo</span>
                          ) : (
                            ex.pitch_zones.map((z: string) => (
                              <span key={z} className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 text-[10px]">
                                Zona {z}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-1">Material</span>
                        <div className="flex flex-wrap gap-1">
                          {ex.equipment.length === 0 ? (
                            <span className="text-slate-500 italic">Sin material específico</span>
                          ) : (
                            ex.equipment.map((eq: any, i: number) => (
                              <span key={i} className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-semibold text-slate-700 text-[10px]">
                                {eq.quantity}x {eq.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {ex.group_setup?.is_strength && (
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                        <span className="block text-[8px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">Pautas de Fuerza</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="block text-[9px] text-slate-500 font-bold">Series:</span>
                            <span className="font-extrabold text-slate-800">{ex.group_setup?.strength_sets ?? 3}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-bold">Repeticiones:</span>
                            <span className="font-extrabold text-slate-800">{ex.group_setup?.strength_reps ?? 10}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-bold">Tiempo:</span>
                            <span className="font-extrabold text-slate-800">{ex.group_setup?.strength_time ?? "45s"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {ex.group_setup?.groups && ex.group_setup.groups.length > 0 && (
                      <div className="space-y-2">
                        <span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Organización de Grupos</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ex.group_setup.groups.map((g: any, gIdx: number) => (
                            <div key={gIdx} className="p-3 border border-slate-100 bg-slate-50 rounded-xl">
                              <span className="block font-bold text-slate-800 text-[11px] border-b border-slate-200 pb-1 mb-1.5">
                                {g.name} ({g.players?.length ?? 0})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(g.players ?? []).map((id: string) => {
                                  const pName = presentPlayers.find(pl => pl.id === id);
                                  return pName ? (
                                    <span key={id} className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                                      {pName.first_name} {pName.last_name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: EXERCISE LIBRARY SELECTOR ── */}
      {isLibraryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-3xl border border-white/10 flex flex-col max-h-[80vh] overflow-hidden shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Biblioteca de Ejercicios</h3>
              <button
                type="button"
                onClick={() => {
                  setIsLibraryOpen(false);
                  setIsCreatingExercise(false);
                }}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Toggle mode */}
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs text-slate-400 font-semibold">
                  {isCreatingExercise ? "Crear Nueva Tarea" : "Seleccionar de la Lista"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingExercise(!isCreatingExercise)}
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isCreatingExercise ? "Ver Biblioteca" : "Crear Ejercicio Rápido"}
                </button>
              </div>

              {isCreatingExercise ? (
                <form onSubmit={handleCreateExerciseInline} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Título del Ejercicio *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Rondo 5v2 en zona"
                      value={newExTitle}
                      onChange={(e) => setNewExTitle(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Categoría
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Táctica, Técnica"
                        value={newExCategory}
                        onChange={(e) => setNewExCategory(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Dificultad
                      </label>
                      <select
                        value={newExDifficulty}
                        onChange={(e) => setNewExDifficulty(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      >
                        <option value="beginner">Principiante</option>
                        <option value="intermediate">Intermedio</option>
                        <option value="advanced">Avanzado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Descripción táctica / Pautas
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describir las reglas del ejercicio y el foco..."
                      value={newExDesc}
                      onChange={(e) => setNewExDesc(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingExLoading}
                    className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-2.5 transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-60 cursor-pointer"
                  >
                    {creatingExLoading ? "Guardando ejercicio..." : "Registrar y Añadir a Sesión"}
                  </button>
                </form>
              ) : (
                /* Exercise List */
                <div className="space-y-2">
                  {exerciseLibrary.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs italic">
                      No hay ejercicios registrados en la biblioteca.
                    </div>
                  ) : (
                    exerciseLibrary.map((item) => {
                      const isAdded = exercises.some((ex) => ex.exercise_id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            isAdded
                              ? "border-emerald-500/20 bg-emerald-500/5 opacity-60"
                              : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <div className="overflow-hidden">
                            <span className="text-xs font-extrabold text-white block">{item.title}</span>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mt-0.5">
                              {item.category} • {item.difficulty || "General"}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => addExercise(item)}
                            className={cn(
                              "rounded-lg text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer",
                              isAdded
                                ? "bg-white/5 text-emerald-400 border border-white/5 cursor-default"
                                : "bg-emerald-500 hover:bg-emerald-400 text-white"
                            )}
                          >
                            {isAdded ? "Añadido" : "Seleccionar"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PIZARRA TÁCTICA ── */}
      {whiteboardExerciseIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-4xl rounded-3xl border border-white/10 flex flex-col max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">Pizarra Táctica</h3>
                <p className="text-xs text-slate-400 mt-0.5">{exercises[whiteboardExerciseIndex]?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setWhiteboardExerciseIndex(null)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer p-2"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <TaskWhiteboard
                value={exercises[whiteboardExerciseIndex]?.whiteboard_data}
                onChange={(wbData) => {
                  updateExerciseField(whiteboardExerciseIndex, "whiteboard_data", wbData);
                  // Also optionally set pitch zone/space dimensions if needed
                  if (wbData.spaceDimensions) {
                    updateExerciseField(whiteboardExerciseIndex, "space_dimensions", wbData.spaceDimensions);
                  }
                  if (wbData.zone) {
                    updateExerciseField(whiteboardExerciseIndex, "whiteboard_zone", wbData.zone);
                  }
                }}
                interactive={true}
                onClose={() => setWhiteboardExerciseIndex(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
