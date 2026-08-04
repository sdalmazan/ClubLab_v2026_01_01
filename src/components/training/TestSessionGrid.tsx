"use client";

import React, { useState, useEffect } from "react";
import { Activity, Save, CheckCircle2, AlertCircle, Check } from "lucide-react";
import type { PlayerWithMembership } from "@/services/players";

export interface TestOption {
  id: string;
  name: string;
  unit: string;
  category: "potencia" | "velocidad" | "resistencia" | "fuerza" | "composicion" | "movilidad";
}

export const PRECONFIGURED_TESTS: TestOption[] = [
  { id: "cmj", name: "CMJ (Salto Vertical)", unit: "cm", category: "potencia" },
  { id: "sprint20m", name: "Sprint 20m", unit: "s", category: "velocidad" },
  { id: "yoyo", name: "Yo-Yo Test", unit: "m", category: "resistencia" },
  { id: "sentadilla1rm", name: "1RM Sentadilla", unit: "kg", category: "fuerza" },
  { id: "bodyfat", name: "Porcentaje de Grasa", unit: "%", category: "composicion" },
  { id: "nordic", name: "Nordic Hamstring", unit: "N", category: "fuerza" },
  { id: "ybalance", name: "Y-Balance", unit: "cm", category: "movilidad" },
  { id: "vbt", name: "Velocidad VBT", unit: "m/s", category: "potencia" },
];

interface TestSessionGridProps {
  sessionDate: string;
  teamId?: string;
  squadPlayers: PlayerWithMembership[];
  selectedTestIds?: string[];
  onSelectedTestsChange?: (testIds: string[]) => void;
  initialResults?: Record<string, Record<string, number | string>>;
  onChangeResults?: (results: Record<string, Record<string, string>>) => void;
}

export function TestSessionGrid({
  sessionDate,
  teamId,
  squadPlayers = [],
  selectedTestIds = ["cmj", "sprint20m", "bodyfat"],
  onSelectedTestsChange,
  initialResults = {},
  onChangeResults,
}: TestSessionGridProps) {
  const [activeTestIds, setActiveTestIds] = useState<string[]>(selectedTestIds);
  const [resultsMap, setResultsMap] = useState<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const [pId, pTests] of Object.entries(initialResults)) {
      map[pId] = {};
      for (const [tId, val] of Object.entries(pTests)) {
        map[pId][tId] = String(val);
      }
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleTest = (testId: string) => {
    const next = activeTestIds.includes(testId)
      ? activeTestIds.filter((id) => id !== testId)
      : [...activeTestIds, testId];
    setActiveTestIds(next);
    if (onSelectedTestsChange) onSelectedTestsChange(next);
  };

  const handleCellChange = (playerId: string, testId: string, val: string) => {
    setResultsMap((prev) => {
      const next = {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [testId]: val,
        },
      };
      if (onChangeResults) onChangeResults(next);
      return next;
    });
    setSavedSuccess(false);
  };

  const handleSaveResults = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const entries: any[] = [];
      for (const player of squadPlayers) {
        const pValues = resultsMap[player.id];
        if (!pValues) continue;
        for (const testId of activeTestIds) {
          const val = pValues[testId];
          if (val != null && val !== "") {
            const testOpt = PRECONFIGURED_TESTS.find((t) => t.id === testId);
            entries.push({
              playerId: player.id,
              testId: testId,
              testName: testOpt?.name || testId,
              unit: testOpt?.unit || "",
              value: Number(val) || val,
              date: sessionDate,
            });
          }
        }
      }

      await fetch("/api/training/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          date: sessionDate,
          entries,
        }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error("Error saving test results:", err);
    } finally {
      setSaving(false);
    }
  };

  const activeTests = PRECONFIGURED_TESTS.filter((t) => activeTestIds.includes(t.id));

  return (
    <div className="space-y-6 bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl animate-fade-in">
      {/* Header & Test Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <Activity className="size-4" />
            Sesión de Test & Valoración Física
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">
            Toma de Medidas — {sessionDate || "Fecha de la Sesión"}
          </h3>
          <p className="text-xs text-slate-400">
            Selecciona los tests que realizarás en la sesión e introduce los resultados en la tabla.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveResults}
          disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? (
            <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : savedSuccess ? (
            <CheckCircle2 className="size-4 text-white" />
          ) : (
            <Save className="size-4" />
          )}
          <span>{saving ? "Guardando..." : savedSuccess ? "¡Guardado con Éxito!" : "Guardar Test"}</span>
        </button>
      </div>

      {/* Selector de Tests Preconfigurados */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          Selecciona los Tests Físicos a Realizar en esta Sesión:
        </label>
        <div className="flex flex-wrap gap-2">
          {PRECONFIGURED_TESTS.map((test) => {
            const isSelected = activeTestIds.includes(test.id);
            return (
              <button
                key={test.id}
                type="button"
                onClick={() => toggleTest(test.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-slate-950 text-slate-400 border-white/10 hover:border-white/20"
                }`}
              >
                <span>{test.name}</span>
                <span className="text-[10px] opacity-60">({test.unit})</span>
                {isSelected && <Check className="size-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Table Grid */}
      {activeTests.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
          <AlertCircle className="size-6 text-amber-400 mx-auto" />
          <p className="text-xs font-bold text-slate-300">No has seleccionado ningún test</p>
          <p className="text-[11px] text-slate-500">Haz clic en los botones de arriba para activar las columnas de medición.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="py-3 px-4 font-bold text-slate-300 w-12 text-center">Dorsal</th>
                <th className="py-3 px-4 font-bold text-slate-300 min-w-[160px]">Futbolista</th>
                {activeTests.map((t) => (
                  <th key={t.id} className="py-3 px-4 font-bold text-emerald-400 min-w-[130px] text-center">
                    <div>{t.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 font-normal">({t.unit})</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {squadPlayers.map((player) => {
                const playerName = player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador";
                const jersey = player.membership?.jersey_number ?? (player as any).jersey_number ?? "–";
                const pValues = resultsMap[player.id] || {};

                return (
                  <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-500 text-center">
                      #{player.membership?.jersey_number ?? (player as any).jersey_number ?? "–"}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-200 truncate max-w-[180px]">
                      {playerName}
                    </td>
                    {activeTests.map((t) => {
                      const val = pValues[t.id] ?? "";
                      return (
                        <td key={t.id} className="py-2 px-3 text-center">
                          <input
                            type="number"
                            step="any"
                            value={val}
                            onChange={(e) => handleCellChange(player.id, t.id, e.target.value)}
                            placeholder="–"
                            className="w-full max-w-[100px] mx-auto bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
