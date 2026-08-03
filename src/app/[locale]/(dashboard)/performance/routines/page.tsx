"use client";

import { useState, useEffect } from "react";
import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { createClient } from "@/lib/supabase/client";
import {
  ClipboardList,
  Shield,
  Flame,
  Plus,
  Play,
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  Sparkles,
  Users,
  Send,
  Layers,
  CheckSquare,
  Square,
  BookOpen
} from "lucide-react";

interface RoutineItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  environment: string;
  exercises_count: number;
  frequency?: string;
  suggested_days?: string;
  recommended_timing?: string;
  scope: "coach" | "academy" | "global";
}

interface SquadPlayer {
  id: string;
  name: string;
  position: string;
}

export default function RoutinesPerformancePage() {
  const supabase = createClient();
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filter & Scope state
  const [selectedScope, setSelectedScope] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Multi-player assignment modal state
  const [assigningRoutine, setAssigningRoutine] = useState<RoutineItem | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [assignedSuccess, setAssignedSuccess] = useState<string | null>(null);

  // Individual Session Generator modal state
  const [isIndividualSessionOpen, setIsIndividualSessionOpen] = useState(false);
  const [indivPlayerIds, setIndivPlayerIds] = useState<string[]>([]);
  const [indivDate, setIndivDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [indivTiming, setIndivTiming] = useState<string>("Pre-entrenamiento (Activación)");
  const [indivRoutineIds, setIndivRoutineIds] = useState<string[]>([]);

  // Create Routine modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Prevención");
  const [newEnvironment, setNewEnvironment] = useState("Gimnasio");
  const [newDuration, setNewDuration] = useState("15 min");
  const [newFrequency, setNewFrequency] = useState("3 veces por semana");
  const [newDays, setNewDays] = useState("Lunes, Miércoles, Viernes");
  const [newTiming, setNewTiming] = useState("Pre-entrenamiento (Activación)");
  const [newScope, setNewScope] = useState<"coach" | "academy" | "global">("coach");

  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([
    { id: "p1", name: "Marc Cardona", position: "DC" },
    { id: "p2", name: "Kirian Rodríguez", position: "MC" },
    { id: "p3", name: "Alberto Moleiro", position: "EX" },
    { id: "p4", name: "Alex Suárez", position: "DFC" },
    { id: "p5", name: "Sandro Ramírez", position: "EX" },
    { id: "p6", name: "Mika Mármol", position: "DFC" },
    { id: "p7", name: "José Campaña", position: "MC" },
  ]);

  const [routines, setRoutines] = useState<RoutineItem[]>([
    {
      id: "r-1",
      title: "Calentamiento RAMP Colectivo MD-2",
      category: "Warm-up",
      duration: "15 min",
      environment: "Campo",
      exercises_count: 5,
      frequency: "Días de Partido (MD-2)",
      suggested_days: "MD-2",
      recommended_timing: "Pre-entrenamiento",
      scope: "academy",
    },
    {
      id: "r-2",
      title: "Protocolo Excéntrico de Isquiotibiales (Nordic)",
      category: "Prevención",
      duration: "12 min",
      environment: "Gimnasio",
      exercises_count: 4,
      frequency: "2 veces por semana",
      suggested_days: "Martes, Jueves",
      recommended_timing: "Gimnasio Post-entrenamiento",
      scope: "coach",
    },
    {
      id: "r-3",
      title: "Activación Neuromuscular Matutina",
      category: "Activación",
      duration: "10 min",
      environment: "Hotel/Campo",
      exercises_count: 3,
      frequency: "Diario matutino",
      suggested_days: "Lunes a Viernes",
      recommended_timing: "Pre-activación matutina",
      scope: "global",
    },
    {
      id: "r-4",
      title: "Vuelta a la Calma & Respiración Down-regulation",
      category: "Cool-down",
      duration: "10 min",
      environment: "Campo",
      exercises_count: 4,
      frequency: "Post-sesión intensa",
      suggested_days: "Miércoles, Sábado",
      recommended_timing: "Post-entrenamiento inmediato",
      scope: "academy",
    },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_organization_roles")
            .select("role, organization_id")
            .eq("user_id", user.id)
            .single();
          if (roleData) {
            setUserRole(roleData.role);

            // Fetch real squad players from Supabase
            const { data: playersData } = await supabase
              .from("players")
              .select("id, first_name, last_name, sporting_name, primary_position, is_invisible")
              .eq("organization_id", roleData.organization_id)
              .or("is_invisible.eq.false,is_invisible.is.null")
              .order("last_name", { ascending: true });

            if (playersData && playersData.length > 0) {
              setSquadPlayers(
                playersData
                  .filter((p: any) => p.adjective !== "invisible" && p.is_invisible !== true)
                  .map((p: any) => ({
                    id: p.id,
                    name: p.sporting_name || `${p.first_name} ${p.last_name}`.trim(),
                    position: p.primary_position || "JUG",
                  }))
              );
            }
          }
        }
      } catch (err) {
        console.error("Error fetching squad data:", err);
      }
    }
    loadData();
  }, []);

  // Filter routines by scope and category
  const filteredRoutines = routines.filter((r) => {
    if (selectedScope !== "all" && r.scope !== selectedScope) return false;
    if (selectedCategory !== "all" && r.category !== selectedCategory) return false;
    return true;
  });

  // Toggle multi-select player in assignment modal
  const togglePlayerSelect = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleAllPlayers = () => {
    if (selectedPlayerIds.length === squadPlayers.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(squadPlayers.map((p) => p.id));
    }
  };

  const handleConfirmAssignment = () => {
    if (selectedPlayerIds.length === 0 || !assigningRoutine) return;
    setAssignedSuccess(
      `Rutina "${assigningRoutine.title}" asignada correctamente a ${selectedPlayerIds.length} jugador(es).`
    );
    setAssigningRoutine(null);
    setSelectedPlayerIds([]);
    setTimeout(() => setAssignedSuccess(null), 4000);
  };

  const handleConfirmIndividualSession = () => {
    if (indivPlayerIds.length === 0 || indivRoutineIds.length === 0) return;
    setAssignedSuccess(
      `Sesión Individual generada y notificada a ${indivPlayerIds.length} jugador(es) con ${indivRoutineIds.length} rutina(s).`
    );
    setIsIndividualSessionOpen(false);
    setIndivPlayerIds([]);
    setIndivRoutineIds([]);
    setTimeout(() => setAssignedSuccess(null), 4000);
  };

  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newRoutine: RoutineItem = {
      id: `r-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      duration: newDuration,
      environment: newEnvironment,
      exercises_count: 4,
      frequency: newFrequency,
      suggested_days: newDays,
      recommended_timing: newTiming,
      scope: newScope,
    };

    setRoutines([newRoutine, ...routines]);
    setIsCreateModalOpen(false);
    setNewTitle("");
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100">
      {/* Header & Quick Action Buttons */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl flex items-center gap-2">
            <ClipboardList className="h-7 w-7 corp-text" />
            Biblioteca de Rutinas Físicas & Sesiones Individuales
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de rutinas de fuerza, calentamientos, prevención y generador de sesiones individuales con metadatos de frecuencia y días.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsIndividualSessionOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white transition-all shadow-md cursor-pointer"
          >
            <Sparkles className="h-4 w-4 corp-text" />
            Generar Sesión Individual
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl btn-corporate text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva Rutina
          </button>
        </div>
      </div>

      <PerformanceSubNav />

      {assignedSuccess && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-800 corp-badge p-3.5 text-xs animate-fade-in">
          <CheckCircle2 className="h-4 w-4 corp-text shrink-0" />
          <span>{assignedSuccess}</span>
        </div>
      )}

      {/* Filter Tabs: Role Scope Libraries */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        {/* Scope Tabs */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setSelectedScope("all")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedScope === "all"
                ? "btn-corporate text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Todas las Rutinas
          </button>
          <button
            onClick={() => setSelectedScope("coach")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedScope === "coach"
                ? "btn-corporate text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Biblioteca Personal
          </button>
          <button
            onClick={() => setSelectedScope("academy")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedScope === "academy"
                ? "btn-corporate text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Biblioteca Academia
          </button>
          <button
            onClick={() => setSelectedScope("global")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedScope === "global"
                ? "btn-corporate text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ClubLab (Global)
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Categoría:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas</option>
            <option value="Warm-up">Calentamientos (RAMP)</option>
            <option value="Prevención">Prevención & Isquios</option>
            <option value="Activación">Activación Neuromuscular</option>
            <option value="Cool-down">Recuperación & Vuelta a la Calma</option>
          </select>
        </div>
      </div>

      {/* Routine Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRoutines.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Scope & Category Tag */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-500/20">
                  {r.category}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {r.scope === "global"
                    ? "ClubLab"
                    : r.scope === "academy"
                    ? "Academia"
                    : "Personal"}
                </span>
              </div>

              <h2 className="text-sm font-bold text-white leading-snug">{r.title}</h2>

              {/* Execution Metadata (Frecuencia, Días, Momento) */}
              <div className="space-y-1.5 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                {r.frequency && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">Frecuencia sugerida:</span>
                    <span className="font-semibold text-slate-200">{r.frequency}</span>
                  </div>
                )}

                {r.suggested_days && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">Días recomendados:</span>
                    <span className="font-semibold text-emerald-400">{r.suggested_days}</span>
                  </div>
                )}

                {r.recommended_timing && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">Momento / Contexto:</span>
                    <span className="font-semibold text-cyan-400">{r.recommended_timing}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-3">
                <span>Entorno: <strong className="text-slate-300">{r.environment}</strong></span>
                <span>{r.duration} • {r.exercises_count} Ejercicios</span>
              </div>
            </div>

            {/* Action Button: Asignar Rutina */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setAssigningRoutine(r);
                  setSelectedPlayerIds([]);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-corporate text-white text-xs font-bold py-2.5 transition-all shadow cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                Asignar Rutina a Jugadores
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL: AGILE MULTI-PLAYER ASSIGNMENT ── */}
      {assigningRoutine && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl w-full max-w-lg rounded-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <UserCheck className="h-5 w-5 corp-text" />
                  Asignar Rutina a Plantilla
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rutina: <strong className="text-slate-200">{assigningRoutine.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setAssigningRoutine(null)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Selecciona Jugadores ({selectedPlayerIds.length}/{squadPlayers.length})
                </span>
                <button
                  type="button"
                  onClick={toggleAllPlayers}
                  className="text-xs corp-text hover:underline font-bold"
                >
                  {selectedPlayerIds.length === squadPlayers.length ? "Desmarcar Todos" : "Seleccionar Todos"}
                </button>
              </div>

              {/* Player Checkboxes List */}
              <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {squadPlayers.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  return (
                    <div
                      key={player.id}
                      onClick={() => togglePlayerSelect(player.id)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "corp-badge text-white font-bold"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 corp-text" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-600" />
                        )}
                        <span className="text-xs font-bold">{player.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                        {player.position}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssigningRoutine(null)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedPlayerIds.length === 0}
                onClick={handleConfirmAssignment}
                className="flex-1 rounded-xl btn-corporate text-white text-xs font-extrabold py-2.5 transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              >
                Asignar ({selectedPlayerIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GENERAR SESIÓN INDIVIDUAL DE RUTINAS ── */}
      {isIndividualSessionOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl w-full max-w-xl rounded-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 corp-text" />
                  Asignar Sesión Individual de Rutinas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecciona jugadores y añade la lista de rutinas de la biblioteca con series, duración y descansos.
                </p>
              </div>
              <button
                onClick={() => setIsIndividualSessionOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Select Players */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">1. Jugador(es) Destinatarios *</label>
                <div className="flex flex-wrap gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-32 overflow-y-auto">
                  {squadPlayers.map((player) => {
                    const isSelected = indivPlayerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() =>
                          setIndivPlayerIds((prev) =>
                            prev.includes(player.id)
                              ? prev.filter((id) => id !== player.id)
                              : [...prev, player.id]
                          )
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                          isSelected
                            ? "corp-badge font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {player.name} ({player.position})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Date & Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fecha Programada</label>
                  <input
                    type="date"
                    value={indivDate}
                    onChange={(e) => setIndivDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Momento / Contexto</label>
                  <select
                    value={indivTiming}
                    onChange={(e) => setIndivTiming(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Pre-entrenamiento (Activación)">Pre-entrenamiento (Activación)</option>
                    <option value="Gimnasio Fuerza">Gimnasio Fuerza</option>
                    <option value="Post-entrenamiento (Recuperación)">Post-entrenamiento (Recuperación)</option>
                    <option value="En Casa / Hotel">En Casa / Hotel</option>
                  </select>
                </div>
              </div>

              {/* 3. Simple List of Routines with Reps / Duration / Rest */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-bold">2. Lista de Rutinas Asignadas *</label>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="text-[11px] font-bold corp-text hover:underline"
                  >
                    + Crear Nueva Rutina
                  </button>
                </div>

                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-52 overflow-y-auto">
                  {routines.map((r) => {
                    const isSelected = indivRoutineIds.includes(r.id);
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          isSelected
                            ? "bg-slate-900 border-slate-700 text-white"
                            : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div
                          onClick={() =>
                            setIndivRoutineIds((prev) =>
                              prev.includes(r.id)
                                ? prev.filter((id) => id !== r.id)
                                : [...prev, r.id]
                            )
                          }
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 corp-text" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-600" />
                            )}
                            <span className="font-bold text-xs">{r.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{r.category}</span>
                        </div>

                        {/* Extra execution details (Series/Reps, Duration/Load, Descansos) when selected */}
                        {isSelected && (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[10px]">
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Series / Reps</span>
                              <input
                                type="text"
                                defaultValue="3 series x 10 reps"
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Duración / Carga</span>
                              <input
                                type="text"
                                defaultValue={r.duration}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold mb-0.5">Descanso</span>
                              <input
                                type="text"
                                defaultValue="60 seg"
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsIndividualSessionOpen(false)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={indivPlayerIds.length === 0 || indivRoutineIds.length === 0}
                onClick={handleConfirmIndividualSession}
                className="flex-1 rounded-xl btn-corporate text-white text-xs font-extrabold py-2.5 transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              >
                Asignar & Notificar ({indivPlayerIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA RUTINA ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRoutine}
            className="bg-slate-900 border border-slate-800 shadow-2xl w-full max-w-lg rounded-2xl p-6 space-y-4 animate-fade-in"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">Nueva Rutina Físico-Preventiva</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Título de la Rutina *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Protocolo de Prevención de Isquiotibiales"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Warm-up">Warm-up / RAMP</option>
                    <option value="Prevención">Prevención / Fuerza</option>
                    <option value="Activación">Activación</option>
                    <option value="Cool-down">Vuelta a la Calma</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Entorno</label>
                  <select
                    value={newEnvironment}
                    onChange={(e) => setNewEnvironment(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Gimnasio">Gimnasio</option>
                    <option value="Campo">Campo</option>
                    <option value="Hotel/Casa">Hotel/Casa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Frecuencia Recomendada</label>
                  <input
                    type="text"
                    placeholder="Ej: 3 veces por semana"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Días Recomendados</label>
                  <input
                    type="text"
                    placeholder="Ej: Lunes, Miércoles, Viernes"
                    value={newDays}
                    onChange={(e) => setNewDays(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Momento Recomendado</label>
                  <input
                    type="text"
                    placeholder="Ej: Pre-entrenamiento"
                    value={newTiming}
                    onChange={(e) => setNewTiming(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Biblioteca de Destino</label>
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="coach">Personal (Prep Físico / Entrenador)</option>
                    {(userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach") && (
                      <option value="academy">Academia (Coordinador / Admin)</option>
                    )}
                    {userRole === "super_admin" && (
                      <option value="global">ClubLab (Superadmin)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold py-2.5 transition-all cursor-pointer"
              >
                Guardar Rutina
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
