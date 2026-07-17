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
  Search
} from "lucide-react";
import {
  exploreAction,
  getSavedViewsAction,
  saveSavedViewAction,
  deleteSavedViewAction,
  getScoutingOpportunitiesAction,
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
}) => {
  // 1. TABS STATE
  const [entityType, setEntityType] = useState<EntityType>("player");

  // 2. QUERY & EXPLORER STATE
  const [filters, setFilters] = useState<FilterGroup>({
    condition: "AND",
    rules: [{ field: "season", operator: "eq", value: activeSeasonName }]
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
        const res = await exploreAction({
          entityType: "player",
          filters: {
            condition: "AND",
            rules: [
              { field: "season", operator: "eq", value: activeSeasonName },
              { field: "player_name", operator: "like", value: compareSearchQuery.trim() }
            ]
          },
          metrics: [],
          page: 1,
          pageSize: 15,
        });
        setCompareSearchSuggestions(res.rows);
      } catch (err) {
        console.warn("Could not search players for comparison:", err);
      } finally {
        setIsCompareSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [compareSearchQuery, activeSeasonName]);

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
            ? [{ field: "competition", operator: "eq" as const, value: "Tercera Federación - Grupo 8" }]
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
      positionCategory === "gk" || positionCategory === "df" ? "back" : positionCategory === "mc" ? "midfielder" : "striker"
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

  // ============================================================
  // PREPARE COMPARISON RADAR DATA
  // ============================================================
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
      if (primaryPos === "goalkeeper" || primaryPos === "back") {
        compareMetrics = ["cleanSheetRatio", "goalsConceded90", "concededGoalsRatio", "minutes", "matches", "redCards"].filter(id => MetricRegistry.get(id) !== undefined);
      } else if (primaryPos === "midfielder") {
        compareMetrics = ["impact", "minutes", "goals", "goals90", "yellowCards"].filter(id => MetricRegistry.get(id) !== undefined);
      } else {
        compareMetrics = ["goals", "goals90", "dependency", "impact", "minutes"].filter(id => MetricRegistry.get(id) !== undefined);
      }
    }
    
    const maxValues: Record<string, number> = {};
    const allRowsForMax = Array.from(uniqueCandidatesMap.values());
    for (const mId of compareMetrics) {
      const values = allRowsForMax.map((r) => Number(r.metrics[mId])).filter((v) => !isNaN(v));
      maxValues[mId] = Math.max(...values, 1);
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
        label: row.name,
        values: normalizedValues,
        color: colors[idx % colors.length],
      };
    });

    if (compareWithAverage && leagueAverages) {
      const averageNormalizedValues: Record<string, number> = {};
      for (const mId of compareMetrics) {
        const val = Number(leagueAverages[mId]) || 0;
        averageNormalizedValues[mId] = parseFloat(((val / maxValues[mId]) * 100).toFixed(1));
      }
      radarDatasets.push({
        label: "Media de la Liga",
        values: averageNormalizedValues,
        color: "#94a3b8",
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
          {selectedRowIds.length >= 2 && (
            <button
              onClick={() => {
                setManualComparePosition(null);
                setShowCompareModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4.5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Zap className="h-4 w-4" />
              <span>Comparar Seleccionados ({selectedRowIds.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900 transition-all"
          >
            <FileText className="h-4 w-4 text-slate-400" />
            <span>Exportar Informe Layout</span>
          </button>
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
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-semibold tracking-wide">Cargando datos estadísticos...</p>
            </div>
          ) : (
            <>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 print:p-0 print:bg-white print:relative print:z-auto">
          <div id="compare-modal-content" className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl print:border-none print:shadow-none print:bg-slate-950 print:text-white print:max-w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 no-print">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary animate-pulse" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Comparativa Universal</h3>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => window.print()}
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
              <h3 className="text-base font-black uppercase text-white tracking-wider">ClubLab - Comparativa Estadísticas</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Informe compilado automáticamente el {new Date().toLocaleDateString()}</p>
            </div>

            {/* Compared Players Badges & Quick selector */}
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-800/80 no-print">
              <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest mr-2">Entidades:</span>
              {compData.rawEntities.map((ent, idx) => {
                const color = compData.datasets[idx]?.color || "var(--primary)";
                return (
                  <div
                    key={ent.id}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 pl-2.5 pr-1.5 py-1 text-xs font-semibold text-white"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span>{ent.name}</span>
                    <button
                      onClick={() => setSelectedRowIds(prev => prev.filter(id => id !== ent.id))}
                      className="ml-1 text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                      title="Eliminar de la comparación"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
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
                {(["back", "midfielder", "striker"] as const).map((posKey) => {
                  const label =
                    posKey === "back"
                      ? "Defensa / Portero"
                      : posKey === "midfielder"
                      ? "Centrocampista"
                      : "Delantero / Extremo";
                  const primaryPos =
                    manualComparePosition || compData.rawEntities[0]?.details?.position || "midfielder";
                  
                  const groupKey =
                    primaryPos === "goalkeeper" || primaryPos === "back"
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
                <RadarChart labels={compData.labels} datasets={compData.datasets} />
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
          header, nav, aside, button, .no-print, [data-sidebar], .sidebar-inset > header {
            display: none !important;
          }
          body, html, main, .sidebar-inset, .print-container {
            background: #020617 !important;
            color: white !important;
          }
          body * {
            visibility: hidden;
          }
          #compare-modal-content, #compare-modal-content * {
            visibility: visible;
          }
          #compare-modal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            background: #020617 !important;
            color: white !important;
            border: none !important;
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
