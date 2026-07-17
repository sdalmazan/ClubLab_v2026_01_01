"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  ArrowLeft,
  Check,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Users,
  Grid,
  Sparkles,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { TacticalConceptsSelector } from "@/components/training/TacticalConceptsSelector";
import { MuscleGroupsSelector } from "@/components/training/MuscleGroupsSelector";
import { TaskWhiteboard } from "@/components/training/TaskWhiteboard";
import { PitchGridSelector } from "@/components/training/PitchGridSelector";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  library_scope: string | null;
  tactical_concepts: string[];
  muscle_groups: string[];
  space_dimensions?: string | null;
  needs_groups?: boolean;
  num_groups?: number | null;
  players_per_group?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  whiteboard_data?: any;
}

export default function ExercisesLibraryPage() {
  const supabase = createClient();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedScope, setSelectedScope] = useState("all");

  // Modal State (Combined Create/Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Táctica");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [scope, setScope] = useState("coach");
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [spaceDimensions, setSpaceDimensions] = useState("");
  const [needsGroups, setNeedsGroups] = useState(false);
  const [numGroups, setNumGroups] = useState<number>(2);
  const [playersPerGroup, setPlayersPerGroup] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [whiteboardData, setWhiteboardData] = useState<any>(null);
  const [selectedPitchZones, setSelectedPitchZones] = useState<string[]>([]);
  const [showWhiteboardModal, setShowWhiteboardModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadExercises();
    fetchUserRole();
  }, []);

  async function fetchUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_organization_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (roleData) {
          setUserRole(roleData.role);
        }
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
    }
  }

  async function loadExercises() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/training/exercises");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al cargar ejercicios");
      setExercises(data ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error al cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }

  // Open modal for creating a new exercise
  function openCreateModal() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("Táctica");
    setDifficulty("intermediate");
    setScope("coach");
    setSelectedConcepts([]);
    setSelectedMuscles([]);
    setSpaceDimensions("");
    setNeedsGroups(false);
    setNumGroups(2);
    setPlayersPerGroup("");
    setImageUrl("");
    setVideoUrl("");
    setWhiteboardData(null);
    setSelectedPitchZones([]);
    setIsModalOpen(true);
  }

  // Open modal for editing an existing exercise
  function openEditModal(ex: Exercise) {
    const isAcademiaAdmin = userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach";
    
    if (ex.library_scope === "global" && userRole !== "super_admin") {
      setEditingId(null);
      setScope(isAcademiaAdmin ? "academy" : "coach");
    } else if (ex.library_scope === "academy" && !isAcademiaAdmin) {
      setEditingId(null);
      setScope("coach");
    } else {
      setEditingId(ex.id);
      setScope(ex.library_scope || "coach");
    }
    setTitle(ex.title);
    setDescription(ex.description || "");
    setCategory(ex.category || "Táctica");
    setDifficulty(ex.difficulty || "intermediate");
    setSelectedConcepts(ex.tactical_concepts || []);
    setSelectedMuscles(ex.muscle_groups || []);
    setSpaceDimensions(ex.space_dimensions || "");
    setNeedsGroups(!!ex.needs_groups);
    setNumGroups(ex.num_groups ?? 2);
    setPlayersPerGroup(ex.players_per_group || "");
    setImageUrl(ex.image_url || "");
    setVideoUrl(ex.video_url || "");
    setWhiteboardData(ex.whiteboard_data || null);
    setSelectedPitchZones(ex.whiteboard_data?.pitch_zones ?? []);
    setIsModalOpen(true);
  }

  // Clone an existing exercise to use as starting point
  function handleClone(ex: Exercise) {
    const isAcademiaAdmin = userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach";
    
    setEditingId(null);
    setTitle(`${ex.title} (Copia)`);
    setDescription(ex.description || "");
    setCategory(ex.category || "Táctica");
    setDifficulty(ex.difficulty || "intermediate");
    
    let newScope = ex.library_scope || "coach";
    if (ex.library_scope === "global" && userRole !== "super_admin") {
      newScope = isAcademiaAdmin ? "academy" : "coach";
    } else if (ex.library_scope === "academy" && !isAcademiaAdmin) {
      newScope = "coach";
    }
    setScope(newScope);

    setSelectedConcepts(ex.tactical_concepts || []);
    setSelectedMuscles(ex.muscle_groups || []);
    setSpaceDimensions(ex.space_dimensions || "");
    setNeedsGroups(!!ex.needs_groups);
    setNumGroups(ex.num_groups ?? 2);
    setPlayersPerGroup(ex.players_per_group || "");
    setImageUrl(ex.image_url || "");
    setVideoUrl(ex.video_url || "");
    setWhiteboardData(ex.whiteboard_data || null);
    setSelectedPitchZones(ex.whiteboard_data?.pitch_zones ?? []);
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        id: editingId, // only needed for PUT
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim(),
        difficulty,
        library_scope: scope,
        tactical_concepts: selectedConcepts,
        muscle_groups: selectedMuscles,
        space_dimensions: spaceDimensions.trim() || null,
        needs_groups: needsGroups,
        num_groups: needsGroups ? numGroups : 2,
        players_per_group: needsGroups ? playersPerGroup.trim() || null : null,
        image_url: imageUrl.trim() || null,
        video_url: videoUrl.trim() || null,
        whiteboard_data: whiteboardData ? { ...whiteboardData, pitch_zones: selectedPitchZones } : (selectedPitchZones.length > 0 ? { pitch_zones: selectedPitchZones } : null),
        whiteboard_zone: whiteboardData?.zone || "full_field",
      };

      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/training/exercises", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el ejercicio");

      if (editingId) {
        setExercises((prev) => prev.map((ex) => (ex.id === editingId ? data : ex)));
        setSuccess(`Ejercicio "${title}" actualizado correctamente.`);
      } else {
        setExercises((prev) => [data, ...prev]);
        setSuccess(`Ejercicio "${title}" creado y guardado en tu biblioteca.`);
      }
      
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error al guardar el ejercicio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Seguro que deseas eliminar "${name}" de la biblioteca?`)) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: delErr } = await supabase
        .from("exercises")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      setSuccess(`Ejercicio "${name}" eliminado correctamente.`);
    } catch (err: any) {
      console.error(err);
      setError("Error al eliminar el ejercicio.");
    }
  }

  const categories = ["all", ...Array.from(new Set(exercises.map((e) => e.category).filter(Boolean)))];

  const filtered = exercises.filter((ex) => {
    const matchesSearch =
      ex.title.toLowerCase().includes(search.toLowerCase()) ||
      (ex.description?.toLowerCase() ?? "").includes(search.toLowerCase());

    const matchesCategory = selectedCategory === "all" || ex.category === selectedCategory;
    const matchesScope = selectedScope === "all" || ex.library_scope === selectedScope;

    return matchesSearch && matchesCategory && matchesScope;
  });

  const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder-slate-700";
  const selectClass =
    "w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all cursor-pointer";

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/training"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Planificación
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 corp-icon" />
            Biblioteca de Ejercicios
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Administra tus tareas, ejercicios físicos de fuerza y pizarras tácticas.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold px-4 py-2.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
        >
          <Plus className="h-4 w-4" />
          Nueva Tarea / Ejercicio
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white/2 p-3 border border-white/5 rounded-2xl">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por título o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-slate-900 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            {categories.filter((c) => c !== "all").map((cat) => (
              <option key={cat} value={cat ?? ""}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Niveles</option>
            <option value="global">ClubLab</option>
            <option value="academy">Academia</option>
            <option value="coach">Personal</option>
          </select>
        </div>
      </div>

      {/* Grid of Exercises */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-500 mt-2">Cargando biblioteca...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500 italic text-sm">
          No hay ejercicios registrados que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="glass rounded-2xl border border-white/10 p-5 flex flex-col justify-between hover:border-white/15 transition-all shadow-xl hover:shadow-2xl"
            >
              <div className="space-y-3.5">
                {/* Header info */}
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-extrabold text-white text-sm line-clamp-1" title={ex.title}>
                    {ex.title}
                  </h3>
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5 shrink-0">
                    {ex.library_scope === "global"
                      ? "ClubLab"
                      : ex.library_scope === "academy"
                      ? "Academia"
                      : "Personal"}
                  </span>
                </div>

                {/* Subheader info */}
                <div className="flex items-center justify-between text-[9px] text-emerald-450 font-bold uppercase tracking-wider">
                  <span>{ex.category || "General"}</span>
                  <span>
                    {ex.difficulty === "beginner"
                      ? "Principiante"
                      : ex.difficulty === "advanced"
                      ? "Avanzado"
                      : "Intermedio"}
                  </span>
                </div>

                {/* Whiteboard visual thumbnail */}
                <div className="relative rounded-xl border border-white/5 bg-slate-950 aspect-[5/3] overflow-hidden flex items-center justify-center">
                  {ex.whiteboard_data?.imageDataUrl ? (
                    <img
                      src={ex.whiteboard_data.imageDataUrl}
                      alt={ex.title}
                      className="w-full h-full object-contain"
                    />
                  ) : ex.image_url ? (
                    <img
                      src={ex.image_url}
                      alt={ex.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 flex flex-col items-center gap-1.5 opacity-40">
                      <Sparkles className="h-6 w-6 text-slate-550" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sin dibujo táctico</span>
                    </div>
                  )}
                </div>

                {/* Groups / Space metadata */}
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/2 p-2 rounded-xl border border-white/5 text-slate-400">
                  <div>
                    <span className="block font-bold text-slate-500 uppercase tracking-wider">Espacio:</span>
                    <span className="font-semibold text-slate-205">{ex.space_dimensions || "No definido"}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-500 uppercase tracking-wider">Grupos / Equipos:</span>
                    <span className="font-semibold text-slate-205">
                      {ex.needs_groups
                        ? `${ex.num_groups ?? 2} equipos (${ex.players_per_group || "S/D"})`
                        : "No requiere"}
                    </span>
                  </div>
                </div>

                {/* Media Links (Strength / Physics) */}
                {(ex.image_url || ex.video_url) && (
                  <div className="flex gap-2 text-[10px] pt-1">
                    {ex.image_url && (
                      <span className="tooltip-container shrink-0">
                        <span
                          className="flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-lg font-semibold cursor-pointer hover:bg-sky-500/15"
                          onClick={() => window.open(ex.image_url!, "_blank")}
                        >
                          <ImageIcon className="h-3 w-3" />
                          Imagen física
                        </span>
                        <span className="tooltip-text">Abrir enlace de imagen</span>
                      </span>
                    )}
                    {ex.video_url && (
                      <span className="tooltip-container shrink-0">
                        <span
                          className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg font-semibold cursor-pointer hover:bg-amber-500/15"
                          onClick={() => window.open(ex.video_url!, "_blank")}
                        >
                          <Video className="h-3 w-3" />
                          Ver Vídeo
                        </span>
                        <span className="tooltip-text">Ver video tutorial</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-medium">
                  {ex.description || "Sin descripción táctica registrada."}
                </p>

                {/* Concepts & Muscles Tags */}
                {((ex.tactical_concepts ?? []).length > 0 || (ex.muscle_groups ?? []).length > 0) && (
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/5">
                    {(ex.tactical_concepts ?? []).slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="text-[8px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider"
                      >
                        {c.replace("_", " ")}
                      </span>
                    ))}
                    {(ex.muscle_groups ?? []).slice(0, 2).map((m) => (
                      <span
                        key={m}
                        className="text-[8px] bg-slate-500/10 border border-white/5 text-slate-350 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons footer */}
              <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between">
                <span className="text-[9px] text-slate-500 font-bold uppercase">
                  ID: #{ex.id.slice(0, 6)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="tooltip-container">
                    <button
                      onClick={() => handleClone(ex)}
                      className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <span className="tooltip-text">Clonar tarea</span>
                  </span>
                  
                  <span className="tooltip-container">
                    <button
                      onClick={() => openEditModal(ex)}
                      className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <span className="tooltip-text">
                      {ex.library_scope === "global" && userRole !== "super_admin"
                        ? "Editar y Personalizar"
                        : ex.library_scope === "academy" && !(userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach")
                        ? "Editar y Personalizar"
                        : "Editar Tarea"}
                    </span>
                  </span>

                  <span className="tooltip-container">
                    <button
                      onClick={() => handleDelete(ex.id, ex.title)}
                      className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-450 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <span className="tooltip-text">Eliminar de biblioteca</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT EXERCISE ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
          className="glass w-full max-w-4xl rounded-3xl border border-white/10 p-6 space-y-5 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-base font-extrabold text-white">
                {editingId ? "Editar Tarea / Ejercicio" : "Nueva Tarea / Ejercicio"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Dibujo Táctico inline */}
              <div className="border border-white/10 rounded-2xl p-4 bg-slate-900/40 space-y-3">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  1. Dibujo Táctico del Ejercicio
                </span>
                <TaskWhiteboard
                  value={whiteboardData}
                  onChange={(wbData) => {
                    setWhiteboardData(wbData);
                  }}
                  interactive={true}
                  title="Pizarra Táctica"
                />
              </div>

              {/* 2. Zonas del Campo (opcional) */}
              <div className="border-t border-white/5 pt-4 space-y-2">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  2. Zonas del Campo (Opcional)
                </span>
                <div className="flex flex-col md:flex-row gap-4 items-center bg-white/2 p-3 rounded-2xl border border-white/5">
                  <PitchGridSelector
                    selectedZones={selectedPitchZones}
                    onChange={setSelectedPitchZones}
                    interactive={true}
                  />
                  <div className="flex-1 w-full space-y-1">
                    <p className="text-xs text-slate-400">Selecciona las zonas del campo táctico utilizadas.</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPitchZones.length === 0 ? (
                        <span className="text-xs text-slate-650 italic">Todo el campo por defecto</span>
                      ) : (
                        selectedPitchZones.map((zone: string) => (
                          <span key={zone} className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-350 font-bold text-[10px] px-2 py-0.5">Zona {zone}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <label className={labelClass}>Título del Ejercicio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Rondo 5v2 con transición rápida"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Táctica, Fuerza"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Dificultad</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className={selectClass}
                  >
                    <option value="beginner" className="bg-slate-950">Principiante</option>
                    <option value="intermediate" className="bg-slate-950">Intermedio</option>
                    <option value="advanced" className="bg-slate-950">Avanzado</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nivel de Acceso (Scope)</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className={selectClass}
                  >
                    <option value="coach" className="bg-slate-950">Personal</option>
                    {(userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach") && (
                      <option value="academy" className="bg-slate-950">Academia</option>
                    )}
                    {userRole === "super_admin" && (
                      <option value="global" className="bg-slate-950">ClubLab</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Descripción / Pautas Tácticas</label>
                <textarea
                  rows={3}
                  placeholder="Describir foco, organización, transiciones..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Physical details & External Links */}
              <div className="border-t border-white/5 pt-4 space-y-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Material de Apoyo Físico (Fuerza / Core / etc.)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Enlace de Imagen Explicativa
                    </label>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/grafico.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Enlace a Vídeo (Ej: YouTube)
                    </label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Space dimensions & needs groups */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Medidas / Espacio (Ej: 30x20m)</label>
                  <input
                    type="text"
                    placeholder="Ej: 40x30m"
                    value={spaceDimensions}
                    onChange={(e) => setSpaceDimensions(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col justify-end gap-1 pb-1">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      id="needs-groups-checkbox-modal"
                      type="checkbox"
                      checked={needsGroups}
                      onChange={(e) => setNeedsGroups(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 corp-accent h-4 w-4"
                    />
                    Requiere equipos / grupos
                  </label>
                </div>
              </div>

              {/* Sub-inputs if groups needed */}
              {needsGroups && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/2 border border-white/5 p-3.5 rounded-2xl animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Número de Equipos / Grupos</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      required
                      value={numGroups}
                      onChange={(e) => setNumGroups(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Jugadores por Equipo (Fórmula)</label>
                    <input
                      type="text"
                      placeholder="Ej: 5 ó 4v4+2"
                      value={playersPerGroup}
                      onChange={(e) => setPlayersPerGroup(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Conceptos Tácticos
                  </span>
                  <TacticalConceptsSelector
                    value={selectedConcepts}
                    onChange={setSelectedConcepts}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Grupos Musculares
                  </span>
                  <MuscleGroupsSelector
                    value={selectedMuscles}
                    onChange={setSelectedMuscles}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-white/5 shadow-inner">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-semibold py-2.5 transition-all cursor-pointer hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-white text-xs font-bold py-2.5 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Ejercicio"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
