import type { Metadata } from "next";
import { getSessions } from "@/services/sessions";
import { getOrgTeams } from "@/services/players";
import { getSessionTemplates } from "@/services/templates";
import { TrainingCalendarView } from "@/components/training/TrainingCalendarView";
import {
  CalendarDays,
  Plus,
  Clock,
  Gauge,
  BookOpen,
  ArrowRight,
  ChevronRight,
  FileText,
  Edit,
  Trash2,
  ListTodo,
  Sunrise,
  LayoutGrid
} from "lucide-react";
import Link from "next/link";
import { ExpandableList } from "@/components/training/ExpandableList";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { formatToDDMMAAAA } from "@/lib/utils";
import { SESSION_TYPE_LABELS, LOAD_LEVEL_LABELS, type SessionType, type LoadLevel } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Planificación — ClubLab",
  description: "Planificación de sesiones de entrenamiento y partidos",
};

export const dynamic = "force-dynamic";

const SESSION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  training: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  individual: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  match: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  rest: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
};

const LOAD_COLORS: Record<LoadLevel, string> = {
  low: "text-muted-foreground border-border bg-muted/30",
  medium: "text-amber-400/90 border-amber-500/20 bg-amber-500/5",
  medium_high: "text-orange-400/90 border-orange-500/20 bg-orange-500/5",
  high: "text-rose-400/90 border-rose-500/20 bg-rose-500/5",
  recovery: "text-indigo-400/90 border-indigo-500/20 bg-indigo-500/5",
};

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Load organization role & type
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select("team_id, organization_id, organizations ( type )")
    .eq("user_id", user?.id)
    .maybeSingle();

  const orgType = (orgRole as any)?.organizations?.type ?? "club";

  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;

  let resolvedTeamId = orgType === "academy"
    ? params.teamId
    : (globalTeamId || orgRole?.team_id || "");

  let teams = await getOrgTeams();

  if (orgType === "club") {
    if (teams.length > 0) {
      resolvedTeamId = teams[0].id;
      teams = [teams[0]];
    }
  }

  const [sessions, templates] = await Promise.all([
    getSessions(resolvedTeamId || undefined),
    getSessionTemplates(),
  ]);

  // Split into upcoming and past (excluding rest sessions)
  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingSessions = sessions.filter((s) => s.date >= todayStr && (s.session_type as string) !== "rest").reverse(); // closest first
  const pastSessions = sessions.filter((s) => s.date < todayStr && (s.session_type as string) !== "rest");

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <PageHeader
        title="Planificación"
        description="Planifica sesiones de entrenamiento, asigna ejercicios y distribuye tareas."
      >
        <div className="flex gap-2 flex-wrap items-center">
          <Link href="/training/preseason" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Sunrise className="size-4 mr-1.5 text-orange-400" />
            Pretemporada
          </Link>
          <Link href="/training/exercises" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <BookOpen className="size-4 mr-1.5 text-muted-foreground" />
            Tareas
          </Link>
          <Link href="/training/templates" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <BookOpen className="size-4 mr-1.5 text-muted-foreground" />
            Plantillas
          </Link>
          <Link href="/training/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4 mr-1.5" />
            Nueva Sesión
          </Link>
        </div>
      </PageHeader>

      {/* ── FILTERS (Academy mode only) ── */}
      {orgType === "academy" && teams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/training"
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              !resolvedTeamId
                ? "corp-badge border-[var(--corp-border-strong)]"
                : "border-white/10 text-slate-400 hover:border-white/20"
            }`}
          >
            Todos los equipos
          </Link>
          {teams.map((t: any) => (
            <Link
              key={t.id}
              href={`/training?teamId=${t.id}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                resolvedTeamId === t.id
                  ? "corp-badge border-[var(--corp-border-strong)]"
                  : "border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* ── WEEKLY / MONTHLY SCHEDULE CALENDAR BAR ── */}
      <TrainingCalendarView sessions={sessions} />

      {/* ── SECTIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Sessions list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Upcoming Sessions */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 corp-icon" />
              Próximas Sesiones ({upcomingSessions.length})
            </h2>

            {upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-muted/50 rounded-lg border border-white/5 bg-white/2">
                <p className="text-slate-400 text-sm italic">No hay sesiones planificadas</p>
                <Link
                  href="/training/new"
                  className="mt-3 text-xs font-bold corp-text hover:underline flex items-center gap-1"
                >
                  Crear la primera sesión <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <ExpandableList initialCount={4}>
                {upcomingSessions.map((session) => {
                  const typeStyles = SESSION_TYPE_COLORS[session.session_type] || {
                    bg: "bg-slate-500/10",
                    text: "text-slate-400",
                    border: "border-slate-500/20"
                  };
                  const typeLabel = (SESSION_TYPE_LABELS as Record<string, string>)[session.session_type] || ((session.session_type as string) === "rest" ? "Descanso" : session.session_type);
                  return (
                    <div
                      key={session.id}
                      className="bg-muted/50 rounded-lg border border-white/10 p-5 bg-white/2 hover:bg-white/5 transition-all flex items-start justify-between gap-4 flex-wrap"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}
                          >
                            {typeLabel}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {formatToDDMMAAAA(session.date)}
                          </span>
                          {session.microcycle_day && (
                            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                              {session.microcycle_day}
                            </span>
                          )}
                          {session.planned_load && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                                LOAD_COLORS[session.planned_load]
                              }`}
                            >
                              Carga: {LOAD_LEVEL_LABELS[session.planned_load]}
                            </span>
                          )}
                        </div>

                        <div>
                          <Link
                            href={`/training/${session.id}`}
                            className="text-base font-extrabold text-white hover:corp-text transition-colors leading-tight"
                          >
                            {session.title || "Sesión de Entrenamiento"}
                          </Link>
                          {session.notes && (
                            <p className="text-slate-400 text-xs mt-1 max-w-xl truncate">
                              {session.notes}
                            </p>
                          )}
                        </div>

                        {session.objectives && session.objectives.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {session.objectives.map((obj, i) => (
                              <span
                                key={i}
                                className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/5"
                              >
                                {obj}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/training/${session.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-[var(--corp-bg)] border border-white/10 text-slate-400 hover:corp-text transition-all"
                          title="Ver informe completo / PDF"
                        >
                          <FileText className="h-4.5 w-4.5" />
                        </Link>
                        <Link
                          href={`/training/${session.id}/edit`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-amber-500/10 border border-white/10 text-slate-400 hover:text-amber-400 transition-all"
                          title="Editar sesión"
                        >
                          <Edit className="h-4.5 w-4.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </ExpandableList>
            )}
          </div>

          {/* Past Sessions */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              Historial de Sesiones Anteriores ({pastSessions.length})
            </h2>

            {pastSessions.length === 0 ? (
              <p className="text-slate-500 text-xs italic py-4">No hay historial disponible.</p>
            ) : (
              <ExpandableList initialCount={4}>
                {pastSessions.map((session) => {
                  const typeStyles = SESSION_TYPE_COLORS[session.session_type] || {
                    bg: "bg-slate-500/10",
                    text: "text-slate-400",
                    border: "border-slate-500/20"
                  };
                  return (
                    <div
                      key={session.id}
                      className="bg-muted/50 rounded-lg border border-white/5 p-4 bg-white/1 hover:bg-white/3 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}
                        >
                          {(SESSION_TYPE_LABELS as Record<string, string>)[session.session_type] || session.session_type}
                        </span>
                        <div className="overflow-hidden">
                          <Link
                            href={`/training/${session.id}`}
                            className="text-sm font-bold text-slate-200 hover:corp-text transition-colors truncate block"
                          >
                            {session.title || "Sesión de Entrenamiento"}
                          </Link>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {formatToDDMMAAAA(session.date)} • {session.duration_min || "--"} min
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/training/${session.id}`}
                          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-0.5"
                        >
                          Ver <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </ExpandableList>
            )}
          </div>

        </div>

        {/* Right Column: Templates & Methodology Quick Access */}
        <div className="space-y-6">
          
          {/* Templates Library Card */}
          <div className="bg-muted/50 rounded-lg border border-white/10 p-5 bg-gradient-to-br from-white/5 to-white/0 flex flex-col gap-4">
            <div className="corp-badge flex h-10 w-10 items-center justify-center rounded-xl">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Biblioteca de Plantillas</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Crea estructuras preestablecidas de entrenamiento (Día MD-4, Activación MD-1, etc.) y aplícalas al planificar una nueva sesión de forma instantánea.
              </p>
            </div>
            <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
              <Link
                href="/training/templates"
                className="flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                <span>Ver todas las plantillas ({templates.length})</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="/training/templates/new"
                className="flex items-center justify-between text-xs font-bold corp-text hover:opacity-80 transition-colors"
              >
                <span>+ Crear nueva plantilla</span>
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick Stats/Summary */}
          <div className="bg-card rounded-lg border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              Resumen Semanal
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border/50 bg-muted/30 rounded-lg p-3">
                <p className="text-muted-foreground text-[11px] font-medium">Sesiones</p>
                <p className="text-lg font-semibold text-foreground mt-0.5">
                  {sessions.filter(s => s.session_type === "training").length}
                </p>
              </div>
              <div className="border border-border/50 bg-muted/30 rounded-lg p-3">
                <p className="text-muted-foreground text-[11px] font-medium">Partidos</p>
                <p className="text-lg font-semibold text-foreground mt-0.5">
                  {sessions.filter(s => s.session_type === "match").length}
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
