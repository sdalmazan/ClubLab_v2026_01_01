"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Film, Check, Video, Volume2, VolumeX, Sliders, Palette, Tag, CheckCircle2 } from "lucide-react";
import { DEFAULT_VIDEO_SETTINGS, type VideoAnalysisSettings, type ActionTypeSetting, type DescriptorSetting } from "@/lib/clublab/types";

interface VideoSettingsTabProps {
  initialSettings?: VideoAnalysisSettings;
  onSave: (settings: VideoAnalysisSettings) => Promise<void>;
}

export function VideoSettingsTab({ initialSettings, onSave }: VideoSettingsTabProps) {
  const [settings, setSettings] = useState<VideoAnalysisSettings>(initialSettings || DEFAULT_VIDEO_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // New action form state
  const [newActionName, setNewActionName] = useState("");
  const [newActionColor, setNewActionColor] = useState("#6366f1");

  // New descriptor form state
  const [newDescriptorName, setNewDescriptorName] = useState("");

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionName.trim()) return;

    const exists = settings.actionTypes.some(a => a.name.toLowerCase() === newActionName.trim().toLowerCase());
    if (exists) return;

    setSettings(prev => ({
      ...prev,
      actionTypes: [...prev.actionTypes, { name: newActionName.trim(), color: newActionColor }]
    }));
    setNewActionName("");
  };

  const handleRemoveAction = (index: number) => {
    setSettings(prev => ({
      ...prev,
      actionTypes: prev.actionTypes.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateActionColor = (index: number, color: string) => {
    setSettings(prev => ({
      ...prev,
      actionTypes: prev.actionTypes.map((a, i) => i === index ? { ...a, color } : a)
    }));
  };

  const handleAddDescriptor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescriptorName.trim()) return;

    const exists = settings.descriptors.some(d => d.name.toLowerCase() === newDescriptorName.trim().toLowerCase());
    if (exists) return;

    setSettings(prev => ({
      ...prev,
      descriptors: [...prev.descriptors, { name: newDescriptorName.trim(), isDefault: false }]
    }));
    setNewDescriptorName("");
  };

  const handleRemoveDescriptor = (index: number) => {
    setSettings(prev => ({
      ...prev,
      descriptors: prev.descriptors.filter((_, i) => i !== index)
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await onSave(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error("Error saving video settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl shadow-inner">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Ajustes de Videoanálisis Táctico</h3>
            <p className="text-xs text-slate-400">
              Personaliza los tipos de acciones, colores, descriptores y modos de corte por defecto para tu equipo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{saving ? "Guardando..." : "Guardar Ajustes"}</span>
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>¡Ajustes de videoanálisis guardados correctamente en la base de datos!</span>
        </div>
      )}

      {/* 1. TIPOS DE ACCIONES Y ASIGNACIÓN DE COLORES */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Tipos de Acciones a Etiquetar y Colores</h4>
          </div>
          <span className="text-xs text-slate-400 font-medium">{settings.actionTypes.length} acciones configuradas</span>
        </div>

        {/* Existing Action Types Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {settings.actionTypes.map((action, idx) => (
            <div
              key={idx}
              className="bg-slate-950 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-2 shadow"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="color"
                  value={action.color}
                  onChange={(e) => handleUpdateActionColor(idx, e.target.value)}
                  className="h-6 w-6 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Cambiar color de acción"
                />
                <span className="text-xs font-bold text-white truncate">{action.name}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAction(idx)}
                className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                title="Eliminar tipo de acción"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Action Form */}
        <form onSubmit={handleAddAction} className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-2 bg-slate-950 border border-white/10 px-3 py-2 rounded-xl flex-1 min-w-[200px]">
            <input
              type="color"
              value={newActionColor}
              onChange={(e) => setNewActionColor(e.target.value)}
              className="h-6 w-6 rounded-lg cursor-pointer bg-transparent border-0"
            />
            <input
              type="text"
              placeholder="Nombre del nuevo tipo de acción (ej. Salida de balón)..."
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-medium"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Añadir Acción</span>
          </button>
        </form>
      </div>

      {/* 2. DESCRIPTORES TÁCTICOS */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Tag className="h-5 w-5 text-emerald-400" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Descriptores de Evaluación</h4>
          </div>
          <span className="text-xs text-slate-400 font-medium">{settings.descriptors.length} descriptores activos</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {settings.descriptors.map((desc, idx) => (
            <div
              key={idx}
              className="bg-slate-950 border border-white/10 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-200 shadow"
            >
              <span>{desc.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveDescriptor(idx)}
                className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
                title="Eliminar descriptor"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add Descriptor Form */}
        <form onSubmit={handleAddDescriptor} className="flex items-center gap-3 pt-2 max-w-md">
          <input
            type="text"
            placeholder="Añadir descriptor (ej. Buen repliegue)..."
            value={newDescriptorName}
            onChange={(e) => setNewDescriptorName(e.target.value)}
            className="bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 focus:outline-none flex-1 font-medium"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Añadir</span>
          </button>
        </form>
      </div>

      {/* 3. MODO DE CORTE Y PREFERENCIAS DE EXPORTACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cut Mode Default */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Sliders className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Modo de Corte por Defecto</h4>
          </div>

          <div className="space-y-3">
            <label
              onClick={() => setSettings(prev => ({ ...prev, defaultCutMode: "manual" }))}
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                settings.defaultCutMode === "manual"
                  ? "bg-indigo-950/60 border-indigo-500/50 text-white ring-1 ring-indigo-500/30"
                  : "bg-slate-950 border-white/10 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                name="cutMode"
                checked={settings.defaultCutMode === "manual"}
                onChange={() => setSettings(prev => ({ ...prev, defaultCutMode: "manual" }))}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-bold block text-white">Modo Rango Manual</span>
                <span className="text-[11px] text-slate-400">Marca el inicio del corte en la barra, navega y selecciona el momento exacto de fin.</span>
              </div>
            </label>

            <label
              onClick={() => setSettings(prev => ({ ...prev, defaultCutMode: "auto_10s" }))}
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                settings.defaultCutMode === "auto_10s"
                  ? "bg-indigo-950/60 border-indigo-500/50 text-white ring-1 ring-indigo-500/30"
                  : "bg-slate-950 border-white/10 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                name="cutMode"
                checked={settings.defaultCutMode === "auto_10s"}
                onChange={() => setSettings(prev => ({ ...prev, defaultCutMode: "auto_10s" }))}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-bold block text-white">Modo Corte Automático (±5s)</span>
                <span className="text-[11px] text-slate-400">Al pulsar cortar, captura 5s antes y 5s después del momento actual para validación inmediata.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Export Preferences */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Video className="h-5 w-5 text-cyan-400" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Exportación & Renderizado (.MP4)</h4>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-950 border border-white/10 p-3.5 rounded-xl">
              <div className="flex items-center gap-2.5">
                {settings.exportSettings.includeSound ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                )}
                <div>
                  <span className="text-xs font-bold block text-white">Sonido en Vídeo Exportado</span>
                  <span className="text-[11px] text-slate-400">Incluir audio ambiental en el montaje final</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettings(prev => ({
                  ...prev,
                  exportSettings: { ...prev.exportSettings, includeSound: !prev.exportSettings.includeSound }
                }))}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  settings.exportSettings.includeSound ? "bg-emerald-500" : "bg-slate-800"
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                  settings.exportSettings.includeSound ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            <div className="bg-slate-950 border border-white/10 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block text-white">Calidad de Renderizado</span>
                <span className="text-[11px] text-slate-400">Resolución de salida del archivo .MP4</span>
              </div>
              <select
                value={settings.exportSettings.resolution}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  exportSettings: { ...prev.exportSettings, resolution: e.target.value as "1080p" | "720p" }
                }))}
                className="bg-slate-900 border border-white/10 text-xs font-bold text-cyan-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
