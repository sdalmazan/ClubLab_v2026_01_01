"use client";

import { useState } from "react";
import { Plus, Trash2, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerItem {
  id: string;
  first_name: string;
  last_name: string;
  physical_status?: "green" | "yellow" | "red";
}

interface Group {
  name: string;
  players: string[]; // Player IDs
}

interface GroupPlannerProps {
  presentPlayers: PlayerItem[];
  value: { groups: Group[]; series_rotations?: string };
  onChange: (value: { groups: Group[]; series_rotations?: string }) => void;
  interactive?: boolean;
}

const DEFAULT_GROUP_COLORS = [
  "border-emerald-500/30 bg-emerald-500/5 text-emerald-300 ring-emerald-500/20",
  "border-sky-500/30 bg-sky-500/5 text-sky-300 ring-sky-500/20",
  "border-amber-500/30 bg-amber-500/5 text-amber-300 ring-amber-500/20",
  "border-rose-500/30 bg-rose-500/5 text-rose-300 ring-rose-500/20",
];

export function GroupPlanner({
  presentPlayers = [],
  value = { groups: [] },
  onChange,
  interactive = true,
}: GroupPlannerProps) {
  const groups = value?.groups || [];
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Preset templates for quick team generation (parallel exercises, tri-color, rotational series)
  const applyPreset = (presetType: '2teams' | '3teams' | 'parallel' | 'series') => {
    if (!interactive) return;
    if (presetType === '2teams') {
      onChange({
        groups: [
          { name: "Equipo Verde", players: [] },
          { name: "Equipo Azul", players: [] },
        ],
      });
    } else if (presetType === '3teams') {
      onChange({
        groups: [
          { name: "Equipo Verde", players: [] },
          { name: "Equipo Azul", players: [] },
          { name: "Equipo Rojo", players: [] },
          { name: "Comodines", players: [] },
        ],
      });
    } else if (presetType === 'parallel') {
      onChange({
        groups: [
          { name: "Posesión 1 - Equipo A", players: [] },
          { name: "Posesión 1 - Equipo B", players: [] },
          { name: "Posesión 2 - Equipo C", players: [] },
          { name: "Posesión 2 - Equipo D", players: [] },
          { name: "Comodines / Apoyos", players: [] },
        ],
      });
    } else if (presetType === 'series') {
      onChange({
        groups: [
          { name: "Serie 1: Equipo A vs B", players: [] },
          { name: "Serie 2: Equipo A vs C", players: [] },
          { name: "Serie 3: Equipo B vs C", players: [] },
          { name: "Comodines / Descansos", players: [] },
        ],
      });
    }
  };

  if (groups.length === 0 && interactive) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border/50 rounded-lg bg-muted/50 space-y-4 text-center">
        <Users className="h-8 w-8 text-slate-500" />
        <div>
          <p className="text-sm text-slate-200 font-bold">
            Distribución de Equipos y Grupos
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Crea grupos simples, posesiones en campos paralelos o rotación por series para esta tarea.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyPreset('2teams')}
            className="flex items-center gap-1.5 rounded-xl btn-corporate text-white text-xs font-semibold px-3 py-2 transition-all cursor-pointer shadow"
          >
            <Plus className="h-3.5 w-3.5" />
            2 Equipos (A vs B)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('3teams')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 border border-slate-700 transition-all cursor-pointer shadow"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            3 Equipos (Tricolor)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('parallel')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 border border-slate-700 transition-all cursor-pointer shadow"
          >
            <Plus className="h-3.5 w-3.5 text-sky-400" />
            2 Posesiones Paralelas
          </button>
          <button
            type="button"
            onClick={() => applyPreset('series')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 border border-slate-700 transition-all cursor-pointer shadow"
          >
            <Plus className="h-3.5 w-3.5 text-amber-400" />
            Rotación por Series
          </button>
        </div>
      </div>
    );
  }

  // Get assigned player IDs
  const assignedIds = new Set(groups.flatMap((g) => g.players));
  // Unassigned players are present players that aren't in any group
  const unassignedPlayers = presentPlayers.filter((p) => !assignedIds.has(p.id));

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Move a player to a group or unassign them
  const movePlayer = (playerId: string, targetGroupName: string | null) => {
    if (!interactive) return;
    
    const updatedGroups = groups.map((g) => {
      // Remove from current group if exists
      const filtered = g.players.filter((id) => id !== playerId);
      
      // Add to target group if it matches
      if (targetGroupName && g.name === targetGroupName) {
        return { ...g, players: [...filtered, playerId] };
      }
      return { ...g, players: filtered };
    });

    onChange({ groups: updatedGroups });
  };

  // Drag and Drop handlers
  const handleDragStart = (playerId: string) => {
    if (!interactive) return;
    setActiveDragId(playerId);
  };

  const handleDrop = (targetGroupName: string | null) => {
    if (!interactive || !activeDragId) return;
    movePlayer(activeDragId, targetGroupName);
    setActiveDragId(null);
  };

  // Group modifications
  const addGroup = () => {
    if (!interactive) return;
    const name = `Equipo ${String.fromCharCode(65 + groups.length)}`; // Equipo C, D, etc.
    onChange({
      groups: [...groups, { name, players: [] }],
    });
  };

  const removeGroup = (groupIndex: number) => {
    if (!interactive) return;
    const updatedGroups = groups.filter((_, idx) => idx !== groupIndex);
    onChange({ groups: updatedGroups });
  };

  const renameGroup = (groupIndex: number, newName: string) => {
    if (!interactive || !newName.trim()) return;
    const updatedGroups = groups.map((g, idx) =>
      idx === groupIndex ? { ...g, name: newName.trim() } : g
    );
    onChange({ groups: updatedGroups });
  };

  return (
    <div className="space-y-6">
      {/* Visual Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        
        {/* Column 1: Unassigned / Available Players */}
        <div
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(null)}
          className={cn(
            "rounded-lg border border-border/50 bg-muted/50 p-4 min-h-[220px] transition-all flex flex-col gap-3",
            activeDragId && "border-slate-500/20 bg-white/5"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sin Asignar ({unassignedPlayers.length})
            </span>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 min-h-[140px] content-start">
            {unassignedPlayers.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-4 text-center w-full">
                Todos asignados
              </p>
            ) : (
              unassignedPlayers.map((p) => (
                <div
                  key={p.id}
                  draggable={interactive}
                  onDragStart={() => handleDragStart(p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-medium shadow transition-all",
                    interactive ? "cursor-grab hover:bg-white/10 active:cursor-grabbing" : "cursor-default"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        p.physical_status === "green" ? "bg-emerald-500" :
                        p.physical_status === "yellow" ? "bg-amber-500" : "bg-rose-500"
                      )}
                      title={
                        p.physical_status === "green" ? "Óptimo" :
                        p.physical_status === "yellow" ? "Control" : "Lesionado"
                      }
                    />
                    <span className="truncate">{p.first_name} {p.last_name}</span>
                  </div>

                  {interactive && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) movePlayer(p.id, e.target.value);
                      }}
                      className="md:hidden opacity-60 text-[10px] bg-slate-900 border border-white/10 rounded px-1 py-0.5 ml-2 text-slate-305"
                    >
                      <option value="" disabled>Equipos</option>
                      {groups.map((g) => (
                        <option key={g.name} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columns 2-4: Groups/Teams */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:col-span-3">
          {groups.map((group, gIdx) => {
            const colorClass = DEFAULT_GROUP_COLORS[gIdx % DEFAULT_GROUP_COLORS.length];
            
            return (
              <div
                key={group.name}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(group.name)}
                className={cn(
                  "rounded-lg border p-4 min-h-[220px] transition-all flex flex-col gap-3 bg-muted/50",
                  colorClass,
                  activeDragId && "ring-1"
                )}
              >
                {/* Column Header: Group name & controls */}
                <div className="flex items-center justify-between gap-2">
                  {interactive ? (
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => renameGroup(gIdx, e.target.value)}
                      className="w-full bg-transparent font-bold text-xs uppercase tracking-wider text-white border-b border-transparent focus:border-white/20 focus:outline-none py-0.5"
                    />
                  ) : (
                    <span className="font-extrabold text-xs uppercase tracking-wider">
                      {group.name} ({group.players.length})
                    </span>
                  )}

                  {interactive && (
                    <button
                      type="button"
                      onClick={() => removeGroup(gIdx)}
                      className="text-slate-500 hover:text-rose-450 p-1 rounded hover:bg-white/5 transition-all cursor-pointer"
                      title="Eliminar grupo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Player Cards in Group */}
                <div className="flex flex-col gap-2 min-h-[140px] h-full">
                  {group.players.length === 0 ? (
                    <p className="text-[11px] text-slate-500/50 italic py-4 text-center my-auto">
                      Arrastra jugadores aquí
                    </p>
                  ) : (
                    group.players.map((id) => {
                      const p = presentPlayers.find((player) => player.id === id);
                      if (!p) return null;

                      return (
                        <div
                          key={p.id}
                          draggable={interactive}
                          onDragStart={() => handleDragStart(p.id)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white font-medium shadow-sm transition-all",
                            interactive ? "cursor-grab hover:bg-white/10 active:cursor-grabbing" : "cursor-default"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                p.physical_status === "green" ? "bg-emerald-500" :
                                p.physical_status === "yellow" ? "bg-amber-500" : "bg-rose-500"
                              )}
                              title={
                                p.physical_status === "green" ? "Óptimo" :
                                p.physical_status === "yellow" ? "Control" : "Lesionado"
                              }
                            />
                            <span className="truncate">{p.first_name} {p.last_name}</span>
                          </div>
                          {interactive && (
                            <button
                              type="button"
                              onClick={() => movePlayer(p.id, null)}
                              className="text-slate-500 hover:text-rose-400 p-0.5 hover:bg-white/5 rounded transition-all cursor-pointer"
                              title="Quitar del grupo"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Group Card */}
          {interactive && groups.length < 10 && (
            <button
              type="button"
              onClick={addGroup}
              className="flex flex-col items-center justify-center p-4 border border-dashed border-border/50 rounded-lg hover:border-border hover:bg-muted min-h-[220px] transition-all cursor-pointer bg-muted/50"
            >
              <Plus className="h-6 w-6 text-slate-500 mb-2" />
              <span className="text-xs font-bold text-slate-400">Añadir Equipo</span>
            </button>
          )}
        </div>

      </div>

      {interactive && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔄 Cambios / Rotaciones entre Series (Opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Serie 1: Posesión A vs B | Serie 2: Rotación de Comodines | Serie 3: Intercambio de parejas"
              value={value?.series_rotations ?? ""}
              onChange={(e) => onChange({ ...value, series_rotations: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <p className="text-[10px] text-slate-500 italic leading-tight">
            Arrastra jugadores entre columnas o usa los controles para organizar los grupos de esta tarea.
          </p>
        </div>
      )}
    </div>
  );
}
