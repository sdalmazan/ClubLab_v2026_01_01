import type { Metadata } from "next";
import { Suspense } from "react";
import { getSquadPlayers, getOrgTeams } from "@/services/players";
import { PlayerCard, PlayerCardSkeleton } from "@/components/players/PlayerCard";
import { FieldMap } from "@/components/players/FieldMap";
import { Users, UserPlus, Filter } from "lucide-react";
import Link from "next/link";
import type { PositionKey } from "@/types";
import type { PlayerWithMembership } from "@/services/players";

export const metadata: Metadata = {
  title: "Plantilla — ClubLab",
  description: "Gestión de la plantilla y jugadores del equipo",
};

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────

function buildFieldAssignments(players: PlayerWithMembership[]) {
  const assignments: Partial<Record<PositionKey, any[]>> = {};
  for (const p of players) {
    const positions = p.membership?.positions ?? [];
    const primary = positions[0] as PositionKey | undefined;
    if (!primary) continue;
    if (!assignments[primary]) assignments[primary] = [];
    assignments[primary]!.push({
      playerId: p.id,
      name: `${p.first_name} ${p.last_name}`,
      jerseyNumber: p.membership?.jersey_number,
      status: "green" as const, // TODO: wire to performance engine
    });
  }
  return assignments;
}

// ── page ─────────────────────────────────────────────────────

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string; view?: string }>;
}) {
  const params = await searchParams;
  const teamId = params.teamId;
  const view = params.view ?? "list";

  const [players, teams] = await Promise.all([
    getSquadPlayers(teamId),
    getOrgTeams(),
  ]);

  const fieldAssignments = buildFieldAssignments(players);

  const injuredCount = players.filter((p) => p.active_injury?.status === "active").length;
  const readaptCount = players.filter((p) => p.active_injury?.status === "readaptation").length;
  const availableCount = players.length - injuredCount - readaptCount;

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Plantilla</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {players.length} jugadores registrados
          </p>
        </div>
        <Link
          href="/players/new"
          id="add-player-btn"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-lg shadow-emerald-950/40"
        >
          <UserPlus className="h-4 w-4" />
          Añadir jugador
        </Link>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Disponibles", value: availableCount, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Readaptación", value: readaptCount, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
          { label: "Lesionados", value: injuredCount, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
        ].map((s) => (
          <div key={s.label} className={`glass-card rounded-xl p-4 border ${s.bg}`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-slate-500 shrink-0" />
        {teams.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/players"
              id="filter-all-teams"
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                !teamId
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              Todos
            </Link>
            {teams.map((t: any) => (
              <Link
                key={t.id}
                href={`/players?teamId=${t.id}`}
                id={`filter-team-${t.id}`}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  teamId === t.id
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          {(["list", "field"] as const).map((v) => (
            <Link
              key={v}
              href={`/players?${teamId ? `teamId=${teamId}&` : ""}view=${v}`}
              id={`view-${v}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                view === v
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {v === "list" ? "Lista" : "Campograma"}
            </Link>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {players.length === 0 ? (
        <EmptyState />
      ) : view === "field" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="max-w-xs mx-auto w-full">
            <FieldMap assignments={fieldAssignments} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <PlayerCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </Suspense>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl">
      <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-slate-600" />
      </div>
      <p className="text-slate-300 font-semibold">No hay jugadores registrados</p>
      <p className="text-slate-500 text-sm mt-1">Añade el primer jugador a tu plantilla</p>
      <Link
        href="/players/new"
        id="empty-add-player-btn"
        className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold px-5 py-2.5 transition-all"
      >
        <UserPlus className="h-4 w-4" />
        Añadir primer jugador
      </Link>
    </div>
  );
}
