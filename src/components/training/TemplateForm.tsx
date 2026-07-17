"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  BookOpen,
  Check,
  AlertCircle,
  PenTool,
  PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PitchGridSelector } from "./PitchGridSelector";
import { EquipmentSelector } from "./EquipmentSelector";
import { TacticalConceptsSelector } from "./TacticalConceptsSelector";
import { MuscleGroupsSelector } from "./MuscleGroupsSelector";
import { TaskWhiteboard } from "./TaskWhiteboard";
import type { ExerciseLibraryItem } from "@/services/tasks";
import type { SessionType } from "@/types";

interface TemplateFormProps {
  organizationId: string;
  userId: string;
  exerciseLibrary: ExerciseLibraryItem[];
  initialData?: any; // If editing
  isClone?: boolean;
  userRole?: string;
}

export function TemplateForm({
  organizationId,
  userId,
  exerciseLibrary = [],
  initialData,
  isClone = false,
  userRole = "coach",
}: TemplateFormProps) {
  const router = useRouter();
  const isEdit = !!initialData && !isClone;

  // Determine user permissions
  const isAcademiaAdmin = userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach";

  // 1. Basic Fields State
  const initialTitle = isClone && initialData?.title ? `Copia de ${initialData.title}` : (initialData?.title ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [durationMin, setDurationMin] = useState(initialData?.duration_min ?? 90);
  const [sessionType, setSessionType] = useState<SessionType>(initialData?.session_type ?? "training");
  const [isShared, setIsShared] = useState(initialData?.is_shared ?? false);
  const [libraryScope, setLibraryScope] = useState<string>(initialData?.library_scope ?? "coach");
  const [microcycleDay, setMicrocycleDay] = useState<string>(initialData?.microcycle_day ?? "none");

  // Objectives (array of tags)
  const [objectiveInput, setObjectiveInput] = useState("");
  const [objectives, setObjectives] = useState<string[]>(initialData?.objectives ?? []);

  // 2. Exercises List State
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
        whiteboard_zone: ex.whiteboard_zone ?? null,
        space_dimensions: ex.space_dimensions ?? null,
        tactical_concepts: ex.tactical_concepts ?? [],
        muscle_groups: ex.muscle_groups ?? [],
      }));
    }
    return [];
  });

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [whiteboardExerciseIndex, setWhiteboardExerciseIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Add exercise from library
  const addExercise = (item: ExerciseLibraryItem) => {
    const exists = exercises.some((ex) => ex.exercise_id === item.id);
    if (exists) return; // Prevent duplicates

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
        group_setup: { groups: [{ name: "Equipo Verde" }, { name: "Equipo Azul" }] }, // Default groups
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

  // Generic group settings handlers for templates
  const addGenericGroup = (exIdx: number) => {
    const ex = exercises[exIdx];
    const currentGroups = ex.group_setup?.groups ?? [];
    const name = `Equipo ${String.fromCharCode(65 + currentGroups.length)}`;
    updateExerciseField(exIdx, "group_setup", {
      groups: [...currentGroups, { name }],
    });
  };

  const removeGenericGroup = (exIdx: number, groupIdx: number) => {
    const ex = exercises[exIdx];
    const currentGroups = ex.group_setup?.groups ?? [];
    updateExerciseField(exIdx, "group_setup", {
      groups: currentGroups.filter((_: any, idx: number) => idx !== groupIdx),
    });
  };

  const renameGenericGroup = (exIdx: number, groupIdx: number, newName: string) => {
    if (!newName.trim()) return;
    const ex = exercises[exIdx];
    const currentGroups = ex.group_setup?.groups ?? [];
    updateExerciseField(exIdx, "group_setup", {
      groups: currentGroups.map((g: any, idx: number) =>
        idx === groupIdx ? { ...g, name: newName.trim() } : g
      ),
    });
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

  // Save template form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor, introduce el título de la plantilla.");
      return;
    }

    setSaving(true);
    setError(null);

    // Format payload
    const exercisesPayload = exercises.map((ex, index) => ({
      exercise_id: ex.exercise_id,
      order_index: index,
      duration_min: Number(ex.duration_min),
      recovery_min: Number(ex.recovery_min),
      pitch_zones: ex.pitch_zones,
      equipment: ex.equipment,
      group_setup: ex.group_setup || { groups: [] },
      whiteboard_data: ex.whiteboard_data || null,
      whiteboard_zone: ex.whiteboard_zone || null,
      space_dimensions: ex.space_dimensions || null,
      tactical_concepts: ex.tactical_concepts || [],
      muscle_groups: ex.muscle_groups || [],
    }));

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      duration_min: Number(durationMin),
      session_type: sessionType,
      objectives,
      is_shared: libraryScope === "academy",
      library_scope: libraryScope,
      microcycle_day: microcycleDay === "none" ? null : microcycleDay,
      exercises: exercisesPayload,
    };

    try {
      const url = isEdit ? `/api/training/templates/${initialData.id}` : "/api/training/templates";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error ?? "Error al guardar la plantilla.");
      }

      router.push("/training/templates");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Error en la petición");
      setSaving(false);
    }
  };

  const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 corp-input-focus transition-all";

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-5xl mx-auto">
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── SECCIÓN 1: DATOS BÁSICOS ── */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
          <PenTool className="h-5 w-5 corp-icon" />
          Datos Generales de la Plantilla
        </h2>

        {/* Row 1: Title & Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="template-title" className={labelClass}>Título de la Plantilla *</label>
            <input
              id="template-title"
              type="text"
              required
              placeholder="Ej: Microciclo MD-4 Fuerza General"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="template-type" className={labelClass}>Tipo de Sesión</label>
            <select
              id="template-type"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className={inputClass}
            >
              <option value="training">Entrenamiento</option>
              <option value="match">Partido</option>
              <option value="recovery">Recuperación</option>
              <option value="gym">Gimnasio</option>
              <option value="physical_test">Test Físico</option>
              <option value="rest">Descanso</option>
            </select>
          </div>
        </div>

        {/* Row 2: Duration, Library Scope & Microcycle Day */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="template-duration" className={labelClass}>Duración Estimada (min)</label>
            <input
              id="template-duration"
              type="number"
              required
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="template-scope" className={labelClass}>Biblioteca de Destino</label>
            <select
              id="template-scope"
              value={libraryScope}
              onChange={(e) => {
                const val = e.target.value;
                setLibraryScope(val);
                setIsShared(val === "academy");
              }}
              className={inputClass}
            >
              <option value="coach">Personal (Mis Plantillas)</option>
              {isAcademiaAdmin ? (
                <option value="academy">Metodología (Academia)</option>
              ) : (
                <option value="academy" disabled>Metodología (Academia - Requiere Coordinador)</option>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="template-day" className={labelClass}>Día de Microciclo</label>
            <select
              id="template-day"
              value={microcycleDay}
              onChange={(e) => setMicrocycleDay(e.target.value)}
              className={inputClass}
            >
              <option value="none">Ninguno / General</option>
              <option value="MD-4">MD-4 (Fuerza)</option>
              <option value="MD-3">MD-3 (Resistencia/Duración)</option>
              <option value="MD-2">MD-2 (Velocidad/Transición)</option>
              <option value="MD-1">MD-1 (Activación/ABP)</option>
              <option value="MD">MD (Partido)</option>
              <option value="MD+1">MD+1 (Recuperación)</option>
              <option value="MD+2">MD+2 (Compensación)</option>
            </select>
          </div>
        </div>

        {/* Objectives */}
        <div>
          <label className={labelClass}>Objetivos del Entrenamiento</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {objectives.map((obj, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded corp-badge text-xs px-2.5 py-1 font-semibold"
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
              placeholder="Ej: Posesión en oleadas, Fuerza explosiva..."
              value={objectiveInput}
              onChange={(e) => setObjectiveInput(e.target.value)}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 corp-input-focus transition-all"
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

        {/* Description */}
        <div>
          <label htmlFor="template-desc" className={labelClass}>Descripción estructural de la plantilla</label>
          <textarea
            id="template-desc"
            rows={3}
            placeholder="Introduce directrices sobre qué microciclo se adapta a esta sesión o pautas metodológicas."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* ── SECCIÓN 2: EXERCISES TIMELINE BUILDER ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 corp-icon" />
            Estructura de Ejercicios de la Plantilla
          </h2>
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-1.5 rounded-xl btn-corporate-solid text-white text-xs font-semibold px-4 py-2 shadow-lg transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Añadir Ejercicio
          </button>
        </div>

        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/2 glass-card">
            <CalendarDays className="h-8 w-8 text-slate-500 mb-2 animate-pulse" />
            <p className="text-sm text-slate-400 font-semibold mb-2">No has añadido ningún ejercicio a la plantilla</p>
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="text-xs font-bold corp-text hover:underline flex items-center gap-1"
            >
              Seleccionar de la biblioteca <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((ex, index) => {
              const currentGroups = ex.group_setup?.groups ?? [];
              return (
                <div
                  key={ex.exercise_id + "-" + index}
                  className="glass rounded-2xl border border-white/10 p-5 bg-white/2 space-y-5"
                >
                  {/* Exercise Header */}
                  <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg corp-badge text-xs font-extrabold flex items-center justify-center">
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
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveExercise(index, "up")}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronDown className="h-4.5 w-4.5 rotate-180" />
                      </button>
                      <button
                        type="button"
                        disabled={index === exercises.length - 1}
                        onClick={() => moveExercise(index, "down")}
                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronDown className="h-4.5 w-4.5" />
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1" />
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="p-1 rounded hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subrow: Duration & Recovery */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        <span>Duración de la tarea</span>
                        <span className="corp-text font-extrabold">{ex.duration_min} minutos</span>
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
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer corp-accent"
                      />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        <span>Intervalo / Recuperación</span>
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

                  {/* Subrow: Zonas del campo */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Zonas de Campo Predefinidas
                    </span>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <PitchGridSelector
                        selectedZones={ex.pitch_zones}
                        onChange={(zones) => updateExerciseField(index, "pitch_zones", zones)}
                        interactive={true}
                      />
                      <div className="flex-1 w-full space-y-2">
                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                          Determina los cuadrantes del campo para el montaje de este ejercicio que se guardarán por defecto.
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ex.pitch_zones.map((zone: string) => (
                            <span
                              key={zone}
                              className="rounded corp-badge font-extrabold text-[10px] px-2 py-0.5"
                            >
                              Zona {zone}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subrow: Material y Equipamiento */}
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Equipamiento por defecto
                    </span>
                    <EquipmentSelector
                      value={ex.equipment}
                      onChange={(equip) => updateExerciseField(index, "equipment", equip)}
                      interactive={true}
                    />
                  </div>

                  {/* Subrow: Nombres de grupos/equipos por defecto */}
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Grupos / Equipos por defecto
                    </span>
                    <p className="text-[11px] text-slate-400 italic">
                      Define los nombres de los equipos por defecto para esta tarea. Al programar un entrenamiento, se crearán estos grupos y podrás arrastrar los jugadores reales.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {currentGroups.map((g: any, gIdx: number) => (
                        <div
                          key={gIdx}
                          className="flex items-center gap-2 p-2 rounded-xl border border-white/10 bg-white/2"
                        >
                          <input
                            type="text"
                            value={g.name}
                            onChange={(e) => renameGenericGroup(index, gIdx, e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none focus:border-b focus:border-white/20 w-[100px]"
                          />
                          <button
                            type="button"
                            onClick={() => removeGenericGroup(index, gIdx)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addGenericGroup(index)}
                        className="flex items-center gap-1 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-3 py-2 border border-dashed border-white/20 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Añadir grupo
                      </button>
                    </div>
                  </div>

                  {/* Subrow: Pizarra Táctica */}
                  <div className="border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Dibujo de Tarea / Pizarra
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

                  {/* Subrow: Conceptos Tácticos */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Conceptos Tácticos Trabajados
                    </span>
                    <TacticalConceptsSelector
                      value={ex.tactical_concepts ?? []}
                      onChange={(concepts) => updateExerciseField(index, "tactical_concepts", concepts)}
                    />
                  </div>

                  {/* Subrow: Grupos Musculares */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <span className="block text-xs font-bold text-slate-450 uppercase tracking-wider">
                      Grupos Musculares Solicitados
                    </span>
                    <MuscleGroupsSelector
                      value={ex.muscle_groups ?? []}
                      onChange={(muscles) => updateExerciseField(index, "muscle_groups", muscles)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FORM ACTIONS ── */}
      <div className="flex gap-4 pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-semibold text-sm py-3 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl btn-corporate text-white font-semibold text-sm py-3 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? "Guardando plantilla..." : isEdit ? "Actualizar Plantilla" : "Crear Plantilla"}
        </button>
      </div>

      {/* ── MODAL: EXERCISE SELECTOR ── */}
      {isLibraryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-3xl border border-white/10 flex flex-col max-h-[80vh] overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Biblioteca de Ejercicios</h3>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-sm cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                          ? "corp-badge opacity-60"
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
                            ? "bg-white/5 corp-text border border-white/5 cursor-default"
                            : "btn-corporate-solid text-white"
                        )}
                      >
                        {isAdded ? "Añadido" : "Seleccionar"}
                      </button>
                    </div>
                  );
                })
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
    </form>
  );
}
