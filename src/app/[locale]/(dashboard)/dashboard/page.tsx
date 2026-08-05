import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSquadPlayers } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import Link from "next/link";
import { 
  Users, 
  Calendar, 
  HeartPulse, 
  Activity, 
  ChevronRight, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  Trophy
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Button, buttonVariants } from "@/components/ui/button";

import { CoachMobileView } from "@/components/dashboard/CoachMobileView";
import { InteractiveCheckinList } from "@/components/dashboard/InteractiveCheckinList";

export const metadata: Metadata = {
  title: "Inicio — ClubLab",
  description: "Plataforma de gestión deportiva y estadísticas de rendimiento",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ debug?: string }>;
}) {
  const cookieStore = await cookies();
  const roleOverride = cookieStore.get("cl_role_override")?.value;
  if (roleOverride === "player") {
    redirect("/player");
  }
  if (roleOverride === "physio") {
    redirect("/injuries");
  }

  const params = await searchParams;
  const isDebug = params?.debug === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Retrieve active team context & role
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      role,
      team_id,
      organization_id,
      organizations (
        name,
        type,
        logo_url,
        settings
      )
    `)
    .eq("user_id", user?.id)
    .single();

  const userRole = roleOverride || orgRole?.role;
  if (userRole === "player") {
    redirect("/player");
  }
  if (userRole === "physio") {
    redirect("/injuries");
  }

  const orgData = orgRole?.organizations as any;
  const clubName = orgData?.settings?.club_name || orgData?.name || "ClubLab";
  const orgType = orgData?.type || "club";
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  let resolvedTeamId = orgType === "club" ? "" : (globalTeamId || orgRole?.team_id || "");

  // Fallback to first team if none active
  if (!resolvedTeamId && orgRole?.organization_id) {
    const { data: clubs } = await supabase
      .from("clubs")
      .select("id")
      .eq("organization_id", orgRole.organization_id);
    
    const clubIds = clubs?.map((c: any) => c.id) || [];
    let firstTeam: any = null;

    if (clubIds.length > 0) {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .or(`organization_id.eq.${orgRole.organization_id},club_id.in.(${clubIds.join(",")})`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstTeam = data;
    }

    if (!firstTeam && orgRole?.organization_id) {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", orgRole.organization_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstTeam = data;
    }

    if (!firstTeam) {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstTeam = data;
    }

    if (firstTeam) {
      resolvedTeamId = firstTeam.id;
    }
  }

  const players = await getSquadPlayers(resolvedTeamId || undefined);

  // Get Monday and Sunday of this week
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const getMondayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
  };

  const currentMonday = getMondayDate(todayStr);
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);
  currentSunday.setHours(23, 59, 59, 999);

  const mondayStr = currentMonday.toISOString().split("T")[0];
  const sundayStr = currentSunday.toISOString().split("T")[0];

  let dbSessions: any[] = [];
  if (resolvedTeamId) {
    const { data } = await supabase
      .from("training_sessions")
      .select(`
        id,
        title,
        date,
        session_type,
        notes,
        session_attendance (
          player_id,
          status,
          rpe,
          notes,
          rpe_recorded_at
        ),
        session_exercises (
          duration_min,
          exercise:exercises (
            title
          )
        )
      `)
      .eq("team_id", resolvedTeamId)
      .neq("session_type", "rest")
      .order("date", { ascending: false })
      .limit(30);

    const { data: wellnessCheckins } = await supabase
      .from("player_wellness_checkins")
      .select("*")
      .order("date", { ascending: false })
      .limit(100);

    const { data: rpeEntries } = await supabase
      .from("rpe_entries")
      .select("*")
      .order("date", { ascending: false })
      .limit(100);

    dbSessions = (data || []).map((s: any) => ({
      ...s,
      wellness_checkins: (wellnessCheckins || []).filter((w: any) => w.session_id === s.id || w.date === s.date),
      rpe_entries: (rpeEntries || []).filter((r: any) => r.session_id === s.id || r.date === s.date),
    }));
  }

  const weekSessions = dbSessions.filter((s) => s.date >= mondayStr && s.date <= sundayStr);
  const todaySession = dbSessions.find((s) => s.date === todayStr);

  // Metrics calculation
  const totalPlayers = players.length;
  const injuredCount = players.filter((p) => p.active_injury?.status === "active").length;
  const readaptCount = players.filter((p) => p.active_injury?.status === "readaptation").length;
  const availableCount = totalPlayers - injuredCount - readaptCount;
  const availabilityRate = totalPlayers > 0 ? Math.round((availableCount / totalPlayers) * 100) : 100;
  const fatiguedCount = players.filter((p) => p.physical_status === "yellow").length;
  const injuredList = players.filter((p) => p.active_injury?.status === "active" || p.active_injury?.status === "readaptation");

  // Fetch active alerts
  const { data: dbAlerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const alertsList = [];
  if (injuredCount > 0) {
    alertsList.push({
      id: "injury-alert",
      message: `${injuredCount} jugador${injuredCount === 1 ? "" : "es"} de baja médica activa.`,
      severity: "high",
      type: "salud"
    });
  }
  if (readaptCount > 0) {
    alertsList.push({
      id: "readapt-alert",
      message: `${readaptCount} jugador${readaptCount === 1 ? "" : "es"} en readaptación física.`,
      severity: "medium",
      type: "readaptacion"
    });
  }
  if (fatiguedCount > 0) {
    alertsList.push({
      id: "fatigue-alert",
      message: `${fatiguedCount} jugador${fatiguedCount === 1 ? "" : "es"} con fatiga acumulada alta.`,
      severity: "medium",
      type: "carga"
    });
  }
  for (const dbA of dbAlerts || []) {
    alertsList.push({
      id: dbA.id,
      message: dbA.message,
      severity: dbA.severity || "medium",
      type: "sistema"
    });
  }

  // Real Check-in & Check-out statistics
  const completedCheckinsCount = players.filter((p: any) => !!p.latest_wellness).length;
  const checkinPct = totalPlayers > 0 ? Math.round((completedCheckinsCount / totalPlayers) * 100) : 0;
  const pendingCheckinCount = totalPlayers - completedCheckinsCount;

  const completedCheckoutsCount = players.filter((p: any) => !!p.latest_rpe).length;
  const completedWeightsCount = players.filter((p: any) => p.latest_wellness?.weight_kg != null).length;
  const checkoutPct = totalPlayers > 0 ? Math.round((completedCheckoutsCount / totalPlayers) * 100) : 0;
  const pendingCheckoutCount = totalPlayers - completedCheckoutsCount;

  return (
    <>
      {/* ── MOBILE COACH INTERFACE ── */}
      <CoachMobileView
        clubName={clubName}
        userRole={userRole || "head_coach"}
        totalPlayers={totalPlayers}
        availableCount={availableCount}
        injuredCount={injuredCount}
        readaptCount={readaptCount}
        fatiguedCount={fatiguedCount}
        availabilityRate={availabilityRate}
        completedCheckinsCount={completedCheckinsCount}
        checkinPct={checkinPct}
        pendingCheckinCount={pendingCheckinCount}
        completedCheckoutsCount={completedCheckoutsCount}
        checkoutPct={checkoutPct}
        pendingCheckoutCount={pendingCheckoutCount}
        todaySession={todaySession}
        weekSessions={weekSessions}
        alertsList={alertsList}
        injuredList={injuredList}
        players={players}
      />

      {/* ── DESKTOP DASHBOARD VIEW ── */}
      <div className="hidden md:block space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* ── Standard PageHeader ── */}
      <PageHeader 
        title="Inicio" 
        description={`Resumen diario de actividad y plantilla de ${clubName}`}
      >
        <Link href="/training/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-4 mr-1.5" />
          Nueva Sesión
        </Link>
      </PageHeader>
      {/* ── CHECK-IN / CHECK-OUT STATUS WIDGET (MONITORIZACIÓN DUAL EN TIEMPO REAL) ── */}
      <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 md:p-5 space-y-4 text-white shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Control de Asistencia & Cuestionarios Diarios
            </span>
          </div>
          <Link
            href="/performance/monitoring"
            className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Monitorización Completa</span>
            <ChevronRight className="size-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. CHECK-IN MATUTINO */}
          <div className="bg-slate-950/60 border border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Check-in Matutino
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                {completedCheckinsCount} / {totalPlayers} ({checkinPct}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-slate-300 h-full transition-all duration-500" style={{ width: `${checkinPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Pendientes:</span>
              <span className={`font-medium ${pendingCheckinCount === 0 ? "text-slate-400" : "text-amber-400/90"}`}>
                {pendingCheckinCount === 0 ? "Ninguno (Al día)" : `${pendingCheckinCount} futbolistas`}
              </span>
            </div>
          </div>

          {/* 2. PRESENCIA & BÁSCULA */}
          <div className="bg-slate-950/60 border border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Presencia & Báscula
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                {completedWeightsCount} / {totalPlayers} ({totalPlayers > 0 ? Math.round((completedWeightsCount / totalPlayers) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-slate-400 h-full transition-all duration-500" style={{ width: `${totalPlayers > 0 ? Math.round((completedWeightsCount / totalPlayers) * 100) : 0}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Sin registrar:</span>
              <span className={`font-medium ${totalPlayers - completedWeightsCount === 0 ? "text-slate-400" : "text-slate-300"}`}>
                {totalPlayers - completedWeightsCount === 0 ? "Todos pesados" : `${totalPlayers - completedWeightsCount} sin peso`}
              </span>
            </div>
          </div>

          {/* 3. CHECK-OUT (RPE) */}
          <div className="bg-slate-950/60 border border-white/[0.06] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Check-out (RPE)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                {completedCheckoutsCount} / {totalPlayers} ({checkoutPct}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-slate-400 h-full transition-all duration-500" style={{ width: `${checkoutPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Pendientes:</span>
              <span className={`font-medium ${pendingCheckoutCount === 0 ? "text-slate-400" : "text-slate-300"}`}>
                {pendingCheckoutCount === 0 ? "Ninguno (Al día)" : `${pendingCheckoutCount} futbolistas`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── DETALLE DE CHECK-IN Y CHECK-OUT POR SESIÓN POR JUGADOR ── */}
      <InteractiveCheckinList
        players={players}
        sessions={dbSessions}
        completedCheckinsCount={completedCheckinsCount}
        completedWeightsCount={completedWeightsCount}
        completedCheckoutsCount={completedCheckoutsCount}
        pendingCheckinCount={pendingCheckinCount}
        totalPlayers={totalPlayers}
      />

      {/* ── TODAY'S FOCUS (DAILY BRIEFING HERO) ── */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Clock className="size-4 text-primary" />
            <span>Hoy, {today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          {todaySession && (
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 font-medium px-2.5 py-0.5 rounded-full">
              {todaySession.session_type === "training" ? "Entrenamiento" : todaySession.session_type === "match" ? "Partido" : "Descanso"}
            </span>
          )}
        </div>

        {todaySession ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{todaySession.title || "Sesión de hoy"}</h2>
              {todaySession.notes && (
                <p className="text-sm text-muted-foreground">{todaySession.notes}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span>{(todaySession.session_exercises || []).length} tareas programadas</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href={`/training/${todaySession.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver Detalle</Link>
              <Link href={`/training/${todaySession.id}`} className={buttonVariants({ size: "sm" })}>Pasar Lista</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">Sin actividad programada para hoy</h2>
              <p className="text-xs text-muted-foreground">No hay entrenamientos ni partidos registrados en el calendario para el día de hoy.</p>
            </div>
            <Link href="/training/new" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>Planificar Sesión</Link>
          </div>
        )}
      </div>

      {/* ── TWO COLUMN WORKSPACE GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT 2 COLS: ATTENTION NEEDED + THIS WEEK */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Section: Attention Needed */}
          <div className="space-y-3">
            <SectionHeader 
              title="Atención Requerida" 
              description="Novedades de enfermería, carga y estado de jugadores"
            />
            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border/40">
              {alertsList.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Sin alertas sanitarias o de fatiga pendientes de revisión.</span>
                </div>
              ) : (
                alertsList.map((alert) => (
                  <div key={alert.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`size-4 ${alert.severity === "high" ? "text-destructive" : "text-amber-400"}`} />
                      <span className="text-xs font-medium text-foreground">{alert.message}</span>
                    </div>
                    <Link href="/injuries" className={buttonVariants({ variant: "ghost", size: "xs" })}>Ver Enfermería</Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: This Week's Plan */}
          <div className="space-y-3">
            <SectionHeader 
              title="Esta Semana" 
              description="Microciclo actual del equipo"
            >
              <Link href="/training" className={buttonVariants({ variant: "ghost", size: "xs" })}>Ver Calendario</Link>
            </SectionHeader>

            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border/40">
              {weekSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No hay sesiones programadas para esta semana.
                </div>
              ) : (
                weekSessions.map((session) => {
                  const sDate = new Date(session.date + "T00:00:00");
                  const dayName = sDate.toLocaleDateString("es-ES", { weekday: "short" });
                  const dayNum = sDate.getDate();
                  const isToday = session.date === todayStr;

                  return (
                    <div 
                      key={session.id} 
                      className={`p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors ${isToday ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 text-center shrink-0">
                          <span className="block text-[10px] text-muted-foreground uppercase font-medium">{dayName}</span>
                          <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>{dayNum}</span>
                        </div>
                        <div>
                          <Link href={`/training/${session.id}`} className="text-xs font-medium text-foreground hover:text-primary transition-colors">
                            {session.title || "Sesión de entrenamiento"}
                          </Link>
                          {session.notes && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{session.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {session.session_type === "training" ? "Entrenamiento" : session.session_type === "match" ? "Partido" : "Descanso"}
                        </span>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT 1 COL: SQUAD STATUS & QUICK ACCESS */}
        <div className="space-y-8">
          
          {/* Section: Squad Snapshot */}
          <div className="space-y-3">
            <SectionHeader title="Plantilla" />
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Disponibilidad General</span>
                <span className="text-sm font-semibold text-foreground">{availabilityRate}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${availabilityRate}%` }} />
              </div>
              
              <div className="pt-2 divide-y divide-border/30 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Total Jugadores</span>
                  <span className="font-medium text-foreground">{totalPlayers}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Disponibles</span>
                  <span className="font-medium text-emerald-400">{availableCount}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Bajas / Readaptación</span>
                  <span className="font-medium text-destructive">{injuredCount + readaptCount}</span>
                </div>
              </div>

              <Link href="/players" className={buttonVariants({ variant: "outline", size: "xs", className: "w-full" })}>Gestionar Plantilla</Link>
            </div>
          </div>

          {/* Medical Status List (if any) */}
          {injuredList.length > 0 && (
            <div className="space-y-3">
              <SectionHeader title="Parte Médico Activo" />
              <div className="bg-card border border-border rounded-lg p-3 divide-y divide-border/30">
                {injuredList.map((player) => (
                  <div key={player.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-foreground block">{player.first_name} {player.last_name}</span>
                      <span className="text-[11px] text-muted-foreground">{player.active_injury?.body_part || "Enfermería"}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${player.active_injury?.status === "readaptation" ? "bg-amber-500/10 text-amber-400" : "bg-destructive/10 text-destructive"}`}>
                      {player.active_injury?.status === "readaptation" ? "Readaptación" : "Baja"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Debug panel (if ?debug=1) */}
      {isDebug && (
        <div className="p-4 bg-muted border border-border rounded-lg text-xs font-mono text-muted-foreground">
          Debug Active: Team {resolvedTeamId || "None"} | Players {players.length} | Sessions {dbSessions.length}
        </div>
      )}
      </div>
    </>
  );
}
