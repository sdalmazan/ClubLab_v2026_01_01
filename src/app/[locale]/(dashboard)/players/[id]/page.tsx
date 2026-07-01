import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerById } from "@/services/players";
import { getPerformanceTestsByPlayerId } from "@/services/tests";
import { getPlayerTasks } from "@/services/tasks";
import { PlayerStatusBadge, InjuryBadge, AvailabilityBadge } from "@/components/players/PlayerStatusBadge";
import { PlayerPositionsMap } from "@/components/players/PlayerPositionsMap";
import { POSITION_LABELS, type PositionKey } from "@/types";
import {
  ArrowLeft, Ruler, Weight, Cake, Flag, Shirt,
  Activity, HeartPulse, Edit, Dumbbell,
  Target, Gauge, TrendingUp, Stethoscope,
} from "lucide-react";

export const dynamic = "force-dynamic";

const KICKER_ROLE_LABELS: Record<string, string> = {
  far_free_kick_left: "Falta Lejana (Izq)",
  far_free_kick_right: "Falta Lejana (Der)",
  close_free_kick_left: "Falta Cercana (Izq)",
  close_free_kick_right: "Falta Cercana (Der)",
  corner_left: "Córner (Izq)",
  corner_right: "Córner (Der)",
  penalty: "Penalti",
  throw_in_left: "Saque de Banda (Izq)",
  throw_in_right: "Saque de Banda (Der)",
  area_rival: "Zona de Área Rival",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return { title: "Jugador no encontrado — ClubLab" };
  return {
    title: `${player.first_name} ${player.last_name} — ClubLab`,
    description: `Ficha de jugador: ${player.first_name} ${player.last_name}`,
  };
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const [player, tests, tasks] = await Promise.all([
    getPlayerById(id),
    getPerformanceTestsByPlayerId(id, 5),
    getPlayerTasks(id),
  ]);

  if (!player) notFound();

  const name = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0]}${player.last_name[0]}`.toUpperCase();
  const membership = player.membership;
  const injury = player.active_injury;

  // Age calculation
  const age = player.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(player.date_of_birth).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25)
      )
    : null;

  const positions = membership?.positions ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Back */}
      <Link
        href="/players"
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        id="back-to-players"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantilla
      </Link>

      {/* ── HEADER CARD ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="shrink-0">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={name}
                className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 ring-2 ring-white/10 flex items-center justify-center text-2xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-extrabold text-white">{name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {injury && (injury.status === "active" || injury.status === "readaptation") ? (
                    <InjuryBadge status={injury.status as any} />
                  ) : (
                    <>
                      <PlayerStatusBadge status={player.physical_status ?? "green"} />
                      <AvailabilityBadge status={player.availability_status ?? "available"} />
                    </>
                  )}
                  {membership?.teams?.name && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 border border-white/10 rounded-full px-2.5 py-0.5">
                      <Shirt className="h-3 w-3" />
                      {membership.teams.name}
                    </span>
                  )}
                  {membership?.jersey_number != null && (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                      #{membership.jersey_number}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/players/${player.id}/edit`}
                id="edit-player-btn"
                className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-sm font-medium px-4 py-2 transition-all"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Link>
            </div>
          </div>
        </div>

        {/* ── BIO STATS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          {age != null && (
            <Stat icon={<Cake className="h-4 w-4" />} label="Edad" value={`${age} años`} />
          )}
          {player.height_cm && (
            <Stat icon={<Ruler className="h-4 w-4" />} label="Altura" value={`${player.height_cm} cm`} />
          )}
          {player.weight_kg && (
            <Stat icon={<Weight className="h-4 w-4" />} label="Peso" value={`${player.weight_kg} kg`} />
          )}
          {player.dominant_foot && (
            <Stat
              icon={<Activity className="h-4 w-4" />}
              label="Pie dominante"
              value={player.dominant_foot === "right" ? "Derecho" : player.dominant_foot === "left" ? "Izquierdo" : "Ambidiestro"}
            />
          )}
          {player.nationality && (
            <Stat icon={<Flag className="h-4 w-4" />} label="Nacionalidad" value={player.nationality} />
          )}
        </div>
      </div>

      {/* ── GRID 1: POSITIONS & HEALTH ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positions with interactive Campograma */}
        <PlayerPositionsMap
          playerId={player.id}
          playerName={name}
          jerseyNumber={membership?.jersey_number}
          positions={positions as PositionKey[]}
        />

        {/* Injury summary */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose-500" />
            Estado de salud
          </h2>
          {injury ? (
            <div className="space-y-2">
              <InjuryBadge status={injury.status as any} />
              <p className="text-sm text-slate-300">
                <span className="text-slate-505">Zona: </span>
                {injury.body_part}
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-slate-505">Severidad: </span>
                {injury.severity}
              </p>
              <Link
                href="/injuries"
                className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Ver módulo de lesiones →
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-sm text-slate-300">Sin lesiones activas</p>
            </div>
          )}

          {player.availability_notes && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] text-slate-550 font-bold uppercase block mb-1">Notas del preparador:</span>
              <p className="text-xs text-slate-350 italic">"{player.availability_notes}"</p>
            </div>
          )}
        </div>
      </div>

      {/* ── KICKER ROLES SECTION ── */}
      {membership?.kicker_roles && membership.kicker_roles.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            Roles de Lanzamiento
          </h3>
          <div className="flex flex-wrap gap-2">
            {membership.kicker_roles.map((role: string) => (
              <span key={role} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1.5">
                {KICKER_ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Physical Tests */}
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-500" />
              Tests físicos
            </h2>
            <Link
              href={`/players/${player.id}/tests/new`}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              + Añadir test
            </Link>
          </div>

          {tests.length === 0 ? (
            <p className="text-slate-505 text-sm italic py-4">Sin tests físicos registrados</p>
          ) : (
            <div className="divide-y divide-white/5 space-y-2">
              {tests.slice(0, 3).map((test) => (
                <div key={test.id} className="pt-2 first:pt-0 flex justify-between items-center text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-200">{test.physical_tests?.name}</span>
                    <span className="text-[10px] text-slate-505">{test.date}</span>
                  </div>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {test.value} {test.physical_tests?.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tests.length > 0 && (
            <Link
              href={`/players/${player.id}/tests`}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors mt-auto pt-2 border-t border-white/5"
            >
              Ver historial completo →
            </Link>
          )}
        </div>

        {/* Assigned Tasks */}
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-indigo-500" />
              Tareas individuales
            </h2>
            <Link
              href={`/players/${player.id}/tasks`}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Gestionar
            </Link>
          </div>

          {tasks.length === 0 ? (
            <p className="text-slate-550 text-sm italic py-4">Sin tareas individuales asignadas</p>
          ) : (
            <div className="divide-y divide-white/5 space-y-2">
              {tasks.slice(0, 3).map((t) => (
                <div key={t.id} className="pt-2 first:pt-0 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200">{t.exercise?.title}</span>
                    <span className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">
                      {t.exercise?.category || "Otro"}
                    </span>
                  </div>
                  {t.staff_comment && (
                    <p className="text-[10px] text-slate-400 italic bg-white/[0.02] p-1.5 rounded border border-white/5">
                      "{t.staff_comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && (
            <Link
              href={`/players/${player.id}/tasks`}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors mt-auto pt-2 border-t border-white/5"
            >
              Ver todas las tareas →
            </Link>
          )}
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: `/performance?playerId=${player.id}`, label: "Rendimiento", icon: TrendingUp, color: "text-emerald-450" },
          { href: `/training?playerId=${player.id}`, label: "Entrenamientos", icon: Dumbbell, color: "text-indigo-450" },
          { href: `/injuries?playerId=${player.id}`, label: "Historial lesiones", icon: Stethoscope, color: "text-rose-450" },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              id={`player-link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              className="glass-card rounded-2xl p-4 hover:border-white/20 transition-all hover:-translate-y-0.5 text-center flex flex-col items-center justify-center gap-2 group cursor-pointer"
            >
              <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform ${link.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-350">{link.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-550">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

