import type { Metadata } from "next";
import { Suspense } from "react";
import { getSquadPlayers, getOrgTeams } from "@/services/players";
import { PlayerCard, PlayerCardSkeleton } from "@/components/players/PlayerCard";
import { InteractiveFieldMap } from "@/components/players/InteractiveFieldMap";
import { Users, UserPlus, Filter } from "lucide-react";
import Link from "next/link";
import type { PositionKey } from "@/types";
import type { PlayerWithMembership } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ImportPreviousModal } from "@/components/players/ImportPreviousModal";

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
      name: p.sporting_name || `${p.first_name} ${p.last_name}`,
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
  const view = params.view ?? "list";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Load organization type, user role, and settings
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      team_id,
      organizations ( type, settings )
    `)
    .eq("user_id", user?.id)
    .single();

  const orgType = (orgRole as any)?.organizations?.type ?? "club";
  const organizationSettings = (orgRole as any)?.organizations?.settings ?? {};
  const filialTeams: string[] = organizationSettings.filial_teams ?? [];
  
  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  
  // Resolve active team context: if academy, allow searchParams filtering, otherwise lock to active team or role team
  const resolvedTeamId = orgType === "academy" 
    ? params.teamId 
    : (globalTeamId || orgRole?.team_id || "");

  const [rawPlayers, teams] = await Promise.all([
    getSquadPlayers(resolvedTeamId || undefined),
    getOrgTeams(),
  ]);

  const positionWeights: Record<string, number> = {
    goalkeeper: 1,
    right_back: 2,
    right_center_back: 2,
    left_center_back: 2,
    left_back: 2,
    defensive_midfielder: 3,
    playmaker_midfielder: 3,
    attacking_midfielder: 3,
    left_winger: 4,
    right_winger: 4,
    striker: 4,
  };

  const players = [...rawPlayers].sort((a, b) => {
    const aInactive = a.membership?.status === "inactive" ? 1 : 0;
    const bInactive = b.membership?.status === "inactive" ? 1 : 0;
    if (aInactive !== bInactive) return aInactive - bInactive;

    const aPos = a.membership?.positions?.[0] || "";
    const bPos = b.membership?.positions?.[0] || "";
    const aW = positionWeights[aPos] || 5;
    const bW = positionWeights[bPos] || 5;
    
    if (aW !== bW) return aW - bW;
    
    const aName = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
    const bName = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  const activeTeam = resolvedTeamId ? teams.find((t: any) => t.id === resolvedTeamId) : null;
  const titleSuffix = activeTeam ? `: ${activeTeam.name}` : "";

  const activePlayers = players.filter((p) => p.membership?.status !== "inactive");
  const injuredCount = activePlayers.filter((p) => p.active_injury?.status === "active").length;
  const readaptCount = activePlayers.filter((p) => p.active_injury?.status === "readaptation").length;
  const availableCount = activePlayers.length - injuredCount - readaptCount;

  // Group players by team if no specific team filter is active (only in academy mode)
  const playersByTeam: Record<string, { name: string; players: PlayerWithMembership[] }> = {};
  const unassignedPlayers: PlayerWithMembership[] = [];

  const shouldGroup = orgType === "academy" && !resolvedTeamId;
  if (shouldGroup) {
    players.forEach((p) => {
      const tName = p.membership?.teams?.name;
      const tId = p.membership?.teams?.id;
      if (tName && tId) {
        if (!playersByTeam[tId]) {
          playersByTeam[tId] = { name: tName, players: [] };
        }
        playersByTeam[tId].players.push(p);
      } else {
        unassignedPlayers.push(p);
      }
    });
  }

  const targetTeamId = resolvedTeamId || teams[0]?.id || "";
  const targetSeasonId = activeTeam?.season_id || teams[0]?.season_id || "";

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap no-print">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
              Plantilla{titleSuffix}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              {players.length} jugadores registrados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {targetTeamId && targetSeasonId && (
            <ImportPreviousModal
              teamId={targetTeamId}
              seasonId={targetSeasonId}
            />
          )}
          <Link
            href="/players/edit"
            id="bulk-edit-players-btn"
            className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-semibold px-4 py-2.5 transition-all bg-white/5"
          >
            Editar plantilla
          </Link>
          <Link
            href="/players/new"
            id="add-player-btn"
            className="flex items-center gap-2 rounded-xl btn-corporate text-sm font-semibold px-4 py-2.5 transition-all shadow-lg"
          >
            <UserPlus className="h-4 w-4" />
            Añadir jugador
          </Link>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3 no-print">
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
      <div className="flex items-center gap-3 flex-wrap no-print">
        {orgType === "academy" && <Filter className="h-4 w-4 text-slate-500 shrink-0" />}
        {orgType === "academy" && teams.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/players"
              id="filter-all-teams"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                !resolvedTeamId
                  ? "corp-badge"
                  : "border-white/10 text-slate-400 hover:border-white/20 border"
              }`}
            >
              Todos
            </Link>
            {teams.map((t: any) => (
              <Link
                key={t.id}
                href={`/players?teamId=${t.id}`}
                id={`filter-team-${t.id}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  resolvedTeamId === t.id
                    ? "corp-badge"
                    : "border-white/10 text-slate-400 hover:border-white/20 border"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="ml-auto flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          {(["list", "field"] as const).map((v) => (
            <Link
              key={v}
              href={`/players?${resolvedTeamId ? `teamId=${resolvedTeamId}&` : ""}view=${v}`}
              id={`view-${v}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                view === v
                  ? "bg-primary text-primary-foreground shadow-lg shadow-black/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {v === "list" ? "Lista" : "Campograma"}
            </Link>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {players.length === 0 ? (
        <EmptyState teamId={targetTeamId} seasonId={targetSeasonId} />
      ) : view === "field" ? (
        <InteractiveFieldMap players={players} organizationSettings={organizationSettings} />
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
          {!resolvedTeamId && orgType === "academy" ? (
            <div className="space-y-8">
              {Object.entries(playersByTeam).map(([tId, group]) => (
                <div key={tId} className="space-y-3">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-primary rounded-full" />
                    {group.name} ({group.players.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {group.players.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        activeTeamId={resolvedTeamId}
                        filialTeams={filialTeams}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {unassignedPlayers.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-slate-500 rounded-full" />
                    Otros / Sin Equipo ({unassignedPlayers.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {unassignedPlayers.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        activeTeamId={resolvedTeamId}
                        filialTeams={filialTeams}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  activeTeamId={resolvedTeamId}
                  filialTeams={filialTeams}
                />
              ))}
            </div>
          )}
        </Suspense>
      )}
    </div>
  );
}

function EmptyState({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl">
      <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-slate-600" />
      </div>
      <p className="text-slate-300 font-semibold">No hay jugadores registrados</p>
      <p className="text-slate-500 text-sm mt-1">Añade el primer jugador a tu plantilla o importa jugadores de la temporada anterior</p>
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/players/new"
          id="empty-add-player-btn"
          className="flex items-center gap-2 rounded-xl btn-corporate text-sm font-semibold px-5 py-2.5 transition-all shadow-lg cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Añadir primer jugador
        </Link>
        {teamId && seasonId && (
          <ImportPreviousModal
            teamId={teamId}
            seasonId={seasonId}
            buttonClassName="flex items-center gap-2 rounded-xl bg-slate-900 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-sm font-semibold px-5 py-2.5 transition-all cursor-pointer"
            label="Importar jugadores"
          />
        )}
      </div>
    </div>
  );
}
