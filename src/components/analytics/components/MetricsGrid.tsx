import React, { useRef, useEffect, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, User, Shield, Trophy, Activity } from "lucide-react";
import { ExplorerRow, EntityType } from "@/features/analysis/types";
import { MetricRegistry } from "@/features/analysis/registry/metrics";

interface MetricsGridProps {
  entityType: EntityType;
  rows: ExplorerRow[];
  averages: Record<string, number>;
  selectedMetrics: string[];
  selectedRowIds: string[];
  onToggleSelectRow: (rowId: string) => void;
  onToggleSelectAll: () => void;
  sortBy: string | undefined;
  sortOrder: "asc" | "desc";
  onSort: (metricId: string) => void;
  onPlayerClick?: (playerName: string) => void;
  onShiftMetric?: (metricId: string, direction: "left" | "right") => void;
  clubName?: string;
}

/**
 * MetricsGrid Component.
 * Supports sticky headers, sticky player name column, double synchronized scrollbars,
 * and hover-triggered discreet column shifting.
 */
export const MetricsGrid: React.FC<MetricsGridProps> = ({
  entityType,
  rows,
  averages,
  selectedMetrics,
  selectedRowIds,
  onToggleSelectRow,
  onToggleSelectAll,
  sortBy,
  sortOrder,
  onSort,
  onPlayerClick,
  onShiftMetric,
  clubName,
}) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [tableWidth, setTableWidth] = useState(1200);
  const [isScrolled, setIsScrolled] = useState(false);

  // Measure table's total scroll width to synchronize top spacer
  useEffect(() => {
    if (tableRef.current) {
      setTableWidth(tableRef.current.scrollWidth);
    }
  }, [selectedMetrics, rows]);

  // Synchronize scrolls
  const handleTopScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
      setIsScrolled(bottomScrollRef.current.scrollLeft > 0);
    }
  };

  const getPositionAbbreviation = (pos: string) => {
    switch (pos) {
      case "goalkeeper": return "POR";
      case "back": return "DEF";
      case "midfielder": return "MC";
      case "winger": return "EXT";
      case "striker": return "DEL";
      default: return pos.toUpperCase().substring(0, 3);
    }
  };

  const allSelected = rows.length > 0 && selectedRowIds.length === rows.length;
  const someSelected = selectedRowIds.length > 0 && selectedRowIds.length < rows.length;

  const formatMetricValue = (metricId: string, value: any) => {
    if (value === undefined || value === null) return "—";
    
    const def = MetricRegistry.get(metricId);
    if (!def) return String(value);

    if (def.formatType === "percentage") {
      return `${value}%`;
    }
    if (def.formatType === "duration") {
      return `${value}m`;
    }
    return String(value);
  };

  const getEntityIcon = () => {
    switch (entityType) {
      case "player": return <User className="h-4 w-4 text-primary" />;
      case "team": return <Shield className="h-4 w-4 text-emerald-400" />;
      case "coach": return <Activity className="h-4 w-4 text-amber-400" />;
      case "competition": return <Trophy className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 1. Mirrored Top Scrollbar */}
      {rows.length > 0 && (
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="w-full overflow-x-auto no-print h-3 mb-1.5 opacity-60 hover:opacity-100 transition-opacity"
          style={{ scrollbarWidth: "thin" }}
        >
          <div style={{ width: `${tableWidth}px`, height: "1px" }} />
        </div>
      )}

      {/* 2. Sticky Table Container */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl">
        <div
          ref={bottomScrollRef}
          onScroll={handleBottomScroll}
          className="overflow-x-auto max-h-[600px] overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          <table ref={tableRef} className="w-full border-collapse text-left text-sm text-slate-300">
            {/* Sticky Header */}
            <thead className="sticky top-0 z-30 bg-slate-950 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              <tr className="border-b border-slate-850">
                {/* Checkbox: Sticky Left 0 */}
                <th className="py-4 pl-4 pr-2 w-12 text-center sticky left-0 z-30 bg-slate-950">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-primary focus:ring-primary focus:ring-offset-slate-950"
                  />
                </th>

                {/* Name / Info: Sticky Left 12 (48px) */}
                <th className={`py-4 px-4 font-bold text-slate-400 sticky left-12 z-30 bg-slate-950 border-r border-slate-850 transition-all ${
                  isScrolled ? "shadow-[4px_0_8px_rgba(0,0,0,0.5)]" : ""
                }`}>
                  <span>Nombre</span>
                </th>

                {/* Dynamic Metric Headers */}
                {selectedMetrics.map((mId) => {
                  const def = MetricRegistry.get(mId);
                  if (!def) return null;

                  const isCurrentSort = sortBy === mId;

                  return (
                    <th
                      key={mId}
                      className="group py-4 px-4 text-center font-bold text-slate-400 select-none hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {/* Discreet reorder arrows: Visible only on cell hover */}
                        {onShiftMetric && (
                          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mr-1 text-[8px] font-black text-slate-500 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShiftMetric(mId, "left");
                              }}
                              className="hover:text-primary active:scale-[0.8] p-0.5 rounded bg-slate-900 border border-slate-800"
                              title="Mover columna a la izquierda"
                            >
                              ◀
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShiftMetric(mId, "right");
                              }}
                              className="hover:text-primary active:scale-[0.8] p-0.5 rounded bg-slate-900 border border-slate-800"
                              title="Mover columna a la derecha"
                            >
                              ▶
                            </button>
                          </div>
                        )}

                        <span
                          onClick={() => onSort(mId)}
                          className="border-b border-dotted border-slate-600 cursor-help hover:text-white flex items-center gap-1.5"
                          title={def.description}
                        >
                          <span>{def.name}</span>
                          {isCurrentSort ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-850">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={selectedMetrics.length + 2} className="py-12 text-center text-slate-550 italic bg-slate-950">
                    No se encontraron resultados en el ámbito de búsqueda.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSelected = selectedRowIds.includes(row.id);

                  const cleanClub = (clubName || "")
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/s\.?d\.?/gi, "")
                    .replace(/c\.?d\.?/gi, "")
                    .trim();

                  const cleanPlayerClub = (row.details?.team_name || row.details?.current_team || "")
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/s\.?d\.?/gi, "")
                    .replace(/c\.?d\.?/gi, "")
                    .trim();

                  const isOwnTeam = cleanClub && cleanPlayerClub && cleanPlayerClub.includes(cleanClub);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-900/20 transition-all ${
                        isSelected ? "bg-primary/10 hover:bg-primary/15" : isOwnTeam ? "bg-primary/5 hover:bg-primary/8" : ""
                      }`}
                    >
                      {/* Checkbox Selector: Sticky Left 0 */}
                      <td className={`py-3 pl-4 pr-2 text-center sticky left-0 z-20 border-r border-transparent transition-all ${
                        isSelected ? "bg-slate-900" : isOwnTeam ? "bg-slate-900 border-l-2 border-primary" : "bg-slate-950"
                      }`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelectRow(row.id)}
                          className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-primary focus:ring-primary"
                        />
                      </td>

                      {/* Row Header Information: Sticky Left 12 */}
                      <td className={`py-3 px-4 sticky left-12 z-20 border-r border-slate-850 transition-all ${
                        isSelected ? "bg-slate-900" : isOwnTeam ? "bg-slate-900" : "bg-slate-950"
                      } ${
                        isScrolled ? "shadow-[4px_0_8px_rgba(0,0,0,0.5)]" : ""
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40">
                            {getEntityIcon()}
                          </div>
                          <div className="flex flex-col max-w-[160px]">
                            {onPlayerClick ? (
                              <span
                                className={`font-bold hover:underline cursor-pointer transition-colors truncate ${
                                  isOwnTeam ? "text-primary hover:text-white" : "text-white hover:text-primary"
                                }`}
                                onClick={() => onPlayerClick(row.name)}
                              >
                                {row.name}
                              </span>
                            ) : (
                              <span className={`font-semibold truncate ${isOwnTeam ? "text-primary" : "text-white"}`}>
                                {row.name}
                              </span>
                            )}
                            <span className="text-xxs text-slate-500 truncate">
                              {row.entityType === "player" && (
                                <>
                                  {getPositionAbbreviation(row.details?.position)} • {row.details?.team_name}
                                </>
                              )}
                              {row.entityType === "team" && (
                                <>{row.details?.competition} • {row.details?.season}</>
                              )}
                              {row.entityType === "coach" && (
                                <>{row.details?.current_team || "Sin equipo"} • {row.details?.season}</>
                              )}
                              {row.entityType === "competition" && (
                                <>Temporada {row.details?.season}</>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Dynamic Metric values */}
                      {selectedMetrics.map((mId) => {
                        const val = row.metrics[mId];
                        return (
                          <td key={mId} className="py-3 px-4 text-center font-mono font-medium text-slate-300">
                            {formatMetricValue(mId, val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer - Group Averages */}
            {rows.length > 0 && (
              <tfoot className="border-t border-slate-850 font-bold bg-slate-900/20">
                <tr>
                  {/* Sticky Left 0 */}
                  <td className="py-4 pl-4 pr-2 sticky left-0 z-20 bg-slate-950"></td>
                  
                  {/* Sticky Left 12 */}
                  <td className={`py-4 px-4 text-slate-400 sticky left-12 z-20 bg-slate-950 border-r border-slate-850 transition-all ${
                    isScrolled ? "shadow-[4px_0_8px_rgba(0,0,0,0.5)]" : ""
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>Media del Grupo</span>
                    </div>
                  </td>

                  {selectedMetrics.map((mId) => (
                    <td key={mId} className="py-4 px-4 text-center font-mono text-primary bg-slate-900/5">
                      {formatMetricValue(mId, averages[mId] ?? 0)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
export default MetricsGrid;
