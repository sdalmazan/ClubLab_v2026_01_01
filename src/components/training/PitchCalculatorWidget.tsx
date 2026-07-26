"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Calculator, Ruler, Activity, Target, Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  parsePlayerCount,
  calculatePitchDimensions,
  PitchCalculationResult,
  PitchSpaceType,
} from "@/lib/pitch-calculator";

interface PitchCalculatorWidgetProps {
  title?: string;
  description?: string;
  playersPerGroup?: string;
  currentSpaceDimensions?: string;
  onApplyCalculation: (dimensionsShort: string, formattedMarkdown: string) => void;
}

export function PitchCalculatorWidget({
  title = "",
  description = "",
  playersPerGroup = "",
  currentSpaceDimensions = "",
  onApplyCalculation,
}: PitchCalculatorWidgetProps) {
  const [manualN, setManualN] = useState<number | "">("");
  const [spaceType, setSpaceType] = useState<PitchSpaceType>("Reducido");
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [applied, setApplied] = useState(false);

  // Detect player count from title, description, or playersPerGroup
  useEffect(() => {
    const combinedText = `${title} ${description} ${playersPerGroup}`;
    const parsed = parsePlayerCount(combinedText);

    if (parsed && parsed.totalPlayers > 0) {
      setDetectedFormat(`${parsed.rawMatch} (${parsed.totalPlayers} jug.)`);
      setManualN(parsed.totalPlayers);
      if (parsed.spaceTypeHint) {
        setSpaceType(parsed.spaceTypeHint);
      }
    } else {
      setDetectedFormat(null);
    }
  }, [title, description, playersPerGroup]);

  const N = typeof manualN === "number" && manualN > 0 ? manualN : 0;
  const calcResult: PitchCalculationResult | null = N > 0 ? calculatePitchDimensions(N, spaceType) : null;

  function handleApply() {
    if (!calcResult) return;
    onApplyCalculation(calcResult.formattedDimensionsShort, calcResult.formattedMarkdown);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-4 space-y-4 shadow-lg backdrop-blur-sm transition-all">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              Calculadora de Espacio Metodológico (APJ)
              {detectedFormat && (
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Detectado: {detectedFormat}
                </span>
              )}
            </h4>
            <p className="text-[10px] text-slate-400">
              Dimensionamiento automático según número de participantes y carga física.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Control Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Total Participantes (N) *
          </label>
          <input
            type="number"
            min="1"
            max="30"
            placeholder="Ej. 10 para 5v5"
            value={manualN}
            onChange={(e) => setManualN(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Tipología de Espacio
          </label>
          <select
            value={spaceType}
            onChange={(e) => setSpaceType(e.target.value as PitchSpaceType)}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-1.5 text-xs text-white cursor-pointer focus:ring-1 focus:ring-emerald-500"
          >
            <option value="Reducido">Reducido (60 m²/j) - Por defecto</option>
            <option value="Medio">Medio (100 m²/j)</option>
            <option value="Amplio">Amplio (140 m²/j)</option>
          </select>
        </div>
      </div>

      {/* Live Calculated Output */}
      {calcResult ? (
        <div className="space-y-3 pt-2">
          {/* Main Measurement Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Medidas Principales Recomendadas
              </span>
              <div className="text-xl font-extrabold text-white">
                {calcResult.largo}m × {calcResult.ancho}m
                <span className="text-xs font-medium text-emerald-300 ml-2.5">
                  ({calcResult.areaTotal} m² | APJ ≈ {calcResult.apjReal} m²/j)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApply}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                applied
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              }`}
            >
              {applied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> ¡Cálculo Aplicado!
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Aplicar a la Tarea
                </>
              )}
            </button>
          </div>

          {/* Details / Adjustments section */}
          {isExpanded && (
            <div className="space-y-3 bg-slate-950/60 rounded-xl p-3.5 border border-white/5 text-xs animate-fade-in">
              {/* Estímulo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-white/5 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <Activity className="h-3 w-3 text-sky-400" /> Impacto Físico Primario
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {calcResult.impactoFisico}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <Target className="h-3 w-3 text-amber-400" /> Orientación Táctica
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {calcResult.orientacionTactica}
                  </p>
                </div>
              </div>

              {/* Margen de Ajuste */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  🎛️ Margen de Ajuste en Campo
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                    <span className="font-bold text-rose-300 block">Espacio Mínimo (Mayor intensidad):</span>
                    <span className="text-white font-semibold">
                      {calcResult.min.largo}m × {calcResult.min.ancho}m
                    </span>{" "}
                    <span className="text-slate-400 text-[10px]">
                      ({calcResult.min.area} m² | APJ ≈ {calcResult.min.apj} m²)
                    </span>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-lg">
                    <span className="font-bold text-indigo-300 block">Espacio Máximo (Mayor fluidez):</span>
                    <span className="text-white font-semibold">
                      {calcResult.max.largo}m × {calcResult.max.ancho}m
                    </span>{" "}
                    <span className="text-slate-400 text-[10px]">
                      ({calcResult.max.area} m² | APJ ≈ {calcResult.max.apj} m²)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 italic text-center py-2 bg-slate-950/40 rounded-xl border border-white/5">
          Escribe un título con formato de juego (ej. 5v5, 4v4+2) o introduce el número N de jugadores arriba para calcular automáticamente las medidas.
        </div>
      )}
    </div>
  );
}
