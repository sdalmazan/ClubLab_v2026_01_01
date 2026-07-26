"use client";

import React, { useState } from "react";
import { ShieldCheck, Download, Trash2, CheckCircle2, Lock, FileText, AlertTriangle } from "lucide-react";

export function PrivacyControlCenter() {
  const [healthConsent, setHealthConsent] = useState(true);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

  const handleExportData = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      // Generate JSON download for GDPR data portability
      const mockData = {
        user: "Diego Almazán",
        export_date: new Date().toISOString(),
        wellness_records: [{ date: "2026-07-23", sleep: 4, fatigue: 2, mood: 4 }],
        rpe_records: [{ date: "2026-07-22", rpe: 7, session: "Entrenamiento Grupal" }],
        consents: [
          { type: "health_data_tracking", version: "v1.0", accepted: healthConsent },
          { type: "performance_analytics", version: "v1.0", accepted: analyticsConsent },
        ],
      };

      const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clublab_mis_datos.json";
      a.click();
      URL.revokeObjectURL(url);

      setTimeout(() => setExportSuccess(false), 4000);
    }, 1000);
  };

  const handleConfirmDelete = () => {
    setDeleteRequested(true);
    setDeleteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/30 bg-card p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Privacidad y Gobierno del Dato</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control transparente de tus datos en ClubLab (RGPD / Privacy by Design)
            </p>
          </div>
        </div>
      </div>

      {/* Mis Consentimientos */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Mis Consentimientos
          </h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 border border-border/40">
            <div>
              <p className="text-xs font-bold text-foreground">Seguimiento de Datos de Salud y Lesiones</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Permite a los fisioterapeutas contextualizar tus cuestionarios wellness. (Versión 1.0)
              </p>
            </div>
            <button
              onClick={() => setHealthConsent(!healthConsent)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                healthConsent ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  healthConsent ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 border border-border/40">
            <div>
              <p className="text-xs font-bold text-foreground">Analítica de Rendimiento Deportivo</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Permite generar comparativas anónimas y gráficos de tendencia. (Versión 1.0)
              </p>
            </div>
            <button
              onClick={() => setAnalyticsConsent(!analyticsConsent)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                analyticsConsent ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  analyticsConsent ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Quién puede acceder */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            ¿Quién puede ver mis datos?
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/40 flex justify-between items-center">
            <span className="font-semibold text-foreground">Datos de Salud y Diagnósticos Médicos</span>
            <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              Solo Fisioterapia / Médico
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/40 flex justify-between items-center">
            <span className="font-semibold text-foreground">Percepción de Fatiga y Carga (RPE)</span>
            <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
              Prep. Físico y Entrenadores
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-accent/30 border border-border/40 flex justify-between items-center">
            <span className="font-semibold text-foreground">Comparativa Anónima de Equipo</span>
            <span className="text-[11px] font-bold text-purple-500 bg-purple-500/10 px-2.5 py-1 rounded-full">
              Anonimizado (Sin nombres)
            </span>
          </div>
        </div>
      </div>

      {/* Mis Derechos RGPD (Portabilidad y Olvido) */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Tus Derechos (Derechos ARCO / RGPD)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Export button */}
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="py-3.5 px-4 bg-accent hover:bg-accent/80 text-foreground font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 border border-border/60 transition-all active:scale-98"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>{isExporting ? "Generando..." : "Descargar mis datos (.JSON)"}</span>
          </button>

          {/* Delete Account button */}
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="py-3.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 border border-rose-500/20 transition-all active:scale-98"
          >
            <Trash2 className="w-4 h-4" />
            <span>Solicitar eliminación de mi cuenta</span>
          </button>
        </div>

        {exportSuccess && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>¡Tus datos se han descargado con éxito en formato JSON!</span>
          </div>
        )}

        {deleteRequested && (
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20 animate-in fade-in">
            <AlertTriangle className="w-4 h-4" />
            <span>Solicitud de eliminación registrada. El administrador la procesará en 48 horas.</span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card max-w-md w-full rounded-3xl p-6 border border-border shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-foreground">¿Solicitar eliminación de cuenta?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Esta acción iniciará el protocolo del Derecho al Olvido (Art. 17 RGPD). Tus datos personales se anonimizarán o borrarán permanentemente del sistema del club.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 bg-accent text-foreground font-semibold text-xs rounded-2xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 bg-rose-500 text-white font-bold text-xs rounded-2xl shadow-md"
              >
                Confirmar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
