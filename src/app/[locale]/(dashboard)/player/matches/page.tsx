"use client";

import React, { useState } from "react";
import { PlayerBottomNav } from "@/components/player/PlayerBottomNav";
import {
  getMockPlayerMatches,
  getMockSeasonStats,
  getMockLeagueStandings,
} from "@/services/playerExperienceService";
import { Trophy, Calendar, Flame, Award, Shield, CheckCircle2 } from "lucide-react";

export default function PlayerMatchesPage() {
  const matches = getMockPlayerMatches();
  const seasonStats = getMockSeasonStats();
  const standings = getMockLeagueStandings();

  const [activeTab, setActiveTab] = useState<"my_matches" | "standings">("my_matches");

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
            Competición & Estadísticas
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
          <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
            Acumulado Temporada 2026/27
          </span>
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
          {matches.map((m) => (
            <div
              key={m.id}
              className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  {m.date} • {m.matchType}
                </span>
                <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  {m.isStarter ? "Titular" : "Suplente"}
                </span>
              </div>

              {/* Scoreboard */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-extrabold text-foreground">SD Almazán</span>
                </div>

                <div className="text-base font-black px-3 py-1 bg-accent rounded-xl border border-border/50">
                  {m.isHome ? `${m.scoreHome} - ${m.scoreAway}` : `${m.scoreAway} - ${m.scoreHome}`}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-foreground">{m.opponentName}</span>
                </div>
              </div>

              {/* Player Contribution Badges */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40 text-xs">
                <span className="bg-accent/60 px-3 py-1 rounded-xl font-bold text-foreground border border-border/40">
                  ⏱️ {m.minutesPlayed} minutos
                </span>

                {m.goals > 0 && (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl font-bold border border-emerald-500/20">
                    ⚽ {m.goals} Goles
                  </span>
                )}

                {m.assists > 0 && (
                  <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-xl font-bold border border-purple-500/20">
                    🅰️ {m.assists} Asistencias
                  </span>
                )}

                {m.yellowCards > 0 && (
                  <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-xl font-bold border border-amber-500/20">
                    🟨 1 Tarjeta Amarilla
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Clasificación */}
      {activeTab === "standings" && (
        <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-lg space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Clasificación Grupo VIII
            </span>
            <span className="text-[11px] text-muted-foreground font-semibold">
              Jornada 14
            </span>
          </div>

          <div className="space-y-1 text-xs">
            {/* Header row */}
            <div className="grid grid-cols-12 font-bold text-muted-foreground px-2 py-1 text-[10px] uppercase">
              <span className="col-span-1">#</span>
              <span className="col-span-6">Equipo</span>
              <span className="col-span-1 text-center">J</span>
              <span className="col-span-2 text-center">G/E/P</span>
              <span className="col-span-2 text-right">Pts</span>
            </div>

            {/* Team Rows */}
            {standings.map((t) => (
              <div
                key={t.position}
                className={`grid grid-cols-12 items-center px-2 py-2.5 rounded-xl transition-all ${
                  t.isCurrentTeam
                    ? "bg-blue-600 text-white font-extrabold shadow-md"
                    : "hover:bg-accent/40 text-foreground"
                }`}
              >
                <span className="col-span-1 font-black">{t.position}</span>
                <span className="col-span-6 font-bold truncate">{t.teamName}</span>
                <span className="col-span-1 text-center font-medium">{t.played}</span>
                <span className="col-span-2 text-center text-[10px]">
                  {t.won}/{t.drawn}/{t.lost}
                </span>
                <span className="col-span-2 text-right font-black">{t.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <PlayerBottomNav />
    </div>
  );
}
