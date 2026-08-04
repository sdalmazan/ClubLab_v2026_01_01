"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, X, Calendar, Database, CheckCircle2, AlertCircle } from "lucide-react";

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
  squadPlayers?: any[];
}

export function ExportDataModal({
  isOpen,
  onClose,
  teamId,
  squadPlayers = [],
}: ExportDataModalProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"season" | "month" | "30days">("season");

  if (!isOpen) return null;

  const downloadCsv = async (exportType: "wellness" | "rpe" | "tests" | "injuries" | "master") => {
    setDownloading(exportType);
    try {
      const res = await fetch(`/api/export/csv?type=${exportType}&teamId=${teamId || ""}&range=${dateRange}`);
      if (!res.ok) throw new Error("Error generando el archivo CSV");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const fileNames: Record<string, string> = {
        wellness: `ClubLab_Checkin_Wellness_${dateRange}.csv`,
        rpe: `ClubLab_Checkout_RPE_${dateRange}.csv`,
        tests: `ClubLab_Tests_Fisicos_${dateRange}.csv`,
        injuries: `ClubLab_Historico_Lesiones_${dateRange}.csv`,
        master: `ClubLab_Master_Agregado_Plantilla_${dateRange}.csv`,
      };

      a.download = fileNames[exportType] || `ClubLab_Export_${exportType}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar CSV:", err);
      alert("No se pudo exportar el CSV. Inténtalo de nuevo.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Centro de Exportación de Datos (CSV)</h2>
              <p className="text-xs text-slate-400">
                Descarga informes tabulares de la temporada en formato CSV compatible con Excel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Rango de Fechas */}
          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="size-4 text-emerald-400" />
              Periodo a Exportar:
            </label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: "season", label: "Toda la Temporada" },
                { id: "month", label: "Mes Actual" },
                { id: "30days", label: "Últimos 30 Días" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDateRange(opt.id as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    dateRange === opt.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                      : "bg-slate-900 text-slate-400 border-white/5 hover:border-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opciones de Exportación Individual */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Descargas Individuales por Módulo:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Check-in */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">📋 Check-in & Wellness</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sueño, fatiga, molestias, dolor muscular (1-5), pesaje diario.
                  </p>
                </div>
                <button
                  onClick={() => downloadCsv("wellness")}
                  disabled={!!downloading}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>{downloading === "wellness" ? "Generando CSV..." : "Descargar CSV Check-in"}</span>
                </button>
              </div>

              {/* Check-out */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">🏁 Check-out & RPE</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Percepción del esfuerzo (RPE 1-10), notas post-sesión.
                  </p>
                </div>
                <button
                  onClick={() => downloadCsv("rpe")}
                  disabled={!!downloading}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>{downloading === "rpe" ? "Generando CSV..." : "Descargar CSV Check-out"}</span>
                </button>
              </div>

              {/* Tests Físicos */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">🧪 Tests & Valoración Física</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    CMJ, Sprint 20m, % Grasa, Yo-Yo, 1RM y marcas registradas.
                  </p>
                </div>
                <button
                  onClick={() => downloadCsv("tests")}
                  disabled={!!downloading}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>{downloading === "tests" ? "Generando CSV..." : "Descargar CSV Tests"}</span>
                </button>
              </div>

              {/* Lesiones */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">🏥 Registro de Lesiones</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Zonas anatómicas, gravedad, fase de readaptación y altas.
                  </p>
                </div>
                <button
                  onClick={() => downloadCsv("injuries")}
                  disabled={!!downloading}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>{downloading === "injuries" ? "Generando CSV..." : "Descargar CSV Lesiones"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Master Agregado Completo */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5 justify-center sm:justify-start">
                <Database className="size-4" />
                Informe Agregado Máster
              </span>
              <h4 className="text-sm font-bold text-white">Tabla Consolidada por Jugador y Fecha</h4>
              <p className="text-xs text-slate-300">
                Agrupa todas las métricas de la plantilla (Wellness + RPE + Peso + Estado + Tests) en una sola hoja.
              </p>
            </div>

            <button
              onClick={() => downloadCsv("master")}
              disabled={!!downloading}
              className="py-3 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download className="size-4" />
              <span>{downloading === "master" ? "Generando..." : "Descargar Máster CSV"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
