"use client";

import { useRouter } from "next/navigation";
import { Users, CalendarDays, ChevronDown } from "lucide-react";
import type { Team, Season, UserRole } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderContextSelectorProps {
  teams: any[];
  seasons: any[];
  activeTeamId: string;
  activeSeasonId: string;
  orgType: "club" | "academy" | "independent_coach";
  userRole?: UserRole;
}

export function HeaderContextSelector({
  teams = [],
  seasons = [],
  activeTeamId,
  activeSeasonId,
  orgType,
  userRole,
}: HeaderContextSelectorProps) {
  const router = useRouter();

  const handleTeamChange = (teamId: string) => {
    document.cookie = `cl_active_team_id=${teamId}; path=/; max-age=31536000; SameSite=Lax`;
    
    // Also auto-select the season associated with that team if we have it
    const selectedTeam = teams.find((t) => t.id === teamId);
    if (selectedTeam?.season_id) {
      document.cookie = `cl_active_season_id=${selectedTeam.season_id}; path=/; max-age=31536000; SameSite=Lax`;
    }
    
    router.refresh();
  };

  const handleSeasonChange = (seasonId: string) => {
    document.cookie = `cl_active_season_id=${seasonId}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  const showTeamSelector =
    orgType === "academy" ||
    userRole === "academy_director" ||
    userRole === "academy_coordinator" ||
    userRole === "club_admin" ||
    userRole === "sporting_director" ||
    userRole === "super_admin";

  return (
    <div className="flex items-center gap-2.5">
      {/* Team Context Selector (Academy mode only) */}
      {showTeamSelector && teams.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 sm:gap-2.5 rounded-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer focus:outline-none">
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline text-muted-foreground font-bold uppercase text-[9px] tracking-wider leading-none mr-0.5">Equipo:</span>
            <span className="text-foreground font-bold leading-none truncate max-w-[80px] sm:max-w-none">
              {teams.find((t) => t.id === activeTeamId)?.name || "Seleccionar"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="start" className="w-56">
            {teams.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => handleTeamChange(t.id)}
                className={`w-full cursor-pointer ${
                  t.id === activeTeamId
                    ? "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary"
                    : ""
                }`}
              >
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Season Context Selector (All modes) */}
      {seasons.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 sm:gap-2.5 rounded-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer focus:outline-none">
            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline text-muted-foreground font-bold uppercase text-[9px] tracking-wider leading-none mr-0.5">Temp:</span>
            <span className="text-foreground font-bold leading-none truncate max-w-[80px] sm:max-w-none">
              {seasons.find((s) => s.id === activeSeasonId)?.name || "Seleccionar"}
              {seasons.find((s) => s.id === activeSeasonId)?.is_active ? " (Activa)" : ""}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            {seasons.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => handleSeasonChange(s.id)}
                className={`w-full cursor-pointer flex justify-between ${
                  s.id === activeSeasonId
                    ? "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary"
                    : ""
                }`}
              >
                <span>{s.name}</span>
                {s.is_active && (
                  <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md uppercase tracking-wider font-extrabold leading-none">
                    Activa
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
