"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  HeartPulse, 
  Shirt, 
  MapPin, 
  Layers, 
  List, 
  UserPlus,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { POSITION_LABELS, type PositionKey } from "@/types";
import type { PlayerWithMembership } from "@/services/players";
import { InteractiveFieldMap } from "./InteractiveFieldMap";

interface SquadWorkspaceProps {
  players: any[];
  teams: any[];
  resolvedTeamId: string;
  orgType: string;
  clubName: string;
}

type SortKey = "position" | "number" | "name" | "availability" | "physical";
type SortDirection = "asc" | "desc";

const POSITION_WEIGHTS: Record<string, number> = {
  goalkeeper: 1,
  left_back: 2,
  left_center_back: 2,
  right_center_back: 2,
  right_back: 2,
  center_back: 2,
  full_back: 2,
  defensive_midfielder: 3,
  playmaker_midfielder: 3,
  attacking_midfielder: 3,
  midfielder: 3,
  left_winger: 4,
  right_winger: 4,
  winger: 4,
  striker: 5,
};

export function SquadWorkspace({
  players = [],
  teams = [],
  resolvedTeamId,
  orgType,
  clubName,
}: SquadWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "attention" | "available" | "injured" | "inactive">("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  // Sorting state (default: position asc - Portero a Delantero)
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Metrics
  const activePlayers = useMemo(() => players.filter((p) => p.membership?.status !== "inactive"), [players]);
  const inactivePlayers = useMemo(() => players.filter((p) => p.membership?.status === "inactive"), [players]);
  const injuredCount = useMemo(() => activePlayers.filter((p) => p.active_injury?.status === "active").length, [activePlayers]);
  const readaptCount = useMemo(() => activePlayers.filter((p) => p.active_injury?.status === "readaptation").length, [activePlayers]);
  const fatiguedCount = useMemo(() => activePlayers.filter((p) => p.physical_status === "yellow").length, [activePlayers]);
  const availableCount = activePlayers.length - injuredCount - readaptCount;
  const attentionCount = injuredCount + readaptCount + fatiguedCount;
  const inactiveCount = inactivePlayers.length;

  const handleReactivatePlayer = async (playerId: string) => {
    setReactivatingId(playerId);
    try {
      await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipStatus: "active" }),
      });
      window.location.reload();
    } catch (e) {
      console.error("Error reactivating player:", e);
      setReactivatingId(null);
    }
  };

  // Filtered & Sorted players list
  const sortedAndFilteredPlayers = useMemo(() => {
    // 1. Filter
    const targetPool = filterMode === "inactive" ? inactivePlayers : activePlayers;

    const filtered = targetPool.filter((p) => {
      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
      const matchesSearch = !search || fullName.includes(search.toLowerCase()) || (p.membership?.jersey_number?.toString() === search);

      let matchesMode = true;
      if (filterMode === "attention") {
        matchesMode = p.active_injury || p.physical_status === "yellow";
      } else if (filterMode === "available") {
        matchesMode = !p.active_injury;
      } else if (filterMode === "injured") {
        matchesMode = !!p.active_injury;
      }

      let matchesPos = true;
      if (positionFilter !== "all") {
        const positions = p.membership?.positions ?? [];
        matchesPos = positions.includes(positionFilter);
      }

      return matchesSearch && matchesMode && matchesPos;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      let result = 0;

      if (sortKey === "position") {
        const posA = a.membership?.positions?.[0] || "";
        const posB = b.membership?.positions?.[0] || "";
        const weightA = POSITION_WEIGHTS[posA] ?? 99;
        const weightB = POSITION_WEIGHTS[posB] ?? 99;
        if (weightA !== weightB) {
          result = weightA - weightB;
        } else {
          // secondary sort by jersey number then name
          const numA = a.membership?.jersey_number ?? 999;
          const numB = b.membership?.jersey_number ?? 999;
          result = numA - numB;
        }
      } else if (sortKey === "number") {
        const numA = a.membership?.jersey_number ?? 999;
        const numB = b.membership?.jersey_number ?? 999;
        result = numA - numB;
      } else if (sortKey === "name") {
        const nameA = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
        const nameB = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
        result = nameA.localeCompare(nameB);
      } else if (sortKey === "availability") {
        const statusWeight = (p: any) => {
          if (p.active_injury?.status === "active") return 3;
          if (p.active_injury?.status === "readaptation") return 2;
          return 1;
        };
        result = statusWeight(a) - statusWeight(b);
      } else if (sortKey === "physical") {
        const physA = a.physical_status === "yellow" ? 2 : 1;
        const physB = b.physical_status === "yellow" ? 2 : 1;
        result = physA - physB;
      }

      return sortDir === "asc" ? result : -result;
    });
  }, [activePlayers, search, filterMode, positionFilter, sortKey, sortDir]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="size-3 opacity-40 group-hover/col:opacity-100" />;
    }
    return sortDir === "asc" ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ── HEADER ── */}
      <PageHeader
        title="Plantilla"
        description={`Gestión y seguimiento de disponibilidades del equipo (${activePlayers.length} jugadores)`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/players/edit" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Edit className="size-4 mr-1.5" />
            Editar Plantilla
          </Link>
          <Link href="/players/new" className={buttonVariants({ size: "sm" })}>
            <UserPlus className="size-4 mr-1.5" />
            Añadir Jugador
          </Link>
        </div>
      </PageHeader>

      {/* ── HIGH-LEVEL DECISION SUMMARY BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all cursor-pointer bg-card",
            filterMode === "all" ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[11px] font-medium text-muted-foreground block">Total Plantilla</span>
          <span className="text-xl font-semibold text-foreground mt-0.5 block">{activePlayers.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("available")}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all cursor-pointer bg-card",
            filterMode === "available" ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[11px] font-medium text-muted-foreground block">Disponibles</span>
          <span className="text-xl font-semibold text-emerald-400 mt-0.5 block">{availableCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("injured")}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all cursor-pointer bg-card",
            filterMode === "injured" ? "border-destructive/50 ring-1 ring-destructive/30" : "border-border hover:border-border/80"
          )}
        >
          <span className="text-[11px] font-medium text-muted-foreground block">Bajas / Readaptación</span>
          <span className="text-xl font-semibold text-destructive mt-0.5 block">{injuredCount + readaptCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("attention")}
          className={cn(
            "p-3.5 rounded-lg border text-left transition-all cursor-pointer bg-card",
            filterMode === "attention" ? "border-amber-500/50 ring-1 ring-amber-500/30" : "border-border hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Requieren Atención</span>
            {attentionCount > 0 && <AlertTriangle className="size-3.5 text-amber-400" />}
          </div>
          <span className="text-xl font-semibold text-amber-400 mt-0.5 block">{attentionCount}</span>
        </button>

        {inactiveCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterMode("inactive")}
            className={cn(
              "p-3.5 rounded-lg border text-left transition-all cursor-pointer bg-card",
              filterMode === "inactive" ? "border-rose-500/50 ring-1 ring-rose-500/30" : "border-border hover:border-border/80"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Desactivados (Sin ficha)</span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                Baja
              </span>
            </div>
            <span className="text-xl font-semibold text-rose-400 mt-0.5 block">{inactiveCount}</span>
          </button>
        )}
      </div>

      {/* ── FILTER & TOGGLE TOOLBAR ── */}
      <div className="bg-card rounded-lg border border-border p-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o dorsal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md bg-background border border-border pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="rounded-md bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
          >
            <option value="all">Todas las posiciones</option>
            <option value="goalkeeper">Porteros</option>
            <option value="center_back">Centrales</option>
            <option value="full_back">Laterales</option>
            <option value="midfielder">Mediocampistas</option>
            <option value="winger">Extremos</option>
            <option value="striker">Delanteros</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex bg-muted/60 border border-border rounded-md p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "table"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-3.5" />
            Tabla de Decisión
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "map"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5" />
            Mapa de Campo
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT VIEW ── */}
      {viewMode === "table" ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {sortedAndFilteredPlayers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No se encontraron jugadores con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30 text-[11px] font-medium text-muted-foreground select-none">
                    <th 
                      onClick={() => handleSort("number")}
                      className="py-3 px-4 w-16 text-center cursor-pointer hover:text-foreground group/col transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>#</span>
                        {renderSortIndicator("number")}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("name")}
                      className="py-3 px-4 cursor-pointer hover:text-foreground group/col transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Jugador</span>
                        {renderSortIndicator("name")}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("position")}
                      className="py-3 px-4 cursor-pointer hover:text-foreground group/col transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Posición</span>
                        {renderSortIndicator("position")}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("availability")}
                      className="py-3 px-4 cursor-pointer hover:text-foreground group/col transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Disponibilidad</span>
                        {renderSortIndicator("availability")}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("physical")}
                      className="py-3 px-4 cursor-pointer hover:text-foreground group/col transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Estado Físico</span>
                        {renderSortIndicator("physical")}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-xs">
                  {sortedAndFilteredPlayers.map((player) => {
                    const fullName = `${player.first_name} ${player.last_name}`;
                    const initials = `${player.first_name[0]}${player.last_name[0]}`.toUpperCase();
                    const positions = player.membership?.positions ?? [];
                    const primaryPos = positions[0] ? (POSITION_LABELS as any)[positions[0]] || positions[0] : "Sin asignar";
                    const activeInjury = player.active_injury;
                    const isInjured = activeInjury && activeInjury.status === "active";
                    const isReadapt = activeInjury && activeInjury.status === "readaptation";
                    const isFatigued = player.physical_status === "yellow";

                    return (
                      <tr 
                        key={player.id} 
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="py-3 px-4 text-center font-mono font-medium text-muted-foreground">
                          {player.membership?.jersey_number ?? "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/players/${player.id}`} className="flex items-center gap-3 group/link">
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt={fullName} className="h-8 w-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                                {initials}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-foreground group-hover/link:text-primary transition-colors block">
                                {fullName}
                              </span>
                              {player.sporting_name && (
                                <span className="text-[11px] text-muted-foreground">{player.sporting_name}</span>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted/60 border border-border/40 font-medium">
                            {primaryPos}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isInjured ? (
                            <span className="inline-flex items-center gap-1.5 text-destructive font-medium text-[11px]">
                              <span className="h-2 w-2 rounded-full bg-destructive" />
                              Baja Médica ({activeInjury.body_part || "Enfermería"})
                            </span>
                          ) : isReadapt ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              Readaptación sobre césped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                              Disponible
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isFatigued ? (
                            <span className="text-amber-400 text-[11px] font-medium flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Sobrecarga / Fatiga
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Carga OK</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {player.membership?.status === "inactive" && (
                              <button
                                type="button"
                                disabled={reactivatingId === player.id}
                                onClick={() => handleReactivatePlayer(player.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                              >
                                {reactivatingId === player.id ? "Reactivando..." : "🟢 Reactivar"}
                              </button>
                            )}
                            <Link 
                              href={`/players/${player.id}`} 
                              className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "text-muted-foreground hover:text-foreground")}
                            >
                              Ver Ficha <ChevronRight className="size-3 ml-1" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6">
          <InteractiveFieldMap players={activePlayers} />
        </div>
      )}
    </div>
  );
}
