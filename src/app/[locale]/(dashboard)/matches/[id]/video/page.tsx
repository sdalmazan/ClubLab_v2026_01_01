import type { Metadata } from "next";
import { getSquadPlayers } from "@/services/players";
import { createClient } from "@/lib/supabase/server";
import { statsAdmin } from "@/lib/supabase/stats-admin";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Video, Film, Trash2, Calendar, MapPin, Award } from "lucide-react";
import { MatchVideoClient } from "./MatchVideoClient";

export const metadata: Metadata = {
  title: "Análisis de Vídeo — ClubLab",
  description: "Herramienta de videoanálisis táctico y cortes de partido",
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function MatchVideoPage({ params }: Props) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  
  // 1. Fetch match info from the statistics database
  const { data: match, error: matchErr } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900 border border-white/5 rounded-3xl text-slate-400 max-w-md mx-auto mt-12 space-y-4 shadow-2xl">
        <div className="text-rose-500 text-3xl">⚠️</div>
        <h2 className="text-sm font-semibold text-white">El partido solicitado no existe o no ha sido encontrado en el registro.</h2>
        <p className="text-xs text-slate-500">Asegúrate de que el identificador del partido es correcto.</p>
        <Link
          href="/matches"
          className="inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/10 transition-colors mt-2"
        >
          Volver a la Lista de Partidos
        </Link>
      </div>
    );
  }

  // 2. Fetch all other matches to allow cross-match rival analysis clipping
  const { data: allMatches } = await statsAdmin
    .from("stat_matches")
    .select("*")
    .order("match_date", { ascending: false });

  // 2b. Fetch match sheet events (acta del partido)
  const { data: matchEvents } = await statsAdmin
    .from("stat_events")
    .select("*")
    .eq("match_id", matchId)
    .order("minute", { ascending: true })
    .order("extra_time", { ascending: true });

  // 3. Retrieve active team context and players
  const { data: { user } } = await supabase.auth.getUser();
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select("team_id")
    .eq("user_id", user?.id)
    .single();

  const cookieStore = await cookies();
  const globalTeamId = cookieStore.get("cl_active_team_id")?.value;
  const resolvedTeamId = globalTeamId || orgRole?.team_id || "";

  // Fetch squad players to allow tagging
  const players = await getSquadPlayers(resolvedTeamId || undefined);

  // Format match title and categories
  const homeName = match.home_team || "Equipo Local";
  const awayName = match.away_team || "Equipo Visitante";
  const isOwnMatch = homeName.includes("Almazán") || awayName.includes("Almazán");

  return (
    <div className="animate-fade-in space-y-6 pb-12 text-slate-100">
      {/* HEADER RAIL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/matches"
            className="h-9 w-9 bg-slate-900 border border-white/5 hover:bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                {match.competition || "Tercera Federación"}
              </span>
              <span className="text-slate-500 text-[10px]">•</span>
              <span className="text-slate-400 text-xs font-semibold">Jornada {match.matchday}</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-0.5">
              <span>{homeName}</span>
              <span className="text-primary font-black px-1.5 py-0.5 rounded bg-slate-900/80 text-sm">
                {match.home_score ?? "-"} - {match.away_score ?? "-"}
              </span>
              <span>{awayName}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3.5 text-xs text-slate-400 bg-slate-900/60 border border-white/5 px-4 py-2.5 rounded-2xl">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{new Date(match.match_date).toLocaleDateString("es-ES")}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate max-w-[120px]">{match.venue || "La Arboleda"}</span>
          </div>
        </div>
      </div>

      {/* VIDEO CLIENT */}
      <MatchVideoClient
        match={match}
        players={players}
        allMatches={allMatches || []}
        matchEvents={matchEvents || []}
      />
    </div>
  );
}
