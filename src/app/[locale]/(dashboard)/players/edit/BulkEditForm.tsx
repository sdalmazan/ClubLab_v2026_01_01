"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NATIONALITIES } from "@/types";
import { Check, X, ShieldAlert, Plus, Trash2, ArrowUpDown } from "lucide-react";

interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  sportingName: string;
  jerseyNumber: string;
  nationality: string;
  dominantFoot: "right" | "left" | "both";
  adjective: string;
  positions: string[];
  signingStatus: "signed" | "close" | "difficult";
  birthYear: string;
  playerType: "main" | "reserve" | "youth" | "other";
  status?: "active" | "inactive";
  isDeleted?: boolean;
}

interface BulkEditFormProps {
  initialPlayers: any[];
  customPositions: any[];
  userRole: string;
  organizationId: string;
  teamId: string;
  seasonId: string;
}

export function BulkEditForm({
  initialPlayers,
  customPositions,
  userRole,
  organizationId,
  teamId,
  seasonId,
}: BulkEditFormProps) {
  const router = useRouter();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof PlayerRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const fallbackPositions = [
    { key: "goalkeeper", label: "Portero" },
    { key: "left_back", label: "Lateral Izquierdo" },
    { key: "left_center_back", label: "Central Izquierdo" },
    { key: "right_center_back", label: "Central Derecho" },
    { key: "right_back", label: "Lateral Derecho" },
    { key: "defensive_midfielder", label: "Pivote" },
    { key: "playmaker_midfielder", label: "Interior" },
    { key: "attacking_midfielder", label: "Mediapunta" },
    { key: "left_winger", label: "Extremo Izquierdo" },
    { key: "right_winger", label: "Extremo Derecho" },
    { key: "striker", label: "Delantero Centro" }
  ];

  const positionsList = customPositions.length > 0 ? customPositions : fallbackPositions;

  // Map database players to client state structure
  const getInitialState = (): PlayerRow[] => {
    return initialPlayers.map((p) => ({
      id: p.id,
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      sportingName: p.sporting_name || "",
      jerseyNumber: p.membership?.jersey_number?.toString() ?? "",
      nationality: p.nationality ?? "Española",
      dominantFoot: p.dominant_foot ?? "right",
      adjective: p.adjective || "",
      positions: p.membership?.positions ?? [],
      signingStatus: (p.signing_status as any) ?? "signed",
      birthYear: p.date_of_birth ? new Date(p.date_of_birth).getFullYear().toString() : "",
      playerType: p.membership?.player_type ?? "main",
      status: p.membership?.status === "inactive" ? "inactive" : "active",
    }));
  };

  const [players, setPlayers] = useState<PlayerRow[]>(getInitialState);

  // Warning Modals States
  const [pendingNav, setPendingNav] = useState(false);
  const [dorsalConflictMsg, setDorsalConflictMsg] = useState<string | null>(null);

  // Check if changes exist compared to initial state
  const hasChanges = JSON.stringify(players) !== JSON.stringify(getInitialState());

  // beforeunload listener to warn user about losing changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Sync horizontal scrollbars
  useEffect(() => {
    const tableEl = tableContainerRef.current;
    const topScrollEl = topScrollRef.current;
    if (!tableEl || !topScrollEl) return;

    const handleTableScroll = () => {
      topScrollEl.scrollLeft = tableEl.scrollLeft;
    };
    const handleTopScroll = () => {
      tableEl.scrollLeft = topScrollEl.scrollLeft;
    };

    tableEl.addEventListener("scroll", handleTableScroll);
    topScrollEl.addEventListener("scroll", handleTopScroll);
    return () => {
      tableEl.removeEventListener("scroll", handleTableScroll);
      topScrollEl.removeEventListener("scroll", handleTopScroll);
    };
  }, [players]);

  // Track table width changes to update top scroll track width
  useEffect(() => {
    const tableEl = tableContainerRef.current?.querySelector("table");
    if (!tableEl) return;

    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableScrollWidth(entry.target.scrollWidth);
      }
    });
    obs.observe(tableEl);
    return () => obs.disconnect();
  }, [players]);

  // Update a specific field for a specific player row
  const updatePlayerField = (id: string, field: keyof PlayerRow, value: any) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Add new player row locally
  const handleAddPlayer = () => {
    const newRow: PlayerRow = {
      id: `temp_${Date.now()}`,
      firstName: "",
      lastName: "",
      sportingName: "",
      jerseyNumber: "",
      nationality: "Española",
      dominantFoot: "right",
      adjective: "",
      positions: [],
      signingStatus: "signed",
      birthYear: "",
      playerType: "main",
      status: "active",
    };
    setPlayers((prev) => [...prev, newRow]);
  };

  // Mark row as deleted or filter out temporary row
  const handleDeletePlayer = (id: string) => {
    if (id.startsWith("temp_")) {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } else {
      setPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isDeleted: true } : p))
      );
    }
  };

  // Perform sorting on table header click
  const handleSort = (column: keyof PlayerRow) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get active, sorted rows (not deleted)
  const activePlayers = players.filter((p) => !p.isDeleted);
  const sortedPlayers = [...activePlayers].sort((a, b) => {
    if (!sortColumn) return 0;

    if (sortColumn === "positions") {
      const getPositionOrder = (key: string): number => {
        if (!key) return 999;
        const idx = positionsList.findIndex((pos) => pos.key === key);
        return idx !== -1 ? idx : 999;
      };
      const orderA = getPositionOrder(a.positions[0] || "");
      const orderB = getPositionOrder(b.positions[0] || "");
      if (orderA < orderB) return sortDirection === "asc" ? -1 : 1;
      if (orderA > orderB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    }

    let valA: any = a[sortColumn] ?? "";
    let valB: any = b[sortColumn] ?? "";

    if (Array.isArray(valA)) valA = valA.join(", ");
    if (Array.isArray(valB)) valB = valB.join(", ");

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Perform validations & save payload
  const saveBulkChanges = async () => {
    // 1. Validate required fields for active rows
    const incomplete = activePlayers.some((p) => !p.firstName.trim() || !p.lastName.trim());
    if (incomplete) {
      setError("Todos los jugadores activos deben tener nombre y apellidos.");
      return false;
    }

    // 2. Check duplicate dorsal numbers in the active signed rows
    const activeSignedJerseys = activePlayers
      .filter((p) => p.signingStatus === "signed")
      .map((p) => p.jerseyNumber.trim())
      .filter((num) => num !== "");

    const duplicates = activeSignedJerseys.filter((num, idx) => activeSignedJerseys.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      setDorsalConflictMsg(
        `Hay dorsales asignados por duplicado (#${Array.from(new Set(duplicates)).join(
          ", #"
        )}). Asegúrate de que cada jugador firmado tenga un dorsal único antes de guardar.`
      );
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/players", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players, // Send full array including isDeleted: true rows and temp_ rows
          organizationId,
          teamId,
          seasonId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ocurrió un error al guardar los cambios.");
        setLoading(false);
        return false;
      }

      setSuccess(true);
      setLoading(false);
      router.refresh();
      setTimeout(() => {
        router.push("/players");
      }, 1000);
      return true;
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
      setLoading(false);
      return false;
    }
  };

  const handleSaveClick = async () => {
    const ok = await saveBulkChanges();
    if (ok) {
      setPendingNav(false);
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setPendingNav(true);
    } else {
      router.push("/players");
    }
  };

  const handleConfirmDiscard = () => {
    setPendingNav(false);
    router.push("/players");
  };

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all [&>option]:bg-slate-900 [&>option]:text-white";

  const renderSortIcon = (column: keyof PlayerRow) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 text-slate-500 shrink-0 opacity-40 hover:opacity-100 transition-opacity" />;
    return (
      <span className="text-[9px] font-black text-[var(--primary)] select-none shrink-0">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Table Container */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-md">
        {/* Synced top scrollbar */}
        <div 
          ref={topScrollRef} 
          className="w-full overflow-x-auto overflow-y-hidden h-3 bg-slate-950/20 border-b border-white/5 rounded-t-2xl"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: "1.5px" }}></div>
        </div>
        <div ref={tableContainerRef} className="max-h-[650px] overflow-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-[#0b0f19]/95 backdrop-blur-md text-[10px] uppercase tracking-wider font-extrabold text-slate-400 select-none sticky top-0 z-20">
                <th 
                  onClick={() => handleSort("firstName")} 
                  className="py-3 px-4 min-w-[280px] cursor-pointer hover:bg-white/1 transition-all sticky left-0 top-0 z-30 bg-[#0e1322]/95 border-r border-white/5 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex items-center gap-1">
                    <span>Jugador (Nombre y Apellidos)</span>
                    {renderSortIcon("firstName")}
                  </div>
                </th>
                <th onClick={() => handleSort("sportingName")} className="py-3 px-4 min-w-[140px] cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Nombre Deportivo</span>
                    {renderSortIcon("sportingName")}
                  </div>
                </th>
                <th onClick={() => handleSort("jerseyNumber")} className="py-3 px-4 w-20 text-center cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center justify-center gap-1">
                    <span>Dorsal</span>
                    {renderSortIcon("jerseyNumber")}
                  </div>
                </th>
                <th onClick={() => handleSort("birthYear")} className="py-3 px-4 w-24 text-center cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center justify-center gap-1">
                    <span>Año Nac.</span>
                    {renderSortIcon("birthYear")}
                  </div>
                </th>
                <th onClick={() => handleSort("playerType")} className="py-3 px-4 min-w-[125px] cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Ficha / Tipo</span>
                    {renderSortIcon("playerType")}
                  </div>
                </th>
                <th onClick={() => handleSort("signingStatus")} className="py-3 px-4 min-w-[140px] cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Estado Fichaje</span>
                    {renderSortIcon("signingStatus")}
                  </div>
                </th>
                <th onClick={() => handleSort("positions")} className="py-3 px-4 min-w-[180px] cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Posición Principal</span>
                    {renderSortIcon("positions")}
                  </div>
                </th>
                <th onClick={() => handleSort("positions")} className="py-3 px-4 min-w-[180px] cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Posición Secundaria</span>
                    {renderSortIcon("positions")}
                  </div>
                </th>
                <th onClick={() => handleSort("nationality")} className="py-3 px-4 w-36 cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Nacionalidad</span>
                    {renderSortIcon("nationality")}
                  </div>
                </th>
                <th onClick={() => handleSort("dominantFoot")} className="py-3 px-4 w-32 cursor-pointer hover:bg-white/1 transition-all">
                  <div className="flex items-center gap-1">
                    <span>Pie Dominante</span>
                    {renderSortIcon("dominantFoot")}
                  </div>
                </th>
                {userRole !== "player" && <th className="py-3 px-4 min-w-[150px]">Adjetivo (Staff)</th>}
                <th className="py-3 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {sortedPlayers.map((p) => {
                const isTemp = p.id.startsWith("temp_");
                return (
                  <tr key={p.id} className="group hover:bg-white/1 transition-all">
                    {/* Name and Last Name inputs */}
                    <td className="py-2 px-4 sticky left-0 z-10 bg-[#0e1322] group-hover:bg-[#131b2e] border-r border-white/5 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={p.firstName}
                          onChange={(e) => updatePlayerField(p.id, "firstName", e.target.value)}
                          className={inputClass}
                          placeholder="Nombre"
                          required
                        />
                        <input
                          type="text"
                          value={p.lastName}
                          onChange={(e) => updatePlayerField(p.id, "lastName", e.target.value)}
                          className={inputClass}
                          placeholder="Apellidos"
                          required
                        />
                      </div>
                    </td>

                    {/* Sporting Name */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={p.sportingName}
                        onChange={(e) => updatePlayerField(p.id, "sportingName", e.target.value)}
                        className={`${inputClass} text-slate-200 placeholder-slate-600`}
                        placeholder="Ej. Charly"
                      />
                    </td>

                    {/* Jersey/Dorsal */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={p.jerseyNumber}
                        onChange={(e) =>
                          updatePlayerField(p.id, "jerseyNumber", e.target.value.replace(/\D/g, ""))
                        }
                        className={`${inputClass} text-center font-bold text-emerald-450`}
                        placeholder="-"
                        disabled={p.signingStatus !== "signed"}
                      />
                    </td>

                    {/* Birth Year */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={p.birthYear}
                        onChange={(e) =>
                          updatePlayerField(p.id, "birthYear", e.target.value.replace(/\D/g, ""))
                        }
                        className={`${inputClass} text-center`}
                        placeholder="AAAA"
                      />
                    </td>

                    {/* Player Type */}
                    <td className="py-2 px-4">
                      <select
                        value={p.playerType}
                        onChange={(e) => updatePlayerField(p.id, "playerType", e.target.value)}
                        className={`w-full rounded-lg bg-slate-950 border px-2 py-1 text-xs focus:outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white ${
                          p.playerType === "reserve"
                            ? "border-purple-500/40 text-purple-400 bg-purple-500/5"
                            : p.playerType === "youth"
                            ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/5"
                            : p.playerType === "other"
                            ? "border-sky-500/40 text-sky-400 bg-sky-500/5"
                            : "border-white/10 text-slate-200"
                        }`}
                      >
                        <option value="main">Principal</option>
                        <option value="reserve">Filial</option>
                        <option value="youth">Juvenil</option>
                        <option value="other">Otros</option>
                      </select>
                    </td>

                    {/* Ficha / Estado */}
                    <td className="py-2 px-4">
                      <select
                        value={p.status}
                        onChange={(e) => updatePlayerField(p.id, "status", e.target.value)}
                        className={`w-full rounded-lg bg-slate-950 border px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white ${
                          p.status === "inactive"
                            ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                            : "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                        }`}
                      >
                        <option value="active">🟢 Activo</option>
                        <option value="inactive">⚪ Desactivado (Sin ficha)</option>
                      </select>
                    </td>
                    <td className="py-2 px-4">
                      <select
                        value={p.signingStatus}
                        onChange={(e) => {
                          const status = e.target.value as any;
                          // Clear jersey number if not signed
                          const updatedJersey = status !== "signed" ? "" : p.jerseyNumber;
                          setPlayers((prev) =>
                            prev.map((row) =>
                              row.id === p.id
                                ? { ...row, signingStatus: status, jerseyNumber: updatedJersey }
                                : row
                            )
                          );
                        }}
                        className={`w-full rounded-lg bg-slate-950 border px-2 py-1 text-xs focus:outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white ${
                          p.signingStatus === "close"
                            ? "border-amber-500/40 text-amber-400 bg-amber-500/5"
                            : p.signingStatus === "difficult"
                            ? "border-rose-500/40 text-rose-455 bg-rose-500/5"
                            : "border-white/10 text-emerald-400 bg-emerald-500/5"
                        }`}
                      >
                        <option value="signed">Firmado</option>
                        <option value="close">Cerca</option>
                        <option value="difficult">Difícil</option>
                      </select>
                    </td>

                    {/* Primary Position */}
                    <td className="py-2 px-4">
                      <select
                        value={p.positions[0] || ""}
                        onChange={(e) => {
                          const newPos = [...p.positions];
                          newPos[0] = e.target.value;
                          updatePlayerField(p.id, "positions", newPos);
                        }}
                        className={`${inputClass} text-emerald-400 font-extrabold`}
                      >
                        <option value="">Seleccionar...</option>
                        {positionsList.map((pos) => (
                          <option key={pos.key} value={pos.key}>
                            {pos.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Secondary Position */}
                    <td className="py-2 px-4">
                      <select
                        value={p.positions[1] || ""}
                        onChange={(e) => {
                          const newPos = [...p.positions];
                          if (e.target.value) {
                            newPos[1] = e.target.value;
                          } else {
                            newPos.splice(1, 1);
                          }
                          updatePlayerField(p.id, "positions", newPos);
                        }}
                        className={`${inputClass} text-slate-400 font-semibold`}
                      >
                        <option value="">Ninguna</option>
                        {positionsList
                          .filter((pos) => pos.key !== p.positions[0])
                          .map((pos) => (
                            <option key={pos.key} value={pos.key}>
                              {pos.label}
                            </option>
                          ))}
                      </select>
                    </td>

                    {/* Nationality select */}
                    <td className="py-2 px-4">
                      <select
                        value={p.nationality}
                        onChange={(e) => updatePlayerField(p.id, "nationality", e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        {NATIONALITIES.map((nat) => (
                          <option key={nat.value} value={nat.value}>
                            {nat.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Dominant Foot */}
                    <td className="py-2 px-4">
                      <select
                        value={p.dominantFoot}
                        onChange={(e) => updatePlayerField(p.id, "dominantFoot", e.target.value)}
                        className={inputClass}
                      >
                        <option value="right">Derecho</option>
                        <option value="left">Izquierdo</option>
                        <option value="both">Ambidiestro</option>
                      </select>
                    </td>

                    {/* Private Adjective (Staff only) */}
                    {userRole !== "player" && (
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={p.adjective}
                          onChange={(e) => updatePlayerField(p.id, "adjective", e.target.value)}
                          className={`${inputClass} text-amber-400 placeholder-slate-700`}
                          placeholder="Ej. Rápido..."
                        />
                      </td>
                    )}

                    {/* Delete row action */}
                    <td className="py-2 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(p.id)}
                        className="text-slate-500 hover:text-rose-455 transition-colors p-1.5 cursor-pointer rounded-lg hover:bg-rose-500/10"
                        title="Eliminar fila"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Row Button inside Table Footer */}
        <div className="p-4 bg-white/2 border-t border-white/5 flex justify-start">
          <button
            type="button"
            onClick={handleAddPlayer}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4 text-[var(--primary)]" />
            Añadir Jugador
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs text-rose-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>¡Todos los cambios se han guardado con éxito! Redirigiendo...</span>
        </div>
      )}

      {/* Roster Edit Actions */}
      <div className="flex gap-4 pt-2">
        <button
          type="button"
          onClick={handleCancelClick}
          disabled={loading}
          className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-3 transition-all cursor-pointer bg-white/2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={loading || !hasChanges}
          className="flex-1 rounded-xl btn-corporate font-semibold text-sm py-3 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Guardando plantilla..." : "Guardar cambios"}
        </button>
      </div>

      {/* Validation modals */}
      <AlertModal
        isOpen={dorsalConflictMsg !== null}
        title="Dorsales Duplicados"
        message={dorsalConflictMsg || ""}
        onConfirm={() => setDorsalConflictMsg(null)}
      />

      <AlertModal
        isOpen={pendingNav}
        title="Cambios sin guardar"
        message="¿Qué deseas hacer con los cambios de la plantilla?"
        confirmLabel="Guardar y salir"
        cancelLabel="Cancelar"
        onConfirm={handleSaveClick}
        onCancel={() => setPendingNav(false)}
        hasDiscardOption={true}
        discardLabel="Salir sin guardar"
        onDiscard={handleConfirmDiscard}
      />
    </div>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  hasDiscardOption?: boolean;
  discardLabel?: string;
  onDiscard?: () => void;
}

function AlertModal({
  isOpen,
  title,
  message,
  confirmLabel = "Aceptar",
  cancelLabel,
  onConfirm,
  onCancel,
  hasDiscardOption = false,
  discardLabel = "Descartar",
  onDiscard,
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-popover border border-border shadow-md max-w-md w-full rounded-lg p-6 space-y-4 animate-in fade-in duration-200">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">{title}</h3>
        <p className="text-slate-350 text-xs leading-relaxed font-medium">{message}</p>
        <div className="flex gap-2.5 justify-end pt-2 flex-wrap sm:flex-nowrap">
          {cancelLabel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              {cancelLabel}
            </button>
          )}
          {hasDiscardOption && onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="px-3.5 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-455 hover:bg-rose-500/20 text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              {discardLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl btn-corporate text-xs font-semibold shadow-lg cursor-pointer flex-1 sm:flex-initial"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
