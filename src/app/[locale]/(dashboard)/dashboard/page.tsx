import type { Metadata } from "next";
import { getSquadPlayers } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import Link from "next/link";
import { 
  Users, 
  Calendar, 
  HeartPulse, 
  Flame, 
  Trophy, 
  Activity, 
  ChevronRight, 
  TrendingUp, 
  AlertCircle,
  Clock,
  MapPin,
  LayoutDashboard
} from "lucide-react";

export const metadata: Metadata = {
  title: "Inicio — ClubLab",
  description: "Plataforma de gestión deportiva y estadísticas de rendimiento",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Retrieve active team context
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
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

  const orgData = orgRole?.organizations as any;
  const clubName = orgData?.settings?.club_name || orgData?.name || "ClubLab";
  const clubLogoUrl = orgData?.settings?.club_logo_url || orgData?.logo_url || "";

  const orgType = orgData?.type || "club";
  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  let resolvedTeamId = orgType === "club" ? "" : (globalTeamId || orgRole?.team_id || "");

  // Fallback to the first team in the organization if no active team is selected yet
  if (!resolvedTeamId && orgRole?.organization_id) {
    const { data: clubs } = await supabase
      .from("clubs")
      .select("id")
      .eq("organization_id", orgRole.organization_id);
    
    const clubIds = clubs?.map((c: any) => c.id) || [];
    if (clubIds.length > 0) {
      const { data: firstTeam } = await supabase
        .from("teams")
        .select("id")
        .in("club_id", clubIds)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstTeam) {
        resolvedTeamId = firstTeam.id;
      }
    }
  }

  // Fetch real squad players
  const players = await getSquadPlayers(resolvedTeamId || undefined);

  // Get Monday and Sunday of this week
  const today = new Date();
  const getMondayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
  };
  const currentMonday = getMondayDate(today.toISOString().split("T")[0]);
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
        session_exercises (
          duration_min,
          exercise:exercises (
            title
          )
        )
      `)
      .eq("team_id", resolvedTeamId)
      .order("date", { ascending: true });
    dbSessions = data || [];
  }

  const weekSessions = dbSessions.filter((s) => s.date >= mondayStr && s.date <= sundayStr);
  const totalTrainings = dbSessions.filter((s) => s.session_type === "training").length;

  const SESSION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    training: { bg: "corp-badge-bg", text: "corp-text", border: "corp-badge-border" },
    individual: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    match: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
    rest: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  };

  // Date format helper for matches
  const formatMatchDate = (dateStr: string, timeStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = date.toLocaleDateString('es-ES', options);
    const capitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    return timeStr ? `${capitalized}, ${timeStr.slice(0, 5)}` : capitalized;
  };

  // Fetch completed and upcoming matches from database
  let completedMatches: any[] = [];
  let nextMatch: any = null;

  if (resolvedTeamId) {
    const todayStr = new Date().toISOString().split("T")[0];
    const cleanClubName = clubName
      .replace(/\b(S\.?D\.?|C\.?D\.?|C\.?F\.?|U\.?D\.?|S\.?A\.?D\.?|Club|Deportivo|Sociedad|Deportiva)\b/gi, "")
      .trim();
    const searchPattern = cleanClubName.replace(/[áéíóúÁÉÍÓÚ]/g, "%");

    console.log("[DashboardPage] resolvedTeamId:", resolvedTeamId);
    console.log("[DashboardPage] clubName:", clubName);
    console.log("[DashboardPage] searchPattern:", searchPattern);
    console.log("[DashboardPage] statsUrl:", process.env.NEXT_PUBLIC_FEDERATION_SUPABASE_URL ? "DEFINED" : "MISSING");
    console.log("[DashboardPage] statsKey:", process.env.FEDERATION_SUPABASE_SERVICE_ROLE_KEY ? "DEFINED" : "MISSING");

    // 1. Fetch completed matches from Federation DB (stat_matches table) for this club in season 2025/2026
    const { data: federationMatches, error: fedError } = await statsAdmin
      .from("stat_matches")
      .select("*")
      .or(`home_team.ilike.%${searchPattern}%,away_team.ilike.%${searchPattern}%`)
      .eq("season", "2025/2026")
      .order("matchday", { ascending: false })
      .limit(5);

    if (fedError) {
      console.error("[DashboardPage] statsAdmin query error:", fedError);
    } else {
      console.log("[DashboardPage] federationMatches count:", federationMatches?.length || 0);
    }

    completedMatches = (federationMatches || []).map((m: any) => {
      const normalizedHome = m.home_team.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedCleanName = cleanClubName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const isHome = normalizedHome.includes(normalizedCleanName);
      const rival = isHome ? m.away_team : m.home_team;
      const score = `${m.home_score} - ${m.away_score}`;
      
      let result: "win" | "draw" | "loss";
      if (isHome) {
        result = m.home_score > m.away_score ? "win" : m.home_score === m.away_score ? "draw" : "loss";
      } else {
        result = m.away_score > m.home_score ? "win" : m.away_score === m.home_score ? "draw" : "loss";
      }

      return {
        id: m.id,
        match_opponent: rival,
        match_score: score,
        match_is_home: isHome,
        match_result: result,
        date_label: `Jornada ${m.matchday}`,
        date: m.match_date || todayStr
      };
    });

    // 2. Fetch the next upcoming match directly from the preseason planning (preseason_sessions table)
    const { data: upcomingPreseason, error: preseasonError } = await supabase
      .from("preseason_sessions")
      .select("*")
      .eq("team_id", resolvedTeamId)
      .in("type", ["friendly", "league"])
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1);

    if (preseasonError) {
      console.error("[DashboardPage] upcomingPreseason query error:", preseasonError);
    } else {
      console.log("[DashboardPage] upcomingPreseason count:", upcomingPreseason?.length || 0);
    }

    const preseasonMatch = upcomingPreseason?.[0] || null;

    if (preseasonMatch) {
      nextMatch = {
        id: preseasonMatch.id,
        date: preseasonMatch.date,
        start_time: preseasonMatch.start_time,
        match_opponent: preseasonMatch.opponent || "Rival",
        match_is_home: !(preseasonMatch.location?.toLowerCase().includes("visitante") || preseasonMatch.location?.toLowerCase().includes("fuera")),
        match_competition: preseasonMatch.type === "friendly" ? "friendly" : "league",
        title: preseasonMatch.type === "friendly" ? "Partido Amistoso" : "Partido Liga",
        notes: preseasonMatch.comments
      };
    } else {
      // Fallback: Fetch upcoming match from the normal calendar (training_sessions table)
      const { data: upcomingMatches } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("team_id", resolvedTeamId)
        .eq("session_type", "match")
        .gte("date", todayStr)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1);
      
      nextMatch = upcomingMatches?.[0] || null;
    }
  }

  // Calculate metrics
  const totalPlayers = players.length;
  const injuredCount = players.filter((p) => p.active_injury?.status === "active").length;
  const readaptCount = players.filter((p) => p.active_injury?.status === "readaptation").length;
  const availableCount = totalPlayers - injuredCount - readaptCount;
  const availabilityRate = totalPlayers > 0 ? Math.round((availableCount / totalPlayers) * 100) : 100;
  
  const fatiguedCount = players.filter((p) => p.physical_status === "yellow").length;
  const injuredList = players.filter((p) => p.active_injury?.status === "active" || p.active_injury?.status === "readaptation");

  // Fetch active alerts from database
  const { data: dbAlerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Generate dynamic alerts
  const alertsList = [];
  if (injuredCount > 0) {
    alertsList.push({
      id: "injury-alert",
      message: `${injuredCount} jugador${injuredCount === 1 ? "" : "es"} de baja médica activa en enfermería.`,
      severity: "high",
      icon: "🚑"
    });
  }
  if (readaptCount > 0) {
    alertsList.push({
      id: "readapt-alert",
      message: `${readaptCount} jugador${readaptCount === 1 ? "" : "es"} en fase de readaptación física sobre el césped.`,
      severity: "medium",
      icon: "🔄"
    });
  }
  if (fatiguedCount > 0) {
    alertsList.push({
      id: "fatigue-alert",
      message: `Fatiga acumulada detectada en ${fatiguedCount} jugador${fatiguedCount === 1 ? "" : "es"}. Vigilancia recomendada.`,
      severity: "medium",
      icon: "⚠️"
    });
  }

  for (const dbA of dbAlerts || []) {
    alertsList.push({
      id: dbA.id,
      message: dbA.message,
      severity: dbA.severity || "medium",
      icon: dbA.severity === "high" ? "🚨" : "⚠️"
    });
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5 shrink-0">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
              Centro de Rendimiento
            </h1>
            <p className="text-slate-400 text-[11px] mt-1 font-medium">
              Panel de control y analítica para la gestión de la <span className="text-primary font-bold">{clubName}</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl text-slate-400">
          <Clock className="h-3 w-3 corp-icon" />
          <span>Última actualización: Hoy, {new Date().toLocaleDateString("es-ES")}</span>
        </div>
      </div>

      {/* ── KEY PERFORMANCE INDICATORS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total squad */}
        <Link href="/players" className="glass-card hover:bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all group cursor-pointer shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Plantilla</span>
            <span className="text-3xl font-black text-white">{totalPlayers}</span>
            <span className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
              Ver lista de jugadores <ChevronRight className="h-2.5 w-2.5 text-primary group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Users className="h-5 w-5" />
          </div>
        </Link>

        {/* Availability */}
        <div className="glass-card border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa Disponibilidad</span>
            <span className="text-3xl font-black text-emerald-400">{availabilityRate}%</span>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${availabilityRate}%` }}></div>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* Training sessions */}
        <Link href="/training" className="glass-card hover:bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all group cursor-pointer shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entrenamientos</span>
            <span className="text-3xl font-black text-white">{totalTrainings}</span>
            <span className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
              Ver planificación semanal <ChevronRight className="h-2.5 w-2.5 text-primary group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
            <Calendar className="h-5 w-5" />
          </div>
        </Link>

        {/* Active injuries */}
        <Link href="/injuries" className="glass-card hover:bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all group cursor-pointer shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bajas Médicas</span>
            <span className={`text-3xl font-black ${injuredCount > 0 ? "text-rose-500" : "text-white"}`}>
              {injuredCount + readaptCount}
            </span>
            <span className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
              Ver enfermería y readaptación <ChevronRight className="h-2.5 w-2.5 text-primary group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-inner ${injuredCount > 0 ? "bg-rose-500/10 text-rose-455" : "bg-slate-800 text-slate-400"}`}>
            <HeartPulse className="h-5 w-5" />
          </div>
        </Link>
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER: Next Match, Recent Results, Physical Status */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Widget: Próximo Partido */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full blur-3xl -z-10" />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-black uppercase text-slate-300 tracking-wider">Próximo Partido</span>
              </div>
              {nextMatch && (
                <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  {nextMatch.match_competition === "friendly" ? "Amistoso" : nextMatch.match_competition === "league" ? "Liga" : (nextMatch.match_competition || "Pretemporada")}
                </span>
              )}
            </div>

            {!nextMatch ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mb-3 text-slate-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-300">No hay partidos planificados</span>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[280px]">
                  Configura amistosos o liga desde el planning de pretemporada.
                </p>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
                {/* Home Team */}
                <div className="flex flex-col items-center gap-2 w-28 text-center">
                  <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2 shadow-md">
                    {nextMatch.match_is_home ? (
                      clubLogoUrl ? (
                        <img src={clubLogoUrl} className="h-full w-full object-contain" alt={clubName} />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 shadow-md">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      )
                    ) : (
                      <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2.5 shadow-md">
                        <span className="text-xl font-black text-rose-500">
                          {(nextMatch.match_opponent || "Rival").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white leading-tight">
                    {nextMatch.match_is_home ? clubName : (nextMatch.match_opponent || "Rival")}
                  </span>
                </div>

                {/* Match info middle */}
                <div className="flex flex-col items-center text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">
                    {nextMatch.title || "Pretemporada"}
                  </span>
                  <div className="text-xl font-black text-white flex items-center gap-2">
                    <span>vs</span>
                  </div>
                  <span className="bg-slate-950/80 px-3 py-1 rounded-lg border border-white/5 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-primary" />
                    <span>{formatMatchDate(nextMatch.date, nextMatch.start_time)}</span>
                  </span>
                  {nextMatch.notes && (
                    <span className="text-[9px] text-slate-450 flex items-center gap-1 pt-1">
                      <MapPin className="h-2.5 w-2.5 text-slate-500" />
                      <span>{nextMatch.notes}</span>
                    </span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-2 w-28 text-center">
                  <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2 shadow-md">
                    {!nextMatch.match_is_home ? (
                      clubLogoUrl ? (
                        <img src={clubLogoUrl} className="h-full w-full object-contain" alt={clubName} />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 shadow-md">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      )
                    ) : (
                      <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2.5 shadow-md">
                        <span className="text-xl font-black text-rose-500">
                          {(nextMatch.match_opponent || "Rival").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white leading-tight">
                    {!nextMatch.match_is_home ? clubName : (nextMatch.match_opponent || "Rival")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Widget: Sesiones de la Semana */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
              <Link 
                href="/training"
                className="flex items-center gap-2 hover:text-white transition-colors group cursor-pointer"
              >
                <Calendar className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase text-slate-350 tracking-wider group-hover:text-white flex items-center gap-1">
                  Sesiones de esta Semana
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                </span>
              </Link>
              <span className="text-[10px] text-slate-400 font-bold bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
                {mondayStr.split("-").reverse().slice(0, 2).join("/")} - {sundayStr.split("-").reverse().slice(0, 2).join("/")}
              </span>
            </div>

            {!weekSessions || weekSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mb-3 text-slate-500">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400">No hay sesiones esta semana</span>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[280px]">
                  Ve a Planificación para programar entrenamientos o partidos para esta semana.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekSessions.map((session: any) => {
                  const typeStyles = SESSION_TYPE_COLORS[session.session_type] || {
                    bg: "bg-slate-500/10",
                    text: "text-slate-400",
                    border: "border-slate-500/20"
                  };
                  
                  const exercisesList = (session.session_exercises || [])
                    .map((se: any) => se.exercise?.title)
                    .filter(Boolean);

                  return (
                    <div 
                      key={session.id}
                      className="glass-card rounded-2xl border border-white/5 p-4 bg-white/1 hover:bg-white/2 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            {new Date(session.date + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
                          </span>
                          <span className={`rounded-lg border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}>
                            {session.session_type === "training" ? "Entrenamiento" : session.session_type === "rest" ? "Descanso" : "Partido"}
                          </span>
                        </div>
                        <div>
                          <Link 
                            href={`/training/${session.id}`}
                            className="text-xs font-extrabold text-white hover:corp-text transition-colors line-clamp-1"
                          >
                            {session.title || "Sesión"}
                          </Link>
                          {session.notes && (
                            <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{session.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Exercises preview */}
                      <div className="border-t border-white/5 pt-2 mt-1">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                          Tareas ({exercisesList.length})
                        </span>
                        {exercisesList.length === 0 ? (
                          <span className="text-[9px] text-slate-500 italic">Sin tareas asignadas</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {exercisesList.slice(0, 3).map((title: string, idx: number) => (
                              <span 
                                key={idx}
                                className="text-[9px] text-slate-300 bg-white/5 border border-white/5 rounded px-1.5 py-0.5 truncate max-w-[120px]"
                                title={title}
                              >
                                {title}
                              </span>
                            ))}
                            {exercisesList.length > 3 && (
                              <span className="text-[8px] font-bold text-slate-400 self-center">
                                +{exercisesList.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Widget: Últimos Resultados */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-black uppercase text-slate-350 tracking-wider">Últimos Resultados (T. 2025/2026)</h3>
              {completedMatches.length > 0 && (
                <div className="flex items-center gap-1.5 no-print">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Racha:</span>
                  <div className="flex gap-1">
                    {[...completedMatches].reverse().map((res: any, idx: number) => {
                      const letter = res.match_result === "win" ? "V" : res.match_result === "draw" ? "E" : "D";
                      const colors = res.match_result === "win"
                        ? "bg-emerald-500/20 text-emerald-450 border-emerald-500/40"
                        : res.match_result === "draw"
                        ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                        : "bg-rose-500/20 text-rose-455 border-rose-500/40";
                      return (
                        <span 
                          key={idx}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border ${colors}`}
                          title={`vs ${res.match_opponent}`}
                        >
                          {letter}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {completedMatches.length === 0 ? (
                <div className="text-center py-6 text-slate-500 italic text-xs">
                  No hay partidos disputados registrados en la temporada 2025/2026.
                </div>
              ) : (
                completedMatches.map((res: any, idx: number) => {
                  const resultType = res.match_result === "win" ? "win" : res.match_result === "draw" ? "draw" : "lose";
                  const colorClass = resultType === "win" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : resultType === "draw" 
                    ? "bg-slate-500/10 text-slate-400 border-slate-500/20" 
                    : "bg-rose-500/10 text-rose-455 border-rose-500/20";
                  
                  const label = resultType === "win" ? "V" : resultType === "draw" ? "E" : "D";

                  return (
                    <div key={res.id || idx} className="flex items-center justify-between p-3 bg-white/2 hover:bg-white/4 border border-white/5 rounded-2xl transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-lg border ${colorClass}`}>
                          {label}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">vs {res.match_opponent || "Rival"}</span>
                          <span className="text-[9px] text-slate-500">
                            {res.match_is_home ? "Local" : "Visitante"} • {new Date(res.date).toLocaleDateString("es-ES")}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-white bg-slate-950/60 px-2.5 py-1 rounded-lg border border-white/5">
                        {res.match_score || "- -"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Injuries & Availability breakdown */}
        <div className="space-y-6">
          
          {/* Widget: Alertas Activas */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Alertas y Notificaciones</h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${alertsList.length > 0 ? "bg-rose-500/20 text-rose-455" : "bg-emerald-500/20 text-emerald-450"}`}>
                {alertsList.length} {alertsList.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {alertsList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic text-[10px]">
                  No hay alertas activas de rendimiento o salud.
                </div>
              ) : (
                alertsList.map((alt, idx) => {
                  const borderClass = alt.severity === "high" 
                    ? "border-rose-500/20 bg-rose-500/5 text-rose-350" 
                    : "border-amber-500/20 bg-amber-500/5 text-amber-350";

                  return (
                    <div key={alt.id || idx} className={`flex items-start gap-2.5 p-3 rounded-2xl border ${borderClass}`}>
                      <span className="text-sm leading-none mt-0.5 shrink-0">{alt.icon}</span>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-[11px] font-bold leading-relaxed">{alt.message}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Widget: Estado de Disponibilidad */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Estado Físico de la Plantilla</h3>
            
            <div className="space-y-3.5 pt-2">
              {/* Disponibles */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Disponibles</span>
                  <span className="text-emerald-455">{availableCount} jugadores</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalPlayers > 0 ? (availableCount/totalPlayers)*100 : 0}%` }}></div>
                </div>
              </div>

              {/* Fatigados */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Fatiga / Sobrecarga</span>
                  <span className="text-amber-450">{fatiguedCount} jugadores</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${totalPlayers > 0 ? (fatiguedCount/totalPlayers)*100 : 0}%` }}></div>
                </div>
              </div>

              {/* Bajas Médicas */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Baja / Recuperación</span>
                  <span className="text-rose-500">{injuredCount + readaptCount} jugadores</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalPlayers > 0 ? ((injuredCount+readaptCount)/totalPlayers)*100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Widget: Enfermería Activa */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Parte Médico</h3>
              <span className="text-[9px] text-slate-500 font-bold uppercase">{injuredList.length} activos</span>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {injuredList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic text-[10px]">
                  No hay bajas médicas registradas en la plantilla.
                </div>
              ) : (
                injuredList.map((p) => {
                  const status = p.active_injury?.status || "active";

                  const statusClass = status === "readaptation" 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20";
                  
                  const statusLabel = status === "readaptation" ? "Readaptación" : "Baja Médica";

                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-2xl">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white">{p.first_name} {p.last_name}</span>
                        <span className="text-[9px] text-slate-500 uppercase font-black">{p.active_injury?.body_part || "No especificada"}</span>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
