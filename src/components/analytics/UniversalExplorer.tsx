"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Zap,
  X,
  FileText,
  Loader2,
  Printer,
  ChevronRight,
  ChevronLeft,
  Search,
  History,
  AlertCircle
} from "lucide-react";
import {
  exploreAction,
  getSavedViewsAction,
  saveSavedViewAction,
  deleteSavedViewAction,
  getScoutingOpportunitiesAction,
  getTeamLeaguePositionAction,
} from "@/features/analysis/actions";
import { getEntityConfig } from "@/features/analysis/entities";
import { FilterEngine } from "@/features/analysis/engines/filter";
import { MetricRegistry } from "@/features/analysis/registry/metrics";
import { FilterGroup, ExplorerResult, ExplorerRow, SavedView, EntityType, ReportConfig } from "@/features/analysis/types";

// Import subcomponents
import { FilterPanel } from "./components/FilterPanel";
import { MetricsGrid } from "./components/MetricsGrid";
import { RadarChart } from "./components/RadarChart";
import { InsightsCard } from "./components/InsightsCard";
import { ReportPreview } from "./components/ReportPreview";
import { PlayerProfileModal } from "./components/PlayerProfileModal";
import { BenchmarkingCard } from "./components/BenchmarkingCard";

interface UniversalExplorerProps {
  userId: string;
  organizationId: string;
  activeSeasonName: string;
  userRole: string;
  defaultCompetition?: string;
}

/**
 * UniversalExplorer Parent Dashboard Component.
 * Orchestrates entity tab selections, dynamic filter rule building, saved view storage,
 * and launches comparative SVG radar charts and layout report builders.
 */
export const UniversalExplorer: React.FC<UniversalExplorerProps> = ({
  userId,
  organizationId,
  activeSeasonName,
  userRole,
  defaultCompetition = "Tercera Federación - Grupo 8",
}) => {
  // 1. TABS STATE
  const [entityType, setEntityType] = useState<EntityType>("player");

  // 2. QUERY & EXPLORER STATE
  const [filters, setFilters] = useState<FilterGroup>({
    condition: "AND",
    rules: [
      { field: "season", operator: "eq", value: activeSeasonName },
      { field: "competition", operator: "eq", value: defaultCompetition }
    ]
  });
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25); // 25 items per page

  const [explorerData, setExplorerData] = useState<ExplorerResult | null>(null);
  const [loading, setLoading] = useState(true);

  // 3. SAVED VIEWS STATE
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // 4. ROW SELECTION & COMPARISON STATE
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [manualComparePosition, setManualComparePosition] = useState<string | null>(null);

  // 5. REPORT BUILDER STATE
  const [showReportModal, setShowReportModal] = useState(false);
  const [isComparisonMode, setIsComparisonMode] = useState(false);

  // 6. EXTRA STATE FOR PROFILE DETAILS & CLUB CONTEXT
  const [profilePlayerName, setProfilePlayerName] = useState<string | null>(null);
  const [previousProfilePlayerName, setPreviousProfilePlayerName] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>("C.D. Almazán");
  const [scoutingRows, setScoutingRows] = useState<ExplorerRow[]>([]);
  const [compareWithAverage, setCompareWithAverage] = useState(false);
  const [leagueAverages, setLeagueAverages] = useState<Record<string, number> | null>(null);
  const [loadingAverages, setLoadingAverages] = useState(false);
  const [myTeamPlayers, setMyTeamPlayers] = useState<{ id: string; name: string; team_name: string }[]>([]);
  const [compareSearchQuery, setCompareSearchQuery] = useState("");
  const [compareSearchSuggestions, setCompareSearchSuggestions] = useState<ExplorerRow[]>([]);
  const [isCompareSearching, setIsCompareSearching] = useState(false);
  const [showCompareSuggestions, setShowCompareSuggestions] = useState(false);
  const compareSearchRef = useRef<HTMLDivElement>(null);
  const [activeSeasonSelectorPlayerId, setActiveSeasonSelectorPlayerId] = useState<string | null>(null);
  const [playerSeasonsList, setPlayerSeasonsList] = useState<ExplorerRow[]>([]);
  const [loadingPlayerSeasons, setLoadingPlayerSeasons] = useState(false);
  const [seasonPositions, setSeasonPositions] = useState<Record<string, number | null>>({});
  const [compareWithPlayerHistory, setCompareWithPlayerHistory] = useState(false);
  const [playerHistoryAverages, setPlayerHistoryAverages] = useState<Record<string, number> | null>(null);
  const [loadingHistoryAverages, setLoadingHistoryAverages] = useState(false);
  const [categoryMaxValues, setCategoryMaxValues] = useState<Record<string, number>>({});
  const [loadingCategoryMaxValues, setLoadingCategoryMaxValues] = useState(false);

  const getComparisonData = () => {
    if (!explorerData || selectedRowIds.length === 0) return null;

    const allCandidates = [...(explorerData?.rows || []), ...scoutingRows];
    const uniqueCandidatesMap = new Map<string, ExplorerRow>();
    for (const r of allCandidates) {
      uniqueCandidatesMap.set(String(r.id), r);
    }

    const selectedRows = selectedRowIds
      .map((id) => uniqueCandidatesMap.get(String(id)))
      .filter((r): r is ExplorerRow => r !== undefined);

    if (selectedRows.length === 0) return null;
    
    let compareMetrics = selectedMetrics;
    if (entityType === "player") {
      const primaryPos = manualComparePosition || selectedRows[0]?.details?.position || "midfielder";
      if (primaryPos === "goalkeeper") {
        compareMetrics = ["cleanSheetRatio", "goalsConceded90", "concededGoalsRatio", "minutes", "matches", "cardPoints"].filter(id => MetricRegistry.get(id) !== undefined);
      } else if (primaryPos === "back") {
        compareMetrics = ["cleanSheetRatio", "goalsConceded90", "goals", "minutes", "matches", "cardPoints"].filter(id => MetricRegistry.get(id) !== undefined);
      } else if (primaryPos === "midfielder") {
        compareMetrics = ["impact", "minutes", "goals", "goals90", "matches", "yellowCards"].filter(id => MetricRegistry.get(id) !== undefined);
      } else {
        compareMetrics = ["goals", "goals90", "dependency", "impact", "minutes", "matches"].filter(id => MetricRegistry.get(id) !== undefined);
      }
    }
    
    const maxValues: Record<string, number> = {};
    for (const mId of compareMetrics) {
      if (categoryMaxValues[mId] !== undefined) {
        maxValues[mId] = categoryMaxValues[mId];
      } else {
        // Fallback to compared candidate rows if league-wide maxes aren't loaded yet
        const values = selectedRows.map((r) => Number(r.metrics[mId])).filter((v) => !isNaN(v));
        if (compareWithAverage && leagueAverages && leagueAverages[mId] !== undefined) {
          values.push(Number(leagueAverages[mId]));
        }
        if (compareWithPlayerHistory && playerHistoryAverages && playerHistoryAverages[mId] !== undefined) {
          values.push(Number(playerHistoryAverages[mId]));
        }
        maxValues[mId] = Math.max(...values, 1);
      }
    }

    const radarLabels = compareMetrics.map((mId) => ({
      key: mId,
      label: MetricRegistry.get(mId)?.name || mId,
    }));

    const radarDatasets = selectedRows.map((row, idx) => {
      const normalizedValues: Record<string, number> = {};
      for (const mId of compareMetrics) {
        const val = Number(row.metrics[mId]) || 0;
        normalizedValues[mId] = parseFloat(((val / maxValues[mId]) * 100).toFixed(1));
      }

      const colors = ["var(--primary)", "#06b6d4", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"];
      return {
        label: `${row.name} (${row.details?.team_name || ""}) (${row.details?.season || ""})`,
        values: normalizedValues,
        color: colors[idx % colors.length],
      };
    });

    if (compareWithAverage && leagueAverages) {
      const avgNormalizedValues: Record<string, number> = {};
      for (const mId of compareMetrics) {
        const val = Number(leagueAverages[mId]) || 0;
        avgNormalizedValues[mId] = parseFloat(((val / maxValues[mId]) * 100).toFixed(1));
      }
      radarDatasets.push({
        label: "Media de la Liga",
        values: avgNormalizedValues,
        color: "#6b7280",
      });
    }

    if (compareWithPlayerHistory && playerHistoryAverages && selectedRows.length > 0) {
      const historyNormalizedValues: Record<string, number> = {};
      for (const mId of compareMetrics) {
        const val = Number(playerHistoryAverages[mId]) || 0;
        historyNormalizedValues[mId] = parseFloat(((val / maxValues[mId]) * 100).toFixed(1));
      }
      radarDatasets.push({
        label: `Media Histórica (${selectedRows[0]?.name})`,
        values: historyNormalizedValues,
        color: "#10b981",
      });
    }

    return {
      labels: radarLabels,
      datasets: radarDatasets,
      rawEntities: selectedRows,
      compareMetrics,
    };
  };

  const compData = getComparisonData();

  // Auto-close comparison modal if all players are removed
  useEffect(() => {
    if (showCompareModal && selectedRowIds.length === 0) {
      setShowCompareModal(false);
    }
  }, [selectedRowIds, showCompareModal]);

  // Load organization name on mount
  useEffect(() => {
    async function loadClubName() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", organizationId)
          .single();
        if (org?.name) {
          const isPlaceholder = org.name.toLowerCase().includes("clublab");
          setClubName(isPlaceholder ? "C.D. Almazán" : org.name);
        }
      } catch (err) {
        console.warn("Could not load club name:", err);
      }
    }
    if (organizationId) {
      loadClubName();
    }
  }, [organizationId]);

  // Load my team players for comparison quick select
  useEffect(() => {
    async function loadMyTeamPlayers() {
      if (!clubName || !activeSeasonName) return;
      try {
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [
              { field: "season", operator: "eq", value: activeSeasonName },
              { field: "team_name", operator: "eq", value: clubName }
            ]
          },
          metrics: [],
          page: 1,
          pageSize: 100,
          organizationId,
        });
        setMyTeamPlayers(res.rows.map(r => ({
          id: r.id,
          name: r.name,
          team_name: r.details?.team_name || clubName
        })));
      } catch (err) {
        console.warn("Could not load my team players:", err);
      }
    }
    loadMyTeamPlayers();
  }, [clubName, activeSeasonName]);

  // Click outside listener for comparison suggestions panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (compareSearchRef.current && !compareSearchRef.current.contains(event.target as Node)) {
        setShowCompareSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autocomplete matching players across the league for comparison
  useEffect(() => {
    if (compareSearchQuery.trim().length < 2) {
      setCompareSearchSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsCompareSearching(true);
      try {
        const targetSeason = selectedRowIds.length > 0
          ? (scoutingRows.find(r => r.id === selectedRowIds[0])?.details?.season || explorerData?.rows.find(r => r.id === selectedRowIds[0])?.details?.season || activeSeasonName)
          : activeSeasonName;
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [
              { field: "season", operator: "eq", value: targetSeason },
              { field: "player_name", operator: "like", value: compareSearchQuery.trim() }
            ]
          },
          metrics: [],
          page: 1,
          pageSize: 15,
          organizationId,
        });
        setCompareSearchSuggestions(res.rows);
      } catch (err) {
        console.warn("Could not search players for comparison:", err);
      } finally {
        setIsCompareSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [compareSearchQuery, activeSeasonName, selectedRowIds[0], organizationId]);

  // ============================================================
  // LOAD CAPABILITIES & PRESERVE FILTERS ON TAB CHANGE
  // ============================================================
  useEffect(() => {
    // Clear old data instantly to show loading state
    setExplorerData(null);
    setLoading(true);

    const config = getEntityConfig(entityType);
    setSelectedMetrics(config.metrics.slice(0, 5));
    
    const firstMetric = config.metrics[0];
    setSortBy(firstMetric);
    setSortOrder("desc");

    // Clear filters and reset to default season and competition
    const isComp = entityType === "competition";
    const defaultRules = isComp
      ? [{ field: "season", operator: "in" as const, value: [activeSeasonName] }]
      : [
          { field: "season", operator: "eq" as const, value: activeSeasonName },
          ...(entityType === "player" || entityType === "team"
            ? [{ field: "competition", operator: "eq" as const, value: defaultCompetition }]
            : [])
        ];

    setFilters({
      condition: "AND",
      rules: defaultRules,
    });

    setSelectedRowIds([]);
    setActiveViewId(null);
    setPage(1);

    // Fetch saved views
    loadSavedViews();
  }, [entityType]);

  // Load independent scouting benchmarking data
  useEffect(() => {
    async function loadScouting() {
      if (entityType === "player" && organizationId) {
        const seasonFilter = filters.rules.find((r: any) => r && !("rules" in r) && r.field === "season") as any;
        const activeSeason = Array.isArray(seasonFilter?.value) ? seasonFilter.value[0] : (seasonFilter?.value || activeSeasonName);
        try {
          const rows = await getScoutingOpportunitiesAction(organizationId, activeSeason);
          setScoutingRows(rows);
        } catch (e) {
          console.warn("Error loading scouting opportunities:", e);
        }
      }
    }
    loadScouting();
  }, [entityType, filters.rules, organizationId]);

  // ============================================================
  // LOAD SAVED VIEWS
  // ============================================================
  const loadSavedViews = async () => {
    try {
      const views = await getSavedViewsAction(organizationId);
      setSavedViews(views.filter((v) => v.entityType === entityType));
    } catch (err) {
      console.error("Fallo al cargar vistas guardadas:", err);
    }
  };

  // ============================================================
  // EXECUTE SEARCH (CACHED VIA SERVICE)
  // ============================================================
  const executeSearch = async () => {
    setLoading(true);
    try {
      const allMetrics = getEntityConfig(entityType).metrics;
      const result = await exploreAction({
        entityType,
        filters,
        metrics: allMetrics,
        sortBy,
        sortOrder,
        page,
        pageSize,
        organizationId,
      });

      setExplorerData(result);
    } catch (err) {
      console.error("Fallo al buscar datos analíticos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent execution if filters are resetting during tab switches
    const seasonValues = FilterEngine.extractValues(filters, "season");
    if (seasonValues.length === 0 && activeSeasonName) return;

    executeSearch();
  }, [filters, sortBy, sortOrder, page, pageSize, entityType]);

  // ============================================================
  // SELECTIONS & COLUMN SHIFTS
  // ============================================================
  const handleToggleSelectRow = (rowId: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const handleToggleSelectAll = () => {
    if (!explorerData) return;
    const allIds = explorerData.rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedRowIds.includes(id));

    if (allSelected) {
      setSelectedRowIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleShiftMetric = (metricId: string, direction: "left" | "right") => {
    const index = selectedMetrics.indexOf(metricId);
    if (index === -1) return;

    const newMetrics = [...selectedMetrics];
    if (direction === "left" && index > 0) {
      newMetrics[index] = newMetrics[index - 1];
      newMetrics[index - 1] = metricId;
    } else if (direction === "right" && index < newMetrics.length - 1) {
      newMetrics[index] = newMetrics[index + 1];
      newMetrics[index + 1] = metricId;
    }
    setSelectedMetrics(newMetrics);
  };

  // ============================================================
  // SCOUTING CARD TRIGGER ACTIONS (SEASON SCOPED)
  // ============================================================
  const handleCompareWithClub = (otherPlayerName: string, positionCategory: string) => {
    if (!explorerData) return;

    const cleanClub = clubName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/s\.?d\.?/gi, "")
      .replace(/c\.?d\.?/gi, "")
      .trim();

    const getPosCat = (pos: string | undefined): string => {
      if (!pos) return "mc";
      if (pos === "goalkeeper") return "gk";
      if (pos === "back") return "df";
      if (pos === "midfielder") return "mc";
      return "fw";
    };

    // Scopes positional peers strictly to the currently searched active season!
    const activeSeason = FilterEngine.extractValues(filters, "season")[0] || activeSeasonName;

    const myPosPlayers = explorerData.rows.filter(
      (r) =>
        r.details?.team_name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/s\.?d\.?/gi, "")
          .replace(/c\.?d\.?/gi, "")
          .trim() === cleanClub &&
        getPosCat(r.details?.position) === positionCategory &&
        r.details?.season === activeSeason
    );

    const targetPlayer = explorerData.rows.find((r) => r.name === otherPlayerName);
    if (!targetPlayer) return;

    const compareIds = [targetPlayer.id, ...myPosPlayers.map((p) => p.id)];
    
    setSelectedRowIds(compareIds);
    setManualComparePosition(
      positionCategory === "gk" ? "goalkeeper" : positionCategory === "df" ? "back" : positionCategory === "mc" ? "midfielder" : "striker"
    );
    setShowCompareModal(true);
  };

  const handleShowTopLeague = (posCategory: string, metricId: string) => {
    const posVal =
      posCategory === "gk"
        ? "goalkeeper"
        : posCategory === "df"
        ? "back"
        : posCategory === "mc"
        ? "midfielder"
        : "striker";

    const cleanRules = filters.rules.filter(
      (r: any) => r.field !== "position" && !r.field.includes("name")
    );
    cleanRules.push({ field: "position", operator: "eq", value: posVal });

    setFilters({
      condition: "AND",
      rules: cleanRules,
    });
    setSortBy(metricId);
    setSortOrder("desc");
  };



  // Dynamically resolve real league averages when comparing with average
  useEffect(() => {
    async function loadLeagueAverages() {
      if (!compareWithAverage || !selectedRowIds.length || !compData?.rawEntities?.[0]) {
        return;
      }
      const target = compData.rawEntities[0];
      const season = target.details?.season;
      const competition = target.details?.competition;
      if (!season || !competition) return;

      setLoadingAverages(true);
      try {
        const config = getEntityConfig(entityType);
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [
              { field: "season", operator: "eq", value: season },
              { field: "competition", operator: "eq", value: competition }
            ]
          },
          metrics: config.metrics,
          page: 1,
          pageSize: 1,
          organizationId,
        });
        setLeagueAverages(res.averages);
      } catch (err) {
        console.warn("Could not load league averages:", err);
      } finally {
        setLoadingAverages(false);
      }
    }
    loadLeagueAverages();
  }, [compareWithAverage, selectedRowIds, compData?.rawEntities, entityType]);

  // Load other historical seasons of a player for multi-season comparison
  useEffect(() => {
    async function loadPlayerSeasons() {
      if (!activeSeasonSelectorPlayerId) {
        setPlayerSeasonsList([]);
        return;
      }
      const ent = compData?.rawEntities.find(e => e.id === activeSeasonSelectorPlayerId);
      if (!ent) return;

      setLoadingPlayerSeasons(true);
      try {
        const config = getEntityConfig(entityType);
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [{ field: "player_name", operator: "eq", value: ent.name }]
          },
          metrics: config.metrics,
          page: 1,
          pageSize: 20,
          organizationId,
        });

        // Sort seasons: descending (newest first)
        const sorted = [...res.rows].sort((a, b) => {
          const sA = String(a.details?.season || "");
          const sB = String(b.details?.season || "");
          return sB.localeCompare(sA, undefined, { numeric: true });
        });

        setPlayerSeasonsList(sorted);

        // Fetch standings / positions for each season concurrently
        const positions: Record<string, number | null> = {};
        await Promise.all(
          sorted.map(async (row) => {
            const team = row.details?.team_name;
            const season = row.details?.season;
            const comp = row.details?.competition;
            if (team && season && comp) {
              const pos = await getTeamLeaguePositionAction(team, season, comp);
              positions[row.id] = pos;
            }
          })
        );
        setSeasonPositions(positions);
      } catch (err) {
        console.warn("Could not load other seasons:", err);
      } finally {
        setLoadingPlayerSeasons(false);
      }
    }
    loadPlayerSeasons();
  }, [activeSeasonSelectorPlayerId, entityType]);

  // Load player historical averages across all their seasons
  useEffect(() => {
    async function loadPlayerHistoryAverages() {
      if (!compareWithPlayerHistory || !selectedRowIds.length || !compData?.rawEntities?.[0]) {
        setPlayerHistoryAverages(null);
        return;
      }
      const target = compData.rawEntities[0];
      setLoadingHistoryAverages(true);
      try {
        const config = getEntityConfig(entityType);
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [{ field: "player_name", operator: "eq", value: target.name }]
          },
          metrics: config.metrics,
          page: 1,
          pageSize: 20,
          organizationId,
        });

        const averages: Record<string, number> = {};
        for (const mId of config.metrics) {
          const vals = res.rows.map(r => Number(r.metrics[mId])).filter(v => !isNaN(v));
          const sum = vals.reduce((s, v) => s + v, 0);
          averages[mId] = vals.length > 0 ? parseFloat((sum / vals.length).toFixed(2)) : 0;
        }
        setPlayerHistoryAverages(averages);
      } catch (err) {
        console.warn("Could not load player history averages:", err);
      } finally {
        setLoadingHistoryAverages(false);
      }
    }
    loadPlayerHistoryAverages();
  }, [compareWithPlayerHistory, selectedRowIds, compData?.rawEntities, entityType]);

  // Load maximum values for the category (league and season) excluding players with <40% matches
  useEffect(() => {
    async function loadCategoryMaxValues() {
      if (!showCompareModal || !compData?.rawEntities?.[0]) {
        setCategoryMaxValues({});
        return;
      }
      const target = compData.rawEntities[0];
      const season = target.details?.season;
      const competition = target.details?.competition;
      if (!season || !competition) return;

      setLoadingCategoryMaxValues(true);
      try {
        const config = getEntityConfig(entityType);
        // Load all players in the league
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [
              { field: "season", operator: "eq", value: season },
              { field: "competition", operator: "eq", value: competition }
            ]
          },
          metrics: config.metrics,
          page: 1,
          pageSize: 1000,
          organizationId,
        });

        const currentPos = manualComparePosition || target.details?.position || "midfielder";
        
        // Filter players by broad position group
        const posPlayers = res.rows.filter(r => {
          const pos = r.details?.position || "midfielder";
          if (currentPos === "goalkeeper") return pos === "goalkeeper";
          if (currentPos === "back") return pos === "back";
          if (currentPos === "midfielder") return pos === "midfielder";
          return pos === "striker" || pos === "forward" || pos === "winger";
        });

        // Exclude players with less than 40% matches
        const maxMatches = posPlayers.length > 0
          ? Math.max(...posPlayers.map(p => Number(p.metrics.matches) || 0), 1)
          : 1;
        const matchesThreshold = maxMatches * 0.4;
        const qualifiedPlayers = posPlayers.filter(p => (Number(p.metrics.matches) || 0) >= matchesThreshold);

        // Compute maximum values
        const maxs: Record<string, number> = {};
        const allMetricsToCalculate = Array.from(new Set([...config.metrics, "cardPoints"]));
        for (const mId of allMetricsToCalculate) {
          const comparedVals = compData.rawEntities.map((r) => Number(r.metrics[mId])).filter((v) => !isNaN(v));
          if (compareWithAverage && leagueAverages && leagueAverages[mId] !== undefined) {
            comparedVals.push(Number(leagueAverages[mId]));
          }
          if (compareWithPlayerHistory && playerHistoryAverages && playerHistoryAverages[mId] !== undefined) {
            comparedVals.push(Number(playerHistoryAverages[mId]));
          }

          const categoryVals = qualifiedPlayers.map(p => Number(p.metrics[mId])).filter(v => !isNaN(v));
          const allVals = [...comparedVals, ...categoryVals];
          maxs[mId] = allVals.length > 0 ? Math.max(...allVals, 1) : 1;
        }

        setCategoryMaxValues(maxs);
      } catch (err) {
        console.warn("Could not load category max values:", err);
      } finally {
        setLoadingCategoryMaxValues(false);
      }
    }
    loadCategoryMaxValues();
  }, [
    showCompareModal,
    compData?.rawEntities?.[0]?.id,
    manualComparePosition,
    compareWithAverage,
    leagueAverages,
    compareWithPlayerHistory,
    playerHistoryAverages,
    entityType,
    organizationId
  ]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const names = compData?.rawEntities?.map(ent => ent.name.trim()) || [];
    const formattedNames = names.slice(0, 2).join("_");
    const printTitle = `ClubLab Comparativa - ${formattedNames}`;
    
    document.title = printTitle;
    window.print();
    
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // ============================================================
  // SAVED VIEWS
  // ============================================================
  const handleApplyView = (view: SavedView) => {
    setActiveViewId(view.id || null);
    setFilters(view.filters);
    setSelectedMetrics(view.metrics);
  };

  const handleSaveActiveView = async (name: string, description: string) => {
    try {
      const newView: SavedView = {
        name,
        description,
        entityType,
        organizationId,
        filters,
        metrics: selectedMetrics,
        isFavorite: false,
        createdBy: userId,
      };

      const result = await saveSavedViewAction(newView);
      if (result) {
        await loadSavedViews();
        setActiveViewId(result.id);
      }
    } catch (err) {
      console.error("Fallo al guardar la vista:", err);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteSavedViewAction(viewId, organizationId);
      await loadSavedViews();
      if (activeViewId === viewId) setActiveViewId(null);
    } catch (err) {
      console.error("Fallo al eliminar vista guardada:", err);
    }
  };

  // ============================================================
  // PLAYER DETAILS REDIRECTS
  // ============================================================
  const handleOpenPlayerProfile = (name: string) => {
    setPreviousProfilePlayerName(profilePlayerName);
    setProfilePlayerName(name);
  };

  const handleClosePlayerProfile = () => {
    setProfilePlayerName(null);
    setPreviousProfilePlayerName(null);
  };

  const handleCompareFromProfile = (rowId: string) => {
    setPreviousProfilePlayerName(profilePlayerName);
    setProfilePlayerName(null); // Close profile to draw comparison modal
    
    setSelectedRowIds((prev) => {
      if (prev.includes(rowId)) return prev;
      return [...prev, rowId];
    });
    
    setManualComparePosition(null);
    setShowCompareModal(true);
  };

  const handleCloseComparison = () => {
    setShowCompareModal(false);
    
    // Restore profile modal context
    if (previousProfilePlayerName) {
      setProfilePlayerName(previousProfilePlayerName);
      setPreviousProfilePlayerName(null);
    }
  };

  // ============================================================
  // REPORT GENERATOR
  // ============================================================
  const getCompiledReportConfig = (): ReportConfig => {
    return {
      title: "Informe de Rendimiento",
      sections: [
        {
          id: "summary_sec",
          title: "Resumen General",
          widgets: [
            {
              id: "radar_chart",
              type: "chart",
              title: "Gráfico de Rendimiento",
              width: "half",
              config: { entityType },
            },
          ],
        },
        {
          id: "data_sec",
          title: "Detalle de Indicadores",
          widgets: [
            {
              id: "explorer_table",
              type: "table",
              title: "Registros Seleccionados",
              width: "full",
              config: {
                entityType,
                metrics: selectedMetrics,
                filters,
              },
            },
          ],
        },
      ],
    };
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      {/* 1. Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Buscador universal</h2>
          <p className="text-xs text-slate-400">
            Busca, analiza y compara estadísticas de jugadores, equipos, entrenadores y competiciones.
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex items-center gap-2">
          {isComparisonMode ? (
            <>
              <button
                disabled={selectedRowIds.length < 2}
                onClick={() => {
                  setManualComparePosition(null);
                  setShowCompareModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4.5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Zap className="h-4 w-4" />
                <span>Confirmar Comparativa ({selectedRowIds.length})</span>
              </button>
              <button
                onClick={() => {
                  setIsComparisonMode(false);
                  setSelectedRowIds([]);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4.5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-[0.98]"
              >
                <span>Cancelar</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsComparisonMode(true);
                setSelectedRowIds([]);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4.5 py-2.5 text-xs font-bold text-slate-350 hover:bg-slate-900 hover:text-white transition-all active:scale-[0.98]"
            >
              <Zap className="h-4 w-4 text-primary" />
              <span>Comparar</span>
            </button>
          )}
        </div>
      </div>

      {/* Entity Tab Nav */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 rounded-xl no-print">
        {(["player", "team", "coach", "competition"] as EntityType[]).map((type) => {
          const isActive = entityType === type;
          const config = getEntityConfig(type);

          return (
            <button
              key={type}
              onClick={() => setEntityType(type)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider border border-transparent transition-all ${
                isActive
                  ? "bg-slate-900 border-slate-800 text-white shadow-inner"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 no-print">
          <div className="sticky top-6 max-h-[calc(100vh-100px)] overflow-y-auto premium-scrollbar pr-1.5">
            <FilterPanel
              entityType={entityType}
              filters={filters}
              onChangeFilters={setFilters}
              savedViews={savedViews}
              activeViewId={activeViewId}
              onApplyView={handleApplyView}
              onSaveActiveView={handleSaveActiveView}
              onDeleteView={handleDeleteView}
              activeSeasonName={activeSeasonName}
              selectedMetrics={selectedMetrics}
            />
          </div>
        </div>

        {/* Right Area */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          {/* Active columns selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 no-print">
            <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest">
              Seleccionar Métricas en Columna
            </span>
            
            <div className="flex flex-wrap gap-2">
              {getEntityConfig(entityType).metrics.map((mId) => {
                const isSelected = selectedMetrics.includes(mId);
                const name = MetricRegistry.get(mId)?.name || mId;
                const desc = MetricRegistry.get(mId)?.description || mId;
                
                return (
                  <button
                    key={mId}
                    onClick={() =>
                      setSelectedMetrics((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== mId)
                          : [...prev, mId]
                      )
                    }
                    className={`rounded-lg px-2.5 py-1 text-xxs font-semibold border transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-white"
                        : "bg-slate-950 border-slate-800/60 text-slate-500 hover:border-slate-700"
                    }`}
                    title={desc}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benchmarking Target Card (Only for Players) */}
          {entityType === "player" && (scoutingRows.length > 0 || explorerData) && (
            <div className="no-print">
              <BenchmarkingCard
                rows={scoutingRows.length > 0 ? scoutingRows : (explorerData?.rows || [])}
                myTeamName={clubName}
                onOpenPlayerProfile={handleOpenPlayerProfile}
                onCompareWithClub={handleCompareWithClub}
                onShowTopLeague={handleShowTopLeague}
              />
            </div>
          )}

          {/* Metrics Grid Area */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-center text-slate-400 shadow-xl">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-bold tracking-wide text-white animate-pulse">Cargando datos...</p>
              <p className="text-xs text-slate-400">Buscando y procesando información en la base de datos de scouting...</p>
            </div>
          ) : (
            <>
              {explorerData && explorerData.rows.length === 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200 flex flex-col items-center justify-center gap-2 text-center my-2 shadow-lg">
                  <AlertCircle className="h-7 w-7 text-amber-400 shrink-0" />
                  <p className="text-sm font-bold">Esta temporada ({activeSeasonName}) todavía no tiene información registrada</p>
                  <p className="text-xs text-amber-300/80 max-w-lg">
                    Los datos estadísticos de partidos disputados se van actualizando semanalmente. Puedes cambiar el filtro de temporada a <strong>2025/2026</strong> o anteriores en el panel de filtros para consultar el historial completo de rendimiento.
                  </p>
                </div>
              )}

              <MetricsGrid

                entityType={entityType}
                rows={explorerData?.rows || []}
                averages={explorerData?.averages || {}}
                selectedMetrics={selectedMetrics}
                selectedRowIds={selectedRowIds}
                onToggleSelectRow={handleToggleSelectRow}
                onToggleSelectAll={handleToggleSelectAll}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={(mId) => {
                  if (sortBy === mId) {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy(mId);
                    setSortOrder("desc");
                  }
                }}
                onPlayerClick={handleOpenPlayerProfile}
                onShiftMetric={handleShiftMetric}
                clubName={clubName}
                isComparisonMode={isComparisonMode}
              />

              {/* Pagination footer */}
              {explorerData && explorerData.totalCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4 no-print shadow-sm">
                  <span className="text-xs text-slate-500 font-medium">
                    Mostrando <span className="font-semibold text-slate-300">{(page - 1) * pageSize + 1}</span> a{" "}
                    <span className="font-semibold text-slate-300">{Math.min(page * pageSize, explorerData.totalCount)}</span> de{" "}
                    <span className="font-semibold text-slate-300">{explorerData.totalCount}</span> entradas
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(prev => prev - 1)}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-900 transition-all active:scale-[0.98]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Anterior</span>
                    </button>
                    <button
                      disabled={page >= Math.ceil(explorerData.totalCount / pageSize)}
                      onClick={() => setPage(prev => prev + 1)}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-900 transition-all active:scale-[0.98]"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Insights Card */}
          {explorerData && explorerData.rows.length > 0 && !loading && (
            <div className="no-print">
              <InsightsCard
                entityType={entityType}
                entityId={explorerData.rows[0].id}
                entityName={explorerData.rows[0].name}
                metrics={explorerData.rows[0].metrics}
                onPlayerClick={handleOpenPlayerProfile}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. COMPARISON MODAL */}
      {showCompareModal && compData && (
        <div className="compare-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 print:p-0 print:bg-white print:relative print:z-auto">
          <div id="compare-modal-content" className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl print:border-none print:shadow-none print:bg-slate-950 print:text-white print:max-w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 no-print">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary animate-pulse" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Comparador de rendimiento</h3>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all active:scale-[0.98]"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span>Exportar a PDF</span>
                </button>
                <button
                  onClick={handleCloseComparison}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-black uppercase text-white tracking-wider">ClubLab - Comparador de rendimiento</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Creado el día {new Date().toLocaleDateString("es-ES")}</p>
            </div>

            {/* Compared Players Badges & Quick selector */}
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-800/80 no-print">
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest mr-2">Entidades:</span>
              {compData.rawEntities.map((ent, idx) => {
                const color = compData.datasets[idx]?.color || "var(--primary)";
                return (
                  <div
                    key={ent.id}
                    className="relative flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 pl-2.5 pr-1.5 py-1 text-xs font-semibold text-white animate-fade-in"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span>{ent.name} ({ent.details?.season})</span>
                              {entityType === "player" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSeasonSelectorPlayerId(
                            activeSeasonSelectorPlayerId === ent.id ? null : ent.id
                          );
                        }}
                        className="ml-2 flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[9px] font-bold text-slate-400 hover:border-primary hover:text-primary transition-all active:scale-[0.97]"
                        title="Comparar con otras temporadas de este jugador"
                      >
                        <History className="h-2.5 w-2.5 text-primary/80" />
                        <span>+ Temp.</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedRowIds(prev => prev.filter(id => id !== ent.id))}
                      className="ml-1 text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                      title="Eliminar de la comparación"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    {activeSeasonSelectorPlayerId === ent.id && (
                      <div className="absolute top-[34px] left-0 w-60 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl z-60 max-h-56 overflow-y-auto premium-scrollbar divide-y divide-slate-900 no-print">
                        {loadingPlayerSeasons ? (
                          <div className="px-3 py-2.5 text-xxs text-slate-500 italic text-center flex items-center justify-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span>Cargando temporadas...</span>
                          </div>
                        ) : (
                          playerSeasonsList
                            .filter(row => row.id !== ent.id)
                            .map(row => {
                              const pos = seasonPositions[row.id];
                              const posText = pos ? `${pos}º` : "—";
                              const isAlreadyCompared = selectedRowIds.includes(row.id);
                              return (
                                <div
                                  key={row.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // REPLACE ACTIVE BADGE SEASON
                                    setScoutingRows(prev => {
                                      if (!prev.some(r => r.id === row.id)) {
                                        return [...prev, row];
                                      }
                                      return prev;
                                    });
                                    setSelectedRowIds(prev => prev.map(id => id === ent.id ? row.id : id));
                                    setActiveSeasonSelectorPlayerId(null);
                                  }}
                                  className="px-3.5 py-2.5 hover:bg-slate-900/60 transition-colors cursor-pointer text-xxs font-medium flex items-center justify-between border-b border-slate-900 last:border-none"
                                >
                                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                                    <div className="flex justify-between text-white font-bold">
                                      <span>Temporada {row.details?.season}</span>
                                      {pos && <span className="text-primary text-[10px]">{posText} pos.</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {row.details?.team_name}
                                    </div>
                                    <div className="text-[9px] text-slate-500 truncate">
                                      {row.details?.competition || "Liga"}
                                    </div>
                                  </div>
                                  
                                  {!isAlreadyCompared && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // ADD AS ADDITIONAL SEASON SERIES
                                        setScoutingRows(prev => {
                                          if (!prev.some(r => r.id === row.id)) {
                                            return [...prev, row];
                                          }
                                          return prev;
                                        });
                                        setSelectedRowIds(prev => Array.from(new Set([...prev, row.id])));
                                        setActiveSeasonSelectorPlayerId(null);
                                      }}
                                      className="shrink-0 px-2 py-1 rounded bg-slate-900 hover:bg-primary border border-slate-800 hover:border-primary text-slate-400 hover:text-white transition-all text-[9px] font-bold"
                                      title="Comparar también con esta temporada (añadir serie)"
                                    >
                                      +
                                    </button>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Toggle Comparar con la media de la liga */}
              {explorerData?.averages && (
                <button
                  onClick={() => setCompareWithAverage(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                    compareWithAverage
                      ? "bg-slate-900 border-primary text-primary"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{compareWithAverage ? "✓ Con Media de la Liga" : "+ Comparar con Media de la Liga"}</span>
                </button>
              )}

              {/* Toggle Comparar con la media histórica del jugador */}
              {entityType === "player" && compData.rawEntities.length > 0 && (
                <button
                  onClick={() => setCompareWithPlayerHistory(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                    compareWithPlayerHistory
                      ? "bg-slate-900 border-primary text-primary"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>{compareWithPlayerHistory ? "✓ Con Media Histórica" : "+ Comparar con Media Histórica"}</span>
                </button>
              )}

              {/* Search Compare Player Input */}
              {entityType === "player" && (
                <div className="relative w-64 ml-auto" ref={compareSearchRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-550 h-3.5 w-3.5" />
                    <input
                      type="text"
                      placeholder="Comparar con otro jugador..."
                      value={compareSearchQuery}
                      onChange={(e) => {
                        setCompareSearchQuery(e.target.value);
                        setShowCompareSuggestions(true);
                      }}
                      onFocus={() => setShowCompareSuggestions(true)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-1.5 text-xxs font-semibold text-white placeholder-slate-600 focus:border-primary focus:outline-none"
                    />
                  </div>

                  {showCompareSuggestions && (
                    <div className="absolute right-0 top-[38px] w-80 rounded-xl border border-slate-850 bg-slate-950 shadow-2xl z-55 max-h-64 overflow-y-auto premium-scrollbar divide-y divide-slate-900 no-print">
                      {/* Section: Your Team */}
                      {myTeamPlayers.length > 0 && !compareSearchQuery.trim() && (
                        <div>
                          <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase bg-slate-900/30">
                            Jugadores de tu equipo ({clubName})
                          </div>
                          {myTeamPlayers
                            .filter(p => !selectedRowIds.includes(p.id))
                            .map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedRowIds(prev => Array.from(new Set([...prev, p.id])));
                                  setShowCompareSuggestions(false);
                                  setCompareSearchQuery("");
                                }}
                                className="px-3 py-2 text-xxs text-slate-350 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer font-medium"
                              >
                                {p.name}
                              </div>
                            ))
                          }
                        </div>
                      )}

                      {/* Section: Search Results */}
                      {compareSearchQuery.trim().length >= 2 && (
                        <div>
                          <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase bg-slate-900/30">
                            Resultados de Búsqueda
                          </div>
                          {isCompareSearching ? (
                            <div className="px-3 py-3 text-xxs text-slate-500 italic text-center">
                              Buscando...
                            </div>
                          ) : compareSearchSuggestions.length === 0 ? (
                            <div className="px-3 py-3 text-xxs text-slate-500 italic text-center">
                              No se encontraron jugadores
                            </div>
                          ) : (
                            compareSearchSuggestions
                              .filter(p => !selectedRowIds.includes(p.id))
                              .map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedRowIds(prev => Array.from(new Set([...prev, p.id])));
                                    setShowCompareSuggestions(false);
                                    setCompareSearchQuery("");
                                  }}
                                  className="px-3 py-2 text-xxs text-slate-300 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer font-medium flex items-center justify-between"
                                >
                                  <span>{p.name}</span>
                                  <span className="text-[9px] text-slate-500">{p.details?.team_name}</span>
                                </div>
                              ))
                          )}
                        </div>
                      )}

                      {!compareSearchQuery.trim() && myTeamPlayers.length === 0 && (
                        <div className="px-3 py-3 text-xxs text-slate-500 italic text-center">
                          Escribe para buscar jugadores en la liga
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Positional template selector */}
            {entityType === "player" && (
              <div className="flex flex-wrap items-center gap-2 mb-4 bg-slate-900/20 p-2 rounded-xl border border-slate-900/60 no-print">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest pl-2 mr-2">
                  Tipo de Comparación:
                </span>
                {(["goalkeeper", "back", "midfielder", "striker"] as const).map((posKey) => {
                  const label =
                    posKey === "goalkeeper"
                      ? "Portero"
                      : posKey === "back"
                      ? "Defensa"
                      : posKey === "midfielder"
                      ? "Centrocampista"
                      : "Delantero / Extremo";
                  const primaryPos =
                    manualComparePosition || compData.rawEntities[0]?.details?.position || "midfielder";
                  
                  const groupKey =
                    primaryPos === "goalkeeper"
                      ? "goalkeeper"
                      : primaryPos === "back"
                      ? "back"
                      : primaryPos === "midfielder"
                      ? "midfielder"
                      : "striker";

                  const isActive = groupKey === posKey;

                  return (
                    <button
                      key={posKey}
                      onClick={() => setManualComparePosition(posKey)}
                      className={`rounded-lg px-2.5 py-1 text-xxs font-semibold border transition-all ${
                        isActive
                          ? "bg-primary/10 border-primary text-white"
                          : "bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-350"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Split layout: SVG Chart vs Grid details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center print:flex print:flex-col print:gap-8">
              {/* Radar Chart */}
              <div className="print:w-full print:max-w-md print:mx-auto print:bg-slate-950 print:p-4 print:rounded-2xl">
                {showCompareModal && compData?.rawEntities?.[0]?.details?.season && compData?.rawEntities?.[0]?.details?.competition && Object.keys(categoryMaxValues).length === 0 ? (
                  <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs font-semibold tracking-wide">Ajustando límites de la categoría...</p>
                  </div>
                ) : (
                  <RadarChart labels={compData.labels} datasets={compData.datasets} />
                )}
              </div>

              {/* Grid details */}
              <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1 print:max-h-none print:w-full print:overflow-visible print:pr-0">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/80 pb-2">
                  Detalle de métricas comparadas
                </h4>

                {compData.compareMetrics.map((mId) => {
                  const def = MetricRegistry.get(mId);
                  if (!def) return null;

                  return (
                    <div key={mId} className="flex flex-col gap-1.5 border-b border-slate-900 pb-2 print:border-slate-800">
                      <span className="text-xs font-semibold text-slate-400 print:text-slate-355">{def.name}</span>
                      
                      <div className="flex gap-4">
                        {compData.rawEntities.map((ent, idx) => {
                          const val = ent.metrics[mId] !== undefined ? ent.metrics[mId] : "—";
                          const datasetMeta = compData.datasets[idx];
                          
                          let formattedVal = String(val);
                          if (val !== "—") {
                            if (def.formatType === "percentage") formattedVal = `${val}%`;
                            if (def.formatType === "duration") formattedVal = `${val}m`;
                          }
                          
                          return (
                            <div key={ent.id} className="flex items-center gap-1.5 flex-1">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: datasetMeta?.color || "var(--primary)" }} />
                              <span className="text-xs text-slate-500 truncate max-w-[80px] print:text-slate-400">{ent.name}:</span>
                              <span className="text-xs font-bold text-white">{formattedVal}</span>
                            </div>
                          );
                        })}

                        {compareWithAverage && explorerData?.averages && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#94a3b8" }} />
                            <span className="text-xs text-slate-500 truncate max-w-[120px] print:text-slate-400">Media Liga:</span>
                            <span className="text-xs font-bold text-white">
                              {explorerData.averages[mId] !== undefined
                                ? (def.formatType === "percentage" ? `${explorerData.averages[mId]}%` : def.formatType === "duration" ? `${explorerData.averages[mId]}m` : explorerData.averages[mId])
                                : "—"}
                            </span>
                          </div>
                        )}

                        {compareWithPlayerHistory && playerHistoryAverages && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#10b981" }} />
                            <span className="text-xs text-slate-500 truncate max-w-[120px] print:text-slate-400">Media Hist.:</span>
                            <span className="text-xs font-bold text-white">
                              {playerHistoryAverages[mId] !== undefined
                                ? (def.formatType === "percentage" ? `${playerHistoryAverages[mId]}%` : def.formatType === "duration" ? `${playerHistoryAverages[mId]}m` : playerHistoryAverages[mId])
                                : "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print style block */}
      <style>{`
        @media print {
          @page {
            margin: 0 !important;
            size: auto;
          }
          body, html, main, .sidebar-inset, #root, #__next {
            margin: 0 !important;
            padding: 0 !important;
            height: 100vh !important;
            max-height: 100vh !important;
            overflow: hidden !important;
            background: #020617 !important;
          }
          header, nav, aside, button, .no-print, [data-sidebar], .sidebar-inset > header {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .compare-modal-overlay, .compare-modal-overlay * {
            visibility: visible;
          }
          .compare-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #020617 !important;
            z-index: 9999999 !important;
          }
          #compare-modal-content, #compare-modal-content * {
            visibility: visible;
          }
          #compare-modal-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #020617 !important;
            color: white !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 99999999 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
        }
      `}</style>

      {/* 4. REPORT COMPILER MODAL */}
      {showReportModal && (
        <ReportPreview
          config={getCompiledReportConfig()}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* 5. PLAYER PROFILE MODAL */}
      {profilePlayerName && (
        <PlayerProfileModal
          entityType={entityType}
          organizationId={organizationId}
          playerName={profilePlayerName}
          onClose={handleClosePlayerProfile}
          isAlreadySelected={
            explorerData
              ? selectedRowIds.includes(
                  explorerData.rows.find((r) => r.name === profilePlayerName)?.id || ""
                )
              : false
          }
          onCompare={handleCompareFromProfile}
        />
      )}
    </div>
  );
};
export default UniversalExplorer;
