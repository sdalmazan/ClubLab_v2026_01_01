"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TACTICAL_CONCEPTS } from "@/lib/exercise-taxonomy";
import {
  AlertTriangle,
  GraduationCap,
  ArrowLeft,
  BellRing,
  CheckCircle,
  Sliders,
  EyeOff,
  RefreshCw,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
}

interface AlertItem {
  type: "inactive" | "overuse";
  concept_key: string;
  concept_label: string;
  category: string;
  team_id: string;
  team_name: string;
  details: string;
}

export default function MethodologyAlertsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orgId, setOrgId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dismissals, setDismissals] = useState<any[]>([]);

  // Settings states
  const [inactiveDaysThreshold, setInactiveDaysThreshold] = useState(21);
  const [overuseWeeklyThreshold, setOveruseWeeklyThreshold] = useState(4);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Get organization context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgRole) return;
      setOrgId(orgRole.organization_id);

      // Fetch alert settings
      const { data: settingsData } = await supabase
        .from("org_alert_settings")
        .select("*")
        .eq("organization_id", orgRole.organization_id)
        .single();

      if (settingsData) {
        setInactiveDaysThreshold(settingsData.concept_inactive_days_threshold);
        setOveruseWeeklyThreshold(settingsData.concept_overuse_weekly_threshold);
      }

      // Fetch teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      setTeams(teamsData ?? []);

      // Fetch dismissals
      const { data: dismissalsData } = await supabase
        .from("concept_alert_dismissals")
        .select("*")
        .eq("organization_id", orgRole.organization_id);

      setDismissals(dismissalsData ?? []);

      // Fetch sessions and concept minutes to calculate alerts
      // (calculate client-side using Supabase data)
      const { data: minutesData } = await supabase
        .from("concept_minutes_by_week")
        .select("*")
        .eq("organization_id", orgRole.organization_id);

      const { data: sessionsData } = await supabase
        .from("training_sessions")
        .select("id, team_id, date, session_exercises(tactical_concepts)")
        .eq("organization_id", orgRole.organization_id)
        .eq("session_type", "training")
        .order("date", { ascending: false });

      calculateAlerts(
        teamsData ?? [],
        dismissalsData ?? [],
        minutesData ?? [],
        sessionsData ?? [],
        settingsData?.concept_inactive_days_threshold ?? 21,
        settingsData?.concept_overuse_weekly_threshold ?? 4
      );
    } catch (err: any) {
      console.error(err);
      setError("Error al cargar los datos metodológicos.");
    } finally {
      setLoading(false);
    }
  }

  function calculateAlerts(
    teamsList: Team[],
    dismissedList: any[],
    minutesList: any[],
    sessionsList: any[],
    inactiveThreshold: number,
    overuseThreshold: number
  ) {
    const list: AlertItem[] = [];
    const today = new Date();

    teamsList.forEach((team) => {
      // 1. Inactive Concepts Alert
      // Find the last date each concept was trained in this team
      TACTICAL_CONCEPTS.forEach((concept) => {
        // Filter out if dismissed
        const isDismissed = dismissedList.some(
          (d) =>
            d.team_id === team.id &&
            d.concept_key === concept.key &&
            d.alert_type === "inactive" &&
            (d.dismissed_until === null || new Date(d.dismissed_until) > today)
        );

        if (isDismissed) return;

        // Find most recent session training this concept
        const matchingSession = sessionsList.find(
          (s) =>
            s.team_id === team.id &&
            s.session_exercises.some((se: any) =>
              (se.tactical_concepts ?? []).includes(concept.key)
            )
        );

        if (matchingSession) {
          const lastDate = new Date(matchingSession.date);
          const diffTime = Math.abs(today.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > inactiveThreshold) {
            list.push({
              type: "inactive",
              concept_key: concept.key,
              concept_label: concept.label,
              category: concept.category,
              team_id: team.id,
              team_name: team.name,
              details: `No entrenado en los últimos ${diffDays} días (Límite: ${inactiveThreshold} días). Última vez: ${matchingSession.date}.`,
            });
          }
        } else {
          // Never trained
          list.push({
            type: "inactive",
            concept_key: concept.key,
            concept_label: concept.label,
            category: concept.category,
            team_id: team.id,
            team_name: team.name,
            details: `Nunca se ha entrenado en esta temporada.`,
          });
        }
      });

      // 2. Overuse Concepts Alert (session_count > overuseThreshold in a week)
      TACTICAL_CONCEPTS.forEach((concept) => {
        const isDismissed = dismissedList.some(
          (d) =>
            d.team_id === team.id &&
            d.concept_key === concept.key &&
            d.alert_type === "overuse" &&
            (d.dismissed_until === null || new Date(d.dismissed_until) > today)
        );

        if (isDismissed) return;

        const overuseWeeks = minutesList.filter(
          (r) =>
            r.team_id === team.id &&
            r.concept_key === concept.key &&
            r.session_count > overuseThreshold
        );

        overuseWeeks.forEach((ow) => {
          // Format week start date
          const wDateStr = new Date(ow.week_start).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
          });
          list.push({
            type: "overuse",
            concept_key: concept.key,
            concept_label: concept.label,
            category: concept.category,
            team_id: team.id,
            team_name: team.name,
            details: `Sobre-entrenamiento en la semana del ${wDateStr} (${ow.session_count} sesiones vs Límite semanal: ${overuseThreshold}).`,
          });
        });
      });
    });

    setAlerts(list);
  }

  async function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);
      setSuccess(null);

      const payload = {
        organization_id: orgId,
        concept_inactive_days_threshold: Number(inactiveDaysThreshold),
        concept_overuse_weekly_threshold: Number(overuseWeeklyThreshold),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from("org_alert_settings")
        .upsert(payload, { onConflict: "organization_id" });

      if (upsertErr) throw upsertErr;

      setSuccess("Ajustes guardados correctamente. Recalculando alertas...");
      setShowSettings(false);
      
      // Reload alerts
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error al guardar ajustes");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDismissAlert(alert: AlertItem) {
    if (!window.confirm(`¿Seguro que deseas silenciar la alerta de "${alert.concept_label}" para ${alert.team_name}?`)) return;

    try {
      setError(null);
      setSuccess(null);

      const dismissPayload = {
        organization_id: orgId,
        team_id: alert.team_id,
        concept_key: alert.concept_key,
        alert_type: alert.type,
        created_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase
        .from("concept_alert_dismissals")
        .insert(dismissPayload);

      if (insErr) throw insErr;

      setSuccess("Alerta silenciada correctamente");
      
      // Reload alerts and dismissals
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError("Error al silenciar alerta");
    }
  }

  async function handleRestoreAlerts() {
    if (!window.confirm("¿Seguro que deseas restaurar todas las alertas silenciadas de tu academia?")) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: delErr } = await supabase
        .from("concept_alert_dismissals")
        .delete()
        .eq("organization_id", orgId);

      if (delErr) throw delErr;

      setSuccess("Alertas restauradas correctamente");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError("Error al restaurar alertas");
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all";
  const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Navigation */}
      <div>
        <Link
          href="/academy"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Metodología
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BellRing className="h-6 w-6 text-amber-500" />
            Panel de Alertas Metodológicas
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Control de desvíos automáticos del modelo de juego planificado.
          </p>
        </div>

        <div className="flex gap-2">
          {dismissals.length > 0 && (
            <button
              onClick={handleRestoreAlerts}
              className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-semibold px-4 py-2.5 text-slate-300 hover:text-white transition-all cursor-pointer shadow"
            >
              <EyeOff className="h-4 w-4 text-slate-500" />
              Restaurar Silenciados ({dismissals.length})
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 rounded-xl btn-corporate text-white text-xs font-semibold px-4 py-2.5 transition-all cursor-pointer shadow-lg"
          >
            <Sliders className="h-4 w-4" />
            Configurar Alertas
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-455">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl corp-badge px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Settings Panel Overlay Drawer */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateSettings}
            className="bg-popover w-full max-w-md rounded-xl border border-border p-6 space-y-6 shadow-md animate-fade-in"
          >
            <div>
              <h3 className="text-base font-extrabold text-white">Configuración de Alertas</h3>
              <p className="text-xs text-slate-400 mt-1">Establece los límites automáticos para las alertas de tu academia.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Límite días de Inactividad</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="7"
                    max="60"
                    step="1"
                    value={inactiveDaysThreshold}
                    onChange={(e) => setInactiveDaysThreshold(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-white w-14 text-right">
                    {inactiveDaysThreshold} días
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Alerta si un concepto táctico pasa más de estos días sin ser trabajado en un equipo.
                </p>
              </div>

              <div className="border-t border-white/5 pt-4">
                <label className={labelClass}>Límite semanal de Frecuencia (Sobreuso)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="1"
                    value={overuseWeeklyThreshold}
                    onChange={(e) => setOveruseWeeklyThreshold(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-white w-14 text-right">
                    {overuseWeeklyThreshold} veces
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Alerta si un concepto se repite más de estas veces en una única semana natural.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-semibold py-2.5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="flex-1 rounded-xl btn-corporate text-white text-xs font-bold py-2.5 transition-all shadow-lg"
              >
                {savingSettings ? "Guardando..." : "Guardar Ajustes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main content area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          <p className="text-xs text-slate-500 mt-2 font-medium">Escaneando planificaciones académicas...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-emerald-500/10 bg-emerald-500/3 rounded-3xl p-6 text-center max-w-2xl mx-auto">
          <CheckCircle className="h-10 w-10 corp-icon mb-3" />
          <h3 className="text-base font-extrabold text-white">¡Modelo de Juego Correcto!</h3>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            No se han detectado desviaciones ni periodos de inactividad de conceptos en las planificaciones de ningún equipo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">
            Desviaciones Detectadas ({alerts.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((item, idx) => {
              const isOveruse = item.type === "overuse";
              return (
                <div
                  key={idx}
                  className={`bg-card rounded-lg border p-5 flex flex-col justify-between gap-4 transition-all hover:bg-white/[0.04] ${
                    isOveruse
                      ? "border-rose-500/15 bg-gradient-to-br from-rose-500/5 to-transparent"
                      : "border-amber-500/15 bg-gradient-to-br from-amber-500/5 to-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isOveruse ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-sm">{item.concept_label}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5">
                          {item.team_name}
                        </span>
                      </div>
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        {item.category} • {isOveruse ? "SOBRE-ENTRENAMIENTO" : "INACTIVIDAD"}
                      </span>
                      <p className="text-xs text-slate-350 leading-relaxed font-medium pt-1">
                        {item.details}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDismissAlert(item)}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Silenciar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
