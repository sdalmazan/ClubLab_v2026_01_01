"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Plus,
  ChevronLeft,
  ArrowRight,
  Edit,
  Trash2,
  Copy,
  Sparkles,
  Search,
  Calendar,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionTemplate } from "@/types";

// Translation labels for session types
const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Entrenamiento",
  individual: "Individual",
  match: "Partido",
  recovery: "Recuperación",
  gym: "Gimnasio",
  physical_test: "Test Físico",
  rest: "Descanso"
};

const SESSION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  training: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" }, // kept: dynamic typeStyles colours; not inline-removable
  individual: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  match: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  recovery: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  gym: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  physical_test: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  rest: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" }
};

interface TemplatesClientProps {
  templates: SessionTemplate[];
  userRole: string;
  userId: string;
}

export function TemplatesClient({ templates, userRole, userId }: TemplatesClientProps) {
  const router = useRouter();
  const [templatesList, setTemplatesList] = useState<SessionTemplate[]>(templates);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedConcept, setSelectedConcept] = useState<string>("all");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Permission helpers
  const isAcademiaAdmin = userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach";

  const canManageTemplate = (tpl: SessionTemplate) => {
    if (tpl.library_scope === "global") return userRole === "super_admin";
    if (tpl.library_scope === "academy") return isAcademiaAdmin;
    // Personal scope: owner or academy admin
    return tpl.created_by === userId || isAcademiaAdmin;
  };

  // Compile all unique tactical concepts from current templates list
  const uniqueTacticalConcepts = useMemo(() => {
    const concepts = new Set<string>();
    templatesList.forEach((tpl) => {
      tpl.exercises?.forEach((te) => {
        // Collect from the template override or the base exercise
        te.tactical_concepts?.forEach((c: string) => c && concepts.add(c));
        te.exercise?.tactical_concepts?.forEach((c: string) => c && concepts.add(c));
      });
    });
    return Array.from(concepts).sort();
  }, [templatesList]);

  // Handle template deletion
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la plantilla "${title}"?`)) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/training/templates/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error ?? "Error al eliminar la plantilla.");
      }

      setTemplatesList((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      setError(err.message ?? "Error en la petición");
    } finally {
      setDeletingId(null);
    }
  };

  // Filter logic
  const filteredTemplates = useMemo(() => {
    return templatesList.filter((tpl) => {
      // 1. Text Search
      const search = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !search ||
        tpl.title.toLowerCase().includes(search) ||
        (tpl.description || "").toLowerCase().includes(search);

      // 2. Library/Scope Filter
      const matchesScope =
        selectedScope === "all" ||
        (selectedScope === "coach" && tpl.library_scope === "coach") ||
        (selectedScope === "academy" && tpl.library_scope === "academy") ||
        (selectedScope === "global" && tpl.library_scope === "global");

      // 3. Microcycle Day Filter
      const matchesDay =
        selectedDay === "all" ||
        (selectedDay === "none" && !tpl.microcycle_day) ||
        (tpl.microcycle_day as string) === selectedDay;

      // 4. Tactical Concept Filter
      let matchesConcept = selectedConcept === "all";
      if (!matchesConcept) {
        matchesConcept = (tpl.exercises ?? []).some((te) => {
          const concepts = [
            ...(te.tactical_concepts || []),
            ...(te.exercise?.tactical_concepts || [])
          ];
          return concepts.includes(selectedConcept);
        });
      }

      return matchesSearch && matchesScope && matchesDay && matchesConcept;
    });
  }, [templatesList, searchQuery, selectedScope, selectedDay, selectedConcept]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/training"
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-white mb-2 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver a planificación
          </Link>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 corp-icon" />
            Biblioteca de Sesiones
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Estructuras predefinidas de entrenamiento para simplificar tu trabajo diario.
          </p>
        </div>
        <Link
          href="/training/templates/new"
          className="flex items-center gap-2 rounded-xl btn-corporate text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-start gap-2.5 max-w-5xl mx-auto w-full">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── FILTERS BAR ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white/2 p-3 border border-white/5 rounded-2xl">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar plantilla..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-slate-900 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none corp-input-focus"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Library Scope Filter */}
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las Bibliotecas</option>
            <option value="coach">Personal (Mis Plantillas)</option>
            <option value="academy">Metodología (Academia)</option>
            <option value="global">ClubLab (Globales)</option>
          </select>

          {/* Microcycle Day Filter */}
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Días de Ciclo</option>
            <option value="none">Sin Día Asignado</option>
            <option value="MD-4">MD-4 (Fuerza)</option>
            <option value="MD-3">MD-3 (Resistencia)</option>
            <option value="MD-2">MD-2 (Velocidad)</option>
            <option value="MD-1">MD-1 (ABP / Activación)</option>
            <option value="MD">MD (Partido)</option>
            <option value="MD+1">MD+1 (Recuperación)</option>
            <option value="MD+2">MD+2 (Compensación)</option>
          </select>

          {/* Tactical Concept Filter */}
          <select
            value={selectedConcept}
            onChange={(e) => setSelectedConcept(e.target.value)}
            className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Conceptos Tácticos</option>
            {uniqueTacticalConcepts.map((concept) => (
              <option key={concept} value={concept}>
                {concept.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── GRID LIST ── */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl border border-white/5 bg-white/2">
          <BookOpen className="h-10 w-10 text-slate-600 mb-3 animate-pulse" />
          <p className="text-slate-300 font-semibold">No se encontraron plantillas</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm text-center">
            Ajusta los filtros o crea una nueva plantilla para estandarizar los entrenamientos del club.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const typeStyles = SESSION_TYPE_COLORS[tpl.session_type] || SESSION_TYPE_COLORS.training;
            const canManage = canManageTemplate(tpl);

            return (
              <div
                key={tpl.id}
                className="glass-card rounded-2xl border border-white/10 p-5 bg-white/2 hover:bg-white/5 transition-all flex flex-col justify-between gap-5 relative overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}
                    >
                      {SESSION_TYPE_LABELS[tpl.session_type] || tpl.session_type}
                    </span>
                    {tpl.duration_min && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tpl.duration_min} min
                      </span>
                    )}
                    {tpl.microcycle_day && (
                      <span className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 text-[9px] font-bold text-orange-400 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {tpl.microcycle_day}
                      </span>
                    )}
                    
                    {/* Library Scope Badge */}
                    {tpl.library_scope === "global" ? (
                      <span className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-[9px] font-bold text-blue-400 ml-auto">
                        ClubLab
                      </span>
                    ) : tpl.library_scope === "academy" ? (
                      <span className="rounded-lg corp-badge px-2 py-0.5 text-[9px] font-bold ml-auto">
                        Academia
                      </span>
                    ) : (
                      <span className="rounded-lg border border-slate-500/20 bg-slate-500/5 px-2 py-0.5 text-[9px] font-bold text-slate-400 ml-auto">
                        Personal
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-extrabold text-white leading-tight">
                      {tpl.title}
                    </h3>
                    {tpl.description && (
                      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2">
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  {/* ── EXERCISES THUMBNAIL GALLERY ── */}
                  {tpl.exercises && tpl.exercises.length > 0 && (() => {
                    const mainExercises = tpl.exercises.filter((te) => {
                      const blockType = te.group_setup?.block_type;
                      return !blockType || blockType === "main";
                    });

                    if (mainExercises.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                          Tareas Principales ({mainExercises.length}):
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {mainExercises.map((te) => {
                            const imageUrl =
                              te.whiteboard_data?.imageDataUrl ||
                              te.image_url ||
                              te.exercise?.whiteboard_data?.imageDataUrl ||
                              te.exercise?.image_url;

                            return (
                              <div
                                key={te.id}
                                className="relative rounded-lg border border-white/5 bg-slate-950 aspect-[5/3] overflow-hidden group/thumb cursor-help"
                                title={`${te.exercise?.title || "Ejercicio"} (${te.duration_min} min)`}
                              >
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={te.exercise?.title}
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-all"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-950">
                                    <Sparkles className="h-4 w-4 opacity-50" />
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-0.5 text-[7px] text-white truncate font-medium text-center">
                                  {te.exercise?.title || "Tarea"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Objectives tags */}
                  {tpl.objectives && tpl.objectives.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {tpl.objectives.map((obj, i) => (
                        <span
                          key={i}
                          className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-medium text-slate-400 border border-white/5"
                        >
                          {obj.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {/* Clone button */}
                    <button
                      type="button"
                      onClick={() => router.push(`/training/templates/new?cloneFrom=${tpl.id}`)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
                      title="Clonar esta sesión para crear una copia"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Clonar</span>
                    </button>

                    {/* Delete button (with permission control) */}
                    {canManage && (
                      <button
                        type="button"
                        disabled={deletingId === tpl.id}
                        onClick={() => handleDelete(tpl.id, tpl.title)}
                        className="flex items-center gap-1 text-[11px] font-bold text-rose-500/80 hover:text-rose-400 transition-colors ml-2 disabled:opacity-40"
                        title="Eliminar de la biblioteca"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>

                  {/* Edit link (with permission control) */}
                  {canManage && (
                    <Link
                      href={`/training/templates/${tpl.id}/edit`}
                      className="flex items-center gap-1 text-[11px] font-bold corp-text hover:opacity-80 transition-colors"
                    >
                      <span>Editar</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
