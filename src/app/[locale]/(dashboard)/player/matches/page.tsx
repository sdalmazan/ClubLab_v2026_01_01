"use client";

import React, { useState, useEffect } from "react";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Calendar, Shield, Activity, CalendarDays } from "lucide-react";

export default function PlayerMatchesPage() {
  const [selectedSeason, setSelectedSeason] = useState("2026/27");
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(["2026/27", "2025/26"]);
  const [matches, setMatches] = useState<any[]>([]);
  const [seasonStats, setSeasonStats] = useState({
    matchesPlayed: 0,
    starts: 0,
    totalMinutes: 0,
    totalGoals: 0,
    totalAssists: 0,
    yellowCards: 0,
    redCards: 0,
  });
  const [activeTab, setActiveTab] = useState<"my_matches" | "standings">("my_matches");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatchesData() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Resolve player row
          const { data: player } = await supabase
            .from("players")
            .select("id, organization_id, team_id")
            .or(`user_id.eq.${user.id},email.eq.${user.email}`)
            .maybeSingle();

          const orgId = player?.organization_id;

          // Fetch seasons in org
          const { data: dbSeasons } = await supabase
            .from("seasons")
            .select("name")
            .order("start_date", { ascending: false });

          if (dbSeasons && dbSeasons.length > 0) {
            const seasonNames = Array.from(new Set(dbSeasons.map((s: any) => s.name === "2026/27" ? "2026/27" : s.name)));
            if (!seasonNames.includes("2025/26")) seasonNames.push("2025/26");
            setAvailableSeasons(seasonNames);
          }

          if (orgId) {
            // Fetch real matches for selected season
            const { data: dbMatches } = await supabase
              .from("matches")
              .select("*, match_player_stats(*)")
              .eq("organization_id", orgId)
              .order("date", { ascending: false });

            if (dbMatches && dbMatches.length > 0) {
              setMatches(dbMatches);

              if (player?.id) {
                // Compute real stats for player
                let minutes = 0;
                let goals = 0;
                let assists = 0;
                let yellow = 0;
                let red = 0;
                let starts = 0;

                dbMatches.forEach((m: any) => {
                  const pStat = (m.match_player_stats || []).find((st: any) => st.player_id === player.id);
                  if (pStat) {
                    minutes += pStat.minutes_played || 0;
                    goals += pStat.goals || 0;
                    assists += pStat.assists || 0;
                    yellow += pStat.yellow_cards || 0;
                    red += pStat.red_cards || 0;
                    if (pStat.is_starter) starts++;
                  }
                });

                setSeasonStats({
                  matchesPlayed: dbMatches.length,
                  starts,
                  totalMinutes: minutes,
                  totalGoals: goals,
                  totalAssists: assists,
                  yellowCards: yellow,
                  redCards: red,
                });
              }
            } else {
              setMatches([]);
              setSeasonStats({
                matchesPlayed: 0,
                starts: 0,
                totalMinutes: 0,
                totalGoals: 0,
                totalAssists: 0,
                yellowCards: 0,
                redCards: 0,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error loading player matches:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMatchesData();
  }, [selectedSeason]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
            Competición & Estadísticas Reales
          </span>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Partidos
          </h1>
        </div>
        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
          <Trophy className="w-6 h-6" />
        </div>
      </div>

      {/* Season Totals Cards */}
      <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-card to-card p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-xl focus:outline-none cursor-pointer"
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s} className="bg-slate-900 text-white">
                Temporada {s}
              </option>
            ))}
          </select>
          <span className="text-xs font-bold text-foreground bg-accent px-2.5 py-0.5 rounded-full border border-border/40">
            {seasonStats.matchesPlayed} Partidos
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-accent/40 border border-border/40">
            <span className="text-lg font-black text-blue-500 block">{seasonStats.totalMinutes}'</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Minutos</span>
          </div>

          <div className="p-3 rounded-2xl bg-accent/40 border border-border/40">
            <span className="text-lg font-black text-emerald-500 block">{seasonStats.totalGoals}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Goles</span>
          </div>

          <div className="p-3 rounded-2xl bg-accent/40 border border-border/40">
            <span className="text-lg font-black text-purple-500 block">{seasonStats.totalAssists}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Asist.</span>
          </div>

          <div className="p-3 rounded-2xl bg-accent/40 border border-border/40">
            <span className="text-lg font-black text-amber-500 block">{seasonStats.yellowCards}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Tarjetas</span>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-accent/40 p-1 rounded-2xl border border-border/50">
        <button
          onClick={() => setActiveTab("my_matches")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === "my_matches"
              ? "bg-blue-600 text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mis Partidos
        </button>
        <button
          onClick={() => setActiveTab("standings")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === "standings"
              ? "bg-blue-600 text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Clasificación
        </button>
      </div>

      {/* Tab 1: Mis Partidos */}
      {activeTab === "my_matches" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Cargando partidos de la temporada...
            </div>
          ) : matches.length === 0 ? (
            <div className="p-8 rounded-3xl border border-border/50 bg-card text-center space-y-3 shadow-sm">
              <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-foreground">Sin partidos disputados en {selectedSeason}</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {selectedSeason === "2026/27"
                    ? "Estamos en fase de pretemporada 2026/27. Las estadísticas se actualizarán automáticamente conforme el cuerpo técnico registre las actas oficiales de los partidos."
                    : "No hay actas registradas para esta temporada previa."}
                </p>
              </div>
            </div>
          ) : (
            matches.map((m) => (
              <div
                key={m.id}
                className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {m.date} • {m.competition || "Oficial / Amistoso"}
                  </span>
                  <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    {m.is_starter ? "Titular" : "Convocado"}
                  </span>
                </div>

                {/* Scoreboard */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-extrabold text-foreground">SD Almazán</span>
                  </div>

                  <div className="text-base font-black px-3 py-1 bg-accent rounded-xl border border-border/50">
                    {m.home_score ?? 0} - {m.away_score ?? 0}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-foreground">{m.opponent_name || "Rival"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Clasificación */}
      {activeTab === "standings" && (
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Clasificación Oficial ({selectedSeason})
            </span>
            <span className="text-[11px] text-muted-foreground font-semibold">
              Tercera RFEF
            </span>
          </div>

          <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
            <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="font-bold text-foreground">Fase Pretemporada {selectedSeason}</p>
            <p>La tabla de clasificación oficial se activará con el inicio del campeonato de liga regular.</p>
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
