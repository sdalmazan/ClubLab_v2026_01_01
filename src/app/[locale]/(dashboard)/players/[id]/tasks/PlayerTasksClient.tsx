"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Trash2, ClipboardList, Sparkles, CheckCircle2 } from "lucide-react";
import type { ExerciseLibraryItem } from "@/services/tasks";

interface PlayerTasksClientProps {
  player: any;
  library: ExerciseLibraryItem[];
  initialTasks: any[];
  playerId: string;
}

export function PlayerTasksClient({
  player,
  library,
  initialTasks,
  playerId,
}: PlayerTasksClientProps) {
  const router = useRouter();

  const [assignedTasks, setAssignedTasks] = useState<any[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);

  // Tab mode: Exercise Task vs Physical Routine
  const [assignMode, setAssignMode] = useState<"task" | "routine">("task");

  // Exercise Assignment Form State
  const [selectedExerciseId, setSelectedExerciseId] = useState(library[0]?.id ?? "");
  const [staffComment, setStaffComment] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Physical Routine Assignment Form State
  const defaultRoutines = [
    { id: "r-1", title: "Calentamiento RAMP Colectivo MD-2", category: "Warm-up", frequency: "Días de partido (MD-2)", timing: "Pre-entrenamiento" },
    { id: "r-2", title: "Protocolo Excéntrico de Isquiotibiales (Nordic)", category: "Prevención", frequency: "2 veces por semana", timing: "Post-entrenamiento" },
    { id: "r-3", title: "Activación Neuromuscular Matutina", category: "Activación", frequency: "Diaria matutina", timing: "Pre-activación" },
    { id: "r-4", title: "Vuelta a la Calma & Down-regulation", category: "Cool-down", frequency: "Post-sesión intensa", timing: "Post-entrenamiento" },
  ];
  const [selectedRoutineId, setSelectedRoutineId] = useState(defaultRoutines[0].id);
  const [routineDays, setRoutineDays] = useState("Lunes, Miércoles, Viernes");
  const [routineTiming, setRoutineTiming] = useState("Pre-entrenamiento (Activación)");

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExerciseId) return;

    setAssignLoading(true);
    setAssignSuccess(false);
    setError(null);

    try {
      const res = await fetch(`/api/players/${playerId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: selectedExerciseId,
          staffComment: staffComment.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al asignar la tarea");
      }

      setAssignSuccess(true);
      setStaffComment("");
      router.refresh();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Error al asignar la tarea.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleAssignRoutine(e: React.FormEvent) {
    e.preventDefault();
    const routine = defaultRoutines.find((r) => r.id === selectedRoutineId);
    if (!routine) return;

    setAssignLoading(true);
    setAssignSuccess(false);
    setError(null);

    try {
      const comment = `Rutina Física: ${routine.title} | Días: ${routineDays} | Momento: ${routineTiming}`;
      const res = await fetch(`/api/players/${playerId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: library[0]?.id || selectedExerciseId,
          staffComment: comment,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al asignar la rutina");
      }

      setAssignSuccess(true);
      router.refresh();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Error al asignar la rutina.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleDelete(playerTaskId: string) {
    const confirmed = window.confirm(
      "¿Seguro que quieres quitar esta asignación al jugador?"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/player-tasks/${playerTaskId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al desasignar");
      }

      window.location.reload();
    } catch (err: any) {
      alert("Error al desasignar: " + err.message);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all";

  const labelClass =
    "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Asignación Individual de Tareas & Rutinas Físicas
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Asigna tareas técnicas, rutinas físicas o protocolos de prevención para <strong className="text-slate-200">{player.sporting_name || `${player.first_name} ${player.last_name}`}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* FORMULARIO DE ASIGNACIÓN */}
        <div className="lg:col-span-1 bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-400" />
              Asignar Trabajo
            </h2>
            
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setAssignMode("task")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  assignMode === "task" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Ejercicio
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("routine")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  assignMode === "routine" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Rutina Física
              </button>
            </div>
          </div>

          {assignSuccess && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Asignación completada con éxito.
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 text-rose-400 text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          {assignMode === "task" ? (
            <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
              <div>
                <label htmlFor="select-exercise" className={labelClass}>Seleccionar Ejercicio de Biblioteca</label>
                <select
                  id="select-exercise"
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className={inputClass}
                  required
                >
                  {library.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.category || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="staff-comment" className={labelClass}>Comentario o Indicaciones Técnicas</label>
                <textarea
                  id="staff-comment"
                  placeholder="Ej: Realizar antes del entrenamiento, 3 series de 10 repeticiones..."
                  rows={3}
                  value={staffComment}
                  onChange={(e) => setStaffComment(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={assignLoading}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 transition-all shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {assignLoading ? "Asignando..." : "Asignar Ejercicio Técnico"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAssignRoutine} className="space-y-4 text-xs">
              <div>
                <label className={labelClass}>Seleccionar Rutina Física</label>
                <select
                  value={selectedRoutineId}
                  onChange={(e) => setSelectedRoutineId(e.target.value)}
                  className={inputClass}
                  required
                >
                  {defaultRoutines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Días Sugeridos para la Rutina</label>
                <input
                  type="text"
                  placeholder="Ej: Lunes, Miércoles, Viernes"
                  value={routineDays}
                  onChange={(e) => setRoutineDays(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Momento Recomendado</label>
                <select
                  value={routineTiming}
                  onChange={(e) => setRoutineTiming(e.target.value)}
                  className={inputClass}
                >
                  <option value="Pre-entrenamiento (Activación)">Pre-entrenamiento (Activación)</option>
                  <option value="Gimnasio Fuerza">Gimnasio Fuerza</option>
                  <option value="Post-entrenamiento (Recuperación)">Post-entrenamiento (Recuperación)</option>
                  <option value="En Casa / Hotel">En Casa / Hotel</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={assignLoading}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 transition-all shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {assignLoading ? "Asignando..." : "Asignar Rutina Física"}
              </button>
            </form>
          )}
        </div>

        {/* LISTADO DE TAREAS Y RUTINAS ASIGNADAS */}
        <div className="lg:col-span-2 bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Dumbbell className="h-4 w-4 text-emerald-400" />
            Planificación Individual Asignada Actualmente
          </h2>

          {assignedTasks.length === 0 ? (
            <p className="text-slate-500 text-xs py-8 text-center italic">
              El jugador no tiene tareas o rutinas asignadas actualmente.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {assignedTasks.map((pt) => {
                const task = pt.exercise;
                if (!task) return null;

                return (
                  <div
                    key={pt.id}
                    className="py-4 flex justify-between items-start gap-4 hover:bg-slate-950/40 rounded-xl px-2 transition-all"
                  >
                    <div className="flex flex-col gap-1.5 w-full text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-extrabold text-white text-sm">
                          {task.title}
                        </span>
                        <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
                          {task.category || "General"}
                        </span>
                      </div>

                      {pt.staff_comment && (
                        <p className="text-xs text-slate-300 bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-medium mt-1">
                          📋 {pt.staff_comment}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(pt.id)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs transition-all cursor-pointer flex-shrink-0"
                      title="Desasignar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
