import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerById } from "@/services/players";
import { InjuryBadge, AvailabilityBadge } from "@/components/players/PlayerStatusBadge";
import { POSITION_LABELS } from "@/types";
import {
  ArrowLeft, Ruler, Weight, Cake, Flag, Shirt,
  Calendar, Activity, HeartPulse, Edit,
} from "lucide-react";

export const dynamic = "force-dynamic";

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
  const player = await getPlayerById(id);

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
                  {injury ? (
                    <InjuryBadge status={injury.status as any} />
                  ) : (
                    <AvailabilityBadge status="available" />
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

      {/* ── GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positions */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            Posiciones
          </h2>
          {positions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {positions.map((pos, i) => (
                <span
                  key={pos}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    i === 0
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 text-slate-400"
                  }`}
                >
                  {i === 0 && <span className="mr-1 text-emerald-600">★</span>}
                  {POSITION_LABELS[pos]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Sin posición asignada</p>
          )}
        </div>

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
                <span className="text-slate-500">Zona: </span>
                {injury.body_part}
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">Severidad: </span>
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
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: `/performance?playerId=${player.id}`, label: "Rendimiento", icon: "📈" },
          { href: `/training?playerId=${player.id}`, label: "Entrenamientos", icon: "🏋️" },
          { href: `/injuries?playerId=${player.id}`, label: "Historial lesiones", icon: "🩺" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            id={`player-link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
            className="glass-card rounded-xl p-4 hover:border-white/20 transition-all hover:-translate-y-0.5 text-center"
          >
            <span className="text-2xl">{link.icon}</span>
            <p className="text-xs font-medium text-slate-300 mt-2">{link.label}</p>
          </Link>
        ))}
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
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
