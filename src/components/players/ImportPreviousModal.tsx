"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, X, Check, Users, AlertTriangle } from "lucide-react";

interface ImportPreviousModalProps {
  teamId: string;
  seasonId: string;
  buttonClassName?: string;
  label?: string;
}

export function ImportPreviousModal({
  teamId,
  seasonId,
  buttonClassName = "",
  label = "Importar jugadores",
}: ImportPreviousModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [importing, setImporting] = useState(false);
  const [players, setPlayers] = useState<{ id?: string; name: string; team?: string }[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, boolean>>({});
  const [foundSeason, setFoundSeason] = useState<string>("2025/2026");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const openModal = async () => {
    setIsOpen(true);
    setLoadingPlayers(true);
    setError(null);
    setSuccessCount(null);
    setSelectedPlayers({});
    
    try {
      const res = await fetch(`/api/players/previous?teamId=${encodeURIComponent(teamId)}`);
      const data = await res.json();
      if (res.ok && data.players) {
        setPlayers(data.players);
        if (data.season) {
          setFoundSeason(data.season);
        }
        // Select all by default
        const initialSel: Record<string, boolean> = {};
        data.players.forEach((p: { id?: string; name: string; team?: string }) => {
          initialSel[p.name] = true;
        });
        setSelectedPlayers(initialSel);
      } else {
        setError(data.error || "Error al cargar los jugadores de la temporada anterior");
      }
    } catch (err: any) {
      setError(err.message || "Error de red al cargar jugadores");
    } finally {
      setLoadingPlayers(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setPlayers([]);
    setError(null);
    setSuccessCount(null);
    setSearchQuery("");
    setIsSearchMode(false);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/players/previous?teamId=${encodeURIComponent(teamId)}&search=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      const data = await res.json();
      if (res.ok && data.players) {
        setPlayers(data.players);
        setIsSearchMode(true);
        setSelectedPlayers({});
      } else {
        setError(data.error || "Error al buscar jugadores");
      }
    } catch (err: any) {
      setError(err.message || "Error al buscar");
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = async () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setError(null);
    setLoadingPlayers(true);
    try {
      const res = await fetch(`/api/players/previous?teamId=${encodeURIComponent(teamId)}`);
      const data = await res.json();
      if (res.ok && data.players) {
        setPlayers(data.players);
        const initialSel: Record<string, boolean> = {};
        data.players.forEach((p: { id?: string; name: string; team?: string }) => {
          initialSel[p.name] = true;
        });
        setSelectedPlayers(initialSel);
      } else {
        setError(data.error || "Error al cargar los jugadores de la temporada anterior");
      }
    } catch (err: any) {
      setError(err.message || "Error de red al cargar jugadores");
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleToggleSelect = (playerName: string) => {
    setSelectedPlayers((prev) => ({
      ...prev,
      [playerName]: !prev[playerName],
    }));
  };

  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    players.forEach((p) => {
      next[p.name] = true;
    });
    setSelectedPlayers(next);
  };

  const handleDeselectAll = () => {
    setSelectedPlayers({});
  };

  const handleImport = async () => {
    const listToImport = players.filter((p) => selectedPlayers[p.name]);
    if (listToImport.length === 0) {
      alert("Selecciona al menos un jugador para continuar.");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/players/import-previous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          seasonId,
          players: listToImport,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessCount(data.imported);
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 2000);
      } else {
        setError(data.error || "Ocurrió un error al importar los jugadores");
      }
    } catch (err: any) {
      setError(err.message || "Error de red al importar");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = Object.values(selectedPlayers).filter(Boolean).length;

  return (
    <>
      <button
        onClick={openModal}
        className={buttonClassName || "flex items-center gap-2 rounded-xl bg-slate-900 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-md cursor-pointer"}
      >
        <Download className="h-4 w-4" />
        <span>{label}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border border-white/10 w-full max-w-lg p-6 bg-slate-900/95 shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Continuidad de Plantilla</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Importa los jugadores de la temporada anterior ({foundSeason})</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={importing}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 border-b border-white/5 pb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar otros jugadores en la liga..."
                className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-white shadow-inner"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-emerald-500 hover:bg-emerald-450 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg flex items-center justify-center min-w-[70px]"
              >
                {searching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span>Buscar</span>
                )}
              </button>
              {isSearchMode && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-2 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </form>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-[200px] max-h-[45vh]">
              {loadingPlayers ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider">Cargando jugadores anteriores...</span>
                </div>
              ) : error ? (
                <div className="rounded-2xl bg-rose-500/5 border border-rose-500/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-extrabold text-rose-450 uppercase tracking-wider">Ha ocurrido un error</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
              ) : successCount !== null ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="h-14 w-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 text-2xl shadow-inner animate-bounce">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">¡Importación Completada!</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Se han incorporado <strong className="text-emerald-400">{successCount}</strong> jugadores a la plantilla activa.
                    </p>
                  </div>
                </div>
              ) : players.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic text-xs">
                  No se encontraron jugadores registrados en el historial de la temporada anterior.
                </div>
              ) : (
                <div className="space-y-3">
                  {!isSearchMode && (
                    <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 flex items-start gap-3 text-left">
                      <span className="text-emerald-400 mt-0.5">💡</span>
                      <div>
                        <p className="text-xs font-bold text-white">Jugadores de la S.D. Almazán ({foundSeason})</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Se han recuperado {players.length} jugadores de las alineaciones oficiales de la liga correspondientes a la temporada {foundSeason}.
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Select actions */}
                  <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-white/5 pb-2">
                    <span>Lista de Jugadores ({players.length})</span>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSelectAll}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        Todos
                      </button>
                      <span className="text-white/10">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>

                  {/* Players list checkboxes */}
                  <div className="grid grid-cols-1 gap-1.5">
                    {players.map((p) => {
                      const isSelected = !!selectedPlayers[p.name];
                      return (
                        <div
                          key={p.name}
                          onClick={() => handleToggleSelect(p.name)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/40 text-white font-semibold"
                              : "bg-white/2 border-white/5 text-slate-400 hover:border-white/15"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-4.5 w-4.5 rounded flex items-center justify-center border transition-all ${
                              isSelected 
                                ? "bg-emerald-500 border-emerald-500 text-slate-950" 
                                : "border-white/20"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span className="truncate uppercase font-medium">
                              {p.name}
                              {p.team && (
                                <span className="text-[10px] text-slate-500 font-normal normal-case italic ml-2">
                                  ({p.team})
                                </span>
                              )}
                            </span>
                          </div>
                          {p.id ? (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 shrink-0">
                              Historial Club
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-550/10 text-blue-400 border border-blue-500/20 shrink-0">
                              Historial Liga
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {successCount === null && !loadingPlayers && players.length > 0 && (
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">
                  {selectedCount} de {players.length} seleccionados
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    disabled={importing}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white border border-white/5 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0}
                    className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Importando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>Importar jugadores</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
