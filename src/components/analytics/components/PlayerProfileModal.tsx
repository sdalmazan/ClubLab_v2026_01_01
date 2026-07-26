import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Shield,
  Calendar,
  ArrowRightLeft,
  Clock,
  AlertCircle,
  UserCheck,
  Trophy
} from "lucide-react";
import {
  exploreAction,
  getPlayerPositionOverrideAction,
  savePlayerPositionOverrideAction
} from "@/features/analysis/actions";
import { ExplorerRow, EntityType } from "@/features/analysis/types";
import { getPositionLabel } from "@/types";
import { MetricRegistry } from "@/features/analysis/registry/metrics";
import { getEntityConfig } from "@/features/analysis/entities";

interface PlayerProfileModalProps {
  entityType?: EntityType; // Optional, defaults to "player"
  organizationId?: string; // Add organizationId support
  playerName: string; // Used as the entity name key
  onClose: () => void;
  onCompare?: (rowId: string) => void;
  isAlreadySelected?: boolean;
}

/**
 * PlayerProfileModal (Unified Entity Profile Modal).
 * Displays detailed profiles, history logs, and season-by-season statistics
 * dynamically for Players, Teams, Coaches, and Competitions.
 */
export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  entityType = "player",
  organizationId,
  playerName,
  onClose,
  onCompare,
  isAlreadySelected = false,
}) => {
  const [history, setHistory] = useState<ExplorerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState<{ position: string; status: string; suggestedPosition?: string; proposedByUserId?: string } | null>(null);
  const [role, setRole] = useState<string>("trainer");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedPos, setSelectedPos] = useState<string>("");

  const config = getEntityConfig(entityType);
  const metricsToLoad = config.metrics;

  useEffect(() => {
    async function fetchOverride() {
      if (entityType === "player" && organizationId) {
        try {
          const res = await getPlayerPositionOverrideAction(playerName, organizationId);
          setOverride(res.override);
          setRole(res.role);
          setCurrentUserId(res.currentUserId);
        } catch (e) {
          console.warn("Failed to load position override:", e);
        }
      }
    }
    fetchOverride();
  }, [playerName, entityType, organizationId]);

  const handleSaveOverride = async (newPos: string, overrideStatus: "approved" | "pending") => {
    if (!organizationId) return;
    try {
      await savePlayerPositionOverrideAction(playerName, organizationId, newPos, overrideStatus);
      setOverride({
        position: overrideStatus === "approved" ? newPos : (override?.position || ""),
        status: overrideStatus,
        suggestedPosition: overrideStatus === "pending" ? newPos : undefined,
        proposedByUserId: overrideStatus === "pending" ? (currentUserId || undefined) : undefined
      });
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const filterField =
          entityType === "player"
            ? "player_name"
            : entityType === "team"
            ? "team_name"
            : entityType === "coach"
            ? "coach_name"
            : "competition";

        const res = await exploreAction({
          entityType,
          filters: {
            condition: "AND",
            rules: [{ field: filterField, operator: "ieq", value: playerName }],
          },
          metrics: metricsToLoad,
          sortBy: "season",
          sortOrder: "desc",
          page: 1,
          pageSize: 20,
          organizationId,
        });
        setHistory(res.rows);
      } catch (err) {
        console.error("Fallo al cargar el historial:", err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [playerName, entityType, organizationId]);

  const sampleRow = history[0];

  const getModalIcon = () => {
    switch (entityType) {
      case "player":
        return <User className="h-5 w-5 text-primary" />;
      case "team":
        return <Shield className="h-5 w-5 text-primary" />;
      case "coach":
        return <UserCheck className="h-5 w-5 text-primary" />;
      case "competition":
        return <Trophy className="h-5 w-5 text-primary" />;
    }
  };

  const getSubtitle = () => {
    switch (entityType) {
      case "player":
        return `Ficha Técnica Histórica • ${getPositionLabel(sampleRow?.details?.position || "midfielder")}`;
      case "team":
        return `Historial de Rendimiento • Club`;
      case "coach":
        return `Historial Táctico • Entrenador`;
      case "competition":
        return `Registro Histórico • Liga`;
    }
  };

  const renderOverviewCards = () => {
    if (!sampleRow) return null;

    if (entityType === "player") {
      const isAdmin = role === "admin" || role === "owner";
      const positionsList = [
        { value: "goalkeeper", label: "Portero" },
        { value: "back", label: "Defensa" },
        { value: "midfielder", label: "Centrocampista" },
        { value: "forward", label: "Delantero / Extremo" },
      ];

      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Position override card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner flex flex-col justify-between min-h-[75px]">
              <div>
                <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Posición</span>
                {editing ? (
                  <div className="flex flex-col gap-1 mt-1">
                    <select
                      value={selectedPos || sampleRow.details?.position || "midfielder"}
                      onChange={(e) => setSelectedPos(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white px-2 py-1 outline-none"
                    >
                      {positionsList.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveOverride(selectedPos || sampleRow.details?.position || "midfielder", isAdmin ? "approved" : "pending")}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold transition-all"
                      >
                        {isAdmin ? "Guardar" : "Proponer"}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">
                      {getPositionLabel(override?.status === "approved" ? override.position : (sampleRow.details?.position || "midfielder"))}
                    </span>
                    {organizationId && (
                      <button
                        onClick={() => {
                          setSelectedPos(override?.status === "approved" ? override.position : (sampleRow.details?.position || "midfielder"));
                          setEditing(true);
                        }}
                        className="text-[10px] font-bold text-primary hover:text-white transition-colors cursor-pointer border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-lg"
                      >
                        ✏️ {isAdmin ? "Editar" : "Proponer"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner flex flex-col justify-center">
              <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Club Actual</span>
              <span className="text-sm font-bold text-white">{sampleRow.details?.team_name}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner flex flex-col justify-center">
              <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Última Temporada</span>
              <span className="text-sm font-bold text-white">{sampleRow.details?.season}</span>
            </div>
          </div>

          {/* Pending Suggestion alert box ONLY for the user who proposed the change */}
          {override?.status === "pending" && override?.proposedByUserId === currentUserId && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fade-in">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">⚠️ Modificación de Posición Propuesta</span>
                <span className="text-xxs text-amber-400/80">
                  Has propuesto cambiar la posición de este jugador a:{" "}
                  <span className="font-bold text-white underline">
                    {getPositionLabel(override.suggestedPosition || "midfielder")}
                  </span>
                </span>
                <span className="text-xxs text-amber-400/60 italic mt-0.5">
                  Pendiente de aprobación por el Superadministrador.
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (entityType === "team") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Competición</span>
            <span className="text-sm font-bold text-white">{sampleRow.details?.competition || "Liga Regional"}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Partidos Registrados</span>
            <span className="text-sm font-bold text-white">{sampleRow.metrics?.matches || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Última Temporada</span>
            <span className="text-sm font-bold text-white">{sampleRow.details?.season}</span>
          </div>
        </div>
      );
    }

    if (entityType === "coach") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Club Actual</span>
            <span className="text-sm font-bold text-white">{sampleRow.details?.current_team || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Partidos Dirigidos</span>
            <span className="text-sm font-bold text-white">{sampleRow.metrics?.matchesPlayed || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
            <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Temporada</span>
            <span className="text-sm font-bold text-white">{sampleRow.details?.season}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
          <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Competición</span>
          <span className="text-sm font-bold text-white">{playerName}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
          <span className="block text-xxs font-bold text-slate-500 uppercase tracking-widest mb-1">Última Temporada</span>
          <span className="text-sm font-bold text-white">{sampleRow.details?.season}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-slate-900/60 px-6 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              {getModalIcon()}
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">{playerName}</h3>
              <p className="text-xs text-slate-400">{getSubtitle()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {entityType !== "competition" && onCompare && sampleRow && (
              <button
                onClick={() => {
                  onCompare(sampleRow.id);
                  onClose();
                }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isAlreadySelected
                    ? "bg-slate-900 border border-slate-800 text-slate-400"
                    : "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]"
                }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>{isAlreadySelected ? "En Comparación" : "Comparar"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-300">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
              <Clock className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-semibold">Cargando trayectoria deportiva...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
              <AlertCircle className="h-6 w-6 text-slate-600" />
              <p className="text-sm">No se encontraron registros históricos para esta entidad.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Profile Details Cards */}
              {renderOverviewCards()}

              {/* Season History Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <span>Trayectoria Histórica</span>
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
                  <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-900/40 text-slate-500 border-b border-slate-800 font-bold">
                        <th className="py-3 px-4">Temporada</th>
                        {entityType !== "competition" && (
                          <th className="py-3 px-4">
                            {entityType === "team" ? "Liga / Competición" : "Equipo"}
                          </th>
                        )}
                        {entityType === "player" && (
                          <th className="py-3 px-4">Categoría</th>
                        )}
                        {metricsToLoad.map((mId) => {
                          const def = MetricRegistry.get(mId);
                          return (
                            <th
                              key={mId}
                              className="py-3 px-3 text-center whitespace-nowrap cursor-help border-b border-dotted border-slate-800 pb-1"
                              title={def?.description || def?.name}
                            >
                              {def?.name || mId}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-900/20 transition-all">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-400">
                            {row.details?.season}
                          </td>
                          {entityType !== "competition" && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="font-semibold text-white">
                                  {entityType === "team"
                                    ? row.details?.competition || "Liga"
                                    : row.details?.team_name || row.details?.current_team || "—"}
                                </span>
                              </div>
                            </td>
                          )}
                          {entityType === "player" && (
                            <td className="py-3 px-4 text-slate-400 font-medium">
                              {row.details?.competition || "—"}
                            </td>
                          )}
                          {metricsToLoad.map((mId) => {
                            const def = MetricRegistry.get(mId);
                            const val = row.metrics[mId] !== undefined ? row.metrics[mId] : "—";
                            let formattedVal = String(val);

                            if (val !== "—") {
                              if (def?.formatType === "percentage") {
                                formattedVal = `${val}%`;
                              } else if (def?.formatType === "duration") {
                                formattedVal = `${val}m`;
                              }
                            }

                            // Dynamic highlighting for impact
                            const isImpact = mId === "impact";
                            const impactNum = Number(val);

                            return (
                              <td key={mId} className="py-3 px-3 text-center font-mono font-medium whitespace-nowrap">
                                <span
                                  className={
                                    isImpact && impactNum > 0
                                      ? "text-emerald-400 font-bold"
                                      : isImpact && impactNum < 0
                                      ? "text-red-400 font-bold"
                                      : ""
                                  }
                                >
                                  {isImpact && impactNum > 0 ? `+${formattedVal}` : formattedVal}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer with clear Exit Button */}
        <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer shadow flex items-center gap-1.5"
          >
            <X className="h-4 w-4" />
            <span>Cerrar Ficha</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default PlayerProfileModal;
