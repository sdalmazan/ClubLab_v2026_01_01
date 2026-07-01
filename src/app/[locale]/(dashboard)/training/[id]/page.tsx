import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionById } from "@/services/sessions";
import {
  CalendarDays,
  Clock,
  Gauge,
  BookOpen,
  Edit,
  FileText,
  Printer,
  ChevronLeft,
  Users,
  Compass,
  Hammer
} from "lucide-react";
import Link from "next/link";
import { SESSION_TYPE_LABELS, LOAD_LEVEL_LABELS, type SessionType, type LoadLevel } from "@/types";
import { PitchGridSelector } from "@/components/training/PitchGridSelector";
import { PrintTrigger } from "./PrintTrigger";
import { MatchGamePlan } from "@/components/training/MatchGamePlan";

export const metadata: Metadata = {
  title: "Detalle de Sesión — ClubLab",
  description: "Detalle de la sesión de entrenamiento y exportación a PDF",
};

export const dynamic = "force-dynamic";

const SESSION_TYPE_COLORS: Record<SessionType, { bg: string; text: string; border: string }> = {
  training: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  individual: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  match: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
};

const LOAD_COLORS: Record<LoadLevel, string> = {
  low: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  medium: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  medium_high: "text-orange-400 border-orange-500/20 bg-orange-500/5",
  high: "text-rose-400 border-rose-500/20 bg-rose-500/5",
  recovery: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
};

export default async function SessionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let organizationSettings = {};
  if (user) {
    const { data: orgRole } = await supabase
      .from("user_organization_roles")
      .select(`
        organizations (
          settings
        )
      `)
      .eq("user_id", user.id)
      .limit(1)
      .single();
    organizationSettings = (orgRole as any)?.organizations?.settings ?? {};
  }

  // Group attendance status
  const present = session.attendance.filter((a: any) => a.status === "present");
  const absent = session.attendance.filter((a: any) => a.status === "absent");
  const injured = session.attendance.filter((a: any) => a.status === "injured");
  const otherAtt = session.attendance.filter(
    (a: any) => a.status !== "present" && a.status !== "absent" && a.status !== "injured"
  );

  const sessionTypeKey = session.session_type as SessionType;
  const typeStyles = SESSION_TYPE_COLORS[sessionTypeKey] || SESSION_TYPE_COLORS.training;

  return (
    <div className="flex flex-col gap-6 print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Print Styles Overlay */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide sidebar, headers, and UI controls */
          header, nav, aside, button, .no-print, [data-sidebar], .sidebar-inset > header {
            display: none !important;
          }
          /* Reset margins, paddings, and background */
          body, html, main, .sidebar-inset, .print-container {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .glass-card, .glass {
            background: transparent !important;
            border-color: #cbd5e1 !important;
            color: black !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }
          .text-white, h1, h2, h3, h4, th, td {
            color: black !important;
          }
          .text-slate-400, .text-slate-500, p {
            color: #475569 !important;
          }
          .text-emerald-400, .text-emerald-300, .status-green {
            color: #047857 !important;
          }
          .text-amber-400, .status-yellow {
            color: #b45309 !important;
          }
          .text-rose-400, .status-red {
            color: #be123c !important;
          }
          .bg-emerald-500\\/10, .bg-emerald-500\\/25 {
            background-color: #d1fae5 !important;
            color: #065f46 !important;
          }
          .border-emerald-500\\/20, .border-emerald-400\\/60 {
            border-color: #10b981 !important;
          }
          .print-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-border-light {
            border: 1px solid #cbd5e1 !important;
          }
          .print\\:break-before-page {
            page-break-before: always !important;
            break-before: page !important;
          }
          .print\\:break-after-page {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}} />

      {/* ── BREADCRUMB / ACTIONS (NO-PRINT) ── */}
      <div className="flex items-center justify-between gap-4 no-print">
        <Link
          href="/training"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a planificación
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/training/${session.id}/edit`}
            className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all"
          >
            <Edit className="h-4 w-4 text-slate-400" />
            Editar sesión
          </Link>
          <PrintTrigger />
        </div>
      </div>

      {/* ── SESSION HEADER CARD ── */}
      <div className="glass rounded-2xl p-6 space-y-4 print:border-b print:pb-6 print:rounded-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}
          >
            {SESSION_TYPE_LABELS[sessionTypeKey]}
          </span>
          <span className="text-sm font-semibold text-slate-400 print:text-slate-600">
            {session.date}
          </span>
          {session.microcycle_day && (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-300 print:text-slate-600 print:border-slate-300">
              {session.microcycle_day as string}
            </span>
          )}
          {session.planned_load && (
            <span
              className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                LOAD_COLORS[session.planned_load as LoadLevel]
              }`}
            >
              Carga: {LOAD_LEVEL_LABELS[session.planned_load as LoadLevel]}
            </span>
          )}
          {session.duration_min && (
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 ml-auto print:text-slate-600">
              <Clock className="h-4 w-4 text-slate-500" />
              {session.duration_min} minutos
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none print:text-3xl">
            {session.title || "Sesión de Entrenamiento"}
          </h1>
          {session.notes && (
            <p className="text-slate-400 text-sm mt-3 leading-relaxed whitespace-pre-wrap">
              {session.notes}
            </p>
          )}
        </div>

        {session.objectives && session.objectives.length > 0 && (
          <div className="pt-2 border-t border-white/5 print:border-slate-200">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Objetivos Tácticos:
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {session.objectives.map((obj: string, i: number) => (
                <span
                  key={i}
                  className="rounded bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-white/5 print:border-slate-300 print:text-slate-700"
                >
                  {obj}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ATTENDANCE REPORT ── */}
      <div className={`glass rounded-2xl p-6 space-y-4 print:border-b print:pb-6 print:rounded-none print-break-avoid ${session.session_type === "match" ? "no-print" : ""}`}>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 print:text-slate-800">
          <Users className="h-4 w-4 text-emerald-500" />
          Convocatoria y Asistencia ({present.length} de {session.attendance.length} presentes)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Presentes */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              Presentes ({present.length})
            </span>
            {present.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-slate-300 space-y-1 print:text-slate-700">
                {present.map((a: any) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{a.player?.first_name} {a.player?.last_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ausentes */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Ausentes ({absent.length})
            </span>
            {absent.length === 0 ? (
              <p className="text-xs text-slate-500/50 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-slate-400 space-y-1 print:text-slate-600">
                {absent.map((a: any) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    <span>
                      {a.player?.first_name} {a.player?.last_name}
                      {a.notes && <span className="text-[10px] text-slate-500 ml-1">({a.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lesionados / Bajas */}
          <div className="border border-white/5 bg-white/1 rounded-xl p-4 glass-card print:border-slate-200">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-2">
              Lesionados / Bajas ({injured.length})
            </span>
            {injured.length === 0 ? (
              <p className="text-xs text-slate-500/50 italic">Ninguno</p>
            ) : (
              <ul className="text-xs text-rose-300 space-y-1 print:text-rose-700">
                {injured.map((a: any) => (
                  <li key={a.id} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    <span>
                      {a.player?.first_name} {a.player?.last_name}
                      {a.notes && <span className="text-[10px] text-rose-400/60 print:text-rose-700/60 ml-1">({a.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── PLAN DE PARTIDO (Solo para partidos) ── */}
      {session.session_type === "match" && (
        <div className="glass rounded-2xl p-6 space-y-4 print:border-b print:pb-6 print:rounded-none">
          <MatchGamePlan
            presentPlayers={present.map((a: any) => ({
              id: a.player.id,
              first_name: a.player?.first_name || "",
              last_name: a.player?.last_name || "",
              membership: a.player?.membership,
              active_injury: a.player?.active_injury,
            }))}
            value={session.match_game_plan}
            interactive={false}
            organizationSettings={organizationSettings}
          />
        </div>
      )}

      {/* ── EXERCISES SEQUENCE TIMELINE ── */}
      {session.exercises && session.exercises.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 print:text-slate-800">
          <Compass className="h-4 w-4 text-emerald-500" />
          Fichas Técnicas de Ejercicios ({session.exercises.length} tareas)
        </h2>

        <div className="space-y-6">
          {session.exercises.map((ex: any, index: number) => (
            <div
              key={ex.id}
              className="glass rounded-2xl border border-white/10 p-6 bg-white/2 space-y-5 print:border print:rounded-none print-break-avoid print-border-light"
            >
              {/* Exercise Title Card */}
              <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 print:border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-extrabold flex items-center justify-center print:bg-slate-200 print:text-black print:border-slate-300">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white leading-tight">
                      {ex.exercise?.title}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
                      Categoría: {ex.exercise?.category || "General"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-bold print:text-slate-700">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Clock className="h-3.5 w-3.5" />
                    {ex.duration_min} min
                  </span>
                  {ex.recovery_min > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      Rec: {ex.recovery_min} min
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {ex.exercise?.description && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Descripción del Ejercicio:
                  </span>
                  <p className="text-slate-300 text-xs leading-relaxed print:text-slate-700">
                    {ex.exercise.description}
                  </p>
                </div>
              )}

              {/* Fields: Zones, Equipment, and Groups in Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5 print:border-slate-200">
                
                {/* Visual Field Grid */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Compass className="h-3 w-3" />
                    Zonas Tácticas Utilizadas
                  </span>
                  <div className="flex gap-4 items-center">
                    <PitchGridSelector
                      selectedZones={ex.pitch_zones}
                      interactive={false}
                    />
                    <div className="text-xs text-slate-400 print:text-slate-600">
                      {ex.pitch_zones.length === 0 ? (
                        <p className="italic">Todo el campo por defecto</p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ex.pitch_zones.map((zone: string) => (
                            <span
                              key={zone}
                              className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-extrabold text-[10px] px-2 py-0.5"
                            >
                              Zona {zone}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Materials & Equipment list with quantity */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Hammer className="h-3 w-3" />
                    Material / Equipamiento Requerido
                  </span>
                  {ex.equipment && ex.equipment.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ex.equipment.map((item: any) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-white/2 text-xs font-semibold text-slate-300 print:border-slate-200 print:text-slate-700"
                        >
                          <span>{item.name}</span>
                          <span className="rounded bg-slate-800 text-slate-400 px-1.5 py-0.5 text-[10px] font-bold border border-white/10 print:bg-slate-200 print:text-slate-800">
                            Cant: {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No requiere material específico</p>
                  )}
                </div>

              </div>

              {/* Player Groups / Teams Planner */}
              {ex.group_setup?.groups && ex.group_setup.groups.length > 0 && (
                <div className="space-y-3 border-t border-white/5 pt-4 print:border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Distribución de Equipos para esta Tarea:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ex.group_setup.groups.map((g: any, gIdx: number) => (
                      <div
                        key={g.name}
                        className="rounded-xl border border-white/5 bg-white/2 p-3 flex flex-col gap-2 glass-card print:border-slate-200"
                      >
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-white/5 pb-1 block print:text-emerald-700 print:border-slate-200">
                          {g.name} ({g.players?.length ?? 0})
                        </span>
                        {(!g.players || g.players.length === 0) ? (
                          <p className="text-[10px] text-slate-500 italic py-1">Sin jugadores</p>
                        ) : (
                          <ul className="text-[11px] text-slate-300 space-y-1 print:text-slate-700">
                            {g.players.map((id: string) => {
                              const p = session.attendance.find((a: any) => a.player_id === id);
                              return (
                                <li key={id} className="truncate">
                                  • {p?.player?.first_name} {p?.player?.last_name}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
