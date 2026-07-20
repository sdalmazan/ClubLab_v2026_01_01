"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Calendar,
  MapPin,
  Search,
  ChevronRight,
  X,
  ShieldAlert,
  TrendingUp,
  Users,
  Gauge,
  Clock,
  Flame,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { createClient } from "@/lib/supabase/client";

interface Match {
  id: string;
  season: string;
  competition: string;
  matchday: number;
  match_date: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  status: string;
  federation_id: string;
}

export default function MatchesPage() {
  const [mounted, setMounted] = useState(false);
  const [supabase] = useState(() => createClient());
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState("2025/2026");
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(["2026/2027", "2025/2026", "2024/2025"]);
  const [search, setSearch] = useState("");
  const [matchdayFilter, setMatchdayFilter] = useState("all");

  // Tab control: "squad" (Partidos propios) vs "rival" (Análisis de rival)
  const [activeTab, setActiveTab] = useState<"squad" | "rival">("squad");
  const [selectedRival, setSelectedRival] = useState("");

  // Sub-tabs for Rival Analysis Dashboard
  const [scoutingTab, setScoutingTab] = useState<"squad" | "coach" | "dynamics" | "discipline">("squad");

  // Match detail modal states
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<any>(null);
  const [matchDetailLoading, setMatchDetailLoading] = useState(false);
  const [matchEventFilter, setMatchEventFilter] = useState<"all" | "goals" | "cards" | "subs">("all");
  const [modalTab, setModalTab] = useState<"details" | "overrides">("details");

  // Overrides local editing state in modal
  const [overrideQuality, setOverrideQuality] = useState<"good" | "bad">("good");
  const [overrideLocalStaff, setOverrideLocalStaff] = useState({
    coach: "",
    assistant: "",
    physio: "",
    fitness_coach: "",
  });
  const [overrideVisitorStaff, setOverrideVisitorStaff] = useState({
    coach: "",
    assistant: "",
    physio: "",
    fitness_coach: "",
  });
  const [overrideAssists, setOverrideAssists] = useState<Record<string, string>>({});
  const [overrideCards, setOverrideCards] = useState<Record<string, "protesta" | "violencia" | "lance">>({});
  const [overridePlayerPositions, setOverridePlayerPositions] = useState<Record<string, string>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  // Rival analysis metrics state
  const [rivalAnalysis, setRivalAnalysis] = useState<any>(null);
  const [rivalAnalysisLoading, setRivalAnalysisLoading] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch seasons dynamically and determine active season
  useEffect(() => {
    async function loadSeasons() {
      try {
        const { data: seasonsList } = await supabase
          .from("seasons")
          .select("id, name")
          .order("name", { ascending: false });

        if (seasonsList) {
          const names = seasonsList.map(s => s.name);
          const uniqueSeasons = Array.from(
            new Set([...names, "2026/2027", "2025/2026", "2024/2025"])
          ).sort().reverse();
          setAvailableSeasons(uniqueSeasons);

          // Get active season from cookie
          const cookieValue = document.cookie
            .split("; ")
            .find((row) => row.startsWith("cl_active_season_id="))
            ?.split("=")[1];

          if (cookieValue) {
            const matchS = seasonsList.find(s => s.id === cookieValue);
            if (matchS) {
              setSeason(matchS.name);
            }
          }
        }
      } catch (err) {
        console.error("Error loading seasons:", err);
      }
    }
    loadSeasons();
  }, [supabase]);

  // Fetch matches
  useEffect(() => {
    async function loadMatches() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/scouting/matches?season=${encodeURIComponent(season)}&competition=Tercera Federación - Grupo 8`
        );
        if (res.ok) {
          const data = await res.json();
          setMatches(data || []);

          // Default select first rival once loaded
          if (data && data.length > 0) {
            const opponents = getOpponentsList(data);
            if (opponents.length > 0 && !selectedRival) {
              setSelectedRival(opponents[0]);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [season]);

  // Fetch rival analysis metrics
  const fetchRivalAnalysis = async () => {
    if (!selectedRival) return;
    try {
      setRivalAnalysisLoading(true);
      const res = await fetch(
        `/api/scouting/rival-analysis?rivalName=${encodeURIComponent(
          selectedRival
        )}&season=${encodeURIComponent(season)}`
      );
      if (res.ok) {
        const data = await res.json();
        setRivalAnalysis(data);
      } else {
        setRivalAnalysis(null);
      }
    } catch (err) {
      console.error(err);
      setRivalAnalysis(null);
    } finally {
      setRivalAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "rival" && selectedRival) {
      fetchRivalAnalysis();
    }
  }, [selectedRival, season, activeTab]);

  // Sync scrollbars
  useEffect(() => {
    const tableEl = tableContainerRef.current;
    const topScrollEl = topScrollRef.current;
    if (!tableEl || !topScrollEl) return;

    let isSyncing = false;
    const syncTable = () => {
      if (isSyncing) return;
      isSyncing = true;
      topScrollEl.scrollLeft = tableEl.scrollLeft;
      isSyncing = false;
    };
    const syncTop = () => {
      if (isSyncing) return;
      isSyncing = true;
      tableEl.scrollLeft = topScrollEl.scrollLeft;
      isSyncing = false;
    };

    tableEl.addEventListener("scroll", syncTable);
    topScrollEl.addEventListener("scroll", syncTop);
    return () => {
      tableEl.removeEventListener("scroll", syncTable);
      topScrollEl.removeEventListener("scroll", syncTop);
    };
  }, [matches, activeTab, selectedRival]);

  // Resize observer
  useEffect(() => {
    const tableEl = tableContainerRef.current?.querySelector("table");
    if (!tableEl) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableScrollWidth(entry.target.scrollWidth);
      }
    });
    obs.observe(tableEl);
    return () => obs.disconnect();
  }, [matches, activeTab, selectedRival]);

  async function fetchMatchDetail(matchId: string) {
    try {
      setSelectedMatchId(matchId);
      setMatchDetailLoading(true);
      setMatchEventFilter("all");
      setModalTab("details");
      const res = await fetch(`/api/scouting/matches/${matchId}`);
      if (!res.ok) throw new Error("Match details fetch failed");
      const data = await res.json();
      setMatchDetail(data);

      // Initialize overrides local state
      const sc = data.scouting || {};
      setOverrideQuality(sc.overrides?.acta_quality || "good");
      setOverrideLocalStaff({
        coach: sc.local_staff?.coach || "",
        assistant: sc.local_staff?.assistant || "",
        physio: sc.local_staff?.physio || "",
        fitness_coach: sc.local_staff?.fitness_coach || "",
      });
      setOverrideVisitorStaff({
        coach: sc.visitor_staff?.coach || "",
        assistant: sc.visitor_staff?.assistant || "",
        physio: sc.visitor_staff?.physio || "",
        fitness_coach: sc.visitor_staff?.fitness_coach || "",
      });
      setOverrideAssists(sc.overrides?.assistances || {});
      setOverrideCards(sc.overrides?.card_classifications || {});
      setOverridePlayerPositions(sc.overrides?.player_positions || {});
    } catch (err) {
      console.error(err);
    } finally {
      setMatchDetailLoading(false);
    }
  }

  // Open match detail modal on mount if matchId query param is present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mId = params.get("matchId");
      if (mId) {
        fetchMatchDetail(mId);
      }
    }
  }, []);

  const handleSaveOverrides = async () => {
    if (!selectedMatchId) return;
    try {
      setSavingOverrides(true);
      const payload = {
        matchId: selectedMatchId,
        overrides: {
          acta_quality: overrideQuality,
          assistances: overrideAssists,
          card_classifications: overrideCards,
          player_positions: overridePlayerPositions,
        },
        staff: {
          local_staff: overrideLocalStaff,
          visitor_staff: overrideVisitorStaff,
        },
      };

      const res = await fetch("/api/scouting/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Refresh match detail view and metrics
        await fetchMatchDetail(selectedMatchId);
        await fetchRivalAnalysis();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOverrides(false);
    }
  };

  // Force federative match of S.D. Almazán naming
  const displayTeamName = (name: string) => {
    if (name.toLowerCase().includes("almazán") || name.toLowerCase().includes("almazan")) {
      return "S.D. Almazán";
    }
    return name;
  };

  // Helper to extract unique opponents list
  const getOpponentsList = (matchList: Match[] = matches) => {
    const teams = new Set<string>();
    for (const m of matchList) {
      const home = displayTeamName(m.home_team);
      const away = displayTeamName(m.away_team);
      if (home !== "S.D. Almazán") teams.add(home);
      if (away !== "S.D. Almazán") teams.add(away);
    }
    return Array.from(teams).sort();
  };

  const getFilteredMatchEvents = () => {
    if (!matchDetail || !matchDetail.events) return [];
    if (matchEventFilter === "all") return matchDetail.events;
    if (matchEventFilter === "goals")
      return matchDetail.events.filter((e: any) =>
        ["goal", "own_goal", "penalty_goal"].includes(e.event_type)
      );
    if (matchEventFilter === "cards")
      return matchDetail.events.filter((e: any) => e.event_type.includes("card"));
    if (matchEventFilter === "subs")
      return matchDetail.events.filter((e: any) => e.event_type.includes("substitution"));
    return matchDetail.events;
  };

  // Filter matches list based on active tab
  const getMatchesToRender = () => {
    let list = matches;
    if (activeTab === "squad") {
      list = matches.filter(
        (m) =>
          displayTeamName(m.home_team) === "S.D. Almazán" ||
          displayTeamName(m.away_team) === "S.D. Almazán"
      );
    } else if (selectedRival) {
      list = matches.filter(
        (m) =>
          displayTeamName(m.home_team) === selectedRival ||
          displayTeamName(m.away_team) === selectedRival
      );
    }

    return list.filter((m) => {
      const home = displayTeamName(m.home_team).toLowerCase();
      const away = displayTeamName(m.away_team).toLowerCase();
      const term = search.toLowerCase();
      const matchesSearch = home.includes(term) || away.includes(term);
      const matchesJornada = matchdayFilter === "all" || m.matchday.toString() === matchdayFilter;

      return matchesSearch && matchesJornada;
    });
  };

  const calculatedMatches = getMatchesToRender();
  const opponentsList = getOpponentsList();
  const uniqueMatchdays = Array.from(new Set(matches.map((m) => m.matchday))).sort((a, b) => a - b);

  return (
    <div className="animate-fade-in space-y-6 pb-12 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5 shrink-0">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
              Calendario y Scouting
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Historial de encuentros oficiales, actas arbitrales y analítica de rendimiento.
            </p>
          </div>
        </div>

        {/* Season Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Temporada:</span>
          <CustomSelect
            value={season}
            onChange={setSeason}
            options={availableSeasons.map(s => ({ value: s, label: `Temporada ${s}` }))}
            className="w-48"
          />
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-white/5 pb-0.5">
        <button
          onClick={() => {
            setActiveTab("squad");
            setSearch("");
            setMatchdayFilter("all");
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeTab === "squad" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Partidos Propios (S.D. Almazán)
          {activeTab === "squad" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("rival");
            setSearch("");
            setMatchdayFilter("all");
            if (opponentsList.length > 0 && !selectedRival) {
              setSelectedRival(opponentsList[0]);
            }
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeTab === "rival" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Análisis de Rival
          {activeTab === "rival" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* RIVAL ANALYSIS PANEL */}
      {activeTab === "rival" && (
        <div className="space-y-6">
          {/* Rival selector header */}
          <div className="glass p-5 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1 w-full md:max-w-xs">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Seleccionar Rival a Analizar:
              </label>
              <CustomSelect
                value={selectedRival}
                onChange={setSelectedRival}
                options={opponentsList.map((opp) => ({ value: opp, label: opp }))}
                className="w-full"
              />
            </div>

            {rivalAnalysis && (
              <div className="flex gap-6 items-center text-xs">
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PJ</span>
                  <span className="text-lg font-black text-white mt-0.5">{rivalAnalysis.matchesPlayed}</span>
                </div>
                <div className="h-6 w-px bg-white/15" />
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rendimiento</span>
                  <span className="text-lg font-black text-white mt-0.5">{rivalAnalysis.points} Pts</span>
                </div>
                <div className="h-6 w-px bg-white/15" />
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Goles (F-C)</span>
                  <span className="text-lg font-black text-white mt-0.5">
                    {rivalAnalysis.goalsFor} - {rivalAnalysis.goalsAgainst}
                  </span>
                </div>
                <div className="h-6 w-px bg-white/15" />
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Balance</span>
                  <span className={`text-lg font-black mt-0.5 ${rivalAnalysis.wins >= rivalAnalysis.losses ? 'text-emerald-400' : 'text-rose-400'}`}>
                    V: {rivalAnalysis.wins} E: {rivalAnalysis.draws} D: {rivalAnalysis.losses}
                  </span>
                </div>
              </div>
            )}
          </div>

          {rivalAnalysisLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/2 border border-white/5 rounded-3xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-xs text-slate-500 mt-2">Compilando métricas avanzadas e informe ejecutivo...</p>
            </div>
          ) : !rivalAnalysis ? (
            <div className="text-center py-16 bg-white/2 border border-white/5 rounded-3xl text-slate-500 italic text-xs">
              No hay datos analíticos para el rival seleccionado. Abre actas de sus partidos y completa auditorías para generar métricas.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Executive Report column */}
              <div className="lg:col-span-2 glass p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    Resumen Ejecutivo (Informe IA)
                  </h3>
                </div>
                <div className="prose prose-invert max-w-none text-slate-300 text-[11px] leading-relaxed max-h-[500px] overflow-y-auto pr-1 space-y-4 font-medium whitespace-pre-wrap">
                  {rivalAnalysis.executiveReport.split("\n\n").map((para: string, idx: number) => {
                    if (para.startsWith("#")) {
                      return (
                        <h4 key={idx} className="text-xs font-black uppercase text-primary tracking-wider mt-3 mb-1 border-b border-primary/20 pb-1">
                          {para.replace(/#/g, "").trim()}
                        </h4>
                      );
                    }
                    if (para.startsWith("-")) {
                      return (
                        <ul key={idx} className="list-disc pl-4 space-y-1">
                          {para.split("\n").map((li, lidx) => (
                            <li key={lidx}>{li.replace(/^-/, "").trim()}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={idx}>{para}</p>;
                  })}
                </div>
              </div>

              {/* Advanced metrics tabs */}
              <div className="lg:col-span-3 flex flex-col space-y-4">
                {/* Secondary tabs */}
                <div className="flex gap-1 p-0.5 bg-slate-950/80 rounded-xl border border-white/5 w-fit">
                  {[
                    { id: "squad", label: "Plantilla", icon: Users },
                    { id: "coach", label: "Entrenador", icon: UserCheck },
                    { id: "dynamics", label: "Dinámicas", icon: Gauge },
                    { id: "discipline", label: "Disciplina y Ataque", icon: ShieldAlert },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setScoutingTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase rounded-lg cursor-pointer transition-all ${
                          scoutingTab === tab.id
                            ? "bg-primary text-slate-950 shadow-md font-extrabold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-tab contents */}
                <div className="glass p-6 rounded-3xl border border-white/10 shadow-xl flex-1 flex flex-col justify-start">
                  {scoutingTab === "squad" && (
                    <div className="space-y-6">
                      {/* Big KPI Grid */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">IRC (Rotaciones)</span>
                          <div className="text-xl font-black text-primary">{rivalAnalysis.squad.irc}</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">cambios/jornada</span>
                        </div>
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">IJI (Jerarquía)</span>
                          <div className="text-xl font-black text-primary">{rivalAnalysis.squad.iji}%</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">de minutos en top 11</span>
                        </div>
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">RFO (Once Base)</span>
                          <div className="text-xl font-black text-primary">{rivalAnalysis.squad.rfo}%</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">frecuencia del once</span>
                        </div>
                      </div>

                      {/* Stable Pairs */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Estructura y Parejas Habituales
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-950/20 border border-white/5 p-3.5 rounded-xl text-xs space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Centrales</span>
                            {rivalAnalysis.squad.stablePairs.centrales ? (
                              <div>
                                <div className="font-extrabold text-white truncate">
                                  {rivalAnalysis.squad.stablePairs.centrales.players.join(" & ")}
                                </div>
                                <span className="text-[9px] text-slate-455">
                                  Inician: {rivalAnalysis.squad.stablePairs.centrales.startsTogether} partidos ({rivalAnalysis.squad.stablePairs.centrales.percentage}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic block">No se detecta pareja</span>
                            )}
                          </div>

                          <div className="bg-slate-950/20 border border-white/5 p-3.5 rounded-xl text-xs space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Pivotes / Mediocampo</span>
                            {rivalAnalysis.squad.stablePairs.pivotes ? (
                              <div>
                                <div className="font-extrabold text-white truncate">
                                  {rivalAnalysis.squad.stablePairs.pivotes.players.join(" & ")}
                                </div>
                                <span className="text-[9px] text-slate-455">
                                  Inician: {rivalAnalysis.squad.stablePairs.pivotes.startsTogether} partidos ({rivalAnalysis.squad.stablePairs.pivotes.percentage}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic block">No se detecta pareja</span>
                            )}
                          </div>

                          <div className="bg-slate-950/20 border border-white/5 p-3.5 rounded-xl text-xs space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Delanteros</span>
                            {rivalAnalysis.squad.stablePairs.delanteros ? (
                              <div>
                                <div className="font-extrabold text-white truncate">
                                  {rivalAnalysis.squad.stablePairs.delanteros.players.join(" & ")}
                                </div>
                                <span className="text-[9px] text-slate-455">
                                  Inician: {rivalAnalysis.squad.stablePairs.delanteros.startsTogether} partidos ({rivalAnalysis.squad.stablePairs.delanteros.percentage}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic block">No se detecta pareja</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Intocables */}
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Intocables (Jugadores con más carga de minutos)
                        </h4>
                        {rivalAnalysis.squad.intocables.length === 0 ? (
                          <div className="text-[10px] text-slate-500 italic">No hay jugadores con más del 80% de minutos acumulados.</div>
                        ) : (
                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {rivalAnalysis.squad.intocables.map((p: any, idx: number) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold">
                                  <span>{p.name}</span>
                                  <span className="text-primary">{p.minutes} min ({p.percentage}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, p.percentage)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {scoutingTab === "coach" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ventana de Reacción</span>
                          <div className="text-xl font-black text-indigo-400">{rivalAnalysis.coach.reactionWindow}'</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">minuto del 1er cambio</span>
                        </div>
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Uso de Banquillo</span>
                          <div className="text-xl font-black text-indigo-400">{rivalAnalysis.coach.benchUsage} / 5</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">cambios de media</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Technical Staff */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cuerpo Técnico Actual</h4>
                          {rivalAnalysis.coach.staff ? (
                            <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl text-xs space-y-2 text-slate-300 font-bold">
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-500">Entrenador:</span>
                                <span className="text-white">{rivalAnalysis.coach.staff.coach || "—"}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-500">2º Entrenador:</span>
                                <span className="text-white">{rivalAnalysis.coach.staff.assistant || "—"}</span>
                              </div>

                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-500">P. Físico:</span>
                                <span className="text-white">{rivalAnalysis.coach.staff.fitness_coach || "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Fisioterapeuta:</span>
                                <span className="text-white">{rivalAnalysis.coach.staff.physio || "—"}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic bg-slate-950/20 border border-white/5 p-4 rounded-2xl text-center">
                              No hay registros de cuerpo técnico. Configura e importa las actas.
                            </div>
                          )}
                        </div>

                        {/* Frequent Substitutes */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Suplentes Habituales (Revulsivos)</h4>
                          {rivalAnalysis.coach.frequentSubs.length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic bg-slate-950/20 border border-white/5 p-4 rounded-2xl text-center">No hay suplentes registrados.</div>
                          ) : (
                            <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl space-y-2 text-xs">
                              {rivalAnalysis.coach.frequentSubs.map((s: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center">
                                  <span className="font-bold">{s.name}</span>
                                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-black text-[9px]">
                                    {s.count} PARTIDOS
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {scoutingTab === "dynamics" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Resiliencia</span>
                          <div className="text-xl font-black text-emerald-400">{rivalAnalysis.dynamics.resilienceIndex}%</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">pts tras recibir el 1º</span>
                        </div>
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Remontadas</span>
                          <div className="text-xl font-black text-emerald-400">{rivalAnalysis.dynamics.comebacks}</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">de ir perdiendo a ganar</span>
                        </div>
                        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tramo de Caos</span>
                          <div className="text-xl font-black text-rose-400">{rivalAnalysis.dynamics.chaosMinutes}</div>
                          <span className="text-[8px] text-slate-455 block font-semibold">pico de incidencias</span>
                        </div>
                      </div>

                      {/* Time Leading */}
                      <div className="space-y-2 text-xs">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Distribución de Estados en el Marcador (% Minutos)
                        </h4>
                        <div className="w-full h-6 bg-slate-950 border border-white/5 rounded-xl overflow-hidden flex font-black text-[9px] text-center leading-6 select-none shadow-inner">
                          {rivalAnalysis.dynamics.timeLeading.winning > 0 && (
                            <div className="bg-emerald-500 text-slate-950 transition-all" style={{ width: `${rivalAnalysis.dynamics.timeLeading.winning}%` }} title={`Ganando: ${rivalAnalysis.dynamics.timeLeading.winning}%`}>
                              V: {rivalAnalysis.dynamics.timeLeading.winning}%
                            </div>
                          )}
                          {rivalAnalysis.dynamics.timeLeading.drawing > 0 && (
                            <div className="bg-slate-500 text-slate-900 transition-all" style={{ width: `${rivalAnalysis.dynamics.timeLeading.drawing}%` }} title={`Empatando: ${rivalAnalysis.dynamics.timeLeading.drawing}%`}>
                              E: {rivalAnalysis.dynamics.timeLeading.drawing}%
                            </div>
                          )}
                          {rivalAnalysis.dynamics.timeLeading.losing > 0 && (
                            <div className="bg-rose-500 text-white transition-all" style={{ width: `${rivalAnalysis.dynamics.timeLeading.losing}%` }} title={`Perdiendo: ${rivalAnalysis.dynamics.timeLeading.losing}%`}>
                              D: {rivalAnalysis.dynamics.timeLeading.losing}%
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Goal clusters */}
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Distribución de Goles por Intervalo de Tiempo
                        </h4>
                        <div className="grid grid-cols-6 gap-2 text-center text-[10px] font-bold">
                          {["0-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90+'"].map((label, idx) => {
                            const gf = rivalAnalysis.dynamics.goalClusters.scored[idx] || 0;
                            const gc = rivalAnalysis.dynamics.goalClusters.conceded[idx] || 0;

                            return (
                              <div key={idx} className="bg-slate-950/20 border border-white/5 p-2 rounded-xl flex flex-col justify-between space-y-1">
                                <span className="text-slate-500 text-[8px] font-black uppercase tracking-wider">{label}</span>
                                <div className="flex justify-center gap-1.5">
                                  <span className="text-emerald-450" title="Goles a favor">{gf}</span>
                                  <span className="text-slate-600">:</span>
                                  <span className="text-rose-400" title="Goles en contra">{gc}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {scoutingTab === "discipline" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6 items-start">
                        {/* Discipline */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Disciplina y Comportamiento</h4>
                          <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl text-xs space-y-3">
                            <div className="flex justify-between font-bold text-slate-300">
                              <span>Tarjetas 1ª Parte:</span>
                              <span className="text-white">{rivalAnalysis.discipline.cardsFirstHalf}</span>
                            </div>
                            <div className="flex justify-between font-bold text-slate-300">
                              <span>Tarjetas 2ª Parte:</span>
                              <span className="text-white">{rivalAnalysis.discipline.cardsSecondHalf}</span>
                            </div>

                            <div className="h-px bg-white/5 my-2" />

                            <div className="space-y-1.5">
                              <div className="flex justify-between font-black text-[9px] uppercase tracking-wider">
                                <span className="text-slate-500">Ratio de Protestas</span>
                                <span className="text-yellow-450">{rivalAnalysis.discipline.protestRatio}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${rivalAnalysis.discipline.protestRatio}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between font-black text-[9px] uppercase tracking-wider">
                                <span className="text-slate-500">Conducta Violenta</span>
                                <span className="text-rose-455">{rivalAnalysis.discipline.violenceRatio}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${rivalAnalysis.discipline.violenceRatio}%` }} />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between font-black text-[9px] uppercase tracking-wider">
                                <span className="text-slate-500">Lances de Juego / Tácticas</span>
                                <span className="text-slate-450">{rivalAnalysis.discipline.lanceRatio}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${rivalAnalysis.discipline.lanceRatio}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Attack and scoring */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Línea Ofensiva y Goles</h4>
                          <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl text-xs space-y-3">
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Goles por Posición</span>
                              <div className="flex justify-between font-bold text-slate-300">
                                <span>Delanteros:</span>
                                <span className="text-emerald-400">{rivalAnalysis.attack.goalscorerDistribution.forwards}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-300">
                                <span>Mediocampistas:</span>
                                <span className="text-emerald-400">{rivalAnalysis.attack.goalscorerDistribution.midfielders}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-300">
                                <span>Defensores:</span>
                                <span className="text-emerald-400">{rivalAnalysis.attack.goalscorerDistribution.defenders}</span>
                              </div>
                            </div>

                            <div className="h-px bg-white/5 my-2" />

                            <div className="space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Goleador Dependencia</span>
                              {rivalAnalysis.attack.goalDependency.top1 ? (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between font-bold text-slate-300">
                                    <span className="truncate max-w-[120px]">{rivalAnalysis.attack.goalDependency.top1.name} (Top 1):</span>
                                    <span className="text-indigo-400 font-extrabold">
                                      {rivalAnalysis.attack.goalDependency.top1.goals} G ({rivalAnalysis.attack.goalDependency.top1.percentage}%)
                                    </span>
                                  </div>
                                  {rivalAnalysis.attack.goalDependency.top2 && (
                                    <div className="flex justify-between font-bold text-slate-300">
                                      <span>Máximos 2 (Top 2):</span>
                                      <span className="text-indigo-455 font-extrabold">
                                        {rivalAnalysis.attack.goalDependency.top2.percentage}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">Sin goles registrados</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div className="glass p-4 rounded-3xl border border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === "squad" ? "Buscar partidos de S.D. Almazán..." : "Buscar rival o partidos..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl bg-slate-905 border border-white/5 pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-500 animate-transition-all"
          />
        </div>

        {/* Matchday Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">Jornada:</span>
          <CustomSelect
            value={matchdayFilter}
            onChange={setMatchdayFilter}
            options={[
              { value: "all", label: "Todas las jornadas" },
              ...uniqueMatchdays.map((j) => ({ value: j.toString(), label: `Jornada ${j}` })),
            ]}
            className="w-full md:w-44"
          />
        </div>
      </div>

      {/* Matches List / Table Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-500 mt-2">Cargando acta de partidos de la federación...</p>
        </div>
      ) : calculatedMatches.length === 0 ? (
        <div className="text-center py-16 bg-white/2 border border-white/5 rounded-3xl text-slate-500 italic text-xs">
          No se encontraron partidos para los criterios seleccionados.
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/10 overflow-hidden shadow-xl">
          {/* Synced top scrollbar */}
          <div
            ref={topScrollRef}
            className="w-full overflow-x-auto overflow-y-hidden h-2.5 bg-slate-950/20 border-b border-white/5 rounded-t-xl"
          >
            <div style={{ width: `${tableScrollWidth}px`, height: "1px" }}></div>
          </div>

          <div ref={tableContainerRef} className="max-h-[650px] overflow-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/95 backdrop-blur-md text-slate-400 font-bold uppercase tracking-wider select-none sticky top-0 z-10">
                  <th className="px-4 py-3 text-center">Jornada</th>
                  <th className="px-4 py-3 min-w-[150px]">Rival Local</th>
                  <th className="px-4 py-3 text-center">Resultado</th>
                  <th className="px-4 py-3 min-w-[150px]">Rival Visitante</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 min-w-[200px]">Campo / Estadio</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                {calculatedMatches.map((m) => {
                  const isHomeAlmazan = m.home_team.toLowerCase().includes("almazán") || m.home_team.toLowerCase().includes("almazan");
                  const played = m.home_score !== null && m.away_score !== null;

                  return (
                    <tr key={m.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3.5 text-center font-bold text-slate-400">Jornada {m.matchday}</td>
                      <td className={`px-4 py-3.5 font-bold whitespace-nowrap truncate max-w-[180px] ${isHomeAlmazan ? "text-emerald-450" : "text-white"}`}>
                        {displayTeamName(m.home_team)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {played ? (
                          <span className="bg-slate-950/80 text-white font-extrabold px-3 py-1 rounded-xl border border-white/5 text-xs">
                            {m.home_score} - {m.away_score}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">vs</span>
                        )}
                      </td>
                      <td className={`px-4 py-3.5 font-bold whitespace-nowrap truncate max-w-[180px] ${!isHomeAlmazan ? "text-emerald-455" : "text-white"}`}>
                        {displayTeamName(m.away_team)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">{m.match_date || "Por definir"}</td>
                      <td className="px-4 py-3.5 text-slate-400 truncate max-w-[220px]">{m.venue || "—"}</td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => fetchMatchDetail(m.id)}
                            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/25 border border-primary/20 text-[10px] font-black text-primary uppercase rounded-lg cursor-pointer transition-colors"
                          >
                            Ver Acta
                          </button>
                          <Link
                            href={`/matches/${m.id}/video`}
                            className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase rounded-lg transition-colors"
                          >
                            Análisis Vídeo
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MATCH DETAILS AND OVERRIDES MODAL */}
      {mounted && selectedMatchId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border border-white/10 w-full max-w-4xl p-6 bg-slate-900/90 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto space-y-5">
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedMatchId(null);
                setMatchDetail(null);
              }}
              className="absolute top-4 right-4 text-slate-455 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {matchDetailLoading || !matchDetail ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                <p className="text-xs text-slate-500 mt-2">Cargando acta oficial del partido...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Scoreboard Header */}
                <div className="text-center space-y-1.5 border-b border-white/5 pb-4">
                  <div className="text-[10px] text-emerald-450 font-black uppercase tracking-wider">
                    {matchDetail.match.competition} — Jornada {matchDetail.match.matchday}
                  </div>
                  <div className="flex items-center justify-center gap-6">
                    <span className="text-lg font-black text-blue-400">
                      {displayTeamName(matchDetail.match.home_team)}
                    </span>
                    <span className="text-3xl font-black text-emerald-400 bg-slate-950/80 px-4 py-1.5 rounded-2xl border border-white/5">
                      {matchDetail.match.home_score} - {matchDetail.match.away_score}
                    </span>
                    <span className="text-lg font-black text-emerald-455">
                      {displayTeamName(matchDetail.match.away_team)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-455 leading-relaxed">
                    Fecha: {matchDetail.match.match_date || "—"} | Campo: {matchDetail.match.venue || "—"}
                  </div>
                </div>

                {/* Modal main tabs selector */}
                <div className="flex gap-2 border-b border-white/5 pb-0.5">
                  <button
                    onClick={() => setModalTab("details")}
                    className={`pb-2 px-3 text-[10px] font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
                      modalTab === "details" ? "text-primary" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Acta Oficial
                    {modalTab === "details" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setModalTab("overrides")}
                    className={`pb-2 px-3 text-[10px] font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
                      modalTab === "overrides" ? "text-primary" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Edición y Auditoría (Overrides)
                    {modalTab === "overrides" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                </div>

                {modalTab === "details" ? (
                  /* OFFICIAL REPORT VIEW */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Lineups */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Alineación y Plantillas
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Home team */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-blue-500/20 pb-1">
                            <h4 className="text-xs font-extrabold text-blue-400 truncate">
                              {displayTeamName(matchDetail.match.home_team)}
                            </h4>
                            <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-black">
                              LOCAL
                            </span>
                          </div>
                          <div className="space-y-1 text-[9px] max-h-[500px] overflow-y-auto pr-1">
                            {matchDetail.lineups
                              .filter((l: any) => l.team_name === matchDetail.match.home_team)
                              .map((l: any) => {
                                const manualPos = overridePlayerPositions[l.player_name];
                                const cardClass = l.is_starter
                                  ? "bg-blue-500/15 border border-blue-500/25 text-blue-100 font-bold"
                                  : "bg-blue-950/20 border border-blue-500/5 text-blue-450/70 opacity-75";
                                return (
                                  <div
                                    key={l.id}
                                    className={`flex justify-between items-center py-1 px-1.5 rounded transition-all ${cardClass}`}
                                  >
                                    <span>
                                      {l.shirt_number ? `${l.shirt_number}. ` : ""}
                                      {l.player_name}
                                    </span>
                                    <span className="text-[8px] font-black text-blue-500 uppercase flex gap-1 items-center">
                                      {manualPos && <span className="bg-primary/20 text-primary border border-primary/20 px-1 py-0.2 rounded text-[7px]">{manualPos}</span>}
                                      {l.is_starter ? "TIT" : "SUPL"}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Away team */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                            <h4 className="text-xs font-extrabold text-emerald-455 truncate">
                              {displayTeamName(matchDetail.match.away_team)}
                            </h4>
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-455 border border-emerald-500/20 px-1 py-0.5 rounded font-black">
                              VISITANTE
                            </span>
                          </div>
                          <div className="space-y-1 text-[9px] max-h-[500px] overflow-y-auto pr-1">
                            {matchDetail.lineups
                              .filter((l: any) => l.team_name === matchDetail.match.away_team)
                              .map((l: any) => {
                                const manualPos = overridePlayerPositions[l.player_name];
                                const cardClass = l.is_starter
                                  ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-100 font-bold"
                                  : "bg-emerald-950/20 border border-emerald-500/5 text-emerald-455/75 opacity-75";
                                return (
                                  <div
                                    key={l.id}
                                    className={`flex justify-between items-center py-1 px-1.5 rounded transition-all ${cardClass}`}
                                  >
                                    <span>
                                      {l.shirt_number ? `${l.shirt_number}. ` : ""}
                                      {l.player_name}
                                    </span>
                                    <span className="text-[8px] font-black text-emerald-500 uppercase flex gap-1 items-center">
                                      {manualPos && <span className="bg-primary/20 text-primary border border-primary/20 px-1 py-0.2 rounded text-[7px]">{manualPos}</span>}
                                      {l.is_starter ? "TIT" : "SUPL"}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Events Timeline */}
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Incidencias y Cronología
                        </h3>

                        {/* Sub-tab event filter */}
                        <div className="flex gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-white/5 w-fit">
                          {[
                            { id: "all", label: "Todo" },
                            { id: "goals", label: "Goles" },
                            { id: "cards", label: "Tarjetas" },
                            { id: "subs", label: "Cambios" },
                          ].map((btn) => (
                            <button
                              key={btn.id}
                              onClick={() => setMatchEventFilter(btn.id as any)}
                              className={`px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer transition-all ${
                                matchEventFilter === btn.id
                                  ? "bg-emerald-500 text-white shadow-sm"
                                  : "text-slate-400 hover:text-white"
                              }`}
                            >
                                {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {getFilteredMatchEvents().length === 0 ? (
                        <div className="text-center py-10 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
                          No hay incidencias reportadas en esta categoría.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                          {getFilteredMatchEvents().map((e: any, idx: number) => {
                            const isGoal = ["goal", "own_goal", "penalty_goal"].includes(e.event_type);
                            const isSub = e.event_type.includes("substitution");
                            const isHomeTeam = e.team_name === matchDetail.match.home_team;
                            const teamBorderColor = isHomeTeam
                              ? "border-blue-500/20 bg-blue-500/5 text-blue-300"
                              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-355";
                            const isOwnGoal = e.event_type === "own_goal";
                            const isPenalty = e.event_type === "penalty_goal";

                            // Comprobar clasificación de tarjetas
                            const cardKey = `${e.player_name}-${e.minute}`;
                            const cardCls = overrideCards[cardKey] || overrideCards[e.player_name];

                            // Buscar si tiene asistencia registrada
                            const assist = overrideAssists[e.id || `${e.player_name}-${e.minute}`];

                            return (
                              <div
                                key={idx}
                                className={`flex items-center gap-2 p-1.5 px-2.5 rounded-lg border transition-colors ${teamBorderColor}`}
                              >
                                <span
                                  className={`font-extrabold bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] shrink-0 ${
                                    isHomeTeam ? "text-blue-400" : "text-emerald-455"
                                  }`}
                                >
                                  {e.minute}
                                  {e.extra_time ? `+${e.extra_time}` : ""}'
                                </span>

                                {isGoal && (
                                  <span
                                    className={
                                      isOwnGoal
                                        ? "text-rose-500 text-xs filter drop-shadow-[0_0_3px_rgba(244,63,94,0.6)] font-bold shrink-0"
                                        : "text-emerald-400 text-xs filter drop-shadow-[0_0_3px_rgba(16,185,129,0.6)] font-bold shrink-0"
                                    }
                                    title={isOwnGoal ? "Autogol" : isPenalty ? "Gol de Penalti" : "Gol"}
                                  >
                                    ⚽
                                  </span>
                                )}
                                {e.event_type === "yellow_card" && (
                                  <span
                                    className="w-2 h-3 rounded-xs inline-block shadow-sm border shrink-0"
                                    style={{ backgroundColor: "#eab308", borderColor: "#ca8a04" }}
                                    title="Tarjeta Amarilla"
                                  />
                                )}
                                {e.event_type === "red_card" && (
                                  <span
                                    className="w-2 h-3 rounded-xs inline-block shadow-sm border shrink-0"
                                    style={{ backgroundColor: "#e11d48", borderColor: "#be123c" }}
                                    title="Tarjeta Roja"
                                  />
                                )}
                                {e.event_type === "yellow_red_card" && (
                                  <span
                                    className="w-2 h-3 rounded-xs inline-block shadow-sm border shrink-0"
                                    style={{ backgroundColor: "#f97316", borderColor: "#ea580c" }}
                                    title="Doble Amarilla"
                                  />
                                )}
                                {isSub && (
                                  <span
                                    className="text-sky-400 text-xs filter drop-shadow-[0_0_3px_rgba(56,189,248,0.6)] shrink-0"
                                    title="Sustitución"
                                  >
                                    🔄
                                  </span>
                                )}

                                <div className="flex-1 leading-tight flex items-center gap-1.5 overflow-hidden text-[10px]">
                                  <span
                                    className={`text-[7px] font-black uppercase px-1 py-0.2 rounded shrink-0 ${
                                      isHomeTeam
                                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                    }`}
                                  >
                                    {isHomeTeam ? "L" : "V"}
                                  </span>
                                  <div className="truncate">
                                    <strong className="text-white font-bold">{e.player_name}</strong>
                                    <span className="text-[8px] text-slate-500">
                                      {" "}
                                      ({displayTeamName(e.team_name)})
                                    </span>
                                    {e.detail && (
                                      <span className="text-slate-455 block text-[8px] font-bold mt-0.2">
                                        {e.detail}
                                      </span>
                                    )}
                                    {cardCls && (
                                      <span className="text-[7px] uppercase tracking-wider font-extrabold bg-primary/10 border border-primary/20 text-primary px-1 py-0.2 rounded mt-0.2 inline-block">
                                        Motivo: {cardCls}
                                      </span>
                                    )}
                                    {assist && (
                                      <span className="text-[7px] uppercase tracking-wider font-extrabold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1 py-0.2 rounded mt-0.2 inline-block">
                                        Asistencia: {assist}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {isGoal && e.score_home_after !== null && (
                                  <span className="text-[9px] font-black text-slate-355 ml-auto bg-slate-950/80 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                                    {e.score_home_after} - {e.score_away_after}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* EDIT AND OVERRIDES (AUDIT) TAB */
                  <div className="space-y-6">
                    {/* Quality control checkbox */}
                    <div className="glass p-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-md">
                      <div className="flex gap-2 items-center">
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
                        <div>
                          <h4 className="text-xs font-black uppercase text-white tracking-wider">
                            Calidad del Acta Arbitral
                          </h4>
                          <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                            Si los datos del acta oficial son deficientes o ilegibles, márcalo aquí.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { id: "good", label: "Buena Calidad", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                          { id: "bad", label: "Deficiente / Ilegible", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => setOverrideQuality(btn.id as any)}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border cursor-pointer transition-all ${
                              overrideQuality === btn.id
                                ? btn.id === "good"
                                  ? "bg-emerald-500 text-slate-950 border-emerald-500 font-extrabold"
                                  : "bg-rose-500 text-white border-rose-500 font-extrabold"
                                : "text-slate-400 hover:text-white border-white/5 hover:bg-white/5"
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Coaching staff fields */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Edición de Cuerpo Técnico
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Local Staff */}
                          <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl space-y-3">
                            <h5 className="text-[10px] font-bold text-blue-400 uppercase border-b border-white/5 pb-1">
                              Staff Local ({displayTeamName(matchDetail.match.home_team)})
                            </h5>
                            <div className="space-y-2 text-[10px] font-bold">
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Entrenador:</label>
                                <input
                                  type="text"
                                  value={overrideLocalStaff.coach}
                                  onChange={(e) =>
                                    setOverrideLocalStaff({ ...overrideLocalStaff, coach: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">2º Entrenador:</label>
                                <input
                                  type="text"
                                  value={overrideLocalStaff.assistant}
                                  onChange={(e) =>
                                    setOverrideLocalStaff({ ...overrideLocalStaff, assistant: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>

                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Preparador Físico:</label>
                                <input
                                  type="text"
                                  value={overrideLocalStaff.fitness_coach}
                                  onChange={(e) =>
                                    setOverrideLocalStaff({ ...overrideLocalStaff, fitness_coach: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Fisioterapeuta:</label>
                                <input
                                  type="text"
                                  value={overrideLocalStaff.physio}
                                  onChange={(e) =>
                                    setOverrideLocalStaff({ ...overrideLocalStaff, physio: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Visitor Staff */}
                          <div className="bg-slate-950/20 border border-white/5 p-4 rounded-2xl space-y-3">
                            <h5 className="text-[10px] font-bold text-emerald-455 uppercase border-b border-white/5 pb-1">
                              Staff Visitante ({displayTeamName(matchDetail.match.away_team)})
                            </h5>
                            <div className="space-y-2 text-[10px] font-bold">
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Entrenador:</label>
                                <input
                                  type="text"
                                  value={overrideVisitorStaff.coach}
                                  onChange={(e) =>
                                    setOverrideVisitorStaff({ ...overrideVisitorStaff, coach: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">2º Entrenador:</label>
                                <input
                                  type="text"
                                  value={overrideVisitorStaff.assistant}
                                  onChange={(e) =>
                                    setOverrideVisitorStaff({ ...overrideVisitorStaff, assistant: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>

                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Preparador Físico:</label>
                                <input
                                  type="text"
                                  value={overrideVisitorStaff.fitness_coach}
                                  onChange={(e) =>
                                    setOverrideVisitorStaff({ ...overrideVisitorStaff, fitness_coach: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 uppercase tracking-wider block mb-1">Fisioterapeuta:</label>
                                <input
                                  type="text"
                                  value={overrideVisitorStaff.physio}
                                  onChange={(e) =>
                                    setOverrideVisitorStaff({ ...overrideVisitorStaff, physio: e.target.value })
                                  }
                                  className="w-full bg-slate-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Disciplinary (Cards) & Goals auditing */}
                      <div className="space-y-4">
                        {/* Goal assistance auditor */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Asistentes de Goles (Overrides)
                          </h4>
                          {matchDetail.events.filter((e: any) => ["goal", "penalty_goal"].includes(e.event_type)).length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic bg-slate-950/20 border border-white/5 p-4 rounded-xl text-center">
                              No hay goles registrados en este partido.
                            </div>
                          ) : (
                            <div className="bg-slate-950/20 border border-white/5 p-4 rounded-xl space-y-3 max-h-[180px] overflow-y-auto">
                              {matchDetail.events
                                .filter((e: any) => ["goal", "penalty_goal"].includes(e.event_type))
                                .map((goal: any, gidx: number) => {
                                  const goalKey = goal.id || `${goal.player_name}-${goal.minute}`;
                                  const teammates = matchDetail.lineups.filter(
                                    (l: any) => l.team_name === goal.team_name
                                  );

                                  return (
                                    <div key={gidx} className="flex justify-between items-center text-xs gap-4">
                                      <div className="truncate max-w-[150px]">
                                        <span className="font-extrabold text-white">{goal.player_name}</span>
                                        <span className="text-[9px] text-slate-500 block">Minuto {goal.minute}'</span>
                                      </div>
                                      <CustomSelect
                                        value={overrideAssists[goalKey] || ""}
                                        onChange={(val) => setOverrideAssists({ ...overrideAssists, [goalKey]: val })}
                                        options={[
                                          { value: "", label: "Sin Asistencia (Ninguno)" },
                                          ...teammates.map((t: any) => ({ value: t.player_name, label: t.player_name })),
                                        ]}
                                        className="w-48"
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                        {/* Card classification auditor */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Clasificación de Motivo de Tarjetas (Overrides)
                          </h4>
                          {matchDetail.events.filter((e: any) => e.event_type.includes("card")).length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic bg-slate-950/20 border border-white/5 p-4 rounded-xl text-center">
                              No hay tarjetas amonestadas en este partido.
                            </div>
                          ) : (
                            <div className="bg-slate-950/20 border border-white/5 p-4 rounded-xl space-y-3 max-h-[180px] overflow-y-auto">
                              {matchDetail.events
                                .filter((e: any) => e.event_type.includes("card"))
                                .map((card: any, cidx: number) => {
                                  const cardKey = `${card.player_name}-${card.minute}`;

                                  return (
                                    <div key={cidx} className="flex justify-between items-center text-xs gap-4">
                                      <div className="truncate max-w-[180px]">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-3 rounded-xs inline-block"
                                            style={{
                                              backgroundColor:
                                                card.event_type === "yellow_card"
                                                  ? "#eab308"
                                                  : card.event_type === "red_card"
                                                  ? "#e11d48"
                                                  : "#f97316",
                                            }}
                                          />
                                          <span className="font-extrabold text-white">{card.player_name}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 block pl-3.5">
                                          {card.team_name.includes("Almazán") ? "Local" : "Rival"} • {card.minute}'
                                        </span>
                                      </div>
                                      <CustomSelect
                                        value={overrideCards[cardKey] || ""}
                                        onChange={(val) => setOverrideCards({ ...overrideCards, [cardKey]: val as any })}
                                        options={[
                                          { value: "", label: "Auto-detectado (o por defecto)" },
                                          { value: "lance", label: "Lance de Juego / Táctica" },
                                          { value: "protesta", label: "Protesta al Árbitro" },
                                          { value: "violencia", label: "Violencia sin Lance" },
                                        ]}
                                        className="w-48"
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                        {/* Player manual positions editor */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Ajuste de Posición Manual de Jugadores
                          </h4>
                          <div className="bg-slate-950/20 border border-white/5 p-4 rounded-xl space-y-3 max-h-[220px] overflow-y-auto">
                            {matchDetail.lineups.map((player: any, pidx: number) => (
                              <div key={pidx} className="flex justify-between items-center text-xs gap-4">
                                <span className="font-extrabold text-white truncate max-w-[180px]">
                                  {player.shirt_number ? `${player.shirt_number}. ` : ""}
                                  {player.player_name}
                                  <span className="text-[9px] text-slate-500 block font-normal">
                                    {displayTeamName(player.team_name)}
                                  </span>
                                </span>
                                <CustomSelect
                                  value={overridePlayerPositions[player.player_name] || ""}
                                  onChange={(val) =>
                                    setOverridePlayerPositions({ ...overridePlayerPositions, [player.player_name]: val })
                                  }
                                  options={[
                                    { value: "", label: "Por defecto (Dorsal)" },
                                    { value: "GK", label: "Portero (Goalkeeper)" },
                                    { value: "CB", label: "Defensa / Central" },
                                    { value: "DM", label: "Mediocentro / Pivote" },
                                    { value: "FW", label: "Delantero / Extremo" },
                                  ]}
                                  className="w-48"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Save Action */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                      <button
                        onClick={() => {
                          setSelectedMatchId(null);
                          setMatchDetail(null);
                        }}
                        className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-white cursor-pointer transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveOverrides}
                        disabled={savingOverrides}
                        className="px-5 py-2 bg-primary hover:bg-primary-hover text-slate-950 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Save className="h-4 w-4" />
                        {savingOverrides ? "Guardando..." : "Guardar Cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
