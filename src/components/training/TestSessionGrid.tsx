"use client";

import React, { useState, useEffect } from "react";
import { Activity, Save, CheckCircle2, AlertCircle, Check, Scale, ChevronDown, ChevronUp } from "lucide-react";
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
  { id: "bodyfat", name: "Test de Grasa (6 Pliegues)", unit: "%", category: "composicion" },
  { id: "nordic", name: "Nordic Hamstring", unit: "N", category: "fuerza" },
  { id: "ybalance", name: "Y-Balance", unit: "cm", category: "movilidad" },
  { id: "vbt", name: "Velocidad VBT", unit: "m/s", category: "potencia" },
];

export interface SkinfoldsEntry {
  weight_kg: string;
  triceps: string;
  subescapular: string;
  biceps: string;
  abdominal: string;
  iliaco: string;
  pierna: string;
}

interface TestSessionGridProps {
  sessionDate: string;
  teamId?: string;
  squadPlayers: PlayerWithMembership[];
  selectedTestIds?: string[];
  onSelectedTestsChange?: (testIds: string[]) => void;
  initialResults?: Record<string, Record<string, number | string>>;
  onChangeResults?: (results: Record<string, Record<string, string>>) => void;
}

export function calculateBodyFat6(skinfolds: {
  triceps?: number | string;
  subescapular?: number | string;
  biceps?: number | string;
  abdominal?: number | string;
  iliaco?: number | string;
  pierna?: number | string;
}): { sumatorio: number; fatPercentage: number } {
  const tri = parseFloat(String(skinfolds.triceps || 0)) || 0;
  const sub = parseFloat(String(skinfolds.subescapular || 0)) || 0;
  const bic = parseFloat(String(skinfolds.biceps || 0)) || 0;
  const abd = parseFloat(String(skinfolds.abdominal || 0)) || 0;
  const ili = parseFloat(String(skinfolds.iliaco || 0)) || 0;
  const pie = parseFloat(String(skinfolds.pierna || 0)) || 0;

  const sumatorio = Math.round((tri + sub + bic + abd + ili + pie) * 100) / 100;
  if (sumatorio === 0) return { sumatorio: 0, fatPercentage: 0 };

  // Fórmula: 0.1051 x SUMA(medidas de la tabla) + 2.58
  const fatPercentage = Math.round((0.1051 * sumatorio + 2.58) * 100) / 100;
  return { sumatorio, fatPercentage };
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

  // 6 Skinfolds detailed entries per player
  const [skinfoldsMap, setSkinfoldsMap] = useState<Record<string, SkinfoldsEntry>>({});
  const [showFatTable, setShowFatTable] = useState(true);

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

  const handleSkinfoldChange = (playerId: string, field: keyof SkinfoldsEntry, val: string) => {
    setSkinfoldsMap((prev) => {
      const playerSkinfolds = prev[playerId] || {
        weight_kg: "",
        triceps: "",
        subescapular: "",
        biceps: "",
        abdominal: "",
        iliaco: "",
        pierna: "",
      };

      const updated = {
        ...playerSkinfolds,
        [field]: val,
      };

      const nextSkinfolds = {
        ...prev,
        [playerId]: updated,
      };

      // Auto-calculate bodyfat percentage
      const { fatPercentage } = calculateBodyFat6(updated);
      const fatValStr = fatPercentage > 0 ? String(fatPercentage) : "";

      setResultsMap((prevResults) => {
        const nextResults = {
          ...prevResults,
          [playerId]: {
            ...prevResults[playerId],
            bodyfat: fatValStr,
          },
        };
        if (onChangeResults) onChangeResults(nextResults);
        return nextResults;
      });

      return nextSkinfolds;
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

      // 1. Save overall test entries
      if (entries.length > 0) {
        await fetch("/api/training/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            date: sessionDate,
            entries,
          }),
        });
      }

      // 2. Save detailed body fat skinfold entries if active
      if (activeTestIds.includes("bodyfat")) {
        for (const player of squadPlayers) {
          const s = skinfoldsMap[player.id];
          if (!s) continue;

          const tri = parseFloat(s.triceps) || 0;
          const sub = parseFloat(s.subescapular) || 0;
          const bic = parseFloat(s.biceps) || 0;
          const abd = parseFloat(s.abdominal) || 0;
          const ili = parseFloat(s.iliaco) || 0;
          const pie = parseFloat(s.pierna) || 0;
          const weight = parseFloat(s.weight_kg) || null;

          if (tri > 0 || sub > 0 || bic > 0 || abd > 0 || ili > 0 || pie > 0 || (weight && weight > 0)) {
            await fetch("/api/performance/body-fat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: player.id,
                teamId,
                date: sessionDate,
                weight_kg: weight,
                triceps_mm: tri,
                subescapular_mm: sub,
                biceps_mm: bic,
                abdominal_mm: abd,
                iliaco_mm: ili,
                pierna_mm: pie,
              }),
            });
          }
        }
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error("Error saving test results:", err);
    } finally {
      setSaving(false);
    }
  };

  const activeTests = PRECONFIGURED_TESTS.filter((t) => activeTestIds.includes(t.id));
  const isFatTestActive = activeTestIds.includes("bodyfat");

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

      {/* DETAILED 6-SKINFOLD BODY FAT TABLE (When bodyfat test is selected) */}
      {isFatTestActive && (
        <div className="space-y-3 bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Scale className="size-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Tabla de Medición de Grasa Corporal (6 Pliegues)
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                Fórmula: 0.1051 × SUMA(6 pliegues) + 2.58
              </span>
              <button
                type="button"
                onClick={() => setShowFatTable(!showFatTable)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
              >
                {showFatTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                <span>{showFatTable ? "Contraer Tabla" : "Expandir Tabla"}</span>
              </button>
            </div>
          </div>

          {showFatTable && (
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-slate-300 font-bold">
                    <th className="py-2.5 px-3 w-10 text-center">Dorsal</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Futbolista</th>
                    <th className="py-2.5 px-2 text-center text-sky-400 font-extrabold w-[80px]">PESO</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">TRICEPS</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">SUBES.</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">BICEPS</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">ABDO.</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">ILIACO</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-extrabold w-[80px]">PIER.</th>
                    <th className="py-2.5 px-3 text-center text-amber-400 font-extrabold w-[90px]">SUMATORIO</th>
                    <th className="py-2.5 px-3 text-center text-emerald-300 font-black bg-emerald-500/10 w-[110px]">GRASA TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {squadPlayers.map((player) => {
                    const playerName = player.sporting_name || `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador";
                    const jersey = player.membership?.jersey_number ?? (player as any).jersey_number ?? "–";
                    const skinfolds = skinfoldsMap[player.id] || {
                      weight_kg: player.weight_kg ? String(player.weight_kg) : "",
                      triceps: "",
                      subescapular: "",
                      biceps: "",
                      abdominal: "",
                      iliaco: "",
                      pierna: "",
                    };

                    const { sumatorio, fatPercentage } = calculateBodyFat6(skinfolds);

                    return (
                      <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-500 text-center">
                          #{jersey}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-200 truncate max-w-[160px]">
                          {playerName}
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.weight_kg}
                            onChange={(e) => handleSkinfoldChange(player.id, "weight_kg", e.target.value)}
                            placeholder="kg"
                            className="w-full bg-slate-950 border border-sky-500/30 rounded px-1.5 py-1 text-xs text-center font-bold text-sky-300 focus:outline-none focus:border-sky-400"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.triceps}
                            onChange={(e) => handleSkinfoldChange(player.id, "triceps", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.subescapular}
                            onChange={(e) => handleSkinfoldChange(player.id, "subescapular", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.biceps}
                            onChange={(e) => handleSkinfoldChange(player.id, "biceps", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.abdominal}
                            onChange={(e) => handleSkinfoldChange(player.id, "abdominal", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.iliaco}
                            onChange={(e) => handleSkinfoldChange(player.id, "iliaco", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <input
                            type="number"
                            step="any"
                            value={skinfolds.pierna}
                            onChange={(e) => handleSkinfoldChange(player.id, "pierna", e.target.value)}
                            placeholder="–"
                            className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-xs text-center font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-400 text-center">
                          {sumatorio > 0 ? `${sumatorio}` : "–"}
                        </td>
                        <td className="py-2 px-3 font-mono font-extrabold text-emerald-300 bg-emerald-500/10 text-center">
                          {fatPercentage > 0 ? `${fatPercentage}%` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Test Data Table Grid */}
      {activeTests.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
          <AlertCircle className="size-6 text-amber-400 mx-auto" />
          <p className="text-xs font-bold text-slate-300">No has seleccionado ningún test</p>
          <p className="text-[11px] text-slate-500">Haz clic en los botones de arriba para activar las columnas de medición.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Resumen General de Resultados por Test:
          </label>
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
                        #{jersey}
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
        </div>
      )}
    </div>
  );
}
