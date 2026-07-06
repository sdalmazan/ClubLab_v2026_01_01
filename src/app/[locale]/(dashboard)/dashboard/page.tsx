import type { Metadata } from "next";
import { getSquadPlayers } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
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
  MapPin
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
      organizations (
        type,
        logo_url,
        settings
      )
    `)
    .eq("user_id", user?.id)
    .single();

  const clubLogoUrl = (orgRole?.organizations as any)?.settings?.club_logo_url || (orgRole?.organizations as any)?.logo_url || "";

  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  const resolvedTeamId = globalTeamId || orgRole?.team_id || "";

  // Fetch real squad players
  const players = await getSquadPlayers(resolvedTeamId || undefined);

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
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Bienvenido a <span className="text-primary">ClubLab</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Panel de control para la gestión deportiva y análisis de la S.D. Almazán.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl text-slate-400">
          <Clock className="h-3 w-3 text-emerald-450" />
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
            <span className="text-3xl font-black text-white">4</span>
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
                <span className="text-xs font-black uppercase text-slate-300 tracking-wider">Próximo Partido Oficial</span>
              </div>
              <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                Jornada 34
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-2 w-28 text-center">
                <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2 shadow-md">
                  {clubLogoUrl ? (
                    <img src={clubLogoUrl} className="h-full w-full object-contain" alt="S.D. Almazán" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 shadow-md">
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-white leading-tight">S.D. Almazán</span>
              </div>

              {/* Match info middle */}
              <div className="flex flex-col items-center text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Tercera Federación (G. 8)</span>
                <div className="text-xl font-black text-white flex items-center gap-2">
                  <span>vs</span>
                </div>
                <span className="bg-slate-950/80 px-3 py-1 rounded-lg border border-white/5 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-primary" />
                  <span>Domingo 5 de Julio, 17:00</span>
                </span>
                <span className="text-[9px] text-slate-455 flex items-center gap-1 pt-1">
                  <MapPin className="h-2.5 w-2.5 text-slate-500" />
                  <span>La Arboleda (Almazán) - Local</span>
                </span>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-2 w-28 text-center">
                <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center p-2.5 shadow-md">
                  <span className="text-2xl font-black text-rose-500">AT</span>
                </div>
                <span className="text-xs font-bold text-white leading-tight">Atlético Tordesillas</span>
              </div>
            </div>
          </div>

          {/* Widget: Últimos Resultados */}
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Últimos Resultados</h3>
            
            <div className="space-y-2">
              {[
                { rival: "Real Ávila", score: "2 - 1", isHome: false, date: "28/06/2026", result: "lose" },
                { rival: "Arandina C.F.", score: "0 - 0", isHome: true, date: "21/06/2026", result: "draw" },
                { rival: "C.D. Bupolsa", score: "1 - 2", isHome: false, date: "14/06/2026", result: "win" },
              ].map((res, idx) => {
                const colorClass = res.result === "win" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : res.result === "draw" 
                  ? "bg-slate-500/10 text-slate-400 border-slate-500/20" 
                  : "bg-rose-500/10 text-rose-455 border-rose-500/20";
                
                const label = res.result === "win" ? "V" : res.result === "draw" ? "E" : "D";

                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/2 hover:bg-white/4 border border-white/5 rounded-2xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center text-[10px] font-black rounded-lg border ${colorClass}`}>
                        {label}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">vs {res.rival}</span>
                        <span className="text-[9px] text-slate-500">{res.isHome ? "Local" : "Visitante"} • {res.date}</span>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-white bg-slate-950/60 px-2.5 py-1 rounded-lg border border-white/5">
                      {res.score}
                    </span>
                  </div>
                );
              })}
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
