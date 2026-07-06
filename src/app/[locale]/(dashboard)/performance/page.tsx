"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Search,
  Filter,
  Users,
  Award,
  Calendar,
  Zap,
  Activity,
  ChevronDown,
  ArrowUpDown,
  Lock,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlayerWithMembership {
  id: string;
  first_name: string;
  last_name: string;
  raw_name?: string;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  dominant_foot: string | null;
  physical_status: string;
  availability_status: string;
  membership?: {
    jersey_number: number | null;
    positions: string[];
    teams?: { name: string; id: string } | null;
  };
}

interface ScoutedPlayer {
  player_name: string;
  team_name: string;
  season: string;
  competition: string;
  shirt_number: number | null;
  position: string;
  matches_played: number;
  starts: number;
  minutes_on: number;
  goals_scored: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  net_impact: number;
  net_impact_per_90: number;
  revulsive_impact: number;
  regularity_index: number;
  cards_density: number;
  clean_sheet_ratio: number;
  penalties_scored?: number;
  goals_for_while_on?: number;
  goals_against_while_on?: number;
}

// Translations dictionary to completely map all positions to Spanish
const SPANISH_POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero",
  back: "Defensa",
  midfielder: "Centrocampista",
  winger: "Extremo",
  striker: "Delantero Centro",
  right_back: "Lateral Derecho",
  right_center_back: "Central Derecho",
  left_center_back: "Central Izquierdo",
  left_back: "Lateral Izquierdo",
  defensive_midfielder: "Mediocentro Defensivo",
  playmaker_midfielder: "Mediocentro",
  attacking_midfielder: "Mediapunta",
  left_winger: "Extremo Izquierdo",
  right_winger: "Extremo Derecho",
};

// Equivalent display name mapper for S.D. Almazán
const displayTeamName = (name: string) => {
  if (name === "C.D. Almazán" || name === "CD Almazán") return "S.D. Almazán";
  return name;
};

// Premium Custom Select Dropdown Component
interface CustomSelectProps {
  value: string; // Comma-separated selected values (e.g. "back,midfielder") or single value
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  isMultiSelect?: boolean;
}

function CustomSelect({ value, onChange, options, placeholder, className, isMultiSelect }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValues = isMultiSelect ? (value ? value.split(",") : []) : [value];

  const handleToggle = (val: string) => {
    if (isMultiSelect) {
      let newValues;
      if (selectedValues.includes(val)) {
        newValues = selectedValues.filter(v => v !== val);
      } else {
        newValues = [...selectedValues, val];
      }
      onChange(newValues.join(","));
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const getDisplayLabel = () => {
    if (isMultiSelect) {
      if (selectedValues.length === 0) return placeholder || "Seleccionar...";
      if (selectedValues.length === options.length) return "Todos";
      if (selectedValues.length > 2) return `${selectedValues.length} seleccionados`;
      return options
        .filter(o => selectedValues.includes(o.value))
        .map(o => o.label)
        .join(", ");
    }
    const selectedOpt = options.find(o => o.value === value);
    return selectedOpt?.label || placeholder || "Seleccionar...";
  };

  return (
    <div className={`relative min-w-[150px] ${className || ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900/80 border border-white/10 hover:border-white/20 text-white rounded-xl px-3 py-2 text-xs focus:outline-none flex items-center justify-between backdrop-blur-sm cursor-pointer transition-all shadow-md select-none"
      >
        <span className="truncate">{getDisplayLabel()}</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-full bg-slate-950/95 border border-white/10 rounded-xl py-1 z-20 shadow-2xl backdrop-blur-md max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-155">
            {options.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-500/10 hover:text-emerald-455 cursor-pointer flex items-center justify-between ${
                    isChecked ? "text-emerald-450 font-bold bg-emerald-500/5" : "text-slate-350"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isMultiSelect && (
                    <span className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center text-[8px] ${isChecked ? "bg-emerald-500 border-emerald-500 text-white" : ""}`}>
                      {isChecked && "✓"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Custom Pentagonal SVG Radar Chart Component for Multi-player Comparisons
interface RadarChartProps {
  mainPlayerName: string;
  mainPlayerStats: {
    goals: number;
    netImpact: number;
    regularity: number;
    cleanSheets: number;
    discipline: number;
    minPerGoal?: number;
  };
  comparedPlayers: {
    name: string;
    stats: {
      goals: number;
      netImpact: number;
      regularity: number;
      cleanSheets: number;
      discipline: number;
      minPerGoal?: number;
    };
  }[];
  isDefensive?: boolean;
}

function RadarChart({ mainPlayerName, mainPlayerStats, comparedPlayers, isDefensive = true }: RadarChartProps) {
  const center = 160;
  const radius = 90;
  const pointsCount = 5;
  const angleStep = (2 * Math.PI) / pointsCount;

  const labels = [
    "Ataque (Goles)",
    "Impacto (+/-)",
    "Regularidad %",
    isDefensive ? "Portería Cero %" : "Minutos/Gol",
    "Disciplina (Tarjetas)"
  ];

  const explanations = [
    "Ataque (Goles): Volumen total de goles marcados en la campaña actual.",
    "Impacto (+/-): Balance de goles del equipo a favor y en contra mientras el jugador está en el campo.",
    "Regularidad %: Consistencia de participación y porcentaje de titularidades en los últimos partidos.",
    isDefensive 
      ? "Portería Cero %: Porcentaje de minutos jugados en los que el equipo no ha recibido ningún gol." 
      : "Minutos/Gol: Minutos disputados requeridos para anotar un gol (menor es mejor rendimiento).",
    "Disciplina (Tarjetas): Frecuencia de amonestaciones recibidas por minuto de juego (a menos amonestaciones, mejor puntuación)."
  ];

  const scaleValue = (val: number | undefined | null, type: string) => {
    const safeVal = val ?? 0;
    if (type === "goals") return Math.min(12, safeVal) / 12;
    if (type === "net") return Math.max(0, Math.min(4, safeVal + 2)) / 4;
    if (type === "reg") return Math.min(100, Math.max(0, safeVal)) / 100;
    if (type === "cs") return Math.min(100, Math.max(0, safeVal)) / 100;
    if (type === "minPerGoal") {
      if (!safeVal || safeVal >= 9999) return 0;
      return Math.max(0, Math.min(1, (900 - Math.min(900, safeVal)) / 800));
    }
    const dVal = safeVal === 9999 ? 1000 : safeVal;
    return Math.min(1000, Math.max(100, dVal)) / 1000;
  };

  const getCoordinates = (statsObj: any) => {
    const vals = [
      scaleValue(statsObj.goals, "goals"),
      scaleValue(statsObj.netImpact, "net"),
      scaleValue(statsObj.regularity, "reg"),
      isDefensive ? scaleValue(statsObj.cleanSheets, "cs") : scaleValue(statsObj.minPerGoal, "minPerGoal"),
      scaleValue(statsObj.discipline, "disp"),
    ];
    return vals.map((val, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = val * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      };
    });
  };

  const mainCoords = getCoordinates(mainPlayerStats);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const colors = ["#3b82f6", "#f97316", "#a855f7"];

  return (
    <div className="flex flex-col items-center justify-center p-5 bg-white/2 border border-white/5 rounded-2xl w-full">
      <svg width="320" height="275" viewBox="0 0 320 275" className="overflow-visible">
        {/* Background Grids */}
        {gridLevels.map((level, idx) => {
          const coords = Array.from({ length: pointsCount }).map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = level * radius;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          });
          return (
            <polygon
              key={idx}
              points={coords.join(" ")}
              fill="none"
              stroke="white"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
          );
        })}

        {/* Radial lines and text labels */}
        {Array.from({ length: pointsCount }).map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          
          const labelX = center + (radius + 24) * Math.cos(angle);
          const labelY = center + (radius + 12) * Math.sin(angle);
          
          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="white"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f1f5f9"
                className="text-[9px] font-black uppercase tracking-wider cursor-help hover:fill-emerald-400 transition-colors"
                style={{ fill: "#f1f5f9" }}
              >
                <title>{explanations[i]}</title>
                {labels[i]}
              </text>
            </g>
          );
        })}

        {/* Compared Players Polygons */}
        {comparedPlayers.map((cp, cpIdx) => {
          const coords = getCoordinates(cp.stats);
          const color = colors[cpIdx % colors.length];
          return (
            <polygon
              key={cpIdx}
              points={coords.map(c => `${c.x},${c.y}`).join(" ")}
              fill={color}
              fillOpacity="0.15"
              stroke={color}
              strokeWidth="2"
            />
          );
        })}

        {/* Main Player Polygon - Emerald */}
        <polygon
          points={mainCoords.map(c => `${c.x},${c.y}`).join(" ")}
          fill="#10b981"
          fillOpacity="0.25"
          stroke="#10b981"
          strokeWidth="2.5"
        />

        {/* Center Spot */}
        <circle cx={center} cy={center} r="3" fill="white" fillOpacity="0.3" />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[9px] font-bold text-slate-200 justify-center">
        <div className="flex items-center gap-1 border border-white/5 bg-slate-900/60 px-2 py-0.5 rounded-lg">
          <span className="w-2 h-2 rounded inline-block" style={{ backgroundColor: "#10b981" }} />
          <span className="truncate max-w-[200px]">{mainPlayerName}</span>
        </div>
        {comparedPlayers.map((cp, cpIdx) => {
          const color = colors[cpIdx % colors.length];
          return (
            <div key={cpIdx} className="flex items-center gap-1 border border-white/5 bg-slate-900/60 px-2 py-0.5 rounded-lg">
              <span className="w-2 h-2 rounded inline-block" style={{ backgroundColor: color }} />
              <span className="truncate max-w-[150px]">{cp.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function PerformanceAndStatsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const squadTableContainerRef = useRef<HTMLDivElement>(null);
  const squadTopScrollRef = useRef<HTMLDivElement>(null);
  const [squadTableScrollWidth, setSquadTableScrollWidth] = useState(1200);

  const scoutingTableContainerRef = useRef<HTMLDivElement>(null);
  const scoutingTopScrollRef = useRef<HTMLDivElement>(null);
  const [scoutingTableScrollWidth, setScoutingTableScrollWidth] = useState(1200);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [hasScoutingAccess, setHasScoutingAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"squad" | "scouting" | "competition">("squad");
  const [squadSubView, setSquadSubView] = useState<"general" | "season" | "history">("general");
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Active season state from Supabase
  const [activeSeasonName, setActiveSeasonName] = useState("2026/2027");

  // Squad States
  const [squadPlayers, setSquadPlayers] = useState<PlayerWithMembership[]>([]);
  const [squadStats, setSquadStats] = useState<any[]>([]);
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadSearch, setSquadSearch] = useState("");
  const [squadPosition, setSquadPosition] = useState("all");
  const [squadStatus, setSquadStatus] = useState("all");
  const [squadSeason, setSquadSeason] = useState("2026/2027");
  
  const [squadSortField, setSquadSortField] = useState<string>("last_name");
  const [squadSortOrder, setSquadSortOrder] = useState<"asc" | "desc">("asc");

  // Local/Temporary Scouting filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterSeason, setFilterSeason] = useState("2025/2026");
  const [filterCompetition, setFilterCompetition] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterMinGoals, setFilterMinGoals] = useState("");
  const [filterMaxGoalsConceded, setFilterMaxGoalsConceded] = useState("");

  // Applied Scouting States
  const [scoutingSearch, setScoutingSearch] = useState("");
  const [scoutingTeam, setScoutingTeam] = useState("");
  const [scoutingSeason, setScoutingSeason] = useState("2025/2026");
  const [scoutingCompetition, setScoutingCompetition] = useState("");
  const [scoutingPosition, setScoutingPosition] = useState("");
  const [scoutingMinGoals, setScoutingMinGoals] = useState("");
  const [scoutingMaxGoalsConceded, setScoutingMaxGoalsConceded] = useState("");

  const [scoutingLoading, setScoutingLoading] = useState(false);
  const [scoutedPlayers, setScoutedPlayers] = useState<ScoutedPlayer[]>([]);
  
  const [scoutingSortField, setScoutingSortField] = useState<string>("goals_scored");
  const [scoutingSortOrder, setScoutingSortOrder] = useState<"asc" | "desc">("desc");

  // Unique filters lists for selects
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [availableCompetitions, setAvailableCompetitions] = useState<string[]>([]);
  const [availableRivals, setAvailableRivals] = useState<string[]>([]);
  const [allLocalSeasons, setAllLocalSeasons] = useState<string[]>([]);

  // Detailed player profile modal
  const [selectedDetailPlayer, setSelectedDetailPlayer] = useState<ScoutedPlayer | null>(null);
  const [playerHistory, setPlayerHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Comparison Modal States
  const [selectedScoutedPlayer, setSelectedScoutedPlayer] = useState<ScoutedPlayer | null>(null);
  const [comparedPlayers, setComparedPlayers] = useState<any[]>([]);
  
  // Real-time comparison database search query states
  const [compareSearch, setCompareSearch] = useState("");
  const [compareResults, setCompareResults] = useState<any[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  // Competition/Standings States
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [competitionSeason, setCompetitionSeason] = useState("2025/2026");
  const [selectedMatchday, setSelectedMatchday] = useState<number>(3);
  const [maxMatchday, setMaxMatchday] = useState<number>(3);

  // Match detail modal
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<any>(null);
  const [matchDetailLoading, setMatchDetailLoading] = useState(false);
  const [matchEventFilter, setMatchEventFilter] = useState<"all" | "goals" | "cards" | "subs">("all");

  useEffect(() => {
    setMounted(true);
    fetchUserData();
    fetchSquad();
  }, []);

  // Fetch matches whenever competition season changes
  useEffect(() => {
    fetchMatchesData(competitionSeason);
  }, [competitionSeason]);

  // Debounced search for comparison players across all seasons to prevent React DOM lag
  useEffect(() => {
    if (compareSearch.length < 2) {
      setCompareResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        setCompareLoading(true);
        const res = await fetch(`/api/scouting/players?search=${encodeURIComponent(compareSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setCompareResults(data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCompareLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [compareSearch]);

  // Sync squad horizontal scrollbars
  useEffect(() => {
    const tableEl = squadTableContainerRef.current;
    const topScrollEl = squadTopScrollRef.current;
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
  }, [squadPlayers, showAdvancedMetrics]);

  // Sync scouting horizontal scrollbars
  useEffect(() => {
    const tableEl = scoutingTableContainerRef.current;
    const topScrollEl = scoutingTopScrollRef.current;
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
  }, [squadPlayers, showAdvancedMetrics]);

  // Squad table resize observer
  useEffect(() => {
    const tableEl = squadTableContainerRef.current?.querySelector("table");
    if (!tableEl) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSquadTableScrollWidth(entry.target.scrollWidth);
      }
    });
    obs.observe(tableEl);
    return () => obs.disconnect();
  }, [squadPlayers, showAdvancedMetrics]);

  // Scouting table resize observer
  useEffect(() => {
    const tableEl = scoutingTableContainerRef.current?.querySelector("table");
    if (!tableEl) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScoutingTableScrollWidth(entry.target.scrollWidth);
      }
    });
    obs.observe(tableEl);
    return () => obs.disconnect();
  }, [squadPlayers, showAdvancedMetrics]);

  async function fetchUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select(`
          role,
          team_id,
          organizations (
            subscriptions (
              plans ( slug )
            )
          )
        `)
        .eq("user_id", user.id)
        .limit(1)
        .single();

      // Retrieve all seasons from local DB
      const { data: seasonsList } = await supabase
        .from("seasons")
        .select("id, name")
        .order("name", { ascending: false });

      if (seasonsList) {
        setAllLocalSeasons(seasonsList.map(s => s.name));
      }

      // Check cl_active_season_id cookie
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("cl_active_season_id="))
        ?.split("=")[1];

      let activeSName = "2026/2027";
      if (cookieValue && seasonsList) {
        const matchS = seasonsList.find(s => s.id === cookieValue);
        if (matchS) activeSName = matchS.name;
      }

      setActiveSeasonName(activeSName);
      setSquadSeason(activeSName);

      if (roleData) {
        setUserRole(roleData.role);
        const pSlug = (roleData as any).organizations?.subscriptions?.[0]?.plans?.slug ?? "free";
        setPlan(pSlug);
        
        const isPremium = pSlug === "performance" || pSlug === "academy" || roleData.role === "super_admin" || user.email === "diecilo7@gmail.com" || user.email === "diego.ciria.lopez@gmail.com";
        setHasScoutingAccess(isPremium);
      }
    } catch (err) {
      console.error("Error loading user context:", err);
    }
  }

  // Load C.D. Almazán roster dynamically across all seasons (no season filter)
  async function fetchSquad() {
    try {
      setSquadLoading(true);
      const res = await fetch(`/api/scouting/players?team=C.D. Almazán`);
      if (!res.ok) throw new Error("Failed to load Almazán roster");
      const data = await res.json();

      const uniqueNames = new Set<string>();
      const formatted: PlayerWithMembership[] = [];

      for (const p of data) {
        const nameKey = p.player_name.toLowerCase();
        if (uniqueNames.has(nameKey)) continue;
        uniqueNames.add(nameKey);

        const parts = p.player_name.split(",");
        const lastName = parts[0]?.trim() || p.player_name;
        const firstName = parts[1]?.trim() || "";

        formatted.push({
          id: `scouted-almazan-${formatted.length}`,
          first_name: firstName,
          last_name: lastName,
          raw_name: p.player_name, // Store exact original DB format name
          date_of_birth: null,
          height_cm: null,
          weight_kg: null,
          dominant_foot: "right",
          physical_status: "optimal",
          availability_status: "available",
          membership: {
            jersey_number: p.shirt_number,
            positions: [p.position],
            teams: { name: "S.D. Almazán", id: "almazan" }
          }
        });
      }

      setSquadStats(data || []);
      setSquadPlayers(formatted);
    } catch (err) {
      console.error("Error loading squad:", err);
    } finally {
      setSquadLoading(false);
    }
  }

  // Load scouting data (triggered on tab switch or applied filter changes)
  async function fetchScoutingData() {
    if (!hasScoutingAccess) return;
    try {
      setScoutingLoading(true);
      const params = new URLSearchParams();
      if (scoutingSearch) params.set("search", scoutingSearch);
      if (scoutingTeam) params.set("team", scoutingTeam);
      if (scoutingSeason) params.set("season", scoutingSeason);
      if (scoutingCompetition) params.set("competition", scoutingCompetition);
      if (scoutingPosition) params.set("position", scoutingPosition);
      if (scoutingMinGoals && scoutingMinGoals !== "0") params.set("minGoals", scoutingMinGoals);
      if (scoutingMaxGoalsConceded) params.set("maxGoalsConceded", scoutingMaxGoalsConceded);

      const res = await fetch(`/api/scouting/players?${params.toString()}`);
      if (!res.ok) throw new Error("Scouting fetch failed");
      const data = await res.json();
      setScoutedPlayers(data);

      const seasons = Array.from(new Set((data as ScoutedPlayer[]).map(p => p.season))).sort();
      const comps = Array.from(new Set((data as ScoutedPlayer[]).map(p => p.competition))).sort();
      const rivals = Array.from(new Set((data as ScoutedPlayer[]).map(p => p.team_name))).sort();

      setAvailableSeasons(seasons);
      setAvailableCompetitions(comps);
      setAvailableRivals(rivals);
    } catch (err) {
      console.error("Error loading scouting data:", err);
    } finally {
      setScoutingLoading(false);
    }
  }

  // Fetch all matches for standings & results
  async function fetchMatchesData(seasonName: string) {
    try {
      setMatchesLoading(true);
      const res = await fetch(`/api/scouting/matches?season=${encodeURIComponent(seasonName)}&competition=Tercera Federación - Grupo 8`);
      if (!res.ok) throw new Error("Matches fetch failed");
      const data = await res.json();
      setMatches(data || []);

      if (data && data.length > 0) {
        const matchdays = data.map((m: any) => m.matchday);
        const maxJ = Math.max(...matchdays);
        setMaxMatchday(maxJ);
        setSelectedMatchday(maxJ);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMatchesLoading(false);
    }
  }

  // Fetch match details on click
  async function fetchMatchDetail(matchId: string) {
    try {
      setSelectedMatchId(matchId);
      setMatchDetailLoading(true);
      setMatchEventFilter("all");
      const res = await fetch(`/api/scouting/matches/${matchId}`);
      if (!res.ok) throw new Error("Match details fetch failed");
      const data = await res.json();
      setMatchDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMatchDetailLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "scouting" && hasScoutingAccess) {
      fetchScoutingData();
    }
  }, [
    activeTab,
    scoutingSearch,
    scoutingTeam,
    scoutingSeason,
    scoutingCompetition,
    scoutingPosition,
    scoutingMinGoals,
    scoutingMaxGoalsConceded
  ]);

  // Apply filters handler inside scouting bar
  const handleApplyFilters = () => {
    setScoutingSearch(filterSearch);
    setScoutingTeam(filterTeam);
    setScoutingSeason(filterSeason);
    setScoutingCompetition(filterCompetition);
    setScoutingPosition(filterPosition);
    setScoutingMinGoals(filterMinGoals);
    setScoutingMaxGoalsConceded(filterMaxGoalsConceded);
  };

  // Squad Sorting Helper
  const handleSquadSort = (field: string) => {
    if (squadSortField === field) {
      setSquadSortOrder(squadSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSquadSortField(field);
      setSquadSortOrder("asc");
    }
  };

  // Scouting Sorting Helper
  const handleScoutingSort = (field: string) => {
    if (scoutingSortField === field) {
      setScoutingSortOrder(scoutingSortOrder === "asc" ? "desc" : "asc");
    } else {
      setScoutingSortField(field);
      setScoutingSortOrder("asc");
    }
  };

  // Fetch player stats looking up the pre-aggregated squad records
  const getPlayerStats = (player: PlayerWithMembership, isHistorical: boolean) => {
    const rawKey = player.raw_name?.toLowerCase();
    const rows = squadStats.filter((s) => {
      if (rawKey) {
        return s.player_name.toLowerCase() === rawKey;
      }
      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
      return s.player_name.toLowerCase() === fullName;
    });

    if (rows.length === 0) {
      return {
        season: squadSeason, matches_played: 0, starts: 0, minutes_on: 0, goals_scored: 0, goals_conceded: 0,
        net_impact: 0, net_impact_per_90: 0, revulsive_impact: 0, regularity_index: 0, cards_density: 9999,
        clean_sheet_ratio: 0, yellow_cards: 0, red_cards: 0, penalties_scored: 0, goals_for_while_on: 0, goals_against_while_on: 0
      };
    }

    // Single selected season view
    if (!isHistorical) {
      const r = rows.find(row => row.season === squadSeason);
      if (!r) {
        return {
          season: squadSeason, matches_played: 0, starts: 0, minutes_on: 0, goals_scored: 0, goals_conceded: 0,
          net_impact: 0, net_impact_per_90: 0, revulsive_impact: 0, regularity_index: 0, cards_density: 9999,
          clean_sheet_ratio: 0, yellow_cards: 0, red_cards: 0, penalties_scored: 0, goals_for_while_on: 0, goals_against_while_on: 0
        };
      }

      return {
        season: r.season,
        matches_played: r.matches_played || 0,
        starts: r.starts || 0,
        minutes_on: r.minutes_on || 0,
        goals_scored: r.goals_scored || 0,
        goals_conceded: r.goals_conceded || 0,
        net_impact: r.net_impact || 0,
        net_impact_per_90: r.net_impact_per_90 || 0,
        revulsive_impact: r.revulsive_impact || 0,
        regularity_index: r.regularity_index || 0,
        cards_density: r.cards_density || 9999,
        clean_sheet_ratio: r.clean_sheet_ratio || 0,
        yellow_cards: r.yellow_cards || 0,
        red_cards: r.red_cards || 0,
        penalties_scored: r.penalties_scored || 0,
        goals_for_while_on: r.goals_for_while_on || 0,
        goals_against_while_on: r.goals_against_while_on || 0,
      };
    }

    // Accumulate sum historically
    let matches_played = 0;
    let starts = 0;
    let minutes_on = 0;
    let goals_scored = 0;
    let goals_conceded = 0;
    let net_impact = 0;
    let yellow_cards = 0;
    let red_cards = 0;
    let penalties_scored = 0;
    let clean_sheets_ratio_sum = 0;
    let regularity_sum = 0;
    let goals_for_while_on = 0;
    let goals_against_while_on = 0;

    for (const r of rows) {
      matches_played += (r.matches_played || 0);
      starts += (r.starts || 0);
      minutes_on += (r.minutes_on || 0);
      goals_scored += (r.goals_scored || 0);
      goals_conceded += (r.goals_conceded || 0);
      net_impact += (r.net_impact || 0);
      yellow_cards += (r.yellow_cards || 0);
      red_cards += (r.red_cards || 0);
      penalties_scored += (r.penalties_scored || 0);
      clean_sheets_ratio_sum += (r.clean_sheet_ratio || 0);
      regularity_sum += (r.regularity_index || 0);
      goals_for_while_on += (r.goals_for_while_on || 0);
      goals_against_while_on += (r.goals_against_while_on || 0);
    }

    const netImpactPer90 = minutes_on > 0 ? parseFloat(((net_impact / minutes_on) * 90).toFixed(2)) : 0;
    const avgCleanSheet = rows.length > 0 ? Math.round(clean_sheets_ratio_sum / rows.length) : 0;
    const avgRegularity = rows.length > 0 ? Math.round(regularity_sum / rows.length) : 0;

    return {
      season: "Histórico",
      matches_played,
      starts,
      minutes_on,
      goals_scored,
      goals_conceded,
      net_impact,
      net_impact_per_90: netImpactPer90,
      revulsive_impact: 0,
      regularity_index: avgRegularity,
      cards_density: 9999,
      clean_sheet_ratio: avgCleanSheet,
      yellow_cards,
      red_cards,
      penalties_scored,
      goals_for_while_on,
      goals_against_while_on,
    };
  };

  // Filter and Sort Squad Players
  const filteredSquad = squadPlayers
    .filter((p) => {
      const fullName = `${p.first_name} ${p.last_name}`;
      const matchSearch = normalize(fullName).includes(normalize(squadSearch));
      
      // Filter by season unless global historical sub-view
      const isHist = squadSubView === "history";
      const rawKey = p.raw_name?.toLowerCase();
      const hasSeasonRecord = isHist || squadStats.some(s => {
        const nameMatch = rawKey ? (s.player_name.toLowerCase() === rawKey) : (s.player_name.toLowerCase() === fullName);
        return nameMatch && s.season === squadSeason;
      });
      if (!hasSeasonRecord) return false;

      const pPositions = p.membership?.positions || [];
      const matchPosition =
        squadPosition === "all" ||
        pPositions.some((pos) => pos.toLowerCase().includes(squadPosition.toLowerCase()));

      const matchStatus = squadStatus === "all" || p.physical_status === squadStatus;

      return matchSearch && matchPosition && matchStatus;
    })
    .sort((a, b) => {
      let valA: any = a[squadSortField as keyof PlayerWithMembership];
      let valB: any = b[squadSortField as keyof PlayerWithMembership];

      if (squadSortField === "jersey_number") {
        valA = a.membership?.jersey_number ?? 999;
        valB = b.membership?.jersey_number ?? 999;
      } else if (squadSortField === "age") {
        valA = a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0;
        valB = b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0;
      } else if (
        squadSortField === "matches_played" ||
        squadSortField === "starts" ||
        squadSortField === "minutes_on" ||
        squadSortField === "goals_scored" ||
        squadSortField === "net_impact"
      ) {
        const statsA = getPlayerStats(a, squadSubView === "history");
        const statsB = getPlayerStats(b, squadSubView === "history");
        valA = statsA[squadSortField as keyof ReturnType<typeof getPlayerStats>];
        valB = statsB[squadSortField as keyof ReturnType<typeof getPlayerStats>];
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === "string") {
        return squadSortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return squadSortOrder === "asc" ? valA - valB : valB - valA;
      }
    });

  // Sort Scouted Players
  const sortedScouting = [...scoutedPlayers].sort((a, b) => {
    let valA = a[scoutingSortField as keyof ScoutedPlayer];
    let valB = b[scoutingSortField as keyof ScoutedPlayer];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === "string") {
      return scoutingSortOrder === "asc"
        ? valA.localeCompare(valB as string)
        : (valB as string).localeCompare(valA);
    } else {
      return scoutingSortOrder === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }
  });

  const getPlayersByEquivalentPosition = (scoutedPos: string) => {
    return squadPlayers.filter(p => {
      const positions = p.membership?.positions || [];
      if (scoutedPos === "goalkeeper") {
        return positions.includes("goalkeeper");
      }
      if (scoutedPos === "back") {
        return positions.some(pos => ["right_back", "left_back", "right_center_back", "left_center_back"].includes(pos));
      }
      if (scoutedPos === "midfielder") {
        return positions.some(pos => ["defensive_midfielder", "playmaker_midfielder", "attacking_midfielder"].includes(pos));
      }
      if (scoutedPos === "winger" || scoutedPos === "striker") {
        return positions.some(pos => ["left_winger", "right_winger", "striker"].includes(pos));
      }
      return true;
    });
  };

  // Open detailed player profile modal
  const handleOpenDetail = async (player: ScoutedPlayer) => {
    setSelectedDetailPlayer(player);
    setSelectedScoutedPlayer(player);
    setComparedPlayers([]);
    setCompareSearch("");
    
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/scouting/players/history?name=${encodeURIComponent(player.player_name)}`);
      if (res.ok) {
        const data = await res.json();
        setPlayerHistory(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open comparison directly
  const handleOpenComparison = (player: ScoutedPlayer) => {
    handleOpenDetail(player);
  };

  const scoutedPlayerStats = selectedScoutedPlayer ? {
    goals: selectedScoutedPlayer.goals_scored,
    netImpact: selectedScoutedPlayer.net_impact_per_90,
    regularity: selectedScoutedPlayer.regularity_index,
    cleanSheets: selectedScoutedPlayer.clean_sheet_ratio,
    discipline: selectedScoutedPlayer.cards_density,
    minPerGoal: selectedScoutedPlayer.goals_scored > 0 ? selectedScoutedPlayer.minutes_on / selectedScoutedPlayer.goals_scored : 9999,
  } : { goals: 0, netImpact: 0, regularity: 0, cleanSheets: 0, discipline: 9999, minPerGoal: 9999 };

  // Unique list of seasons options merging local seasons and statistics DB seasons
  const squadSeasonsOptions = Array.from(new Set([...allLocalSeasons, "2025/2026", "2024/2025"])).sort().reverse();

  // Populate options lists for comparing players across all seasons dynamically
  const getComparisonOptions = () => {
    const list: { value: string; label: string }[] = [];
    
    // Add squad players matching search
    for (const p of squadPlayers) {
      const name = `${p.first_name} ${p.last_name}`;
      if (selectedDetailPlayer && name.toLowerCase() === selectedDetailPlayer.player_name.toLowerCase()) continue;
      
      if (compareSearch && !name.toLowerCase().includes(compareSearch.toLowerCase())) continue;
      
      list.push({
        value: `squad|${p.id}`,
        label: `${name} (Mi Plantilla)`
      });
    }

    // Add scouted players matching debounced search results across all seasons
    const dataSource = compareSearch ? compareResults : scoutedPlayers.slice(0, 30);
    let count = 0;
    for (const p of dataSource) {
      if (selectedDetailPlayer && p.player_name.toLowerCase() === selectedDetailPlayer.player_name.toLowerCase()) continue;
      
      if (compareSearch) {
        if (!p.player_name.toLowerCase().includes(compareSearch.toLowerCase())) continue;
      } else {
        if (count >= 30) break; // Capped default options list to preserve VDOM render times
      }

      list.push({
        value: `scouted|${p.player_name}|${p.season}`,
        label: `${p.player_name} (${displayTeamName(p.team_name)}) - Temp. ${p.season}`
      });
      count++;
    }

    return list.slice(0, 100);
  };

  const handleAddComparisonPlayer = (val: string) => {
    if (!val) return;
    if (comparedPlayers.some(cp => cp.key === val)) return;

    if (val.startsWith("squad|")) {
      const squadId = val.replace("squad|", "");
      const p = squadPlayers.find(sp => sp.id === squadId);
      if (p) {
        const stats = getPlayerStats(p, squadSubView === "history");
        setComparedPlayers([...comparedPlayers, {
          key: val,
          name: `${p.first_name} ${p.last_name}`,
          stats: {
            goals: stats.goals_scored,
            netImpact: stats.net_impact_per_90,
            regularity: stats.regularity_index,
            cleanSheets: stats.clean_sheet_ratio,
            discipline: stats.cards_density,
            minPerGoal: stats.goals_scored > 0 ? stats.minutes_on / stats.goals_scored : 9999,
            matches_played: stats.matches_played,
            starts: stats.starts,
            minutes_on: stats.minutes_on,
            goals_scored: stats.goals_scored,
            yellow_cards: stats.yellow_cards,
            red_cards: stats.red_cards,
            penalties_scored: stats.penalties_scored || 0,
            net_impact_per_90: stats.net_impact_per_90,
            revulsive_impact: stats.revulsive_impact,
            regularity_index: stats.regularity_index,
            cards_density: stats.cards_density,
            clean_sheet_ratio: stats.clean_sheet_ratio,
            goals_for_while_on: stats.goals_for_while_on,
            goals_against_while_on: stats.goals_against_while_on
          }
        }]);
      }
    } else {
      const parts = val.split("|");
      const name = parts[1];
      const season = parts[2];
      
      const p = compareResults.find(sp => sp.player_name === name && sp.season === season) || 
                scoutedPlayers.find(sp => sp.player_name === name && sp.season === season);
                
      if (p) {
        setComparedPlayers([...comparedPlayers, {
          key: val,
          name: `${p.player_name} (${p.season})`, // Includes season to distinguish same player comparison
          stats: {
            goals: p.goals_scored,
            netImpact: p.net_impact_per_90,
            regularity: p.regularity_index,
            cleanSheets: p.clean_sheet_ratio,
            discipline: p.cards_density,
            minPerGoal: p.goals_scored > 0 ? p.minutes_on / p.goals_scored : 9999,
            matches_played: p.matches_played,
            starts: p.starts,
            minutes_on: p.minutes_on,
            goals_scored: p.goals_scored,
            yellow_cards: p.yellow_cards,
            red_cards: p.red_cards,
            penalties_scored: p.penalties_scored || 0,
            net_impact_per_90: p.net_impact_per_90,
            revulsive_impact: p.revulsive_impact,
            regularity_index: p.regularity_index,
            cards_density: p.cards_density,
            clean_sheet_ratio: p.clean_sheet_ratio,
            goals_for_while_on: p.goals_for_while_on,
            goals_against_while_on: p.goals_against_while_on
          }
        }]);
      }
    }
  };

  const handleRemoveComparePlayer = (key: string) => {
    setComparedPlayers(comparedPlayers.filter(cp => cp.key !== key));
  };

  const standingsTable = calculateStandings(matches);
  const selectedMatchdayGames = matches.filter((m: any) => m.matchday === selectedMatchday);
  const historicalTeamsList = Array.from(new Set(playerHistory.map((h: any) => displayTeamName(h.team_name))));
  
  const getFilteredMatchEvents = () => {
    if (!matchDetail) return [];
    const events = matchDetail.events || [];
    if (matchEventFilter === "all") return events;
    if (matchEventFilter === "goals") return events.filter((e: any) => e.event_type === "goal");
    if (matchEventFilter === "cards") return events.filter((e: any) => e.event_type.includes("card"));
    if (matchEventFilter === "subs") return events.filter((e: any) => e.event_type.includes("substitution"));
    return events;
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            Estadísticas y Scouting
          </h1>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Métricas de la plantilla asociadas a la S.D. Almazán, comparador de rendimiento radar, clasificación y resultados oficiales.
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 p-1 bg-white/2 border border-white/5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("squad")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            activeTab === "squad"
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Mi Plantilla
        </button>
        
        {/* Scouting Tab */}
        <button
          onClick={() => {
            if (hasScoutingAccess) {
              setActiveTab("scouting");
            } else {
              alert("El módulo de Scouting requiere un plan Performance o de la Academia.");
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            !hasScoutingAccess
              ? "text-slate-500 opacity-60 cursor-not-allowed hover:bg-white/1"
              : activeTab === "scouting"
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {hasScoutingAccess ? <Zap className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
          Scouting & Rivales
        </button>

        {/* Competition Results Tab */}
        <button
          onClick={() => setActiveTab("competition")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            activeTab === "competition"
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          Resultados y Clasificación
        </button>
      </div>

      {/* TAB CONTENT: MY SQUAD */}
      {activeTab === "squad" && (
        <div className="space-y-4">
          {/* Sub-view switcher */}
          <div className="flex gap-2 border-b border-white/5 pb-2">
            {[
              { id: "general", label: "Vista General" },
              { id: "season", label: "Estadísticas Temporada" },
              { id: "history", label: "Histórico" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSquadSubView(v.id as any);
                  if (v.id === "general") setSquadSortField("last_name");
                  else setSquadSortField("goals_scored");
                }}
                className={`px-3 py-1.5 text-[11px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                  squadSubView === v.id
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-450 shadow-sm"
                    : "border-white/5 text-slate-400 hover:text-white bg-white/1"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Filters & Toggles Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/2 p-3.5 border border-white/5 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar jugador de S.D Almazán..."
                  value={squadSearch}
                  onChange={(e) => setSquadSearch(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Local Season Selector */}
              <CustomSelect
                value={squadSeason}
                onChange={(val) => setSquadSeason(val)}
                options={squadSeasonsOptions.map(s => ({ value: s, label: `Temporada ${s}` }))}
                placeholder="Temporada"
              />

              {/* Position Filter */}
              <CustomSelect
                value={squadPosition}
                onChange={(val) => setSquadPosition(val)}
                options={SQUAD_POSITION_OPTIONS}
                placeholder="Posiciones"
              />

              {/* Status Filter */}
              <CustomSelect
                value={squadStatus}
                onChange={(val) => setSquadStatus(val)}
                options={[
                  { value: "all", label: "Todos los Estados" },
                  { value: "optimal", label: "Óptimo" },
                  { value: "fatigued", label: "Fatigado" },
                  { value: "injured", label: "Lesionado" },
                  { value: "resting", label: "Descanso" },
                  { value: "rehab", label: "Readaptación" },
                ]}
                placeholder="Estado Físico"
              />
            </div>

            {/* Toggle advanced metrics button */}
            {(squadSubView === "season" || squadSubView === "history") && (
              <button
                onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl border transition-all cursor-pointer ${
                  showAdvancedMetrics
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white/2 border-white/10 text-slate-355 hover:text-white"
                }`}
              >
                {showAdvancedMetrics ? "Ocultar métricas avanzadas" : "Mostrar métricas avanzadas"}
              </button>
            )}
          </div>

          {/* Table */}
          {squadLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              <p className="text-xs text-slate-500 mt-2">Cargando plantilla de la S.D. Almazán...</p>
            </div>
          ) : filteredSquad.length === 0 ? (
            <div className="text-center py-16 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
              No se encontraron jugadores registrados en esta temporada o coincidiendo con los filtros.
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl animate-fade-in">
              {/* Synced top scrollbar */}
              <div 
                ref={squadTopScrollRef} 
                className="w-full overflow-x-auto overflow-y-hidden h-2.5 bg-slate-950/20 border-b border-white/5 rounded-t-xl"
              >
                <div style={{ width: `${squadTableScrollWidth}px`, height: "1px" }}></div>
              </div>
              <div ref={squadTableContainerRef} className="max-h-[650px] overflow-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    {squadSubView === "general" ? (
                      <tr className="border-b border-white/10 bg-slate-900/95 backdrop-blur-md text-slate-400 font-bold uppercase tracking-wider select-none sticky top-0 z-10">
                        <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleSquadSort("last_name")}>
                          Jugador <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("jersey_number")}>
                          Dorsal <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3">Posición principal</th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("dominant_foot")}>
                          Pie hábil <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center">Físico</th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("height_cm")}>
                          Altura <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("weight_kg")}>
                          Peso <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center">Disponibilidad</th>
                      </tr>
                    ) : (
                      <tr className="border-b border-white/10 bg-slate-900/95 backdrop-blur-md text-slate-400 font-bold uppercase tracking-wider select-none sticky top-0 z-10">
                        <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleSquadSort("last_name")}>
                          Jugador <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("jersey_number")}>
                          Dorsal <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("matches_played")}>
                          Partidos <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("minutes_on")}>
                          Minutos <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("goals_scored")}>
                          Goles <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        <th className="px-4 py-3 text-center">Tarjetas</th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleSquadSort("goals_conceded")}>
                          Encajados <ArrowUpDown className="inline h-3 w-3 ml-1" />
                        </th>
                        
                        {/* Advanced Expandable Headers with custom styled tooltips */}
                        {showAdvancedMetrics && (
                          <>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("net_impact")}>
                              Impacto Neto <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Diferencia total de goles del equipo mientras el jugador está en el campo.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("net_impact_per_90")}>
                              Impacto/90 min <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-355 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Goles netos del equipo por cada 90 minutos de juego del jugador.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("revulsive_impact")}>
                              Revulsivo <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Variación de goles del equipo tras el ingreso como sustituto en comparación con el marcador previo.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("regularity_index")}>
                              Regularidad <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Porcentaje de minutos disputados sobre los últimos 5 partidos de su equipo.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("cards_density")}>
                              Min/Tarjeta <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Minutos promedio transcurridos entre amonestaciones del jugador.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleSquadSort("clean_sheet_ratio")}>
                              Port. Cero % <ArrowUpDown className="inline h-3 w-3 ml-1" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Porcentaje de minutos jugados con portería imbatida del equipo.
                              </div>
                            </th>
                            {/* Additional highly-requested metrics (hidden/advanced) */}
                            <th className="px-4 py-3 text-center group relative">
                              Min/Gol F.
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Minutos jugados por cada gol anotado por el equipo mientras el jugador estaba en el campo.
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center group relative">
                              Min/Gol C.
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                                Minutos jugados por cada gol encajado por el equipo mientras el jugador estaba en el campo.
                              </div>
                            </th>
                          </>
                        )}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                    {filteredSquad.map((player) => {
                      const stats = getPlayerStats(player, squadSubView === "history");
                      
                      // Format to match ScoutedPlayer type for opening modals
                      const rawScoutedObj: ScoutedPlayer = {
                        player_name: player.raw_name || `${player.first_name} ${player.last_name}`,
                        team_name: "C.D. Almazán",
                        season: stats.season,
                        competition: "Tercera Federación - Grupo 8",
                        shirt_number: player.membership?.jersey_number ?? null,
                        position: player.membership?.positions?.[0] || "striker",
                        matches_played: stats.matches_played,
                        starts: stats.starts,
                        minutes_on: stats.minutes_on,
                        goals_scored: stats.goals_scored,
                        goals_conceded: stats.goals_conceded,
                        yellow_cards: stats.yellow_cards,
                        red_cards: stats.red_cards,
                        net_impact: stats.net_impact,
                        net_impact_per_90: stats.net_impact_per_90,
                        revulsive_impact: stats.revulsive_impact,
                        regularity_index: stats.regularity_index,
                        cards_density: stats.cards_density,
                        clean_sheet_ratio: stats.clean_sheet_ratio,
                        penalties_scored: stats.penalties_scored,
                        goals_for_while_on: stats.goals_for_while_on,
                        goals_against_while_on: stats.goals_against_while_on
                      };

                      return (
                        <tr key={player.id} className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-white cursor-pointer hover:text-emerald-450 whitespace-nowrap truncate max-w-[220px]" onClick={() => handleOpenDetail(rawScoutedObj)}>
                            {player.last_name}, {player.first_name}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-emerald-455">
                            {player.membership?.jersey_number ?? "—"}
                          </td>

                          {squadSubView === "general" ? (
                            <>
                              <td className="px-4 py-3.5">
                                {player.membership?.positions
                                  ?.map((pos) => SPANISH_POSITION_LABELS[pos] || pos)
                                  .join(", ") || "No asignada"}
                              </td>
                              <td className="px-4 py-3.5 text-center uppercase">
                                {player.dominant_foot === "both" ? "Ambos" : player.dominant_foot === "left" ? "Izquierdo" : "Derecho"}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  player.physical_status === "optimal"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : player.physical_status === "fatigued"
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-455"
                                }`}>
                                  {player.physical_status === "optimal" ? "Óptimo" : player.physical_status === "fatigued" ? "Fatiga" : "Baja/Rest"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {player.height_cm ? `${player.height_cm} cm` : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {player.weight_kg ? `${player.weight_kg} kg` : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  player.availability_status === "available"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : player.availability_status === "questionable"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-rose-500/10 text-rose-455"
                                }`}>
                                  {player.availability_status === "available" ? "Disponible" : player.availability_status === "questionable" ? "Duda" : "No disp."}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3.5 text-center">{stats.matches_played} ({stats.starts} tit)</td>
                              <td className="px-4 py-3.5 text-center">{stats.minutes_on} min</td>
                              <td className="px-4 py-3.5 text-center font-bold text-amber-450">{stats.goals_scored}</td>
                              <td className="px-4 py-3.5 text-center space-x-1.5">
                                <span className="text-yellow-550 font-bold">{stats.yellow_cards}🟨</span>
                                <span className="text-rose-500 font-bold">{stats.red_cards}🟥</span>
                              </td>
                              <td className="px-4 py-3.5 text-center text-slate-400">{stats.goals_conceded}</td>
                              
                              {showAdvancedMetrics && (
                                <>
                                  <td className={`px-4 py-3.5 text-center font-bold ${
                                    stats.net_impact > 0 ? "text-emerald-400" : stats.net_impact < 0 ? "text-rose-455" : "text-slate-400"
                                  }`}>
                                    {stats.net_impact > 0 ? `+${stats.net_impact}` : stats.net_impact}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-extrabold">{stats.net_impact_per_90}</td>
                                  <td className={`px-4 py-3.5 text-center font-bold ${
                                    stats.revulsive_impact > 0 ? "text-emerald-400" : stats.revulsive_impact < 0 ? "text-rose-455" : "text-slate-400"
                                  }`}>
                                    {stats.revulsive_impact > 0 ? `+${stats.revulsive_impact}` : stats.revulsive_impact === 0 ? "—" : stats.revulsive_impact}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-bold">{stats.regularity_index}%</td>
                                  <td className="px-4 py-3.5 text-center">{stats.cards_density === 9999 ? "—" : `${stats.cards_density} min`}</td>
                                  <td className="px-4 py-3.5 text-center text-sky-400 font-bold">{stats.clean_sheet_ratio}%</td>
                                  
                                  {/* Minutes per Goal metrics */}
                                  <td className="px-4 py-3.5 text-center">
                                    {stats.goals_for_while_on > 0 ? `${Math.round(stats.minutes_on / stats.goals_for_while_on)} min` : "—"}
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    {stats.goals_against_while_on > 0 ? `${Math.round(stats.minutes_on / stats.goals_against_while_on)} min` : "—"}
                                  </td>
                                </>
                              )}
                            </>
                          )}
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

      {/* TAB CONTENT: SCOUTING & RIVALES */}
      {activeTab === "scouting" && hasScoutingAccess && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar with local filters and explicit Apply button */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-white/2 p-4 border border-white/5 rounded-2xl">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Nombre jugador rival..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-white/10 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Team/Rival Dropdown with Premium CustomSelect supporting Multi-Select */}
            <CustomSelect
              value={filterTeam}
              onChange={(val) => setFilterTeam(val)}
              options={availableRivals.map(r => ({ value: r, label: displayTeamName(r) }))}
              placeholder="Rival / Equipo (Varios)"
              isMultiSelect={true}
            />

            {/* Season Select with Premium CustomSelect - Populated globally to avoid lock circular dependency */}
            <CustomSelect
              value={filterSeason}
              onChange={(val) => setFilterSeason(val)}
              options={squadSeasonsOptions.map(s => ({ value: s, label: `Temp. ${s}` }))}
              placeholder="Temporadas (Varias)"
              isMultiSelect={true}
            />

            {/* Competition Select with Premium CustomSelect supporting Multi-Select */}
            <CustomSelect
              value={filterCompetition}
              onChange={(val) => setFilterCompetition(val)}
              options={availableCompetitions.map(c => ({ value: c, label: c }))}
              placeholder="Competiciones (Varias)"
              isMultiSelect={true}
            />

            {/* Position Select with Premium CustomSelect supporting Multi-Select */}
            <CustomSelect
              value={filterPosition}
              onChange={(val) => setFilterPosition(val)}
              options={[
                { value: "goalkeeper", label: "Portero" },
                { value: "back", label: "Defensa" },
                { value: "midfielder", label: "Centrocampista" },
                { value: "winger", label: "Extremo" },
                { value: "striker", label: "Delantero Centro" },
              ]}
              placeholder="Posiciones (Varias)"
              isMultiSelect={true}
            />

            {/* Manual Goals Scored input */}
            <div className="flex flex-col justify-center">
              <input
                type="number"
                placeholder="Min goles marcados..."
                value={filterMinGoals}
                onChange={(e) => setFilterMinGoals(e.target.value)}
                className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Goals Conceded Filter */}
            <input
              type="number"
              placeholder="Máx goles encajados..."
              value={filterMaxGoalsConceded}
              onChange={(e) => setFilterMaxGoalsConceded(e.target.value)}
              className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />

            {/* Apply filters button */}
            <button
              onClick={handleApplyFilters}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-black uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              Aplicar filtros
            </button>

            {/* Toggle advanced metrics button for Scouting */}
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase transition-all shadow-md border cursor-pointer flex items-center justify-center gap-1.5 ${
                showAdvancedMetrics
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white/2 border-white/10 text-slate-355 hover:text-white"
              }`}
            >
              {showAdvancedMetrics ? "Ocultar avanzadas" : "Mostrar avanzadas"}
            </button>
          </div>

          {/* Table */}
          {scoutingLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              <p className="text-xs text-slate-500 mt-2">Cargando base de datos de Scouting...</p>
            </div>
          ) : sortedScouting.length === 0 ? (
            <div className="text-center py-16 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
              No se encontraron registros de scouting con los criterios de búsqueda aplicados.
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              {/* Synced top scrollbar */}
              <div 
                ref={scoutingTopScrollRef} 
                className="w-full overflow-x-auto overflow-y-hidden h-2.5 bg-slate-950/20 border-b border-white/5 rounded-t-xl"
              >
                <div style={{ width: `${scoutingTableScrollWidth}px`, height: "1px" }}></div>
              </div>
              <div ref={scoutingTableContainerRef} className="max-h-[650px] overflow-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/95 backdrop-blur-md text-slate-400 font-bold uppercase tracking-wider select-none sticky top-0 z-10">
                      <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleScoutingSort("player_name")}>
                        Jugador Rival <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleScoutingSort("team_name")}>
                        Equipo <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-white" onClick={() => handleScoutingSort("competition")}>
                        Liga <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleScoutingSort("season")}>
                        Temp. <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-center">Posición</th>
                      
                      {/* Basic columns always visible */}
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleScoutingSort("matches_played")}>
                        Partidos <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleScoutingSort("minutes_on")}>
                        Minutos <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleScoutingSort("goals_scored")}>
                        Goles <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </th>
                      
                      {/* Scouting Advanced Columns (Shown when showAdvancedMetrics is enabled) */}
                      {showAdvancedMetrics && (
                        <>
                          <th className="px-4 py-3 text-center">Tarjetas</th>
                          <th className="px-4 py-3 text-center cursor-pointer hover:text-white" onClick={() => handleScoutingSort("goals_conceded")}>
                            Encajados <ArrowUpDown className="inline h-3 w-3 ml-1" />
                          </th>
                          <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleScoutingSort("net_impact_per_90")}>
                            Impacto/90m <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                              Goles netos del equipo por cada 90 minutos de juego del jugador.
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleScoutingSort("revulsive_impact")}>
                            Revulsivo <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                              Variación de goles del equipo tras el ingreso como sustituto en comparación con el marcador previo.
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center cursor-pointer hover:text-white group relative" onClick={() => handleScoutingSort("regularity_index")}>
                            Reg. (5p) <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                              Porcentaje de minutos disputados sobre los últimos 5 partidos jugados por su equipo.
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center group relative">
                            Min/Gol F.
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                              Minutos jugados por cada gol anotado por el equipo mientras el jugador estaba en el campo.
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center group relative">
                            Min/Gol C.
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-350 font-medium invisible group-hover:visible z-35 shadow-2xl backdrop-blur-md text-center normal-case">
                              Minutos jugados por cada gol encajado por el equipo mientras el jugador estaba en el campo.
                            </div>
                          </th>
                        </>
                      )}
                      
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                    {sortedScouting.map((player, idx) => {
                      const isOwnPlayer = player.team_name === "C.D. Almazán" || player.team_name === "S.D. Almazán";
                      
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-white/2 transition-colors border-l-2 border-transparent"
                          style={isOwnPlayer ? {
                            borderLeftColor: "var(--primary, #10b981)",
                            backgroundColor: "var(--color-brand-50, rgba(16, 185, 129, 0.08))",
                            color: "var(--primary, #10b981)",
                            fontWeight: "bold"
                          } : undefined}
                        >
                          <td
                            className={`px-4 py-3.5 font-bold cursor-pointer whitespace-nowrap truncate max-w-[220px] ${isOwnPlayer ? "text-emerald-450 hover:text-emerald-400" : "text-white hover:text-emerald-450"}`}
                            onClick={() => handleOpenDetail(player)}
                          >
                            {player.player_name}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-455">{displayTeamName(player.team_name)}</td>
                          <td className="px-4 py-3.5 text-slate-400">{player.competition}</td>
                          <td className="px-4 py-3.5 text-center text-slate-455">{player.season}</td>
                          <td className="px-4 py-3.5 text-center uppercase font-bold text-[10px] text-emerald-450">
                            {SPANISH_POSITION_LABELS[player.position] || player.position}
                          </td>
                          
                          {/* Basic Stats Cells always visible */}
                          <td className="px-4 py-3.5 text-center">{player.matches_played} ({player.starts} tit)</td>
                          <td className="px-4 py-3.5 text-center">{player.minutes_on} min</td>
                          <td className={`px-4 py-3.5 text-center font-black text-sm ${isOwnPlayer ? "text-emerald-450" : "text-amber-450"}`}>{player.goals_scored}</td>
                          
                          {/* Advanced cells visible under toggle */}
                          {showAdvancedMetrics && (
                            <>
                              <td className="px-4 py-3.5 text-center space-x-1.5">
                                <span className="text-yellow-550 font-bold">{player.yellow_cards}🟨</span>
                                <span className="text-rose-500 font-bold">{player.red_cards}🟥</span>
                              </td>
                              <td className="px-4 py-3.5 text-center text-slate-400">{player.goals_conceded}</td>
                              <td className="px-4 py-3.5 text-center font-extrabold text-white">{player.net_impact_per_90}</td>
                              <td className={`px-4 py-3.5 text-center font-bold ${
                                player.revulsive_impact > 0 ? "text-emerald-400" : player.revulsive_impact < 0 ? "text-rose-455" : "text-slate-455"
                              }`}>
                                {player.revulsive_impact > 0 ? `+${player.revulsive_impact}` : player.revulsive_impact === 0 ? "—" : player.revulsive_impact}
                              </td>
                              <td className="px-4 py-3.5 text-center font-bold">{player.regularity_index}%</td>
                              <td className="px-4 py-3.5 text-center">
                                {player.goals_for_while_on && player.goals_for_while_on > 0 ? `${Math.round(player.minutes_on / player.goals_for_while_on)} min` : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {player.goals_against_while_on && player.goals_against_while_on > 0 ? `${Math.round(player.minutes_on / player.goals_against_while_on)} min` : "—"}
                              </td>
                            </>
                          )}
                          
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => handleOpenComparison(player)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 hover:text-white px-2 py-1 rounded text-[10px] font-black uppercase transition-all cursor-pointer shadow-md"
                            >
                              Comparar
                            </button>
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

      {/* TAB CONTENT: COMPETITION STANDINGS & RESULTS */}
      {activeTab === "competition" && (
        <div className="space-y-4 animate-fade-in">
          {/* Season filter inside Results/Standings */}
          <div className="flex items-center gap-3 bg-white/2 p-3 border border-white/5 rounded-2xl w-fit">
            <span className="text-xs font-bold text-slate-400">Filtrar por año de competición:</span>
            <CustomSelect
              value={competitionSeason}
              onChange={(val) => setCompetitionSeason(val)}
              options={squadSeasonsOptions.map(s => ({ value: s, label: `Temporada ${s}` }))}
              placeholder="Temporada"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Standings Column */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Trophy className="h-4.5 w-4.5 text-amber-500" />
                Clasificación — Tercera Federación (Grupo 8)
              </h2>
              {matchesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-2xl animate-pulse">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
              ) : standingsTable.length === 0 ? (
                <div className="text-center py-16 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
                  No hay partidos cargados para calcular la clasificación en esta temporada.
                </div>
              ) : (
                <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/3 text-slate-400 font-bold uppercase tracking-wider select-none">
                        <th className="px-3 py-2.5 text-center w-10">Pos</th>
                        <th className="px-3 py-2.5">Equipo</th>
                        <th className="px-3 py-2.5 text-center">PJ</th>
                        <th className="px-3 py-2.5 text-center">PG</th>
                        <th className="px-3 py-2.5 text-center">PE</th>
                        <th className="px-3 py-2.5 text-center">PP</th>
                        <th className="px-3 py-2.5 text-center">GF</th>
                        <th className="px-3 py-2.5 text-center">GC</th>
                        <th className="px-3 py-2.5 text-center font-black">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-355">
                      {standingsTable.map((t: any, idx: number) => {
                        const mappedTeamName = displayTeamName(t.team);
                        const isAlmazan = mappedTeamName === "S.D. Almazán";
                        
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-white/2 transition-colors border-l-2 border-transparent"
                            style={isAlmazan ? {
                              borderLeftColor: "var(--primary, #10b981)",
                              backgroundColor: "var(--color-brand-50, rgba(16, 185, 129, 0.08))",
                              color: "var(--primary, #10b981)",
                              fontWeight: "bold"
                            } : undefined}
                          >
                            <td className="px-3 py-2.5 text-center font-bold">{idx + 1}</td>
                            <td className="px-3 py-2.5">{mappedTeamName}</td>
                            <td className="px-3 py-2.5 text-center">{t.pj}</td>
                            <td className="px-3 py-2.5 text-center">{t.pg}</td>
                            <td className="px-3 py-2.5 text-center">{t.pe}</td>
                            <td className="px-3 py-2.5 text-center">{t.pp}</td>
                            <td className="px-3 py-2.5 text-center">{t.gf}</td>
                            <td className="px-3 py-2.5 text-center">{t.gc}</td>
                            <td className="px-3 py-2.5 text-center font-extrabold" style={isAlmazan ? { color: "var(--primary, #10b981)" } : undefined}>{t.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Results/Matchday Column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-sky-500" />
                  Resultados de la Competición
                </h2>
                {/* Matchday Switcher */}
                <div className="flex items-center gap-2.5 bg-white/2 border border-white/5 px-2.5 py-1 rounded-xl">
                  <button
                    onClick={() => setSelectedMatchday(Math.max(1, selectedMatchday - 1))}
                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">Jornada {selectedMatchday} / {maxMatchday}</span>
                  <button
                    onClick={() => setSelectedMatchday(Math.min(maxMatchday, selectedMatchday + 1))}
                    className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {matchesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/2 border border-white/5 rounded-2xl animate-pulse">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
              ) : selectedMatchdayGames.length === 0 ? (
                <div className="text-center py-16 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
                  No hay partidos registrados en esta jornada.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 animate-fade-in">
                  {selectedMatchdayGames.map((m: any) => {
                    const hasPlayed = m.home_score !== null && m.away_score !== null;
                    
                    return (
                      <div
                        key={m.id}
                        onClick={() => fetchMatchDetail(m.id)}
                        className="glass rounded-2xl border border-white/10 hover:border-white/20 p-4 transition-all hover:-translate-y-0.5 flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex-1 flex justify-between items-center gap-3">
                          <div className="flex-1 text-right font-extrabold text-xs text-white truncate">{displayTeamName(m.home_team)}</div>
                          
                          <div className="px-3.5 py-1 rounded-xl bg-slate-950/80 border border-white/5 text-xs font-black text-center min-w-[70px] group-hover:border-emerald-500/30 transition-colors">
                            {hasPlayed ? `${m.home_score} - ${m.away_score}` : "vs"}
                          </div>

                          <div className="flex-1 font-extrabold text-xs text-white truncate">{displayTeamName(m.away_team)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED PLAYER PROFILE & MULTI-PLAYER COMPARISON MODAL */}
      {mounted && selectedDetailPlayer && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl border border-white/10 w-full max-w-4xl p-6 bg-slate-900/90 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto space-y-5">
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedDetailPlayer(null);
                setSelectedScoutedPlayer(null);
                setComparedPlayers([]);
                setCompareSearch("");
              }}
              className="absolute top-4 right-4 text-slate-455 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Ficha Analítica y Comparativa: {selectedDetailPlayer.player_name}
              </h2>
              <p className="text-xs text-slate-455 mt-0.5 uppercase tracking-wider font-bold">
                Posición: {SPANISH_POSITION_LABELS[selectedDetailPlayer.position] || selectedDetailPlayer.position}
              </p>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: Teams, Radar Chart, and Multi-Player Side-by-Side numbers */}
              <div className="space-y-4">
                <div className="bg-white/2 p-4 border border-white/5 rounded-2xl space-y-2">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Historial de Equipos</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {historyLoading ? (
                      <span className="text-xs text-slate-500 italic">Cargando clubes...</span>
                    ) : historicalTeamsList.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">No hay clubes registrados</span>
                    ) : (
                      historicalTeamsList.map((t, idx) => (
                        <span key={idx} className="bg-slate-955/60 border border-white/5 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Multi-player radar chart */}
                <RadarChart
                  mainPlayerName={selectedDetailPlayer.player_name}
                  mainPlayerStats={scoutedPlayerStats}
                  comparedPlayers={comparedPlayers}
                  isDefensive={!!(selectedDetailPlayer.position && 
                    ["goalkeeper", "back", "portero", "defensa", "lateral", "central"].some(pType => selectedDetailPlayer.position.toLowerCase().includes(pType))
                  )}
                />

                {/* Leyenda y Explicación de Métricas del Radar */}
                <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl text-[10px] text-slate-400 space-y-2.5 shadow-inner">
                  <div className="font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <span>📊</span>
                    <span>Explicación de Ejes del Radar</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] leading-relaxed">
                    <div>
                      <strong className="text-white block">Ataque (Goles)</strong>
                      <span>Volumen de goles marcados (escala máx. 12 goles).</span>
                    </div>
                    <div>
                      <strong className="text-white block">Impacto (+/-)</strong>
                      <span>Diferencial de goles mientras está en el campo.</span>
                    </div>
                    <div>
                      <strong className="text-white block">Regularidad %</strong>
                      <span>Consistencia y porcentaje de titularidades en la temporada.</span>
                    </div>
                    <div>
                      <strong className="text-white block">
                        {selectedDetailPlayer.position && ["goalkeeper", "back", "portero", "defensa", "lateral", "central"].some(pType => selectedDetailPlayer.position.toLowerCase().includes(pType)) ? "Portería Cero %" : "Minutos/Gol"}
                      </strong>
                      <span>
                        {selectedDetailPlayer.position && ["goalkeeper", "back", "portero", "defensa", "lateral", "central"].some(pType => selectedDetailPlayer.position.toLowerCase().includes(pType)) 
                          ? "Ratio de partidos sin recibir goles." 
                          : "Minutos jugados necesarios para anotar (inverso, menor es mejor)."}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <strong className="text-white block">Disciplina (Tarjetas)</strong>
                      <span>Frecuencia y control de amonestaciones (tarjetas por minuto, a menor tarjetas mejor puntuación).</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Historical Stats & Multi-Player selector list */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estadísticas por Año / Temporada</h3>
                
                {historyLoading ? (
                  <div className="flex justify-center py-10 bg-white/2 border border-white/5 rounded-2xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                  </div>
                ) : playerHistory.length === 0 ? (
                  <div className="text-center py-10 bg-white/2 border border-white/5 rounded-2xl text-slate-500 italic text-xs">
                    Sin registros históricos de partidos.
                  </div>
                ) : (
                  <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/3 text-slate-400 font-bold uppercase tracking-wider select-none">
                          <th className="px-3 py-2">Año</th>
                          <th className="px-3 py-2">Club</th>
                          <th className="px-3 py-2 text-center">Partidos</th>
                          <th className="px-3 py-2 text-center">Minutos</th>
                          <th className="px-3 py-2 text-center">Goles</th>
                          <th className="px-3 py-2 text-center">T. Amar.</th>
                          <th className="px-3 py-2 text-center">T. Roja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                        {playerHistory.map((h, idx) => (
                          <tr key={idx} className="hover:bg-white/2 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-white">{h.season}</td>
                            <td className="px-3 py-2.5 text-slate-455">{displayTeamName(h.team_name)}</td>
                            <td className="px-3 py-2.5 text-center">{h.matches_played} ({h.starts} tit)</td>
                            <td className="px-3 py-2.5 text-center">{h.minutes_on} min</td>
                             <td className="px-3 py-2.5 text-center text-amber-450 font-black">
                               {h.goals_scored}
                               {h.penalties_scored > 0 && (
                                 <span className="text-[9px] text-slate-500 font-semibold block">
                                   ({h.penalties_scored} pen)
                                 </span>
                               )}
                             </td>
                            <td className="px-3 py-2.5 text-center text-amber-500 font-bold">{h.yellow_cards}</td>
                            <td className="px-3 py-2.5 text-center text-rose-500 font-bold">{h.red_cards}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Compare Selection Menu supporting any database player with typing filters */}
                <div className="bg-white/2 p-4 border border-white/5 rounded-2xl space-y-3">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                    Comparar con otro jugador (Mi plantilla o rivales):
                  </label>
                  
                   {/* Search input to filter dropdown options instantly */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe para buscar jugador..."
                      value={compareSearch}
                      onChange={(e) => setCompareSearch(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                    {compareLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-emerald-500" />
                        <span className="text-[9px] text-emerald-450 font-bold animate-pulse">Buscando...</span>
                      </div>
                    )}
                  </div>

                  <CustomSelect
                    value=""
                    onChange={(val) => {
                      handleAddComparisonPlayer(val);
                      setCompareSearch(""); // Reset search on select
                    }}
                    options={getComparisonOptions()}
                    placeholder={compareLoading ? "Buscando en base de datos..." : compareSearch ? "Resultados de la búsqueda..." : "Seleccionar de la lista..."}
                    className="w-full"
                  />
                  {comparedPlayers.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Jugadores comparados:</div>
                      <div className="flex flex-col gap-2 w-full">
                        {comparedPlayers.map((cp, idx) => {
                          const cpColors = [
                            "bg-blue-500/10 text-blue-400 border-blue-500/50 hover:bg-blue-500/15",
                            "bg-amber-500/10 text-amber-500 border-amber-500/50 hover:bg-amber-500/15",
                            "bg-purple-500/10 text-purple-400 border-purple-500/50 hover:bg-purple-500/15"
                          ];
                          const colorClass = cpColors[idx % cpColors.length];

                          return (
                            <div
                              key={cp.key}
                              className={`flex items-center justify-between border-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg transition-all ${colorClass}`}
                            >
                              <span>{cp.name}</span>
                              <button
                                onClick={() => handleRemoveComparePlayer(cp.key)}
                                className="ml-3 hover:text-white font-black text-sm cursor-pointer transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-2xl text-[10px] text-slate-400 leading-relaxed space-y-1.5 mt-3 shadow-inner">
                    <div className="font-bold text-emerald-450 uppercase tracking-wider flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Guía de Análisis Comparativo</span>
                    </div>
                    <p>
                      Esta vista permite contrastar perfiles estadísticos directamente. El <strong className="text-white">Impacto Neto/90m</strong> mide el balance de goles del equipo con el jugador en el campo. El <strong className="text-white">Efecto Revulsivo</strong> cuantifica la mejora inmediata del marcador tras ingresar como sustituto. La <strong className="text-white">Regularidad</strong> evalúa la consistencia de participación en la campaña actual.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side numbers table supporting multiple players (full width below the grid) */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl mt-4 w-full mb-8 max-h-[380px] overflow-y-auto">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-355 font-bold uppercase select-none">
                      <th className="px-4 py-3.5 min-w-[180px] text-slate-300 sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">Variable</th>
                      <th className="px-4 py-3.5 text-emerald-455 text-center min-w-[160px] whitespace-nowrap bg-white/5 font-extrabold sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">{selectedDetailPlayer.player_name}</th>
                      {comparedPlayers.map((cp, idx) => {
                        const cpColors = ["text-blue-400", "text-amber-500", "text-purple-400"];
                        const colorClass = cpColors[idx % cpColors.length];
                        return (
                          <th key={idx} className={`px-4 py-3.5 ${colorClass} text-center min-w-[160px] whitespace-nowrap font-extrabold sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md`}>
                            {cp.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-100 font-medium">
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Partidos Jugados</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-400 text-center bg-white/5">{selectedDetailPlayer.matches_played}</td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 font-bold text-white text-center">{cp.stats.matches_played ?? 0}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Titularidades</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">{selectedDetailPlayer.starts}</td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">{cp.stats.starts ?? 0}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Minutos</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">{selectedDetailPlayer.minutes_on} min</td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">{cp.stats.minutes_on ?? 0} min</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Ratio de Titularidad</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.matches_played > 0 ? `${Math.round((selectedDetailPlayer.starts / selectedDetailPlayer.matches_played) * 100)}%` : "0%"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.matches_played > 0 ? `${Math.round(((cp.stats.starts || 0) / cp.stats.matches_played) * 100)}%` : "0%"}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Minutos por Partido</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.matches_played > 0 ? `${Math.round(selectedDetailPlayer.minutes_on / selectedDetailPlayer.matches_played)} min` : "0 min"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.matches_played > 0 ? `${Math.round((cp.stats.minutes_on || 0) / cp.stats.matches_played)} min` : "0 min"}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Goles Marcados</td>
                      <td className="px-4 py-2.5 font-bold text-amber-500 text-center bg-white/5">
                        {selectedDetailPlayer.goals_scored}
                        {(selectedDetailPlayer.penalties_scored ?? 0) > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            ({selectedDetailPlayer.penalties_scored} {(selectedDetailPlayer.penalties_scored ?? 0) === 1 ? "penalti" : "penaltis"})
                          </span>
                        )}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 font-bold text-amber-500 text-center">
                          {cp.stats.goals_scored || 0}
                          {(cp.stats.penalties_scored ?? 0) > 0 && (
                            <span className="text-[10px] text-slate-400 font-medium block">
                              ({cp.stats.penalties_scored} {cp.stats.penalties_scored === 1 ? "penalti" : "penaltis"})
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Goles por 90 min</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.minutes_on > 0 ? ((selectedDetailPlayer.goals_scored / selectedDetailPlayer.minutes_on) * 90).toFixed(2) : "0.00"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.minutes_on > 0 ? (((cp.stats.goals_scored || 0) / cp.stats.minutes_on) * 90).toFixed(2) : "0.00"}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Tarjetas</td>
                      <td className="px-4 py-2.5 text-center bg-white/5">
                        <div className="flex justify-center items-center gap-1.5 font-bold">
                          <span className="text-yellow-500">{selectedDetailPlayer.yellow_cards || 0}🟨</span>
                          <span className="text-rose-500">{selectedDetailPlayer.red_cards || 0}🟥</span>
                        </div>
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-center">
                          <div className="flex justify-center items-center gap-1.5 font-bold">
                            <span className="text-yellow-500">{cp.stats.yellow_cards || 0}🟨</span>
                            <span className="text-rose-500">{cp.stats.red_cards || 0}🟥</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Tarjetas por 90 min</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.minutes_on > 0 ? (((selectedDetailPlayer.yellow_cards + selectedDetailPlayer.red_cards) / selectedDetailPlayer.minutes_on) * 90).toFixed(2) : "0.00"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.minutes_on > 0 ? ((((cp.stats.yellow_cards || 0) + (cp.stats.red_cards || 0)) / cp.stats.minutes_on) * 90).toFixed(2) : "0.00"}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Impacto Neto / 90 min</td>
                      <td className="px-4 py-2.5 font-extrabold text-white text-center bg-white/5">{selectedDetailPlayer.net_impact_per_90}</td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 font-extrabold text-white text-center">{cp.stats.net_impact_per_90 ?? "—"}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Efecto Revulsivo</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">{selectedDetailPlayer.revulsive_impact}</td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">{cp.stats.revulsive_impact ?? "—"}</td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Regularidad</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.regularity_index !== undefined && selectedDetailPlayer.regularity_index !== null ? `${selectedDetailPlayer.regularity_index}%` : "—"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.regularity_index !== undefined && cp.stats.regularity_index !== null ? `${cp.stats.regularity_index}%` : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Min/Tarjeta</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.cards_density && selectedDetailPlayer.cards_density < 9999 ? `${selectedDetailPlayer.cards_density} min` : "—"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.cards_density && cp.stats.cards_density < 9999 ? `${cp.stats.cards_density} min` : "—"}
                        </td>
                      ))}
                    </tr>
                    
                    {/* Conditionally display Clean Sheet or Goals Conceded for defenders/gk; otherwise display Min/Gol and % Team Goals for forwards/midfielders */}
                    {selectedDetailPlayer.position && 
                     ["goalkeeper", "back", "portero", "defensa", "lateral", "central"].some(pType => selectedDetailPlayer.position.toLowerCase().includes(pType)) ? (
                      <>
                        <tr className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-400">Port. Cero %</td>
                          <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                            {selectedDetailPlayer.clean_sheet_ratio !== undefined && selectedDetailPlayer.clean_sheet_ratio !== null ? `${selectedDetailPlayer.clean_sheet_ratio}%` : "—"}
                          </td>
                          {comparedPlayers.map((cp, idx) => (
                            <td key={idx} className="px-4 py-2.5 text-white text-center">
                              {cp.stats.clean_sheet_ratio !== undefined && cp.stats.clean_sheet_ratio !== null ? `${cp.stats.clean_sheet_ratio}%` : "—"}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-400">Min/Gol Contra</td>
                          <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                            {selectedDetailPlayer.goals_against_while_on && selectedDetailPlayer.goals_against_while_on > 0 ? `${Math.round(selectedDetailPlayer.minutes_on / selectedDetailPlayer.goals_against_while_on)} min` : "—"}
                          </td>
                          {comparedPlayers.map((cp, idx) => (
                            <td key={idx} className="px-4 py-2.5 text-white text-center">
                              {cp.stats.goals_against_while_on && cp.stats.goals_against_while_on > 0 ? `${Math.round(cp.stats.minutes_on / cp.stats.goals_against_while_on)} min` : "—"}
                            </td>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-400">Goles de Penalti</td>
                          <td className="px-4 py-2.5 font-bold text-white text-center bg-white/5">{selectedDetailPlayer.penalties_scored || 0}</td>
                          {comparedPlayers.map((cp, idx) => (
                            <td key={idx} className="px-4 py-2.5 font-bold text-white text-center">{cp.stats.penalties_scored || 0}</td>
                          ))}
                        </tr>
                        <tr className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-400">Min/Gol</td>
                          <td className="px-4 py-2.5 text-slate-100 font-bold text-center bg-white/5">
                            {selectedDetailPlayer.goals_scored && selectedDetailPlayer.goals_scored > 0 ? `${Math.round(selectedDetailPlayer.minutes_on / selectedDetailPlayer.goals_scored)} min` : "—"}
                          </td>
                          {comparedPlayers.map((cp, idx) => (
                            <td key={idx} className="px-4 py-2.5 text-white font-bold text-center">
                              {cp.stats.goals_scored && cp.stats.goals_scored > 0 ? `${Math.round(cp.stats.minutes_on / cp.stats.goals_scored)} min` : "—"}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-400">% Goles Equipo</td>
                          <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                            {selectedDetailPlayer.goals_for_while_on && selectedDetailPlayer.goals_for_while_on > 0 ? `${Math.round((selectedDetailPlayer.goals_scored / selectedDetailPlayer.goals_for_while_on) * 100)}%` : "0%"}
                          </td>
                          {comparedPlayers.map((cp, idx) => (
                            <td key={idx} className="px-4 py-2.5 text-white text-center">
                              {cp.stats.goals_for_while_on && cp.stats.goals_for_while_on > 0 ? `${Math.round(((cp.stats.goals_scored || 0) / cp.stats.goals_for_while_on) * 100)}%` : "0%"}
                            </td>
                          ))}
                        </tr>
                      </>
                    )}
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-400">Min/Gol Favor</td>
                      <td className="px-4 py-2.5 text-slate-100 text-center bg-white/5">
                        {selectedDetailPlayer.goals_for_while_on && selectedDetailPlayer.goals_for_while_on > 0 ? `${Math.round(selectedDetailPlayer.minutes_on / selectedDetailPlayer.goals_for_while_on)} min` : "—"}
                      </td>
                      {comparedPlayers.map((cp, idx) => (
                        <td key={idx} className="px-4 py-2.5 text-white text-center">
                          {cp.stats.goals_for_while_on && cp.stats.goals_for_while_on > 0 ? `${Math.round(cp.stats.minutes_on / cp.stats.goals_for_while_on)} min` : "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MATCH DETAILS MODAL (Visualización pulida con colores por equipo e iconos premium) */}
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
                  <div className="text-[10px] text-emerald-450 font-black uppercase tracking-wider">{matchDetail.match.competition} — Jornada {matchDetail.match.matchday}</div>
                  <div className="flex items-center justify-center gap-6">
                    <span className="text-lg font-black text-blue-400">{displayTeamName(matchDetail.match.home_team)}</span>
                    <span className="text-3xl font-black text-emerald-400 bg-slate-950/80 px-4 py-1.5 rounded-2xl border border-white/5">
                      {matchDetail.match.home_score} - {matchDetail.match.away_score}
                    </span>
                    <span className="text-lg font-black text-emerald-455">{displayTeamName(matchDetail.match.away_team)}</span>
                  </div>
                  <div className="text-[10px] text-slate-455 leading-relaxed">
                    Fecha: {matchDetail.match.match_date || "—"} | Campo: {matchDetail.match.venue || "—"}
                  </div>
                </div>

                {/* Match events timeline and lineups side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Lineups with visual team differentiating headers */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alineación y Plantillas</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Home team - Blue Color Scheme */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-blue-500/20 pb-1">
                          <h4 className="text-xs font-extrabold text-blue-400 truncate">{displayTeamName(matchDetail.match.home_team)}</h4>
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-black">LOCAL</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {matchDetail.lineups
                            .filter((l: any) => l.team_name === matchDetail.match.home_team)
                            .map((l: any) => (
                              <div key={l.id} className="flex justify-between items-center py-1 px-1.5 rounded bg-blue-500/5 border border-blue-500/10 text-blue-300">
                                <span>{l.shirt_number ? `${l.shirt_number}. ` : ""}{l.player_name}</span>
                                <span className="text-[8px] font-black text-blue-500 uppercase">{l.is_starter ? "TIT" : "SUPL"}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Away team - Emerald Color Scheme */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                          <h4 className="text-xs font-extrabold text-emerald-455 truncate">{displayTeamName(matchDetail.match.away_team)}</h4>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded font-black">VISITANTE</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {matchDetail.lineups
                            .filter((l: any) => l.team_name === matchDetail.match.away_team)
                            .map((l: any) => (
                              <div key={l.id} className="flex justify-between items-center py-1 px-1.5 rounded bg-emerald-500/5 border border-emerald-500/10 text-emerald-355">
                                <span>{l.shirt_number ? `${l.shirt_number}. ` : ""}{l.player_name}</span>
                                <span className="text-[8px] font-black text-emerald-550 uppercase">{l.is_starter ? "TIT" : "SUPL"}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Match Events timeline - Categorized with visual colors per team and premium icons */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Incidencias y Cronología</h3>
                      
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
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {getFilteredMatchEvents().map((e: any, idx: number) => {
                          const isGoal = e.event_type === "goal";
                          const isCard = e.event_type.includes("card");
                          const isSub = e.event_type.includes("substitution");
                          
                          // Determine team color scheme
                          const isHomeTeam = e.team_name === matchDetail.match.home_team;
                          const teamBorderColor = isHomeTeam ? "border-blue-500/25 bg-blue-500/5 text-blue-300" : "border-emerald-500/25 bg-emerald-500/5 text-emerald-355";
                          const isOwnGoal = isGoal && e.detail?.toLowerCase().includes("propia");

                          return (
                            <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${teamBorderColor}`}>
                              {/* Minute badge */}
                              <span className={`font-extrabold bg-slate-950/80 px-2 py-0.5 rounded text-[10px] ${isHomeTeam ? "text-blue-400" : "text-emerald-455"}`}>
                                {e.minute}{e.extra_time ? `+${e.extra_time}` : ""}'
                              </span>
                              
                              {/* Event Premium Icon */}
                              {isGoal && (
                                <span className={isOwnGoal ? "text-rose-500 text-sm filter drop-shadow-[0_0_4px_rgba(244,63,94,0.6)] font-bold" : "text-emerald-400 text-sm filter drop-shadow-[0_0_4px_rgba(16,185,129,0.6)] font-bold"} title={isOwnGoal ? "Autogol" : "Gol"}>
                                  ⚽
                                </span>
                              )}
                              {e.event_type === "yellow_card" && (
                                <span className="w-2.5 h-3.5 rounded-xs inline-block shadow-md border" style={{ backgroundColor: '#eab308', borderColor: '#ca8a04' }} title="Tarjeta Amarilla" />
                              )}
                              {e.event_type === "red_card" && (
                                <span className="w-2.5 h-3.5 rounded-xs inline-block shadow-md border" style={{ backgroundColor: '#e11d48', borderColor: '#be123c' }} title="Tarjeta Roja" />
                              )}
                              {e.event_type === "yellow_red_card" && (
                                <span className="w-2.5 h-3.5 rounded-xs inline-block shadow-md border" style={{ backgroundColor: '#f97316', borderColor: '#ea580c' }} title="Doble Amarilla" />
                              )}
                              {isSub && (
                                <span className="text-sky-400 text-sm filter drop-shadow-[0_0_4px_rgba(56,189,248,0.6)]" title="Sustitución">
                                  🔄
                                </span>
                              )}

                              {/* Details */}
                              <div className="flex-1 leading-normal flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isHomeTeam ? "bg-blue-500/15 text-blue-400 border border-blue-500/25" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"}`}>
                                  {isHomeTeam ? "L" : "V"}
                                </span>
                                <div>
                                  <strong className="text-white">{e.player_name}</strong>
                                  <span className="text-[10px] text-slate-500"> ({displayTeamName(e.team_name)})</span>
                                  {e.detail && <span className="text-slate-455 block text-[9px] font-bold mt-0.5">{e.detail}</span>}
                                </div>
                              </div>

                              {/* Score check after goal */}
                              {isGoal && e.score_home_after !== null && (
                                <span className="text-[10px] font-black text-slate-300 ml-auto bg-slate-950/80 px-2 py-0.5 rounded border border-white/5">
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
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const SQUAD_POSITION_OPTIONS = [
  { value: "all", label: "Todas las Posiciones" },
  { value: "goalkeeper", label: "Portero" },
  { value: "back", label: "Defensa" },
  { value: "midfielder", label: "Centrocampista" },
  { value: "winger", label: "Extremo" },
  { value: "striker", label: "Delantero Centro" },
];

const calculateStandings = (matchList: any[]) => {
  const table: Record<string, any> = {};

  for (const m of matchList) {
    if (m.home_score === null || m.away_score === null) continue;

    const home = m.home_team;
    const away = m.away_team;

    if (!table[home]) {
      table[home] = { team: home, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
    }
    if (!table[away]) {
      table[away] = { team: away, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
    }

    const tHome = table[home];
    const tAway = table[away];

    tHome.pj += 1;
    tAway.pj += 1;

    tHome.gf += m.home_score;
    tHome.gc += m.away_score;
    tAway.gf += m.away_score;
    tAway.gc += m.home_score;

    if (m.home_score > m.away_score) {
      tHome.pg += 1;
      tHome.pts += 3;
      tAway.pp += 1;
    } else if (m.home_score < m.away_score) {
      tAway.pg += 1;
      tAway.pts += 3;
      tHome.pp += 1;
    } else {
      tHome.pe += 1;
      tHome.pts += 1;
      tAway.pe += 1;
      tAway.pts += 1;
    }
  }

  return Object.values(table).sort((a: any, b: any) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const diffA = a.gf - a.gc;
    const diffB = b.gf - b.gc;
    if (diffB !== diffA) return diffB - diffA;
    return b.gf - a.gf;
  });
};
