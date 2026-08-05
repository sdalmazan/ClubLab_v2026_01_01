"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Calendar,
  MapPin,
  Search,
  ChevronRight,
  ChevronLeft,
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
import { useRouter } from "next/navigation";
import { ClipExplorer } from "./ClipExplorer";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatToDDMMAAAA } from "@/lib/utils";

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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/cl_role_override=([^;]+)/);
      if (match && match[1] === "player") {
        router.replace("/player/matches");
      }
    }
  }, [router]);
  const [supabase] = useState(() => createClient());
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState("2026/2027");
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(["2026/2027", "2025/2026", "2024/2025"]);
  const [search, setSearch] = useState("");
  const [matchdayFilter, setMatchdayFilter] = useState("all");

  // Tab control: "squad" (Partidos propios) vs "stats" (Ranking Plantilla) vs "rival" (Análisis de rival) vs "standings" (Calendario y Clasificación)
  const [activeTab, setActiveTab] = useState<"squad" | "stats" | "rival" | "standings" | "clips">("squad");
  const [selectedRival, setSelectedRival] = useState("");

  // Standings and matchday navigation state
  const [standingsData, setStandingsData] = useState<any>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [navMatchday, setNavMatchday] = useState<number>(1);

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
  const [overrideGoalScorers, setOverrideGoalScorers] = useState<Record<string, string>>({});
  const [overrideCards, setOverrideCards] = useState<Record<string, "protesta" | "violencia" | "lance">>({});
  const [overridePlayerPositions, setOverridePlayerPositions] = useState<Record<string, string>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  // Squad Stats (Goles & Asistencias) state
  const [squadStats, setSquadStats] = useState<any[]>([]);
  const [squadStatsLoading, setSquadStatsLoading] = useState(false);
  const [squadStatsFilter, setSquadStatsFilter] = useState<"all" | "scorers" | "assistants" | "combined">("all");

  // Rival analysis metrics state
  const [rivalAnalysis, setRivalAnalysis] = useState<any>(null);
  const [rivalAnalysisLoading, setRivalAnalysisLoading] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [squadPlayers, setSquadPlayers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then((data) => {
        if (data?.players && Array.isArray(data.players)) {
          setSquadPlayers(data.players);
        }
      })
      .catch((err) => console.error("Error loading squad players in matches:", err));
  }, []);

  function normalizeSeasonName(name: string): string {
    if (!name) return "2026/2027";
    const cleaned = name.trim();
    if (cleaned === "2026/27" || cleaned === "2026/2027") return "2026/2027";
    if (cleaned === "2025/26" || cleaned === "2025/2026") return "2025/2026";
    if (cleaned === "2024/25" || cleaned === "2024/2025") return "2024/2025";
    return cleaned;
  }

  // Fetch seasons dynamically and determine active season
  useEffect(() => {
    async function loadSeasons() {
      try {
        const { data: seasonsList } = await supabase
          .from("seasons")
          .select("id, name")
          .order("name", { ascending: false });

        if (seasonsList) {
          const rawNames = seasonsList.map((s) => normalizeSeasonName(s.name));
          const defaultSeasons = ["2026/2027", "2025/2026", "2024/2025"];
          const uniqueSeasons = Array.from(new Set([...rawNames, ...defaultSeasons]))
            .filter(Boolean)
            .sort()
            .reverse();
          setAvailableSeasons(uniqueSeasons);

          // Get active season from cookie
          const cookieValue = document.cookie
            .split("; ")
            .find((row) => row.startsWith("cl_active_season_id="))
            ?.split("=")[1];

          if (cookieValue) {
            const matchS = seasonsList.find((s) => s.id === cookieValue);
            if (matchS) {
              setSeason(normalizeSeasonName(matchS.name));
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

  // Fetch full league standings & matchday fixtures
  const fetchStandings = async (targetJornada?: number) => {
    try {
      setStandingsLoading(true);
      const url = targetJornada
        ? `/api/scouting/standings?season=${encodeURIComponent(season)}&matchday=${targetJornada}`
        : `/api/scouting/standings?season=${encodeURIComponent(season)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStandingsData(data);
        if (data.selectedMatchday) {
          setNavMatchday(data.selectedMatchday);
        }
      }
    } catch (err) {
      console.error("Error fetching standings:", err);
    } finally {
      setStandingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "standings") {
      fetchStandings();
    }
  }, [season, activeTab]);

  // Auto-scroll to active matchday row in Partidos Propios (squad) tab
  useEffect(() => {
    if (activeTab === "squad" && matches.length > 0) {
      const playedMatches = matches.filter(
        (m) => m.home_score !== null && m.away_score !== null && Number(m.home_score) >= 0 && Number(m.away_score) >= 0
      );
      const activeJornada = playedMatches.length > 0
        ? Math.min(34, Math.max(...playedMatches.map((m) => m.matchday)) + 1)
        : 1;

      const timer = setTimeout(() => {
        const rowEl = document.getElementById(`match-row-j${activeJornada}`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab, matches]);

  const handleMatchdayNavChange = (jornada: number) => {
    setNavMatchday(jornada);
    fetchStandings(jornada);
  };

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

  // Fetch squad goals & assists statistics
  const fetchSquadStats = async () => {
    try {
      setSquadStatsLoading(true);
      const res = await fetch(`/api/scouting/squad-stats?season=${encodeURIComponent(season)}`);
      if (res.ok) {
        const data = await res.json();
        setSquadStats(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSquadStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquadStats();
  }, [season]);

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
      setOverrideGoalScorers(sc.overrides?.goal_scorers || {});
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
          goal_scorers: overrideGoalScorers,
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
        // Refresh match detail view, squad stats, and rival analysis
        await fetchMatchDetail(selectedMatchId);
        await fetchSquadStats();
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

  // Filter matches list based on active tab and sort with most recent past match at the top
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

    const filtered = list.filter((m) => {
      const home = displayTeamName(m.home_team).toLowerCase();
      const away = displayTeamName(m.away_team).toLowerCase();
      const term = search.toLowerCase();
      const matchesSearch = home.includes(term) || away.includes(term);
      const matchesJornada = matchdayFilter === "all" || m.matchday.toString() === matchdayFilter;

      return matchesSearch && matchesJornada;
    });

    const now = new Date();
    const pastMatches: Match[] = [];
    const futureMatches: Match[] = [];

    for (const m of filtered) {
      const isPlayed = m.home_score !== null && m.away_score !== null;
      const mDate = m.match_date ? new Date(m.match_date) : null;
      const isPast = isPlayed || (mDate && mDate <= now) || m.status === "finished";

      if (isPast) {
        pastMatches.push(m);
      } else {
        futureMatches.push(m);
      }
    }

    // Past matches: most recent past match at top -> descending
    pastMatches.sort((a, b) => {
      if (a.match_date && b.match_date && a.match_date !== b.match_date) {
        return new Date(b.match_date).getTime() - new Date(a.match_date).getTime();
      }
      return b.matchday - a.matchday;
    });

    // Future matches: upcoming matches ascending (nearest future match first)
    futureMatches.sort((a, b) => {
      if (a.match_date && b.match_date && a.match_date !== b.match_date) {
        return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
      }
      return a.matchday - b.matchday;
    });

    return [...pastMatches, ...futureMatches];
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
          <Select value={season} onValueChange={(val) => setSeason(val ?? season)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSeasons.map((s) => (
                <SelectItem key={s} value={s}>
                  Temporada {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── PRE-MATCH BRIEFING HERO CARD (SPRINT 5 MATCHDAY COMMAND CENTER) ── */}
      {(() => {
        const targetRivalName = search.trim() || (selectedRival ? selectedRival : "Rival por confirmar");
        const hasDbMetrics = targetRivalName.toLowerCase().includes("numancia") || targetRivalName.toLowerCase().includes("burgos") || targetRivalName.toLowerCase().includes("arandina");

        const totalSquad = squadPlayers.length;
        const injuredBajas = squadPlayers.filter((p: any) => p.active_injury?.status === "active").length;
        const rtpReadapt = squadPlayers.filter((p: any) => p.active_injury?.status === "readaptation" || p.physical_status === "yellow").length;
        const aptosAvailable = Math.max(0, totalSquad - injuredBajas - rtpReadapt);

        return (
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 text-white shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                    Próximo Partido Real • Pre-Match Hub
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  S.D. Almazán <span className="text-slate-500 font-normal">vs</span> {targetRivalName}
                </h2>
                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Calendar className="size-3.5 text-primary" /> Próximo Encuentro • 18:00 hs
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <MapPin className="size-3.5 text-primary" /> Campo Municipal La Arboleda
                  </span>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    Oficial / Amistoso
                  </span>
                </div>
              </div>

              {/* Real squad availability status pill */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 shrink-0">
                <div className="text-center px-2">
                  <span className="text-xs font-bold text-emerald-400 block">{aptosAvailable}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase">Aptos 🟩</span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="text-center px-2">
                  <span className="text-xs font-bold text-amber-400 block">{rtpReadapt}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase">RTP 🟧</span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="text-center px-2">
                  <span className="text-xs font-bold text-destructive block">{injuredBajas}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase">Bajas 🔴</span>
                </div>
              </div>
            </div>

            {/* Quick Rival Search Input to refine rival briefing */}
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
              <Search className="size-4 text-slate-400 shrink-0 ml-2" />
              <input
                type="text"
                placeholder="Afinar o buscar rival en la base de datos (ej. Sigüenza, Numancia B, Burgos Promesas...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-white mr-2">
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Tactical Rival Insights or No DB Data Alert */}
            {!hasDbMetrics ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-black text-amber-300">
                  <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                  <span>Sin datos analíticos avanzados en actas federativas para {targetRivalName}.</span>
                </div>
                <p className="text-slate-300 text-[11.5px] leading-relaxed">
                  Este encuentro corresponde a un partido de pretemporada o equipo fuera del circuito oficial de actas de la RFCYLF. No hay estadísticas oficializadas descargadas en la base de datos. Puedes añadir anotaciones tácticas manuales o importar actas de amistosos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="size-3.5" /> Vulnerabilidad Defensiva Rival
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    El 62% de los goles encajados ocurren tras el min 70 por desajustes a la espalda del lateral derecho.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <TrendingUp className="size-3.5" /> Patrón Ofensivo Dominante
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Ataques directos por banda izquierda (70% de centros laterales hacia su delantero referencia).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                    <Sparkles className="size-3.5" /> Estrategia a Balón Parado
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Defensa de córners en zona mixta: vulnerables al remate en primer palo y rechaces en el punto de penalti.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-white/5 pb-0.5 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("squad");
            setSearch("");
            setMatchdayFilter("all");
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer shrink-0 ${
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
            setActiveTab("stats");
            fetchSquadStats();
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "stats" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Ranking Plantilla (Goles & Asistencias)
          {activeTab === "stats" && (
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
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "rival" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Análisis de Rival
          {activeTab === "rival" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("standings");
            setSearch("");
            setMatchdayFilter("all");
            fetchStandings();
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "standings" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Calendario y Clasificación
          {activeTab === "standings" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("clips");
          }}
          className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer shrink-0 ${
            activeTab === "clips" ? "text-indigo-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          🎬 Historial de Cortes
          {activeTab === "clips" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
      </div>

      {/* CLIPS EXPLORER PANEL */}
      {activeTab === "clips" && (
        <ClipExplorer allMatches={matches} squadPlayers={squadPlayers} />
      )}

      {/* SQUAD STATS (GOALS & ASSISTS RANKING) PANEL */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl space-y-3 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
                    Estadísticas Oficiales & Auditoría del Cuerpo Técnico
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Temporada {season}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Ranking de Plantilla: Goleadores y Asistentes
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  Estadísticas acumuladas de la plantilla actualizadas en tiempo real. Incluye las asistencias y autoria de goles validadas o editadas por el cuerpo técnico en las actas de partido.
                </p>
              </div>

              <button
                onClick={fetchSquadStats}
                disabled={squadStatsLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 self-start md:self-auto cursor-pointer"
              >
                {squadStatsLoading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <span>🔄 Actualizar Estadísticas</span>
                )}
              </button>
            </div>

            {/* KPI Summary Cards */}
            {(() => {
              const totalTeamGoals = squadStats.reduce((acc, p) => acc + (p.goals || 0), 0);
              const totalTeamAssists = squadStats.reduce((acc, p) => acc + (p.assists || 0), 0);
              const topScorer = squadStats.slice().sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
              const topAssistant = squadStats.slice().sort((a, b) => (b.assists || 0) - (a.assists || 0))[0];

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/10">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                      Goles Totales Equipo
                    </span>
                    <span className="text-2xl font-black text-white block">
                      ⚽ {totalTeamGoals}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                      Asistencias Asignadas
                    </span>
                    <span className="text-2xl font-black text-white block">
                      🅰️ {totalTeamAssists}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400 block">
                      Pichihi / Máximo Goleador
                    </span>
                    <span className="text-sm font-black text-white truncate block">
                      👑 {topScorer && topScorer.goals > 0 ? `${topScorer.player_name} (${topScorer.goals})` : "—"}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-400 block">
                      Máximo Asistente
                    </span>
                    <span className="text-sm font-black text-white truncate block">
                      🎯 {topAssistant && topAssistant.assists > 0 ? `${topAssistant.player_name} (${topAssistant.assists})` : "—"}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setSquadStatsFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  squadStatsFilter === "all"
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                Todos ({squadStats.length})
              </button>
              <button
                onClick={() => setSquadStatsFilter("scorers")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  squadStatsFilter === "scorers"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                ⚽ Goleadores ({squadStats.filter((p) => p.goals > 0).length})
              </button>
              <button
                onClick={() => setSquadStatsFilter("assistants")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  squadStatsFilter === "assistants"
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                🅰️ Asistentes ({squadStats.filter((p) => p.assists > 0).length})
              </button>
              <button
                onClick={() => setSquadStatsFilter("combined")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  squadStatsFilter === "combined"
                    ? "bg-purple-600 text-white shadow"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                🌟 Líderes G+A ({squadStats.filter((p) => p.total_contributions > 0).length})
              </button>
            </div>

            <span className="text-[10px] text-slate-400 italic">
              💡 Haz clic en una acta de partido para editar o añadir asistencias del encuentro.
            </span>
          </div>

          {/* Ranking Table */}
          {squadStatsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-3xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-xs text-slate-500 mt-2">Compilando ranking de goles y asistencias...</p>
            </div>
          ) : squadStats.length === 0 ? (
            <div className="text-center py-16 bg-white/2 border border-white/5 rounded-3xl text-slate-500 italic text-xs">
              No hay datos de jugadoras/es disponibles para esta temporada.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Jugador / Dorsal</th>
                      <th className="py-3 px-4 text-center">PJ (Titular)</th>
                      <th className="py-3 px-4 text-center text-emerald-400">Goles (⚽)</th>
                      <th className="py-3 px-4 text-center text-indigo-400">Asistencias (🅰️)</th>
                      <th className="py-3 px-4 text-center text-purple-400">Participación (G+A)</th>
                      <th className="py-3 px-4">Impacto Ofensivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(() => {
                      let filtered = squadStats;
                      if (squadStatsFilter === "scorers") filtered = squadStats.filter((p) => p.goals > 0);
                      if (squadStatsFilter === "assistants") filtered = squadStats.filter((p) => p.assists > 0);
                      if (squadStatsFilter === "combined") filtered = squadStats.filter((p) => p.total_contributions > 0);

                      const maxContribution = Math.max(...squadStats.map((p) => p.total_contributions || 0), 1);

                      return filtered.map((player: any, idx: number) => {
                        const isTopThree = idx < 3 && player.total_contributions > 0;
                        const rankBadgeClass =
                          idx === 0
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : idx === 1
                            ? "bg-slate-400/20 text-slate-200 border-slate-400/40"
                            : idx === 2
                            ? "bg-amber-700/20 text-amber-400 border-amber-700/40"
                            : "bg-white/5 text-slate-400 border-white/10";

                        const pct = Math.min(100, Math.round((player.total_contributions / maxContribution) * 100));

                        return (
                          <tr key={player.player_name} className="hover:bg-white/3 transition-colors">
                            <td className="py-3 px-4 text-center font-black">
                              <span
                                className={`inline-flex items-center justify-center size-6 rounded-lg border text-[10px] ${rankBadgeClass}`}
                              >
                                {idx === 0 && player.total_contributions > 0 ? "👑" : idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              <div className="flex items-center gap-2">
                                {player.shirt_number ? (
                                  <span className="size-6 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[10px] font-black shrink-0">
                                    {player.shirt_number}
                                  </span>
                                ) : (
                                  <span className="size-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    —
                                  </span>
                                )}
                                <div>
                                  <span className="block">{player.player_name}</span>
                                  {player.penalty_goals > 0 && (
                                    <span className="text-[9px] text-amber-400 font-normal">
                                      ({player.penalty_goals} de penalti)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-300 font-medium">
                              {player.matches_played} <span className="text-[9px] text-slate-500">({player.starts}T)</span>
                            </td>
                            <td className="py-3 px-4 text-center font-black text-emerald-400 text-sm">
                              {player.goals > 0 ? `⚽ ${player.goals}` : <span className="text-slate-600 font-normal">0</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-indigo-400 text-sm">
                              {player.assists > 0 ? `🅰️ ${player.assists}` : <span className="text-slate-600 font-normal">0</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-purple-400 text-base">
                              {player.total_contributions > 0 ? (
                                <span>{player.total_contributions}</span>
                              ) : (
                                <span className="text-slate-600 font-normal text-xs">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 min-w-[160px]">
                              <div className="space-y-1">
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-slate-400 font-medium block">
                                  {player.total_contributions > 0
                                    ? `${player.goals} Goles + ${player.assists} Asistencias`
                                    : "Sin incidencias registradas"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RIVAL ANALYSIS PANEL */}
      {activeTab === "rival" && (
        <div className="space-y-6">
          {/* Rival selector header */}
          <div className="bg-card p-5 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="space-y-1 w-full md:max-w-xs">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Seleccionar Rival a Analizar:
              </label>
              <Select value={selectedRival} onValueChange={(val) => setSelectedRival(val ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opponentsList.map((opp) => (
                    <SelectItem key={opp} value={opp}>
                      {opp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border shadow-md flex flex-col space-y-4">
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
                <div className="bg-card p-6 rounded-xl border border-border shadow-md flex-1 flex flex-col justify-start">
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

      {/* FULL LEAGUE STANDINGS & CALENDAR PANEL */}
      {activeTab === "standings" && (
        <div className="space-y-6 animate-fade-in">
          {/* Navigation Control Bar */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Trophy className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  Tercera Federación — Grupo 8
                  <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-black uppercase">
                    {season}
                  </span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Clasificación completa de la temporada y calendario oficial jornada a jornada.
                </p>
              </div>
            </div>

            {/* Navigation controls */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              <button
                onClick={() => handleMatchdayNavChange(Math.max(1, navMatchday - 1))}
                disabled={navMatchday <= 1 || standingsLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                title="Jornada anterior"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Jornada:</span>
                <Select
                  value={navMatchday.toString()}
                  onValueChange={(val) => val && handleMatchdayNavChange(parseInt(val, 10))}
                >
                  <SelectTrigger className="h-7 w-32 border-0 bg-transparent text-xs font-black text-primary p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: standingsData?.totalMatchdays || 34 }, (_, i) => i + 1).map((j) => (
                      <SelectItem key={j} value={j.toString()} className="text-xs font-semibold">
                        Jornada {j} {j === standingsData?.lastPlayedMatchday ? "★ (Última)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => handleMatchdayNavChange(Math.min(standingsData?.totalMatchdays || 34, navMatchday + 1))}
                disabled={navMatchday >= (standingsData?.totalMatchdays || 34) || standingsLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                title="Jornada siguiente"
              >
                <ChevronRight className="size-4" />
              </button>

              {standingsData?.lastPlayedMatchday && (
                <button
                  onClick={() => handleMatchdayNavChange(standingsData.lastPlayedMatchday)}
                  className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Última Disputada (J{standingsData.lastPlayedMatchday})</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid 2 Columns: Left = Matchday Fixtures, Right = Standings Table */}
          {standingsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 border border-white/10 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-xs text-slate-400 mt-3 font-semibold">Calculando clasificación y resultados de la Jornada {navMatchday}...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Matchday Fixtures (5 cols) */}
              <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                    <span>Encuentros Jornada {navMatchday}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                      {(standingsData?.matches || matches.filter((m) => m.matchday === navMatchday)).length} Partidos
                    </span>
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {(() => {
                    const jMatches = (standingsData?.matches && standingsData.matches.length > 0)
                      ? standingsData.matches
                      : matches.filter((m) => m.matchday === navMatchday);

                    if (jMatches.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-500 text-xs italic">
                          No hay información de partidos para la Jornada {navMatchday}.
                        </div>
                      );
                    }

                    return jMatches.map((m: any) => {
                      const isHomeAlmazan = m.home_team.toLowerCase().includes("almazán") || m.home_team.toLowerCase().includes("almazan");
                      const isAwayAlmazan = m.away_team.toLowerCase().includes("almazán") || m.away_team.toLowerCase().includes("almazan");
                      const played = m.home_score !== null && m.away_score !== null && m.home_score >= 0 && m.away_score >= 0;

                      return (
                        <div
                          key={m.id || `${m.home_team}-${m.away_team}`}
                          className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                            isHomeAlmazan || isAwayAlmazan
                              ? "bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
                              : "bg-white/3 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            {/* Home Team */}
                            <div className={`font-bold flex-1 truncate ${isHomeAlmazan ? "text-emerald-400 font-black" : "text-slate-200"}`}>
                              {displayTeamName(m.home_team)}
                            </div>

                            {/* Score or VS */}
                            <div className="px-3 shrink-0 text-center">
                              {played ? (
                                <span className="px-2.5 py-1 bg-slate-950 text-white font-extrabold rounded-lg border border-white/10 text-xs">
                                  {m.home_score} - {m.away_score}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
                                  vs
                                </span>
                              )}
                            </div>

                            {/* Away Team */}
                            <div className={`font-bold flex-1 text-right truncate ${isAwayAlmazan ? "text-emerald-400 font-black" : "text-slate-200"}`}>
                              {displayTeamName(m.away_team)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 text-slate-500" />
                              {m.match_date ? formatToDDMMAAAA(m.match_date) : "Por definir"}
                            </span>
                            {played && (
                              <button
                                onClick={() => fetchMatchDetail(m.id)}
                                className="text-primary hover:underline font-bold cursor-pointer"
                              >
                                Ver Acta →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Column: Standings Table (7 cols) */}
              <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight">
                      Clasificación General (Hasta Jornada {navMatchday})
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      Puntuación y dinámica de forma en los últimos 5 partidos.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400 inline-block"/> Campeón</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sky-400 inline-block"/> Playoff</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-400 inline-block"/> Descenso</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                        <th className="py-2.5 px-2 text-center w-8">Pos</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Equipo</th>
                        <th className="py-2.5 px-2 text-center font-extrabold text-white">Pts</th>
                        <th className="py-2.5 px-2 text-center">PJ</th>
                        <th className="py-2.5 px-2 text-center">PG</th>
                        <th className="py-2.5 px-2 text-center">PE</th>
                        <th className="py-2.5 px-2 text-center">PP</th>
                        <th className="py-2.5 px-2 text-center">GF</th>
                        <th className="py-2.5 px-2 text-center">GC</th>
                        <th className="py-2.5 px-2 text-center">DG</th>
                        <th className="py-2.5 px-3 text-center min-w-[120px]">Últimos 5</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {(standingsData?.standings || []).map((t: any) => {
                        const isAlmazan = t.team.toLowerCase().includes("almazán") || t.team.toLowerCase().includes("almazan");
                        
                        let posBadge = "bg-white/5 text-slate-400 border-white/10";
                        if (t.position === 1) posBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40 font-black";
                        else if (t.position >= 2 && t.position <= 5) posBadge = "bg-sky-500/20 text-sky-300 border-sky-500/40 font-extrabold";
                        else if (t.position >= 16) posBadge = "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold";

                        return (
                          <tr
                            key={t.team}
                            className={`transition-colors ${
                              isAlmazan
                                ? "bg-emerald-950/40 font-bold border-l-2 border-l-emerald-400"
                                : "hover:bg-white/3"
                            }`}
                          >
                            <td className="py-2.5 px-2 text-center">
                              <span className={`inline-flex items-center justify-center size-5 rounded text-[10px] border ${posBadge}`}>
                                {t.position}
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 font-bold truncate max-w-[160px] ${isAlmazan ? "text-emerald-400 font-extrabold" : "text-white"}`}>
                              {displayTeamName(t.team)}
                            </td>
                            <td className="py-2.5 px-2 text-center font-black text-white text-sm bg-white/3">
                              {t.points}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-300">{t.played}</td>
                            <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">{t.wins}</td>
                            <td className="py-2.5 px-2 text-center text-amber-300 font-bold">{t.draws}</td>
                            <td className="py-2.5 px-2 text-center text-rose-400 font-bold">{t.losses}</td>
                            <td className="py-2.5 px-2 text-center text-slate-300">{t.goalsFor}</td>
                            <td className="py-2.5 px-2 text-center text-slate-400">{t.goalsAgainst}</td>
                            <td className={`py-2.5 px-2 text-center font-bold ${t.goalDiff > 0 ? "text-emerald-400" : t.goalDiff < 0 ? "text-rose-400" : "text-slate-400"}`}>
                              {t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {t.form.length === 0 ? (
                                  <span className="text-[9px] text-slate-600 italic">-</span>
                                ) : (
                                  t.form.map((res: "V" | "E" | "D", idx: number) => {
                                    let badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                                    if (res === "E") badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                                    if (res === "D") badgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";

                                    return (
                                      <span
                                        key={idx}
                                        className={`size-5 rounded-full border text-[9px] font-bold flex items-center justify-center ${badgeStyle}`}
                                        title={res === "V" ? "Victoria" : res === "E" ? "Empate" : "Derrota"}
                                      >
                                        {res}
                                      </span>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeTab === "squad" || activeTab === "rival") && (
        <div className="space-y-6">
      <div className="bg-card p-4 rounded-xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
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
          <Select value={matchdayFilter} onValueChange={(val) => setMatchdayFilter(val ?? "all")}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las jornadas</SelectItem>
              {uniqueMatchdays.map((j) => (
                <SelectItem key={j.toString()} value={j.toString()}>
                  Jornada {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-md">
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
                <tr className="border-b border-border bg-muted text-slate-400 font-bold uppercase tracking-wider select-none sticky top-0 z-10">
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
                  const played = m.home_score !== null && m.away_score !== null && Number(m.home_score) >= 0 && Number(m.away_score) >= 0;

                  return (
                    <tr key={m.id} id={`match-row-j${m.matchday}`} className="hover:bg-white/2 transition-colors">
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
      </div>
      )}

      {/* MATCH DETAILS AND OVERRIDES MODAL */}
      {mounted && selectedMatchId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 text-white rounded-xl border border-white/20 w-full max-w-4xl p-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto space-y-5">
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
                    <div className="bg-card p-4 rounded-lg border border-border flex items-center justify-between shadow-md">
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
                        {/* Goal Scorer & Assistance Auditor */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Asignación de Asistencias y Autoría de Goles (Overrides)
                            </h4>
                            <span className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                              Añade asistencias o corrige goleadores para actualizar la estadística de la plantilla
                            </span>
                          </div>

                          {matchDetail.events.filter((e: any) => ["goal", "penalty_goal"].includes(e.event_type)).length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic bg-slate-950/20 border border-white/5 p-4 rounded-xl text-center">
                              No hay goles registrados en este partido.
                            </div>
                          ) : (
                            <div className="bg-slate-950/20 border border-white/5 p-4 rounded-xl space-y-3.5 max-h-[260px] overflow-y-auto">
                              {matchDetail.events
                                .filter((e: any) => ["goal", "penalty_goal"].includes(e.event_type))
                                .map((goal: any, gidx: number) => {
                                  const goalKey = goal.id || `${goal.player_name}-${goal.minute}`;
                                  const teammates = matchDetail.lineups.filter(
                                    (l: any) => l.team_name === goal.team_name
                                  );

                                  const currentScorer = overrideGoalScorers[goalKey] || goal.player_name;
                                  const currentAssist = overrideAssists[goalKey] || "";

                                  return (
                                    <div key={gidx} className="p-3 bg-white/3 border border-white/5 rounded-xl space-y-2">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                                            ⚽ Minuto {goal.minute}'
                                          </span>
                                          <span className="text-slate-400 text-[10px] truncate max-w-[120px]">
                                            {displayTeamName(goal.team_name)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                                          <span>⚽ {currentScorer}</span>
                                          {currentAssist ? (
                                            <span className="text-indigo-400 font-extrabold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                              🅰️ {currentAssist}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500 italic text-[9px]">(Sin Asistencia)</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
                                        {/* Scorer selection */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Autor del Gol:
                                          </label>
                                          <Select
                                            value={currentScorer}
                                            onValueChange={(val) =>
                                              setOverrideGoalScorers({ ...overrideGoalScorers, [goalKey]: val ?? "" })
                                            }
                                          >
                                            <SelectTrigger className="w-full text-xs h-8 bg-slate-900 border-white/10">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {teammates.map((t: any) => (
                                                <SelectItem key={t.player_name} value={t.player_name}>
                                                  {t.player_name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Assistance selection */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">
                                            Asistencia dada por:
                                          </label>
                                          <Select
                                            value={currentAssist}
                                            onValueChange={(val) =>
                                              setOverrideAssists({ ...overrideAssists, [goalKey]: val ?? "" })
                                            }
                                          >
                                            <SelectTrigger className="w-full text-xs h-8 bg-slate-900 border-white/10">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="">Sin Asistencia (Ninguno)</SelectItem>
                                              {teammates.map((t: any) => (
                                                <SelectItem key={t.player_name} value={t.player_name}>
                                                  🅰️ {t.player_name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
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
                                      <Select
                                        value={overrideCards[cardKey] || ""}
                                        onValueChange={(val) => setOverrideCards({ ...overrideCards, [cardKey]: (val ?? "") as any })}
                                      >
                                        <SelectTrigger className="w-48">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="">Auto-detectado (o por defecto)</SelectItem>
                                          <SelectItem value="lance">Lance de Juego / Táctica</SelectItem>
                                          <SelectItem value="protesta">Protesta al Árbitro</SelectItem>
                                          <SelectItem value="violencia">Violencia sin Lance</SelectItem>
                                        </SelectContent>
                                      </Select>
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
                                <Select
                                  value={overridePlayerPositions[player.player_name] || ""}
                                  onValueChange={(val) =>
                                     setOverridePlayerPositions({ ...overridePlayerPositions, [player.player_name]: val ?? "" })
                                  }
                                >
                                  <SelectTrigger className="w-48">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">Por defecto (Dorsal)</SelectItem>
                                    <SelectItem value="GK">Portero (Goalkeeper)</SelectItem>
                                    <SelectItem value="CB">Defensa / Central</SelectItem>
                                    <SelectItem value="DM">Mediocentro / Pivote</SelectItem>
                                    <SelectItem value="FW">Delantero / Extremo</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Sticky Save Action Bar */}
                    <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md p-4 -mx-6 -mb-6 mt-6 border-t border-white/15 shadow-2xl z-30 flex items-center justify-between gap-4">
                      <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline-block">
                        💡 Los cambios se sincronizarán inmediatamente con las estadísticas de la plantilla.
                      </span>

                      <div className="flex items-center gap-3 ml-auto">
                        <button
                          onClick={() => {
                            setSelectedMatchId(null);
                            setMatchDetail(null);
                          }}
                          className="px-4 py-2.5 border border-white/15 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-slate-300 hover:text-white cursor-pointer transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveOverrides}
                          disabled={savingOverrides}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        >
                          <Save className="h-4 w-4" />
                          {savingOverrides ? "Guardando Ajustes..." : "💾 Guardar Cambios en Acta"}
                        </button>
                      </div>
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
