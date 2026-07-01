import type { Metadata } from "next";
import { getSessionTemplates } from "@/services/templates";
import { getOrgTeams } from "@/services/players";
import {
  CalendarDays,
  Plus,
  Clock,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  Edit,
  Trash2,
  ListTodo
} from "lucide-react";
import Link from "next/link";
import { SESSION_TYPE_LABELS, type SessionType } from "@/types";
import { DeleteTemplateButton } from "./DeleteTemplateButton";

export const metadata: Metadata = {
  title: "Plantillas de Sesión — ClubLab",
  description: "Biblioteca de plantillas estructuradas de entrenamiento",
};

export const dynamic = "force-dynamic";

const SESSION_TYPE_COLORS: Record<SessionType, { bg: string; text: string; border: string }> = {
  training: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  individual: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  match: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
};

export default async function TemplatesPage() {
  const templates = await getSessionTemplates();

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
            <BookOpen className="h-6 w-6 text-emerald-400" />
            Plantillas de Sesión
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Estructuras predefinidas de entrenamiento para simplificar tu trabajo diario.
          </p>
        </div>
        <Link
          href="/training/templates/new"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-lg shadow-emerald-950/40"
        >
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Link>
      </div>

      {/* ── GRID LIST ── */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl border border-white/5 bg-white/2">
          <BookOpen className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-slate-300 font-semibold">No hay plantillas registradas</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm text-center">
            Crea tu primera plantilla para estandarizar los entrenamientos del club o academia.
          </p>
          <Link
            href="/training/templates/new"
            className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold px-5 py-2.5 transition-all"
          >
            <Plus className="h-4 w-4" />
            Crear primera plantilla
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const typeStyles = SESSION_TYPE_COLORS[tpl.session_type];
            return (
              <div
                key={tpl.id}
                className="glass-card rounded-2xl border border-white/10 p-5 bg-white/2 hover:bg-white/5 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}
                    >
                      {SESSION_TYPE_LABELS[tpl.session_type]}
                    </span>
                    {tpl.duration_min && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tpl.duration_min} min
                      </span>
                    )}
                    {tpl.is_shared && (
                      <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-bold text-emerald-400 ml-auto">
                        Compartida
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white leading-tight">
                      {tpl.title}
                    </h3>
                    {tpl.description && (
                      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-3">
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  {tpl.objectives && tpl.objectives.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {tpl.objectives.map((obj, i) => (
                        <span
                          key={i}
                          className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-medium text-slate-300 border border-white/5"
                        >
                          {obj}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <DeleteTemplateButton templateId={tpl.id} />
                  <Link
                    href={`/training/templates/${tpl.id}/edit`}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Editar estructura</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
