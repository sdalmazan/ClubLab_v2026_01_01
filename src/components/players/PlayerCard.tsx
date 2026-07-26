import Link from "next/link";
import { cn } from "@/lib/utils";
import { PlayerStatusBadge, InjuryBadge } from "./PlayerStatusBadge";
import type { PlayerWithMembership } from "@/services/players";
import type { PlayerStatus } from "@/types";
import { POSITION_LABELS, getPositionLabel } from "@/types";
import { Shirt } from "lucide-react";

interface PlayerCardProps {
  player: PlayerWithMembership;
  status?: PlayerStatus;
  activeTeamId?: string;
  filialTeams?: string[];
}

export function PlayerCard({
  player,
  status = "green",
  activeTeamId,
  filialTeams,
}: PlayerCardProps) {
  const name = player.sporting_name || `${player.first_name} ${player.last_name}`;
  const initials = player.sporting_name ? player.sporting_name.substring(0, 2).toUpperCase() : `${player.first_name[0] || ""}${player.last_name[0] || ""}`.toUpperCase();
  const membership = player.membership;
  const injury = player.active_injury;
  const primaryPosition = membership?.positions?.[0];

  const isInactive = membership?.status === "inactive";
  const playerType = membership?.player_type ?? "main";
  const playerTeamName = membership?.teams?.name ?? "";

  // Check if player belongs to a filial team (case-insensitive comparison)
  const cleanFilialList = filialTeams?.map((t) => t.toLowerCase().trim()) ?? [];
  const isReserve = playerType === "reserve" ||
                    cleanFilialList.includes(playerTeamName.toLowerCase().trim()) ||
                    (activeTeamId && membership?.teams?.id && membership.teams.id !== activeTeamId);
  const isYouth = playerType === "youth";
  const isOther = playerType === "other";

  const customLabel = membership?.player_type_label || (isReserve ? "Filial" : isYouth ? "Juvenil" : isOther ? "Otros" : "");

  const isClose = player.signing_status === "close";
  const isDifficult = player.signing_status === "difficult";

  let borderStyle = "border-white/5 bg-white/2 hover:border-white/20";
  let labelColor = "";

  if (isClose) {
    borderStyle = "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/80 shadow-md shadow-amber-950/30 ring-1 ring-amber-500/20";
    labelColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else if (isDifficult) {
    borderStyle = "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/80 shadow-md shadow-rose-950/30 ring-1 ring-rose-500/20";
    labelColor = "bg-rose-500/10 text-rose-455 border-rose-500/20";
  } else if (isReserve) {
    borderStyle = "border-purple-500/45 bg-purple-500/5 hover:border-purple-500/80 shadow-md shadow-purple-950/30 ring-1 ring-purple-500/20";
    labelColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
  } else if (isYouth) {
    borderStyle = "border-indigo-500/45 bg-indigo-500/5 hover:border-indigo-500/80 shadow-md shadow-indigo-950/30 ring-1 ring-indigo-500/20";
    labelColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  } else if (isOther) {
    borderStyle = "border-sky-500/35 bg-sky-500/5 hover:border-sky-500/60 shadow-sm shadow-sky-950/20";
    labelColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
  }

  const cardClass = cn(
    "group block bg-card rounded-lg p-4 transition-all hover:-translate-y-0.5 hover:shadow-md border border-border",
    borderStyle,
    isInactive && "opacity-45 grayscale"
  );

  // Accurate age calculation
  const getAge = (dobString: string) => {
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  const seasonStartYear = player.membership?.seasons?.start_date
    ? new Date(player.membership.seasons.start_date).getFullYear()
    : new Date().getFullYear();
  const sub23LimitYear = seasonStartYear - 22;
  const isSub23 = player.date_of_birth && new Date(player.date_of_birth).getFullYear() >= sub23LimitYear;

  return (
    <Link
      href={`/players/${player.id}`}
      className={cardClass}
      id={`player-card-${player.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={name}
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
          )}
          {/* Jersey number overlay */}
          {membership?.jersey_number != null && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300">
              {membership.jersey_number}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white leading-tight truncate group-hover:text-emerald-400 transition-colors">
                {name}
              </p>
              {primaryPosition && (
                <p className="text-[11.5px] text-slate-400 mt-0.5 truncate font-medium flex items-center gap-1.5">
                  <span>{getPositionLabel(primaryPosition)}</span>
                </p>
              )}
              {membership?.teams?.name && (
                <p className="text-[10.5px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 truncate">
                  {membership.teams.name}
                </p>
              )}
            </div>
            <PlayerStatusBadge status={status} size="sm" showLabel={false} />
          </div>

          {/* Badges */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
            {injury && <InjuryBadge status={injury.status as any} />}
            {player.date_of_birth && (
              <span className={cn(
                "text-[9px] font-extrabold border rounded px-1.5 py-0.5 uppercase tracking-wider",
                isSub23
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-white/5 border-white/10 text-slate-400"
              )}>
                {new Date(player.date_of_birth).getFullYear()}
              </span>
            )}
            {isSub23 && (
              <span className="text-[9px] font-extrabold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded px-1.5 py-0.5 uppercase tracking-wider">
                Sub-23
              </span>
            )}
            {isInactive && membership?.left_date && (
              <span className="text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded px-1.5 py-0.5">
                Baja: {new Date(membership.left_date).toLocaleDateString()}
              </span>
            )}
            {(isClose || isDifficult) && (
              <span className={cn("text-[9px] font-extrabold border rounded px-1.5 py-0.5 uppercase tracking-wider", labelColor)}>
                {isClose ? "Fichaje: Cerca" : "Fichaje: Difícil"}
              </span>
            )}
            {playerType !== "main" && customLabel && (
              <span className={cn("text-[9px] font-extrabold border rounded px-1.5 py-0.5 uppercase tracking-wider", labelColor)}>
                {customLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// SKELETON LOADER
// ============================================================

export function PlayerCardSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-white/5 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-28 rounded bg-white/5" />
          <div className="h-2.5 w-20 rounded bg-white/5" />
          <div className="h-4 w-16 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}
