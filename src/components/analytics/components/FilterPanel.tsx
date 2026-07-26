import React, { useState, useEffect, useRef } from "react";
import { Star, Save, Sparkles, Folder, Search, Filter, Trash2, ChevronDown, Check } from "lucide-react";
import { FilterGroup, FilterRule, SavedView, EntityType } from "@/features/analysis/types";
import { MetricRegistry } from "@/features/analysis/registry/metrics";
import { getSuggestionsAction } from "@/features/analysis/actions";

// ============================================================
// CUSTOM PREMIUM DROPDOWN / SELECT COMPONENT
// ============================================================
interface CustomSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string | string[]; // Array for multi-select, string for single
  onChange: (value: any) => void;
  isMulti?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  options,
  value,
  onChange,
  isMulti = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (optVal: string) => {
    if (isMulti) {
      const currentArr = Array.isArray(value) ? value : [];
      if (optVal === "") {
        // "All" option resets everything
        onChange([]);
      } else {
        const nextArr = currentArr.includes(optVal)
          ? currentArr.filter((v) => v !== optVal)
          : [...currentArr, optVal];
        onChange(nextArr);
      }
    } else {
      onChange(optVal);
      setIsOpen(false);
    }
  };

  // Get active display text
  const getDisplayText = () => {
    if (isMulti) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return "Todos / Sin filtro";
      if (arr.length === 1) {
        const match = options.find((o) => o.value === arr[0]);
        return match ? match.label : arr[0];
      }
      return `${arr.length} seleccionados`;
    } else {
      const match = options.find((o) => o.value === value);
      return match ? match.label : "Seleccionar...";
    }
  };

  const isChecked = (optVal: string) => {
    if (isMulti) {
      const arr = Array.isArray(value) ? value : [];
      if (optVal === "") return arr.length === 0;
      return arr.includes(optVal);
    }
    return value === optVal;
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-xxs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white hover:border-slate-700 focus:border-primary focus:outline-none transition-all"
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[54px] left-0 w-full rounded-xl border border-slate-850 bg-slate-950 shadow-2xl z-45 max-h-56 overflow-y-auto premium-scrollbar divide-y divide-slate-900">
          {options.map((opt) => {
            const active = isChecked(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => handleToggleOption(opt.value)}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-slate-900 transition-colors cursor-pointer select-none text-slate-300"
              >
                <span className={active ? "font-bold text-primary" : "font-medium"}>{opt.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN FILTER PANEL
// ============================================================
interface FilterPanelProps {
  entityType: EntityType;
  filters: FilterGroup;
  onChangeFilters: (filters: FilterGroup) => void;
  savedViews: SavedView[];
  activeViewId: string | null;
  onApplyView: (view: SavedView) => void;
  onSaveActiveView: (name: string, description: string) => Promise<void>;
  onDeleteView: (viewId: string) => Promise<void>;
  activeSeasonName: string;
  selectedMetrics: string[];
  myTeamPlayers?: { id: string; name: string; team_name: string }[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  entityType,
  filters,
  onChangeFilters,
  savedViews,
  activeViewId,
  onApplyView,
  onSaveActiveView,
  onDeleteView,
  activeSeasonName,
  selectedMetrics,
  myTeamPlayers,
}) => {
  // Form values
  const [typedSearch, setTypedSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [season, setSeason] = useState<string | string[]>(
    entityType === "competition" ? [activeSeasonName] : activeSeasonName
  );
  const [competition, setCompetition] = useState<string | string[]>(
    entityType === "competition" ? [] : ""
  );
  const [teamSearch, setTeamSearch] = useState("");
  const [position, setPosition] = useState("");

  // Team autocomplete states
  const [typedTeamSearch, setTypedTeamSearch] = useState("");
  const [teamSuggestions, setTeamSuggestions] = useState<string[]>([]);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const teamSuggestionsRef = useRef<HTMLDivElement>(null);

  // Dynamic metrics filters: maps metric ID -> min value
  const [metricMinFilters, setMetricMinFilters] = useState<Record<string, string>>({});

  // Autocomplete states
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const lastCompiledFiltersRef = useRef<FilterGroup | null>(null);

  // States for saved view dialog
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewDescription, setViewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const seasonOptions = [
    { value: "", label: "Todas las temporadas" },
    { value: "2026/2027", label: "2026/2027" },
    { value: "2025/2026", label: "2025/2026" },
    { value: "2024/2025", label: "2024/2025" },
    { value: "2023/2024", label: "2023/2024" },
    { value: "2022/2023", label: "2022/2023" },
    { value: "2021/2022", label: "2021/2022" },
    { value: "2020/2021", label: "2020/2021" },
  ];

  const competitionOptions = [
    { value: "", label: "Todas las ligas" },
    { value: "Tercera Federación - Grupo 8", label: "Tercera RFEF - G8" },
    { value: "1ª División Regional Aficionados - Grupo A", label: "1ª Regional - Grupo A" },
    { value: "1ª División Regional Aficionados - Grupo B", label: "1ª Regional - Grupo B" },
    { value: "División de Honor - Grupo 1", label: "División de Honor - G1" },
  ];

  // Clear all filters when the active tab/entity type changes
  useEffect(() => {
    setTypedSearch("");
    setNameSearch("");
    setTypedTeamSearch("");
    setTeamSearch("");
    setPosition("");
    setMetricMinFilters({});
    
    if (entityType === "competition") {
      setSeason([activeSeasonName]);
      setCompetition([]);
    } else {
      setSeason(activeSeasonName);
      setCompetition("");
    }
  }, [entityType]);

  // Synchronize parent filters to local form state (Accent-safe, prevents loops)
  useEffect(() => {
    if (!filters || !filters.rules) return;

    // Skip synchronization if the incoming filters match what we just compiled locally
    if (
      lastCompiledFiltersRef.current === filters ||
      JSON.stringify(lastCompiledFiltersRef.current) === JSON.stringify(filters)
    ) {
      return;
    }

    let parentName = "";
    let parentSeason: string | string[] = entityType === "competition" ? [] : "";
    let parentCompetition: string | string[] = entityType === "competition" ? [] : "";
    let parentTeam = "";
    let parentPosition = "";
    const parentMetricsMin: Record<string, string> = {};

    for (const rule of filters.rules) {
      if ("condition" in rule) continue;
      const { field, value, operator } = rule;

      const isNameField = field === "player_name" || field === "team_name" || field === "coach_name" || field === "competition";
      if (isNameField && rule.operator === "like" && field !== "competition") {
        parentName = String(value);
      }
      if (field === "season") {
        parentSeason = operator === "in" ? (Array.isArray(value) ? value : [String(value)]) : String(value);
      }
      if (field === "competition") {
        parentCompetition = operator === "in" ? (Array.isArray(value) ? value : [String(value)]) : String(value);
      }
      if (field === "team_name" || field === "current_team") {
        if (rule.operator === "like" || rule.operator === "eq") {
          parentTeam = String(value);
        }
      }
      if (field === "position" && rule.operator === "eq") {
        parentPosition = String(value);
      }

      const dbFieldMapReverse: Record<string, string> = {
        goals_scored: "goals",
        minutes_on: "minutes",
        yellow_cards: "yellowCards",
        red_cards: "redCards",
      };
      const mId = dbFieldMapReverse[field] || field;
      if (selectedMetrics.includes(mId) && operator === "gte") {
        parentMetricsMin[mId] = String(value);
      }
    }

    if (parentName !== nameSearch) setNameSearch(parentName);

    // Normalize parent values to prevent array/string type oscillations causing loops
    let normalizedParentSeason: string | string[];
    if (entityType === "competition") {
      normalizedParentSeason = Array.isArray(parentSeason)
        ? parentSeason
        : parentSeason ? [parentSeason] : [];
    } else {
      normalizedParentSeason = Array.isArray(parentSeason)
        ? (parentSeason[0] || "")
        : (parentSeason || "");
    }

    let normalizedParentCompetition: string | string[];
    if (entityType === "competition") {
      normalizedParentCompetition = Array.isArray(parentCompetition)
        ? parentCompetition
        : parentCompetition ? [parentCompetition] : [];
    } else {
      normalizedParentCompetition = Array.isArray(parentCompetition)
        ? (parentCompetition[0] || "")
        : (parentCompetition || "");
    }

    const isSeasonEqual = Array.isArray(normalizedParentSeason) && Array.isArray(season)
      ? normalizedParentSeason.length === season.length && normalizedParentSeason.every((v, i) => v === season[i])
      : normalizedParentSeason === season;

    const isCompetitionEqual = Array.isArray(normalizedParentCompetition) && Array.isArray(competition)
      ? normalizedParentCompetition.length === competition.length && normalizedParentCompetition.every((v, i) => v === competition[i])
      : normalizedParentCompetition === competition;

    if (!isSeasonEqual) setSeason(normalizedParentSeason);
    if (!isCompetitionEqual) setCompetition(normalizedParentCompetition);

    if (parentTeam !== teamSearch) {
      setTeamSearch(parentTeam);
      setTypedTeamSearch(parentTeam);
    }
    if (parentPosition !== position) setPosition(parentPosition);

    let metricsChanged = false;
    for (const mId of selectedMetrics) {
      if ((parentMetricsMin[mId] || "") !== (metricMinFilters[mId] || "")) {
        metricsChanged = true;
        break;
      }
    }
    if (metricsChanged) {
      setMetricMinFilters(parentMetricsMin);
    }
  }, [filters, entityType, selectedMetrics]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (teamSuggestionsRef.current && !teamSuggestionsRef.current.contains(event.target as Node)) {
        setShowTeamSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions as the user types
  useEffect(() => {
    let active = true;
    async function fetchSuggestions() {
      if (typedSearch.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await getSuggestionsAction(entityType, typedSearch);
        if (active) {
          setSuggestions(res);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.warn("Error fetching suggestions:", err);
      }
    }

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 250); // Debounce input queries

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [typedSearch, entityType]);

  // Fetch autocomplete suggestions for team/club as the user types
  useEffect(() => {
    let active = true;
    async function fetchTeamSuggestions() {
      if (typedTeamSearch.trim().length < 2) {
        setTeamSuggestions([]);
        return;
      }
      try {
        const res = await getSuggestionsAction("team", typedTeamSearch);
        if (active) {
          setTeamSuggestions(res);
          setShowTeamSuggestions(true);
        }
      } catch (err) {
        console.warn("Error fetching team suggestions:", err);
      }
    }

    const timer = setTimeout(() => {
      fetchTeamSuggestions();
    }, 250); // Debounce input queries

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [typedTeamSearch]);

  // Clean up dynamic filters for metrics that are no longer active/selected
  useEffect(() => {
    setMetricMinFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const mId in next) {
        if (!selectedMetrics.includes(mId)) {
          delete next[mId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedMetrics]);

  // Compile form states to filter group
  const updateFilterGroup = () => {
    const rules: FilterRule[] = [];

    // 1. Text Name search (Split words, matches using "like" to support multi-order)
    if (nameSearch.trim()) {
      const fieldMap: Record<EntityType, string> = {
        player: "player_name",
        team: "team_name",
        coach: "coach_name",
        competition: "competition",
      };
      rules.push({
        field: fieldMap[entityType] || "player_name",
        operator: "like",
        value: nameSearch.trim(),
      });
    }

    // 2. Season (supports EQ or IN)
    if (Array.isArray(season)) {
      if (season.length > 0) {
        rules.push({
          field: "season",
          operator: "in",
          value: season,
        });
      }
    } else if (season) {
      rules.push({
        field: "season",
        operator: "eq",
        value: season,
      });
    }

    // 3. Competition (supports EQ or IN)
    if (Array.isArray(competition)) {
      if (competition.length > 0) {
        rules.push({
          field: "competition",
          operator: "in",
          value: competition,
        });
      }
    } else if (competition) {
      rules.push({
        field: "competition",
        operator: "eq",
        value: competition,
      });
    }

    // 4. Team Search (Permanent filter field for players/coaches, even if col is hidden)
    if (teamSearch.trim() && entityType !== "competition") {
      const teamField = entityType === "player" ? "team_name" : "current_team";
      rules.push({
        field: teamField,
        operator: "like",
        value: teamSearch.trim(),
      });
    }

    // 5. Position (Player tab only)
    if (entityType === "player" && position) {
      rules.push({
        field: "position",
        operator: "eq",
        value: position,
      });
    }

    // 6. Dynamic Metric rules (GTE logic)
    const dbFieldMap: Record<string, string> = {
      goals: "goals_scored",
      goals90: "goals_scored",
      minutes: "minutes_on",
      yellowCards: "yellow_cards",
      redCards: "red_cards",
    };

    for (const mId of selectedMetrics) {
      const val = metricMinFilters[mId];
      if (val && val.trim()) {
        const dbField = dbFieldMap[mId] || mId;
        rules.push({
          field: dbField,
          operator: "gte",
          value: Number(val),
        });
      }
    }

    const newFilters: FilterGroup = {
      condition: "AND",
      rules,
    };
    lastCompiledFiltersRef.current = newFilters;
    onChangeFilters(newFilters);
  };

  // Trigger search update
  useEffect(() => {
    updateFilterGroup();
  }, [nameSearch, season, competition, teamSearch, position, metricMinFilters, entityType]);

  const handleApplyViewLocal = (view: SavedView) => {
    let name = "";
    let seas: string | string[] = entityType === "competition" ? [] : "";
    let comp: string | string[] = entityType === "competition" ? [] : "";
    let team = "";
    let pos = "";
    const metricsMin: Record<string, string> = {};

    for (const rule of view.filters.rules) {
      if ("condition" in rule) continue;
      const field = rule.field;
      const val = rule.value;

      if (field.includes("name") && rule.operator === "like") {
        name = String(val);
      }
      if (field === "season") {
        seas = rule.operator === "in" ? (Array.isArray(val) ? val : [String(val)]) : String(val);
      }
      if (field === "competition") {
        comp = rule.operator === "in" ? (Array.isArray(val) ? val : [String(val)]) : String(val);
      }
      if ((field === "team_name" || field === "current_team") && rule.operator === "like") {
        team = String(val);
      }
      if (field === "position") pos = String(val);

      const reverseFieldMap: Record<string, string> = {
        goals_scored: "goals",
        minutes_on: "minutes",
        yellow_cards: "yellowCards",
        red_cards: "redCards",
      };
      const mId = reverseFieldMap[field] || field;
      if (rule.operator === "gte") {
        metricsMin[mId] = String(val);
      }
    }

    setTypedSearch(name);
    setNameSearch(name);
    setSeason(seas);
    setCompetition(comp);
    setTeamSearch(team);
    setPosition(pos);
    setMetricMinFilters(metricsMin);

    onApplyView(view);
  };

  const handleResetFilters = () => {
    setTypedSearch("");
    setNameSearch("");
    setSeason(entityType === "competition" ? [activeSeasonName] : activeSeasonName);
    setCompetition(entityType === "competition" ? [] : "");
    setTypedTeamSearch("");
    setTeamSearch("");
    setPosition("");
    setMetricMinFilters({});
  };

  const handleSuggestionClick = (val: string) => {
    setTypedSearch(val);
    setNameSearch(val);
    setShowSuggestions(false);
  };

  const handleTeamSuggestionClick = (val: string) => {
    setTypedTeamSearch(val);
    setTeamSearch(val);
    setShowTeamSuggestions(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameSearch(typedSearch);
    setShowSuggestions(false);
  };

  const handleTeamSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamSearch(typedTeamSearch);
    setShowTeamSuggestions(false);
  };

  const handleSaveViewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;

    setIsSaving(true);
    try {
      await onSaveActiveView(viewName.trim(), viewDescription.trim());
      setViewName("");
      setViewDescription("");
      setShowSaveModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
      {/* 1. Saved Views */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wider text-slate-400 uppercase">
          <Folder className="h-4 w-4 text-primary" />
          <span>Vistas Guardadas</span>
        </div>

        {savedViews.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-2">No hay vistas guardadas.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto premium-scrollbar pr-1">
            {savedViews.map((view) => (
              <div
                key={view.id}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all cursor-pointer ${
                  activeViewId === view.id
                    ? "bg-primary/10 border-primary text-white"
                    : "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
                onClick={() => handleApplyViewLocal(view)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Star className={`h-3.5 w-3.5 flex-shrink-0 ${view.isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-500"}`} />
                  <span className="truncate font-medium">{view.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (view.id) onDeleteView(view.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-0.5 rounded"
                  title="Eliminar vista"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-slate-800/80" />

      {/* 2. Filters Form */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-400 uppercase">
            <Filter className="h-4 w-4 text-primary" />
            <span>Filtros de Búsqueda</span>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xxs text-slate-500 hover:text-white transition-colors"
          >
            Limpiar
          </button>
        </div>

        {/* Text search with autocomplete */}
        <div className="flex flex-col gap-1 relative" ref={suggestionsRef}>
          <label className="text-xxs font-bold text-slate-500 uppercase tracking-wider">
            {entityType === "player"
              ? "Nombre del jugador"
              : entityType === "team"
              ? "Nombre del equipo"
              : entityType === "coach"
              ? "Nombre del entrenador"
              : "Competición"}
          </label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <input
              type="text"
              value={typedSearch}
              onChange={(e) => {
                setTypedSearch(e.target.value);
                if (e.target.value === "") setNameSearch(""); // Instant clear
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Buscar (ej. Castillo, Almazán...)"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-700 focus:border-primary focus:outline-none"
            />
          </form>

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-[52px] left-0 w-full rounded-xl border border-slate-850 bg-slate-950 shadow-2xl max-h-48 overflow-y-auto premium-scrollbar z-45 divide-y divide-slate-900">
              {suggestions.map((sug) => {
                const isOwnTeamPlayer = myTeamPlayers?.some(
                  (p) => p.name.toLowerCase().trim() === sug.toLowerCase().trim()
                );
                return (
                  <div
                    key={sug}
                    onClick={() => handleSuggestionClick(sug)}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors cursor-pointer ${
                      isOwnTeamPlayer
                        ? "bg-primary/10 hover:bg-primary/20 text-primary font-bold border-l-2 border-primary"
                        : "text-slate-350 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{sug}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Season Selector: Custom Dropdown */}
        <CustomSelect
          label="Temporada"
          options={seasonOptions}
          value={season}
          onChange={setSeason}
          isMulti={entityType === "competition"}
        />

        {/* Competition Selector: Custom Dropdown */}
        <CustomSelect
          label="Liga / Competición"
          options={competitionOptions}
          value={competition}
          onChange={setCompetition}
          isMulti={entityType === "competition"}
        />

        {/* Team Search Selector (Permanent field for players/coaches) */}
        {entityType !== "team" && entityType !== "competition" && (
          <div className="flex flex-col gap-1 relative" ref={teamSuggestionsRef}>
            <label className="text-xxs font-bold text-slate-500 uppercase tracking-wider">
              {entityType === "player" ? "Equipo / Club" : "Club actual"}
            </label>
            <form onSubmit={handleTeamSearchSubmit} className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
              <input
                type="text"
                value={typedTeamSearch}
                onChange={(e) => {
                  setTypedTeamSearch(e.target.value);
                  if (e.target.value === "") {
                    setTeamSearch("");
                  }
                }}
                onFocus={() => {
                  if (typedTeamSearch.trim().length >= 2) {
                    setShowTeamSuggestions(true);
                  }
                }}
                placeholder="Ej. C.D. Becerril, Bembibre..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-700 focus:border-primary focus:outline-none"
              />
            </form>

            {/* Team Autocomplete suggestions dropdown */}
            {showTeamSuggestions && teamSuggestions.length > 0 && (
              <div className="absolute top-[58px] left-0 w-full rounded-xl border border-slate-855 bg-slate-950 shadow-2xl z-45 max-h-48 overflow-y-auto premium-scrollbar divide-y divide-slate-900">
                {teamSuggestions.map((sug) => (
                  <div
                    key={sug}
                    onClick={() => handleTeamSuggestionClick(sug)}
                    className="px-3.5 py-2.5 text-xs hover:bg-slate-900 transition-colors cursor-pointer select-none text-slate-300 font-medium"
                  >
                    {sug}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Position Selector (Players only): Custom Dropdown */}
        {entityType === "player" && (
          <CustomSelect
            label="Posición"
            options={[
              { value: "", label: "Todas las posiciones" },
              { value: "goalkeeper", label: "Portero" },
              { value: "back", label: "Defensa" },
              { value: "midfielder", label: "Centrocampista" },
              { value: "winger", label: "Extremo" },
              { value: "striker", label: "Delantero Centro" },
            ]}
            value={position}
            onChange={setPosition}
          />
        )}

        {/* 3. DYNAMIC METRIC RANGE FILTERS */}
        {selectedMetrics.length > 0 && (
          <div className="flex flex-col gap-3.5 border-t border-slate-900 pt-3">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
              Filtro de métricas activas
            </span>

            <div className="grid grid-cols-2 gap-3.5">
              {selectedMetrics.map((mId) => {
                const def = MetricRegistry.get(mId);
                if (!def) return null;
                if (def.formatType === "duration" || def.id === "matches" || def.id === "starts") return null;

                return (
                  <div key={mId} className="flex flex-col gap-1">
                    <label
                      className="text-xxs font-bold text-slate-500 uppercase tracking-wider truncate cursor-help border-b border-dotted border-slate-850 pb-0.5"
                      title={def.description}
                    >
                      Mín. {def.name}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={metricMinFilters[mId] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMetricMinFilters((prev) => ({ ...prev, [mId]: val }));
                      }}
                      placeholder="—"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:border-primary focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save view button */}
      {(nameSearch || teamSearch || (Array.isArray(season) ? season.length > 0 : season !== activeSeasonName) || (Array.isArray(competition) ? competition.length > 0 : competition) || position || Object.values(metricMinFilters).some(Boolean)) && (
        <button
          onClick={() => setShowSaveModal(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Save className="h-4 w-4" />
          <span>Guardar Vista Actual</span>
        </button>
      )}

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="flex items-center gap-2 text-base font-bold text-white mb-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Guardar Configuración de Vista</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Se almacenarán los filtros activos y las métricas seleccionadas en sus posiciones actuales.
            </p>

            <form onSubmit={handleSaveViewSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre de la vista</label>
                <input
                  type="text"
                  required
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Ej. Porteros con vallas invictas, Delanteros goleadores..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-655 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción corta (opcional)</label>
                <textarea
                  value={viewDescription}
                  onChange={(e) => setViewDescription(e.target.value)}
                  placeholder="Explica el criterio..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-655 focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="rounded-xl border border-slate-850 bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-900 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSaving ? "Guardando..." : "Guardar Vista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FilterPanel;
