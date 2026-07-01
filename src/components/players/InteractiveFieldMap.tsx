"use client";

import { useState } from "react";
import { FieldMap } from "./FieldMap";
import type { PositionKey } from "@/types";
import { POSITION_LABELS } from "@/types";
import type { PlayerWithMembership } from "@/services/players";
import { User, Target, CalendarDays, Activity, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface InteractiveFieldMapProps {
  players: PlayerWithMembership[];
}

const FORMATIONS = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "3-4-3",
  "5-3-2",
  "4-2-3-1",
  "4-1-4-1",
  "4-5-1",
  "5-4-1",
  "3-6-1",
];

const POSITION_ORDER: PositionKey[] = [
  "goalkeeper",
  "left_back",
  "left_center_back",
  "right_center_back",
  "right_back",
  "defensive_midfielder",
  "playmaker_midfielder",
  "attacking_midfielder",
  "left_winger",
  "right_winger",
  "striker",
];

export function InteractiveFieldMap({ players = [] }: InteractiveFieldMapProps) {
  const [selectedPosition, setSelectedPosition] = useState<PositionKey | null>(null);
  const [formation, setFormation] = useState<string>("4-3-3");
  const [formationsOpen, setFormationsOpen] = useState(false);

  // Build field assignments from all players for the FieldMap
  const assignments: Record<PositionKey, any[]> = {} as Record<PositionKey, any[]>;
  for (const p of players) {
    const positions = p.membership?.positions ?? [];
    positions.forEach((pos, index) => {
      if (!pos) return;
      if (!assignments[pos]) assignments[pos] = [];
      assignments[pos].push({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        lastName: p.last_name || "",
        isPrimary: index === 0,
        status: p.membership?.player_type === "reserve" ? "yellow" : p.membership?.player_type === "youth" ? "red" : "green",
      });
    });
  }

  // Filter players on the right column
  const filteredPlayers = selectedPosition
    ? players.filter((p) => p.membership?.positions?.includes(selectedPosition))
    : players;

  // Sort players GK -> DF -> MF -> FW
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const posA = a.membership?.positions?.[0];
    const posB = b.membership?.positions?.[0];
    const idxA = posA ? POSITION_ORDER.indexOf(posA) : 999;
    const idxB = posB ? POSITION_ORDER.indexOf(posB) : 999;
    return idxA - idxB;
  });

  const handlePositionClick = (pos: PositionKey) => {
    setSelectedPosition(pos === selectedPosition ? null : pos);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Large Tactical Field Map */}
      <div className="lg:col-span-8 w-full max-w-[640px] mx-auto">
        <div className="glass-card rounded-3xl p-5 border border-white/10 shadow-2xl relative bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Campograma / Plantilla
            </span>
            
            <div className="flex items-center gap-2">
              {/* Custom Formations Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFormationsOpen(!formationsOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer focus:outline-none hover:bg-white/10 hover:text-white transition-all"
                >
                  <span>Formación: {formation}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400 transition-transform duration-200" style={{ transform: formationsOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                
                {formationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFormationsOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      {FORMATIONS.map((form) => (
                        <button
                          key={form}
                          type="button"
                          onClick={() => {
                            setFormation(form);
                            setFormationsOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            formation === form
                              ? "bg-emerald-500/20 text-emerald-450 border border-emerald-500/20"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {form}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedPosition && (
                <button
                  type="button"
                  onClick={() => setSelectedPosition(null)}
                  className="text-xs font-bold text-emerald-450 hover:underline px-2 py-1"
                >
                  Ver todos
                </button>
              )}
            </div>
          </div>
          
          <FieldMap
            assignments={assignments}
            selectedPosition={selectedPosition}
            interactive={true}
            onPositionClick={handlePositionClick}
            formation={formation}
          />
        </div>
      </div>

      {/* Right Column: Single Column Roster List */}
      <div className="lg:col-span-4 space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-xs font-bold text-slate-455 uppercase tracking-wider">
            {selectedPosition
              ? `${POSITION_LABELS[selectedPosition]} (${sortedPlayers.length})`
              : `Todos los jugadores (${sortedPlayers.length})`}
          </h2>
        </div>

        <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1 scrollbar-thin">
          {sortedPlayers.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-10 text-center">
              No hay jugadores asignados a esta posición
            </p>
          ) : (
            sortedPlayers.map((p) => {
              const name = `${p.first_name} ${p.last_name}`;
              const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
              const primary = p.membership?.positions?.[0];
              const secondaries = p.membership?.positions?.slice(1) ?? [];
              const birthYear = p.date_of_birth ? new Date(p.date_of_birth).getFullYear() : null;
              const currentYear = new Date().getFullYear();
              const isSub23 = birthYear && (currentYear - birthYear <= 23);
              const isInactive = p.membership?.status === "inactive";
              const isReserve = p.membership?.player_type === "reserve";
              const isYouth = p.membership?.player_type === "youth";
              const isOther = p.membership?.player_type === "other";

              let typeLabel = "";
              let borderClass = "border-white/5 bg-white/2 hover:border-white/10";
              if (isReserve) {
                borderClass = "border-sky-500/20 bg-sky-500/5 hover:border-sky-500/45";
                typeLabel = p.membership?.player_type_label || "Filial";
              } else if (isYouth) {
                borderClass = "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/45";
                typeLabel = p.membership?.player_type_label || "Juvenil";
              } else if (isOther) {
                borderClass = "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/45";
                typeLabel = p.membership?.player_type_label || "Otro";
              }

              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className={cn(
                    "flex flex-col gap-2 p-3.5 rounded-2xl border transition-all glass-card",
                    borderClass,
                    isInactive && "opacity-45 grayscale"
                  )}
                >
                  <div className="flex items-center justify-between min-w-0 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={name}
                          className="h-10 w-10 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0 border border-white/10">
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white leading-tight truncate">
                          {name} {p.membership?.jersey_number != null && `#${p.membership.jersey_number}`}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {primary && (
                            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 rounded px-1.5 py-0.5 leading-none">
                              {POSITION_LABELS[primary]}
                            </span>
                          )}
                          {secondaries.length > 0 &&
                            secondaries.slice(0, 2).map((sec) => (
                              <span
                                key={sec}
                                className="text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-white/5 rounded px-1.5 py-0.5 leading-none"
                              >
                                {POSITION_LABELS[sec]}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>

                    {typeLabel && (
                      <span className={cn(
                        "text-[8px] font-extrabold border rounded-lg px-2 py-0.5 uppercase tracking-widest shrink-0",
                        isReserve && "bg-sky-500/10 text-sky-400 border-sky-500/25",
                        isYouth && "bg-purple-500/10 text-purple-400 border-purple-500/25",
                        isOther && "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
                      )}>
                        {typeLabel}
                      </span>
                    )}
                  </div>

                  {/* Details row (adjective, birthYear, labels) */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {isSub23 && (
                        <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5 leading-none uppercase tracking-wider">
                          Sub-23
                        </span>
                      )}
                      {p.adjective && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5 leading-none">
                          {p.adjective}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 font-medium">
                      <CalendarDays className="h-3 w-3 text-slate-600" />
                      <span>{birthYear ? `Nac. ${birthYear}` : "—"}</span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
