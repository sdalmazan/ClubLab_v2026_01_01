"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { 
  ArrowLeft, 
  Ruler, 
  Weight, 
  Cake, 
  Flag, 
  Shirt, 
  Activity, 
  HeartPulse, 
  Edit, 
  Dumbbell, 
  Gauge, 
  TrendingUp, 
  Stethoscope, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  ChevronRight,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlayerPositionsMap } from "./PlayerPositionsMap";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { POSITION_LABELS, type PositionKey, NATIONALITY_TO_COUNTRY_CODE } from "@/types";
import { TalksManagerCard } from "@/components/talks/TalksManagerCard";
import { PlayerFatControlTab } from "./PlayerFatControlTab";

interface PlayerProfileWorkspaceProps {
  player: any;
  tests: any[];
  tasks: any[];
  userRole: string;
}

const KICKER_ROLE_LABELS: Record<string, string> = {
  far_free_kick_left: "Falta Lejana (Izq)",
  far_free_kick_right: "Falta Lejana (Der)",
  close_free_kick_left: "Falta Cercana (Izq)",
  close_free_kick_right: "Falta Cercana (Der)",
  corner_left: "Córner (Izq)",
  corner_right: "Córner (Der)",
  penalty: "Penalti",
  throw_in_left: "Saque de Banda (Izq)",
  throw_in_right: "Saque de Banda (Der)",
  area_rival: "Zona de Área Rival",
};

export function PlayerProfileWorkspace({
  player,
  tests = [],
  tasks = [],
  userRole,
}: PlayerProfileWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "gps" | "wellness" | "fat_control" | "health" | "evaluations">("overview");
  const [historyCheckins, setHistoryCheckins] = useState<any[]>([]);
  const [historyRpe, setHistoryRpe] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function loadPlayerWellnessHistory() {
      if (!player?.id) return;
      setLoadingHistory(true);
      try {
        const supabase = createClient();
        const [checkinsRes, rpeRes] = await Promise.all([
          supabase.from("player_wellness_checkins").select("*").eq("player_id", player.id).order("date", { ascending: false }).limit(30),
          supabase.from("rpe_entries").select("*").eq("player_id", player.id).order("date", { ascending: false }).limit(30),
        ]);

        if (checkinsRes.data) setHistoryCheckins(checkinsRes.data);
        if (rpeRes.data) setHistoryRpe(rpeRes.data);
      } catch (err) {
        console.error("Error loading player wellness history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadPlayerWellnessHistory();
  }, [player?.id]);

  const name = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0]}${player.last_name[0]}`.toUpperCase();
  const membership = player.membership;
  const injury = player.active_injury;
  const positions = membership?.positions ?? [];

  const isInjured = injury && (injury.status === "active" || injury.status === "readaptation");
  const isFatigued = player.physical_status === "yellow";

  const age = player.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(player.date_of_birth).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25)
      )
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* ── BACK LINK ── */}
      <div className="flex items-center justify-between">
        <Link
          href="/players"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Volver a Plantilla</span>
        </Link>
      </div>

      {/* ── INTEGRATED PLAYER SUMMARY HEADER ── */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Identity & Status */}
          <div className="flex items-start gap-4">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={name}
                className="h-16 w-16 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted border border-border flex items-center justify-center text-xl font-semibold text-muted-foreground">
                {initials}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{name}</h1>
                {membership?.jersey_number != null && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    #{membership.jersey_number}
                  </span>
                )}
                {membership?.teams?.name && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {membership.teams.name}
                  </span>
                )}
              </div>

              {/* Multidimensional Status Line */}
              <div className="flex items-center gap-3 flex-wrap pt-1 text-xs">
                {isInjured ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    {injury.status === "readaptation" ? "Readaptación Física" : "Baja Médica"} ({injury.body_part || "Enfermería"})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Disponible
                  </span>
                )}

                <span className="text-muted-foreground/40">•</span>

                {isFatigued ? (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Sobrecarga
                  </span>
                ) : (
                  <span className="text-muted-foreground font-medium">Carga OK</span>
                )}
              </div>
            </div>
          </div>

          {/* Contextual Actions Bar */}
          <div className="flex items-center gap-2 shrink-0">
            {isInjured ? (
              <Link href="/injuries" className={buttonVariants({ size: "sm" })}>
                <HeartPulse className="size-4 mr-1.5" />
                Seguimiento Médico
              </Link>
            ) : (
              <Link href={`/players/${player.id}/tests/new`} className={buttonVariants({ size: "sm" })}>
                <Gauge className="size-4 mr-1.5" />
                Registrar Test Físico
              </Link>
            )}

            <button
              onClick={() => {
                const el = document.getElementById("talks-manager-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className={buttonVariants({ variant: "outline", size: "sm", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20" })}
            >
              💬 Solicitar Charla
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  render={
                    <Link href={`/players/${player.id}/edit`} className="flex items-center cursor-pointer">
                      <Edit className="size-3.5 mr-2" /> Editar Datos
                    </Link>
                  }
                />
                <DropdownMenuItem
                  render={
                    <Link href={`/players/${player.id}/tasks`} className="flex items-center cursor-pointer">
                      <Dumbbell className="size-3.5 mr-2" /> Tareas Individuales
                    </Link>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Integrated Bio Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/40 text-xs">
          {age != null && (
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium">Edad</span>
              <span className="font-semibold text-foreground mt-0.5 block">{age} años</span>
            </div>
          )}
          {player.height_cm && (
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium">Altura / Peso</span>
              <span className="font-semibold text-foreground mt-0.5 block">{player.height_cm} cm / {player.weight_kg || "--"} kg</span>
            </div>
          )}
          {player.dominant_foot && (
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium">Pie Dominante</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {player.dominant_foot === "right" ? "Derecho" : player.dominant_foot === "left" ? "Izquierdo" : "Ambidiestro"}
              </span>
            </div>
          )}
          {player.nationality && (
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium">Nacionalidad</span>
              <span className="font-semibold text-foreground mt-0.5 block">{player.nationality}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── WORKSPACE TABS NAV ── */}
      <div className="flex bg-muted/60 border border-border rounded-md p-0.5 gap-0.5 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeTab === "overview"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Ficha & Rendimiento
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gps")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "gps"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>🛰️ Estadísticas GPS Acumuladas</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("wellness")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "wellness"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>📊 Histórico Check-in & RPE</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("fat_control")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "fat_control"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>⚖️ Grasa & Antropometría</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("health")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "health"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Salud & Enfermería</span>
          {isInjured && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evaluations")}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeTab === "evaluations"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tests & Evaluaciones ({tests.length})
        </button>
      </div>

      {/* ── TAB CONTENTS ── */}

      {/* TAB 1: OVERVIEW & TACTICAL MAP */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayerPositionsMap
            playerId={player.id}
            playerName={name}
            sportingName={player.sporting_name}
            jerseyNumber={membership?.jersey_number}
            positions={positions as PositionKey[]}
          />

          {/* Kicker roles & Quick Links */}
          <div className="space-y-6">
            {membership?.kicker_roles && membership.kicker_roles.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-5 space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">Roles de Lanzamiento</h3>
                <div className="flex flex-wrap gap-2">
                  {membership.kicker_roles.map((role: string) => (
                    <span key={role} className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground border border-border/60">
                      {KICKER_ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Context Actions */}
            <div className="bg-card rounded-lg border border-border p-5 space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">Accesos Directos</h3>
              <div className="space-y-2 text-xs">
                <Link href={`/performance?playerId=${player.id}`} className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted transition-colors text-foreground">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-400" />
                    <span>Estadísticas de Minutos y Carga</span>
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </Link>
                <Link href={`/training?playerId=${player.id}`} className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted transition-colors text-foreground">
                  <span className="flex items-center gap-2">
                    <Dumbbell className="size-4 text-indigo-400" />
                    <span>Participación en Entrenamientos</span>
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB GPS: ACUMULADO Y COMPARATIVA DE PLANTILLA */}
      {activeTab === "gps" && (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-emerald-400" />
                  <span>Estadísticas GPS Acumuladas de la Temporada</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Promedios, récords individuales y ranking de percentiles en comparación con la plantilla
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                12 Partidos Analizados
              </span>
            </div>

            {/* Promedios y Máximos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Distancia Media</span>
                <span className="text-xl font-bold text-foreground font-mono">9.82 <span className="text-xs font-sans text-muted-foreground">km/partido</span></span>
                <span className="text-[10px] text-emerald-400 block font-medium">Máx: 11.40 km</span>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Velocidad Máxima</span>
                <span className="text-xl font-bold text-amber-400 font-mono">32.40 <span className="text-xs font-sans text-muted-foreground">km/h</span></span>
                <span className="text-[10px] text-amber-400 block font-medium">Pico récord temporada</span>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Volumen HSR Medio</span>
                <span className="text-xl font-bold text-sky-400 font-mono">685 <span className="text-xs font-sans text-muted-foreground">m/partido</span></span>
                <span className="text-[10px] text-sky-400 block font-medium">Máx: 890 m</span>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">PlayerLoad / min</span>
                <span className="text-xl font-bold text-purple-400 font-mono">1.28 <span className="text-xs font-sans text-muted-foreground">PL/m</span></span>
                <span className="text-[10px] text-purple-400 block font-medium">Carga inercial estable</span>
              </div>
            </div>

            {/* Ranking de Percentiles vs Plantilla */}
            <div className="bg-muted/30 p-5 rounded-lg border border-border space-y-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-400" />
                <span>Percentiles de Rendimiento vs Resto del Equipo (1 - 100)</span>
              </h3>

              <div className="space-y-4 font-mono text-xs">
                {/* Metric 1: Distancia */}
                <div className="space-y-1">
                  <div className="flex justify-between font-sans">
                    <span className="font-medium text-foreground">Kilometraje Total (Distancia km)</span>
                    <span className="font-bold text-emerald-400 font-mono">P95 (Top 5% del equipo)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: "95%" }} />
                  </div>
                </div>

                {/* Metric 2: Velocidad */}
                <div className="space-y-1">
                  <div className="flex justify-between font-sans">
                    <span className="font-medium text-foreground">Velocidad Máxima (Pico km/h)</span>
                    <span className="font-bold text-amber-400 font-mono">P98 (Top 2% del equipo)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                    <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: "98%" }} />
                  </div>
                </div>

                {/* Metric 3: HSR */}
                <div className="space-y-1">
                  <div className="flex justify-between font-sans">
                    <span className="font-medium text-foreground">Volumen de Alta Intensidad HSR (&gt;19.8 km/h)</span>
                    <span className="font-bold text-sky-400 font-mono">P90 (Top 10% del equipo)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                    <div className="bg-sky-400 h-full rounded-full transition-all" style={{ width: "90%" }} />
                  </div>
                </div>

                {/* Metric 4: Arrancadas */}
                <div className="space-y-1">
                  <div className="flex justify-between font-sans">
                    <span className="font-medium text-foreground">Arrancadas Explosivas (+3 m/s²)</span>
                    <span className="font-bold text-purple-400 font-mono">P92 (Top 8% del equipo)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                    <div className="bg-purple-400 h-full rounded-full transition-all" style={{ width: "92%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HEALTH & RECOVERY */}
      {activeTab === "health" && (
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HeartPulse className="size-4 text-destructive" />
              <span>Estado de Salud y Registro Médico</span>
            </h2>
            <Link href="/injuries" className={buttonVariants({ variant: "outline", size: "xs" })}>
              Ir al Módulo de Lesiones
            </Link>
          </div>

          {injury ? (
            <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">Parte Médico Activo</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                  {injury.status === "readaptation" ? "Readaptación" : "Baja Médica"}
                </span>
              </div>
              <p><span className="text-muted-foreground">Zona afectada:</span> <span className="text-foreground font-medium">{injury.body_part || "No especificada"}</span></p>
              <p><span className="text-muted-foreground">Severidad:</span> <span className="text-foreground font-medium">{injury.severity || "Moderada"}</span></p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>El jugador no presenta ningún proceso lesional activo.</span>
            </div>
          )}

          {player.availability_notes && (
            <div className="pt-3 border-t border-border/40 text-xs space-y-1">
              <span className="text-muted-foreground font-medium block">Notas de readaptación / cuerpo técnico:</span>
              <p className="text-foreground italic bg-muted/30 p-2.5 rounded-md border border-border/40">"{player.availability_notes}"</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EVALUATIONS & TESTS */}
      {activeTab === "evaluations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Physical Tests */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                <Gauge className="size-4 text-primary" />
                Tests Físicos ({tests.length})
              </h3>
              <Link href={`/players/${player.id}/tests/new`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                <Plus className="size-3 mr-1" /> Nuevo Test
              </Link>
            </div>

            {tests.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">Sin pruebas físicas registradas.</p>
            ) : (
              <div className="divide-y divide-border/30 text-xs">
                {tests.map((test) => (
                  <div key={test.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-foreground block">{test.physical_tests?.name || "Test"}</span>
                      <span className="text-[11px] text-muted-foreground">{test.date}</span>
                    </div>
                    <span className="font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded text-xs border border-primary/20">
                      {test.value} {test.physical_tests?.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Individual Tasks */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                <Dumbbell className="size-4 text-indigo-400" />
                Tareas Individuales ({tasks.length})
              </h3>
              <Link href={`/players/${player.id}/tasks`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                Gestionar
              </Link>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">Sin tareas individuales asignadas.</p>
            ) : (
              <div className="divide-y divide-border/30 text-xs">
                {tasks.map((t) => (
                  <div key={t.id} className="py-2.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">{t.exercise?.title || "Tarea"}</span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border/50">
                        {t.exercise?.category || "Individual"}
                      </span>
                    </div>
                    {t.staff_comment && (
                      <p className="text-[11px] text-muted-foreground italic">"{t.staff_comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WELLNESS HISTORY & STATE EVOLUTION */}
      {activeTab === "wellness" && (
        <div className="space-y-6">
          {/* Latest Available State Banner */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Último Estado Disponible del Jugador
                </h3>
              </div>
              {historyCheckins[0] && (
                <span className="text-[11px] text-muted-foreground">
                  Registrado el {historyCheckins[0].date}
                </span>
              )}
            </div>

            {historyCheckins[0] ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Sueño</span>
                  <span className={`text-base font-bold ${historyCheckins[0].sleep_quality >= 4 ? "text-emerald-400" : "text-amber-400"}`}>
                    {historyCheckins[0].sleep_quality}/5
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Fatiga</span>
                  <span className={`text-base font-bold ${historyCheckins[0].fatigue >= 4 ? "text-rose-400" : historyCheckins[0].fatigue >= 3 ? "text-amber-400" : "text-emerald-400"}`}>
                    {historyCheckins[0].fatigue}/5
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Ánimo</span>
                  <span className="text-base font-bold text-foreground">{historyCheckins[0].mood}/5</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Peso Hoy</span>
                  <span className="text-base font-bold text-foreground">{historyCheckins[0].weight_kg ? `${historyCheckins[0].weight_kg} kg` : "–"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Último RPE</span>
                  <span className="text-base font-bold text-sky-400">{historyRpe[0] ? `RPE ${historyRpe[0].rpe}` : "–"}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin datos de check-in registrados recientemente.</p>
            )}
          </div>

          {/* Historical Log Table */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="size-4 text-emerald-400" />
                Histórico Completo de Check-in y Check-out ({historyCheckins.length} registros)
              </h3>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Cargando historial de estado...
              </div>
            ) : historyCheckins.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                No hay historial de cuestionarios para este futbolista aún.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] border-b border-border/40">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Sueño</th>
                      <th className="p-2.5">Fatiga</th>
                      <th className="p-2.5">Ánimo</th>
                      <th className="p-2.5">Molestia</th>
                      <th className="p-2.5">Peso</th>
                      <th className="p-2.5">RPE Post</th>
                      <th className="p-2.5">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {historyCheckins.map((c: any) => {
                      const matchRpe = historyRpe.find((r: any) => r.date === c.date);
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground">{c.date}</td>
                          <td className="p-2.5">{c.sleep_quality}/5</td>
                          <td className={`p-2.5 font-bold ${c.fatigue >= 4 ? "text-rose-400" : c.fatigue >= 3 ? "text-amber-400" : "text-emerald-400"}`}>
                            {c.fatigue}/5
                          </td>
                          <td className="p-2.5">{c.mood}/5</td>
                          <td className="p-2.5">
                            {c.has_discomfort ? (
                              <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                ⚠ {c.discomfort_body_part} ({c.discomfort_intensity || "?"}/10)
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-medium">OK</span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold">{c.weight_kg ? `${c.weight_kg} kg` : "–"}</td>
                          <td className="p-2.5">
                            {matchRpe ? (
                              <span className="text-sky-300 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                RPE {matchRpe.rpe}
                              </span>
                            ) : (
                              <span className="text-slate-600">–</span>
                            )}
                          </td>
                          <td className="p-2.5 text-muted-foreground italic truncate max-w-[150px]">
                            {c.notes || matchRpe?.notes || "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: FAT CONTROL & ANTHROPOMETRY */}
      {activeTab === "fat_control" && (
        <PlayerFatControlTab player={player} />
      )}

      {/* ── TALKS & MEETINGS MANAGER (COACH VIEW) ── */}
      <div id="talks-manager-section" className="pt-2">
        <TalksManagerCard
          viewerRole="coach"
          playerId={player.id}
          playerName={name}
          title={`Gestión de Charlas con ${name}`}
          subtitle="Historial de solicitudes y citas propuestas entre el cuerpo técnico y el jugador"
        />
      </div>
    </div>
  );
}
