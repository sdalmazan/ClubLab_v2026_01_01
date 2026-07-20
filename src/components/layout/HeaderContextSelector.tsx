"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CalendarDays, ChevronDown } from "lucide-react";
import type { Team, Season } from "@/types";

interface HeaderContextSelectorProps {
  teams: any[];
  seasons: any[];
  activeTeamId: string;
  activeSeasonId: string;
  orgType: "club" | "academy" | "independent_coach";
}

export function HeaderContextSelector({
  teams = [],
  seasons = [],
  activeTeamId,
  activeSeasonId,
  orgType,
}: HeaderContextSelectorProps) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
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

  const showTeamSelector = orgType === "academy" || teams.length > 1;

  return (
    <div className="flex items-center gap-2.5">
      {/* Team Context Selector (Academy mode only) */}
      {showTeamSelector && teams.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setTeamOpen(!teamOpen);
              setSeasonOpen(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 rounded-xl border border-white/10 bg-slate-950/40 hover:bg-slate-900/60 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 transition-all text-xs font-semibold text-slate-300 hover:text-white cursor-pointer focus:outline-none shadow-md"
          >
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline text-slate-500 font-bold uppercase text-[9px] tracking-wider leading-none mr-0.5">Equipo:</span>
            <span className="text-white font-bold leading-none truncate max-w-[80px] sm:max-w-none">
              {teams.find((t) => t.id === activeTeamId)?.name || "Seleccionar"}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: teamOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          
          {teamOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTeamOpen(false)} />
              <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      handleTeamChange(t.id);
                      setTeamOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center ${
                      t.id === activeTeamId
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Season Context Selector (All modes) */}
      {seasons.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setSeasonOpen(!seasonOpen);
              setTeamOpen(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 rounded-xl border border-white/10 bg-slate-950/40 hover:bg-slate-900/60 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 transition-all text-xs font-semibold text-slate-300 hover:text-white cursor-pointer focus:outline-none shadow-md"
          >
            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline text-slate-500 font-bold uppercase text-[9px] tracking-wider leading-none mr-0.5">Temp:</span>
            <span className="text-white font-bold leading-none truncate max-w-[80px] sm:max-w-none">
              {seasons.find((s) => s.id === activeSeasonId)?.name || "Seleccionar"}
              {seasons.find((s) => s.id === activeSeasonId)?.is_active ? " (Activa)" : ""}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: seasonOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          
          {seasonOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSeasonOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {seasons.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      handleSeasonChange(s.id);
                      setSeasonOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      s.id === activeSeasonId
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.is_active && (
                      <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider font-extrabold leading-none">
                        Activa
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
