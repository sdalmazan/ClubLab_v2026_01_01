"use client";

import { useState, useEffect } from "react";
import { DEFAULT_PERFORMANCE_THRESHOLDS, DEFAULT_PERFORMANCE_RULES } from "@/lib/performance/ruleEngine";
import type { PerformanceThresholds, PerformanceRule } from "@/types/performance";
import {
  Sliders,
  ShieldCheck,
  Save,
  CheckCircle2,
  Zap,
  Radio,
  ToggleRight,
  ToggleLeft,
  Plus,
  Trash2,
  AlertCircle,
  Activity,
  HeartPulse,
  MapPin,
  Compass,
  Scale,
} from "lucide-react";

interface PhysicalTestItem {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  higher_is_better: boolean;
  is_active: boolean;
  description?: string | null;
}

export function PerformanceSettingsTab() {
  const [thresholds, setThresholds] = useState<PerformanceThresholds>(DEFAULT_PERFORMANCE_THRESHOLDS);
  const [rules, setRules] = useState<PerformanceRule[]>(DEFAULT_PERFORMANCE_RULES);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [gpsProvider, setGpsProvider] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cl_gps_provider") || "catapult";
    }
    return "catapult";
  });
  const [defaultPhysioSlotMin, setDefaultPhysioSlotMin] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cl_default_physio_slot_min");
      if (saved) return Number(saved);
    }
    return 10;
  });

  // Geometría del Campo (Esquinas GPS Opuestas P1 y P2)
  const [pitchP1Lat, setPitchP1Lat] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("cl_pitch_p1_lat") || "40.453521" : "40.453521"));
  const [pitchP1Lon, setPitchP1Lon] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("cl_pitch_p1_lon") || "-3.688972" : "-3.688972"));
  const [pitchP2Lat, setPitchP2Lat] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("cl_pitch_p2_lat") || "40.452587" : "40.452587"));
  const [pitchP2Lon, setPitchP2Lon] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("cl_pitch_p2_lon") || "-3.687717" : "-3.687717"));

  const parseCoordStr = (val: string | number) => {
    if (val === null || val === undefined) return NaN;
    return parseFloat(String(val).trim().replace(",", "."));
  };

  const p1LatN = parseCoordStr(pitchP1Lat);
  const p1LonN = parseCoordStr(pitchP1Lon);
  const p2LatN = parseCoordStr(pitchP2Lat);
  const p2LonN = parseCoordStr(pitchP2Lon);
  const hasValidCorners = !isNaN(p1LatN) && !isNaN(p1LonN) && !isNaN(p2LatN) && !isNaN(p2LonN);

  let computedLengthM = 0;
  let computedWidthM = 0;
  if (hasValidCorners) {
    const latC = (p1LatN + p2LatN) / 2;
    const lonC = (p1LonN + p2LonN) / 2;
    const earthR = 6371000;
    const latCRad = (latC * Math.PI) / 180;
    const dLonM = (p2LonN - p1LonN) * (Math.PI / 180) * earthR * Math.cos(latCRad);
    const dLatM = (p2LatN - p1LatN) * (Math.PI / 180) * earthR;
    const absLonM = Math.abs(dLonM);
    const absLatM = Math.abs(dLatM);
    computedLengthM = Math.round(Math.max(absLonM, absLatM) * 10) / 10;
    computedWidthM = Math.round(Math.min(absLonM, absLatM) * 10) / 10;
  }
  
  // Physical Tests State
  const [physicalTests, setPhysicalTests] = useState<PhysicalTestItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // New Test Modal State
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [newTestCategory, setNewTestCategory] = useState("Fuerza");
  const [newTestUnit, setNewTestUnit] = useState("cm");
  const [newTestHigherIsBetter, setNewTestHigherIsBetter] = useState(true);
  const [newTestDescription, setNewTestDescription] = useState("");
  const [submittingTest, setSubmittingTest] = useState(false);

  // Body Fat & ISAK Skinfolds Settings State
  const [activeSkinfolds, setActiveSkinfolds] = useState<string[]>([
    "triceps", "subescapular", "biceps", "abdominal", "iliaco", "pierna"
  ]);
  const [targetFatMin, setTargetFatMin] = useState<number>(8.0);
  const [targetFatMax, setTargetFatMax] = useState<number>(12.0);

  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPhysicalTests();
    loadGpsPreference();
    loadBodyFatSettings();
  }, []);

  async function loadBodyFatSettings() {
    try {
      const res = await fetch("/api/performance/body-fat/settings");
      const data = await res.json();
      if (res.ok && data) {
        if (data.active_skinfolds) setActiveSkinfolds(data.active_skinfolds);
        if (data.target_fat_min != null) setTargetFatMin(Number(data.target_fat_min));
        if (data.target_fat_max != null) setTargetFatMax(Number(data.target_fat_max));
      }
    } catch (err) {
      console.error("Error loading body fat settings:", err);
    }
  }

  async function loadGpsPreference() {
    try {
      const res = await fetch("/api/organization/settings");
      const data = await res.json();
      console.log(`[GPS DEBUG UI] GET response in PerformanceSettingsTab = ${JSON.stringify(data)}`);
      if (data?.success) {
        if (data.is_gps_enabled !== undefined) {
          const isGpsOn = Boolean(data.is_gps_enabled);
          setGpsEnabled(isGpsOn);
          if (typeof window !== "undefined") {
            localStorage.setItem("cl_is_gps_enabled", isGpsOn ? "true" : "false");
            document.cookie = `cl_is_gps_enabled=${isGpsOn ? "true" : "false"}; path=/; max-age=31536000`;
          }
        }
        const savedProvider = data.gps_provider || data.settings?.gps_provider || (typeof window !== "undefined" ? localStorage.getItem("cl_gps_provider") : null);
        if (savedProvider) {
          setGpsProvider(savedProvider);
          if (typeof window !== "undefined") {
            localStorage.setItem("cl_gps_provider", savedProvider);
          }
        }
      }
    } catch (err) {
      console.error("Error loading GPS preference in PerformanceSettingsTab:", err);
    }
  }

  async function persistGpsSetting(newValue: boolean, providerValue?: string) {
    const targetProvider = providerValue || gpsProvider;
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_is_gps_enabled", newValue ? "true" : "false");
      localStorage.setItem("cl_gps_provider", targetProvider);
      document.cookie = `cl_is_gps_enabled=${newValue ? "true" : "false"}; path=/; max-age=31536000`;
    }
    try {
      console.log(`[GPS DEBUG UI] Sending PATCH /api/organization/settings with is_gps_enabled = ${newValue}, gps_provider = ${targetProvider}`);
      const res = await fetch("/api/organization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settingsToUpdate: {
            is_gps_enabled: newValue,
            gps_provider: targetProvider,
          },
        }),
      });
      const data = await res.json();
      console.log(`[GPS DEBUG UI] PATCH response in PerformanceSettingsTab = ${JSON.stringify(data)}`);
      if (data?.success) {
        if (data.is_gps_enabled !== undefined) setGpsEnabled(Boolean(data.is_gps_enabled));
        const respProvider = data.gps_provider || data.settings?.gps_provider;
        if (respProvider) setGpsProvider(respProvider);
      }
    } catch (err) {
      console.error("Error saving GPS setting in PerformanceSettingsTab:", err);
    }
  }

  async function handleToggleGps() {
    const updated = !gpsEnabled;
    console.log(`[GPS DEBUG UI] Toggling GPS in PerformanceSettingsTab from ${gpsEnabled} to ${updated}`);
    setGpsEnabled(updated);
    await persistGpsSetting(updated, gpsProvider);
  }

  async function handleGpsProviderChange(newProvider: string) {
    console.log(`[GPS DEBUG UI] Changing GPS provider to ${newProvider}`);
    setGpsProvider(newProvider);
    await persistGpsSetting(gpsEnabled, newProvider);
  }

  async function loadPhysicalTests() {
    try {
      setLoadingTests(true);
      setErrorMsg(null);
      const res = await fetch("/api/performance/tests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar batería de tests");
      setPhysicalTests(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "No se pudo cargar la batería de tests.");
    } finally {
      setLoadingTests(false);
    }
  }

  async function handleToggleTest(testId: string, currentActive: boolean) {
    try {
      setTogglingId(testId);
      setErrorMsg(null);

      const res = await fetch("/api/performance/tests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: testId,
          is_active: !currentActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado del test");

      setPhysicalTests((prev) =>
        prev.map((t) => (t.id === testId ? { ...t, is_active: !currentActive } : t))
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al actualizar el test.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    if (!newTestName.trim()) return;

    try {
      setSubmittingTest(true);
      setErrorMsg(null);

      const res = await fetch("/api/performance/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTestName.trim(),
          category: newTestCategory,
          unit: newTestUnit.trim(),
          higher_is_better: newTestHigherIsBetter,
          description: newTestDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el nuevo test");

      setPhysicalTests((prev) => [...prev, data]);
      setShowAddTestModal(false);
      setNewTestName("");
      setNewTestDescription("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al guardar el nuevo test.");
    } finally {
      setSubmittingTest(false);
    }
  }

  async function handleDeleteTest(testId: string, testName: string) {
    if (!confirm(`¿Eliminar el test "${testName}" de la batería del club?`)) return;

    try {
      setErrorMsg(null);
      const res = await fetch(`/api/performance/tests?id=${testId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar test");

      setPhysicalTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al eliminar el test.");
    }
  }

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, is_enabled: !r.is_enabled } : r))
    );
  };

  const handleSave = async () => {
    await persistGpsSetting(gpsEnabled, gpsProvider);
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_gps_provider", gpsProvider);
      localStorage.setItem("cl_pitch_p1_lat", pitchP1Lat);
      localStorage.setItem("cl_pitch_p1_lon", pitchP1Lon);
      localStorage.setItem("cl_pitch_p2_lat", pitchP2Lat);
      localStorage.setItem("cl_pitch_p2_lon", pitchP2Lon);
    }

    try {
      await fetch("/api/performance/body-fat/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_skinfolds: activeSkinfolds,
          target_fat_min: targetFatMin,
          target_fat_max: targetFatMax,
        }),
      });
    } catch (err) {
      console.error("Error saving body fat settings:", err);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Save Button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Ajustes de Rendimiento, Tests & Reglas
          </h2>
          <p className="text-xs text-slate-400">
            Añade o quita tests físicos de la batería activa y configura los umbrales del club.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saved ? "¡Ajustes Guardados!" : "Guardar Ajustes"}
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Los parámetros de rendimiento, batería de tests y motor de reglas se han guardado con éxito.
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 text-rose-400" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Physical Tests Management & Physio Settings (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Configuración de Servicios Médicos & Fisioterapia */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-emerald-400" />
                Ajustes de Fisioterapia & Consultas
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              Configura la duración estándar por franja horaria que se predefinirá al abrir convocatorias de consulta médica.
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Duración Estándar por Franja (minutos):
              </label>
              <select
                value={defaultPhysioSlotMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDefaultPhysioSlotMin(val);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("cl_default_physio_slot_min", String(val));
                  }
                }}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value={10}>10 minutos (Estándar recomendado)</option>
                <option value={5}>5 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos</option>
              </select>
            </div>
          </div>

          {/* Configuración de Control de Grasa & Pliegues ISAK Medidos */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-400" />
                Pliegues Cutáneos Medidos (ISAK) & Objetivos
              </h3>
              <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Antropometría
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Selecciona cuáles de los 6 pliegues cutáneos estándar mide tu cuerpo técnico en las evaluaciones antropométricas del club:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "triceps", label: "TRICEPS (Tricipital)" },
                { key: "subescapular", label: "SUBES. (Subescapular)" },
                { key: "biceps", label: "BICEPS (Bicipital)" },
                { key: "abdominal", label: "ABDO. (Abdominal)" },
                { key: "iliaco", label: "ILIACO (Suprailíaco)" },
                { key: "pierna", label: "PIER. (Pierna / Gemelo)" },
              ].map((item) => {
                const isChecked = activeSkinfolds.includes(item.key);
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 transition-all cursor-pointer ${
                      isChecked
                        ? "border-emerald-500/40 bg-slate-950/80 text-white font-semibold"
                        : "border-white/5 bg-slate-950/30 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setActiveSkinfolds([...activeSkinfolds, item.key]);
                        } else {
                          setActiveSkinfolds(activeSkinfolds.filter((k) => k !== item.key));
                        }
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  % Grasa Mínimo Objetivo
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={targetFatMin}
                  onChange={(e) => setTargetFatMin(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  % Grasa Máximo Objetivo
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={targetFatMax}
                  onChange={(e) => setTargetFatMax(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Physical Tests Selection & Creation */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                Batería de Tests Físicos ({physicalTests.filter((t) => t.is_active).length}/{physicalTests.length} Activos)
              </h3>

              <button
                type="button"
                onClick={() => setShowAddTestModal(true)}
                className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir Test
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Los tests seleccionados aquí son los que aparecerán automáticamente en la pantalla de testing del preparador físico.
            </p>

            {loadingTests ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500" />
              </div>
            ) : physicalTests.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-4 text-center">
                No hay tests físicos configurados. Haz clic en "Añadir Test" para crear uno.
              </div>
            ) : (
              <div className="space-y-2 text-xs max-h-[380px] overflow-y-auto pr-1">
                {physicalTests.map((test) => (
                  <div
                    key={test.id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                      test.is_active
                        ? "border-emerald-500/30 bg-slate-950/80"
                        : "border-white/5 bg-slate-950/30 opacity-60"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{test.name}</span>
                        <span className="text-[9px] font-bold uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {test.category || "General"}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400 font-semibold">
                          [{test.unit || "unidad"}]
                        </span>
                      </div>
                      {test.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-1">{test.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTest(test.id, test.is_active)}
                        disabled={togglingId === test.id}
                        className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                        title={test.is_active ? "Desactivar de la pantalla de tests" : "Activar en la pantalla de tests"}
                      >
                        {test.is_active ? (
                          <ToggleRight className="h-6 w-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-slate-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTest(test.id, test.name)}
                        className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer p-1"
                        title="Eliminar test"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GPS Tracking Config */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400" />
                Integración de Dispositivos GPS & Carga Externa
              </h3>

              <button
                type="button"
                onClick={handleToggleGps}
                className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {gpsEnabled ? (
                  <ToggleRight className="h-6 w-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-slate-600" />
                )}
              </button>
            </div>

            {gpsEnabled ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-400">
                  El sistema capturará automáticamente métricas GPS (Distancia Total, HSR &gt;21 km/h, Sprints &gt;25 km/h, Aceleraciones/Desaceleraciones).
                </p>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Proveedor de GPS del Club</label>
                  <select
                    value={gpsProvider}
                    onChange={(e) => handleGpsProviderChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="catapult">Catapult Sports (OpenField)</option>
                    <option value="wimu">WIMU PRO / Hudl</option>
                    <option value="oliver">Oliver GPS</option>
                    <option value="statssports">STATS Apex GPS</option>
                    <option value="manual">Ingreso Manual / CSV</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                La recopilación de datos GPS está desactivada. La carga externa se calculará mediante minutos de juego y RPE.
              </p>
            )}
          </div>

          {/* Terreno de Juego del Club - Geometría & Esquinas GPS */}
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                Estadio del Club (Coordenadas GPS de Esquinas P1 y P2)
              </h3>
              <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Campo Principal
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Configura las coordenadas GPS de dos esquinas opuestas del campo de tu club. Serán utilizadas por el Motor de Procesamiento Espacial para fijar el origen cartesiano (0,0), rotar el eje longitudinal por PCA y normalizar mapas de calor.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 space-y-1.5">
                <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  📍 Esquina P1 (Latitud, Longitud)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={pitchP1Lat}
                    onChange={(e) => setPitchP1Lat(e.target.value)}
                    placeholder="40.453521"
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={pitchP1Lon}
                    onChange={(e) => setPitchP1Lon(e.target.value)}
                    placeholder="-3.688972"
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 space-y-1.5">
                <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  📍 Esquina P2 Opuesta (Latitud, Longitud)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={pitchP2Lat}
                    onChange={(e) => setPitchP2Lat(e.target.value)}
                    placeholder="40.452587"
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={pitchP2Lon}
                    onChange={(e) => setPitchP2Lon(e.target.value)}
                    placeholder="-3.687717"
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {hasValidCorners && (
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                computedLengthM >= 80 && computedLengthM <= 125 && computedWidthM >= 45 && computedWidthM <= 90
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-amber-950/40 border-amber-500/40 text-amber-300"
              }`}>
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Dimensiones Calculadas del Campo: {computedLengthM} m (Longitud) × {computedWidthM} m (Anchura)
                    </span>
                    <span className="text-[10px] opacity-80">
                      {computedLengthM >= 80 && computedLengthM <= 125 && computedWidthM >= 45 && computedWidthM <= 90
                        ? "✓ Coordenadas correctas. Rango dentro de las dimensiones habituales de fútbol."
                        : "⚠️ Revisa las coordenadas: las dimensiones calculadas resultan inusuales (esperado ~90-120m x 45-90m)."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Thresholds & Rules Engine (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Thresholds */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              Umbrales de Carga & Wellness del Club
            </h3>

            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Wellness Alerta (0–25)</label>
                <input
                  type="number"
                  value={thresholds.wellness_warning_score}
                  onChange={(e) => setThresholds({ ...thresholds, wellness_warning_score: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Wellness Crítico (0–25)</label>
                <input
                  type="number"
                  value={thresholds.wellness_critical_score}
                  onChange={(e) => setThresholds({ ...thresholds, wellness_critical_score: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">ACWR Ratio Alerta</label>
                <input
                  type="number"
                  step="0.05"
                  value={thresholds.acwr_warning_ratio}
                  onChange={(e) => setThresholds({ ...thresholds, acwr_warning_ratio: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">ACWR Ratio Crítico (Spike)</label>
                <input
                  type="number"
                  step="0.05"
                  value={thresholds.acwr_critical_ratio}
                  onChange={(e) => setThresholds({ ...thresholds, acwr_critical_ratio: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-300 mb-1">Límite Minutos Competitivos (7 Días)</label>
                <input
                  type="number"
                  value={thresholds.max_minutes_7days}
                  onChange={(e) => setThresholds({ ...thresholds, max_minutes_7days: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Rule Engine Manager */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-3 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Gestor de Reglas de Recomendación ({rules.filter((r) => r.is_enabled).length}/{rules.length} Activas)
            </h3>

            <div className="space-y-2 text-xs">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-white/5 p-3">
                  <div>
                    <span className="font-bold text-white block">
                      {r.code} — {r.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{r.description}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRule(r.id)}
                    className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {r.is_enabled ? (
                      <ToggleRight className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-600" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD NEW TEST */}
      {showAddTestModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTest}
            className="bg-slate-900 border border-white/10 shadow-2xl w-full max-w-md rounded-2xl p-6 space-y-4 animate-fade-in"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Añadir Nuevo Test Físico
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTestModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nombre del Test *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Test VBT en Sentadilla, Salto Monopodal..."
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={newTestCategory}
                    onChange={(e) => setNewTestCategory(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Fuerza">Fuerza / Potencia</option>
                    <option value="Velocidad">Velocidad / Aceleración</option>
                    <option value="Aeróbico">Aeróbico / RSA</option>
                    <option value="Neuromuscular">Neuromuscular</option>
                    <option value="Antropometría">Antropometría ISAK</option>
                    <option value="Movilidad">Movilidad / Asimetría</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. cm, seg, kg, m/s, nivel"
                    value={newTestUnit}
                    onChange={(e) => setNewTestUnit(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newTestHigherIsBetter}
                    onChange={(e) => setNewTestHigherIsBetter(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4"
                  />
                  Un mayor valor indica mejor rendimiento (Higher is Better)
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Descripción / Protocolo
                </label>
                <textarea
                  rows={2}
                  placeholder="Detallar protocolo de medición..."
                  value={newTestDescription}
                  onChange={(e) => setNewTestDescription(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAddTestModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submittingTest}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                {submittingTest ? "Guardando..." : "Crear y Activar Test"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
