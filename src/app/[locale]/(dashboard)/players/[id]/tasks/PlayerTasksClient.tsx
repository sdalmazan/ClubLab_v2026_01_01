"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Trash2, ClipboardList } from "lucide-react";
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

  // Assignment Form State
  const [selectedExerciseId, setSelectedExerciseId] = useState(library[0]?.id ?? "");
  const [staffComment, setStaffComment] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  async function handleAssign(e: React.FormEvent) {
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

      // Reload tasks list
      const tasksRes = await fetch(`/api/players/${playerId}`);
      // Wait, instead of fetching player details from api (which might not exist or return tasks), we can just fetch and reload tasks by refreshing the route:
      router.refresh();
      // Or we can query the tasks route if we had a GET endpoint. Let's do a refresh of the page:
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Error al asignar la tarea.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleDelete(playerTaskId: string) {
    const confirmed = window.confirm(
      "¿Seguro que quieres quitar esta tarea asignada al jugador?"
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

      // Refresh page to load updated tasks
      window.location.reload();
    } catch (err: any) {
      alert("Error al desasignar: " + err.message);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 corp-input-focus transition-all";

  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Asignación Individual
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Asigna pautas y ejercicios de recuperación o prevención para {player.sporting_name || `${player.first_name} ${player.last_name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* FORMULARIO DE ASIGNACIÓN */}
        <div className="lg:col-span-1 glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 corp-icon" />
            Asignar Ejercicio
          </h2>

          {library.length === 0 ? (
            <p className="text-slate-400 text-xs py-4 text-center">
              No hay ejercicios en la biblioteca.
            </p>
          ) : (
            <form onSubmit={handleAssign} className="space-y-4">
              {assignSuccess && (
                <div className="rounded-xl corp-badge px-3.5 py-2.5 text-xs font-bold">
                  ✓ Ejercicio asignado con éxito.
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-red-400 text-xs font-bold">
                  ⚠️ {error}
                </div>
              )}

              {/* Selección de Ejercicio */}
              <div>
                <label htmlFor="select-exercise" className={labelClass}>Seleccionar Ejercicio</label>
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

              {/* Comentario */}
              <div>
                <label htmlFor="staff-comment" className={labelClass}>Comentario o Nota para el Jugador</label>
                <textarea
                  id="staff-comment"
                  placeholder="Ej: Realizar antes del entrenamiento, 3 series de 10 repeticiones..."
                  rows={4}
                  value={staffComment}
                  onChange={(e) => setStaffComment(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={assignLoading}
                className="w-full rounded-xl btn-corporate font-semibold text-sm py-2.5 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {assignLoading ? "Asignando..." : "Asignar Ejercicio"}
              </button>
            </form>
          )}
        </div>

        {/* LISTADO DE TAREAS ASIGNADAS */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-indigo-500" />
            Ejercicios Asignados Actualmente
          </h2>

          {assignedTasks.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center italic">
              El jugador no tiene tareas o ejercicios asignados actualmente.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {assignedTasks.map((pt) => {
                const task = pt.exercise;
                if (!task) return null;

                return (
                  <div
                    key={pt.id}
                    className="py-4 flex justify-between items-start gap-4 hover:bg-white/[0.01] rounded-xl px-2 transition-all"
                  >
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-extrabold text-white text-base">
                          {task.title}
                        </span>
                        <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
                          {task.category || "General"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        Dificultad: {task.difficulty || "No especificada"}
                      </div>

                      {pt.staff_comment && (
                        <p className="text-xs text-indigo-200/80 bg-indigo-500/[0.03] border border-indigo-500/[0.05] p-2.5 rounded-xl italic">
                          Nota preparador: "{pt.staff_comment}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(pt.id)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-450 hover:text-rose-450 text-sm transition-all duration-150 cursor-pointer flex-shrink-0"
                      title="Desasignar ejercicio"
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
