"use client";

import { useState, useEffect } from "react";
import { PerformanceSubNav } from "@/components/performance/PerformanceSubNav";
import { DEFAULT_PERFORMANCE_RULES, DEFAULT_PERFORMANCE_THRESHOLDS } from "@/lib/performance/ruleEngine";
import type { PerformanceThresholds, PerformanceRule } from "@/types/performance";
import { Settings, Sliders, Save, CheckCircle2, ShieldCheck, ToggleLeft, ToggleRight, Info } from "lucide-react";

export default function PerformanceSettingsPage() {
  const [thresholds, setThresholds] = useState<PerformanceThresholds>(DEFAULT_PERFORMANCE_THRESHOLDS);
  const [rules, setRules] = useState<PerformanceRule[]>(DEFAULT_PERFORMANCE_RULES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadOrgSettings() {
      try {
        const res = await fetch("/api/organization/settings");
        const data = await res.json();
        console.log(`[GPS DEBUG UI] value received from GET = ${JSON.stringify(data?.is_gps_enabled)}`);
        if (data?.success && data?.is_gps_enabled !== undefined) {
          const isGpsOn = Boolean(data.is_gps_enabled);
          setThresholds(prev => ({ ...prev, is_gps_enabled: isGpsOn }));
          console.log(`[GPS DEBUG UI] value rendered = ${isGpsOn}`);
          if (typeof window !== "undefined") {
            localStorage.setItem("cl_is_gps_enabled", isGpsOn ? "true" : "false");
            document.cookie = `cl_is_gps_enabled=${isGpsOn ? "true" : "false"}; path=/; max-age=31536000`;
          }
        }
      } catch (err) {
        console.error("Error loading org settings for GPS:", err);
      }
    }
    loadOrgSettings();
  }, []);

  const persistGpsSetting = async (newValue: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_is_gps_enabled", newValue ? "true" : "false");
      document.cookie = `cl_is_gps_enabled=${newValue ? "true" : "false"}; path=/; max-age=31536000`;
    }
    try {
      const res = await fetch("/api/organization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingsToUpdate: { is_gps_enabled: newValue } }),
      });
      const data = await res.json();
      if (data?.success && data?.is_gps_enabled !== undefined) {
        const confirmedGpsState = Boolean(data.is_gps_enabled);
        setThresholds(prev => ({ ...prev, is_gps_enabled: confirmedGpsState }));
        console.log(`[GPS DEBUG UI] after PATCH confirmed value rendered = ${confirmedGpsState}`);
      }
    } catch (err) {
      console.error("Error saving GPS setting to DB:", err);
    }
  };

  const handleToggleGps = async () => {
    const updated = !thresholds.is_gps_enabled;
    console.log(`[GPS DEBUG UI] Toggling GPS to = ${updated}`);
    setThresholds(prev => ({ ...prev, is_gps_enabled: updated }));
    await persistGpsSetting(updated);
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, is_enabled: !r.is_enabled } : r))
    );
  };

  const handleSave = async () => {
    await persistGpsSetting(Boolean(thresholds.is_gps_enabled));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 text-slate-100">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md corp-badge px-2.5 py-1 text-xs font-semibold border">
              Configuración del Staff Técnico
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
            Performance Settings & Rule Engine
          </h1>
          <p className="text-xs text-slate-400">
            Define los umbrales del club y activa o desactiva las reglas del Recommendation Engine.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl btn-corporate text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {savedSuccess ? "¡Guardado!" : "Guardar Cambios"}
        </button>
      </div>

      {/* Sub Navigation */}
      <PerformanceSubNav />

      {savedSuccess && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-800 corp-badge p-3.5 text-xs">
          <CheckCircle2 className="h-4 w-4 corp-text" />
          La configuración de umbrales y reglas del motor se ha actualizado correctamente para la organización.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column (5 cols): Thresholds Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Sliders className="h-4 w-4 corp-text" />
              Umbrales del Club (Thresholds)
            </h2>

            <div className="space-y-4 text-xs">
              {/* GPS Tracking Devices Toggle */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between">
                <div>
                  <label className="block text-slate-200 font-bold mb-0.5">
                    Dispositivos GPS Activos
                  </label>
                  <span className="text-[10px] text-slate-400 block">
                    Activa la ingesta y visualización de Carga Externa GPS en el panel de Monitorización.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleGps}
                  className="text-slate-400 hover:corp-text transition-colors shrink-0 ml-3 cursor-pointer"
                >
                  {thresholds.is_gps_enabled ? (
                    <ToggleRight className="h-7 w-7 corp-text" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Wellness Warning */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wellness Score — Umbral Alerta (0–25)
                </label>
                <input
                  type="number"
                  value={thresholds.wellness_warning_score}
                  onChange={e => setThresholds({ ...thresholds, wellness_warning_score: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Por debajo de este valor se genera aviso leve de fatiga.</span>
              </div>

              {/* Wellness Critical */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wellness Score — Umbral Crítico (0–25)
                </label>
                <input
                  type="number"
                  value={thresholds.wellness_critical_score}
                  onChange={e => setThresholds({ ...thresholds, wellness_critical_score: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Soreness Level */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Dolor Muscular Crítico (1–5)
                </label>
                <input
                  type="number"
                  value={thresholds.soreness_critical_level}
                  onChange={e => setThresholds({ ...thresholds, soreness_critical_level: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* ACWR Warning & Critical */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">ACWR Alerta</label>
                  <input
                    type="number"
                    step="0.05"
                    value={thresholds.acwr_warning_ratio}
                    onChange={e => setThresholds({ ...thresholds, acwr_warning_ratio: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">ACWR Crítico</label>
                  <input
                    type="number"
                    step="0.05"
                    value={thresholds.acwr_critical_ratio}
                    onChange={e => setThresholds({ ...thresholds, acwr_critical_ratio: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Max Minutes 7d */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Minutos Máximos Competitivos (7 Días)
                </label>
                <input
                  type="number"
                  value={thresholds.max_minutes_7days}
                  onChange={e => setThresholds({ ...thresholds, max_minutes_7days: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Rules Manager */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Catálogo de Reglas Activas ({rules.filter(r => r.is_enabled).length}/{rules.length})
              </h2>
            </div>

            <div className="space-y-3">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-4 transition-all ${
                    rule.is_enabled
                      ? "border-slate-800 bg-slate-950/60"
                      : "border-slate-900 bg-slate-950/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        {rule.code}
                      </span>
                      <h3 className="text-xs font-bold text-white">{rule.name}</h3>
                    </div>

                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {rule.is_enabled ? (
                        <ToggleRight className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-slate-600" />
                      )}
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">{rule.description}</p>

                  <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="capitalize bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Categoría: {rule.category}
                    </span>
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Prioridad: P{rule.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
