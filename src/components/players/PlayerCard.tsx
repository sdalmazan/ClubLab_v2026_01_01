import Link from "next/link";
import { cn } from "@/lib/utils";
import { PlayerStatusBadge, InjuryBadge } from "./PlayerStatusBadge";
import type { PlayerWithMembership } from "@/services/players";
import type { PlayerStatus } from "@/types";
import { POSITION_LABELS } from "@/types";
import { Shirt } from "lucide-react";

interface PlayerCardProps {
  player: PlayerWithMembership;
  status?: PlayerStatus;
}

export function PlayerCard({ player, status = "green" }: PlayerCardProps) {
  const name = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0]}${player.last_name[0]}`.toUpperCase();
  const membership = player.membership;
  const injury = player.active_injury;
  const primaryPosition = membership?.positions?.[0];

  return (
    <Link
      href={`/players/${player.id}`}
      className="group block glass-card rounded-2xl p-4 hover:border-white/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
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
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {POSITION_LABELS[primaryPosition]}
                </p>
              )}
            </div>
            <PlayerStatusBadge status={status} size="sm" showLabel={false} />
          </div>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {injury && <InjuryBadge status={injury.status as any} />}
            {!injury && membership?.teams?.name && (
              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                <Shirt className="h-2.5 w-2.5" />
                {membership.teams.name}
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
    <div className="glass-card rounded-2xl p-4 animate-pulse">
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
