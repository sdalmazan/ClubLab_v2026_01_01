"use client";

import React, { useMemo } from "react";
import { Activity, Clock, Flame } from "lucide-react";

export interface TimelinePoint {
  minute: number;
  intensity: number; // 0.0 - 1.0
  speedKmh?: number;
  mMin?: number;
}

export interface TrimmedPeriodProp {
  name: string;
  start_min: number;
  end_min: number;
  t_start?: string;
  t_end?: string;
}

interface GpsTimelineChartProps {
  timelineSeries: TimelinePoint[];
  periods: TrimmedPeriodProp[];
  maxDurationMin?: number;
  onPeriodUpdate?: (index: number, newStartMin: number, newEndMin: number) => void;
}

export function GpsTimelineChart({
  timelineSeries,
  periods,
  maxDurationMin,
  onPeriodUpdate,
}: GpsTimelineChartProps) {
  // Determine timeline limits
  const totalMins = useMemo(() => {
    if (maxDurationMin && maxDurationMin > 0) return maxDurationMin;
    if (timelineSeries.length > 0) {
      return Math.max(...timelineSeries.map((p) => p.minute));
    }
    const maxPeriodEnd = periods.reduce((max, p) => Math.max(max, p.end_min), 0);
    return Math.max(120, maxPeriodEnd + 15);
  }, [timelineSeries, periods, maxDurationMin]);

  // Generate SVG path for intensity curve with generous headroom
  const chartHeight = 210;
  const chartWidth = 720;
  const paddingX = 55;
  const paddingTop = 55;
  const paddingBottom = 35;

  const drawableWidth = chartWidth - paddingX * 2;
  const drawableHeight = chartHeight - paddingTop - paddingBottom;

  const pointsSvg = useMemo(() => {
    if (timelineSeries.length === 0) return "";
    return timelineSeries
      .map((pt) => {
        const x = paddingX + (pt.minute / totalMins) * drawableWidth;
        const clampedIntensity = Math.min(1, Math.max(0, pt.intensity));
        const y = paddingTop + 10 + (1 - clampedIntensity) * (drawableHeight - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" L ");
  }, [timelineSeries, totalMins, drawableWidth, drawableHeight]);

  const fillAreaSvg = useMemo(() => {
    if (!pointsSvg) return "";
    const startX = paddingX;
    const endX = paddingX + drawableWidth;
    const bottomY = paddingTop + drawableHeight;
    return `M ${startX},${bottomY} L ${pointsSvg} L ${endX},${bottomY} Z`;
  }, [pointsSvg, drawableWidth, drawableHeight]);

  const periodColors = [
    { fill: "rgba(16, 185, 129, 0.14)", stroke: "#10b981", label: "1ª Parte / Bloque 1" },
    { fill: "rgba(56, 189, 248, 0.14)", stroke: "#38bdf8", label: "2ª Parte / Bloque 2" },
    { fill: "rgba(245, 158, 11, 0.14)", stroke: "#f59e0b", label: "3ª Parte / Bloque 3" },
  ];

  const [draggingHandle, setDraggingHandle] = React.useState<{ periodIndex: number; handleType: "start" | "end" } | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const getMinuteFromPointer = (clientX: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (clientX - rect.left) * (chartWidth / rect.width);
    const clampedX = Math.max(paddingX, Math.min(chartWidth - paddingX, svgX));
    const minVal = ((clampedX - paddingX) / drawableWidth) * totalMins;
    return Math.round(minVal * 10) / 10;
  };

  const handlePointerMove = (clientX: number) => {
    if (!draggingHandle || !onPeriodUpdate) return;
    const { periodIndex, handleType } = draggingHandle;
    const targetPeriod = periods[periodIndex];
    if (!targetPeriod) return;

    const newMin = getMinuteFromPointer(clientX);

    if (handleType === "start") {
      const clampedStart = Math.max(0, Math.min(targetPeriod.end_min - 1, newMin));
      onPeriodUpdate(periodIndex, clampedStart, targetPeriod.end_min);
    } else {
      const clampedEnd = Math.max(targetPeriod.start_min + 1, Math.min(totalMins, newMin));
      onPeriodUpdate(periodIndex, targetPeriod.start_min, clampedEnd);
    }
  };

  React.useEffect(() => {
    if (!draggingHandle) return;

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
    };

    const onUp = () => setDraggingHandle(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingHandle, periods, totalMins]);

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-xl select-none">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Timeline Colectivo ({totalMins} min) — ¡Arrastra las barras para ajustar!
            </h4>
            <p className="text-[11px] text-slate-400">
              Mueve los delimitadores directamente en la gráfica para recortar el inicio y fin de cada parte.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded" /> Intensidad (m/min)
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 bg-emerald-500/20 border border-emerald-500 inline-block rounded-xs" /> Periodo Activo
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full pt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto max-h-64 drop-shadow-md select-none touch-none"
        >
          <defs>
            <linearGradient id="intensityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y-Axis Labels & Background grid lines */}
          {[
            { pct: 0, label: "160 m/min" },
            { pct: 0.5, label: "80 m/min" },
            { pct: 1, label: "0 m/min" },
          ].map((g, idx) => {
            const y = paddingTop + g.pct * drawableHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  fill="#475569"
                  fontSize="8"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {g.label}
                </text>
              </g>
            );
          })}

          {/* Period Overlays */}
          {periods.map((p, idx) => {
            const color = periodColors[idx % periodColors.length];
            const startX = paddingX + (Math.max(0, p.start_min) / totalMins) * drawableWidth;
            const endX = paddingX + (Math.min(totalMins, p.end_min) / totalMins) * drawableWidth;
            const width = Math.max(2, endX - startX);

            const isDraggingStart = draggingHandle?.periodIndex === idx && draggingHandle?.handleType === "start";
            const isDraggingEnd = draggingHandle?.periodIndex === idx && draggingHandle?.handleType === "end";

            return (
              <g key={idx}>
                {/* Highlighted active period region */}
                <rect
                  x={startX}
                  y={paddingTop}
                  width={width}
                  height={drawableHeight}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  rx="4"
                />

                {/* Period Start Line & Draggable Handle */}
                <g
                  className="cursor-ew-resize group"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraggingHandle({ periodIndex: idx, handleType: "start" });
                  }}
                  onTouchStart={() => {
                    setDraggingHandle({ periodIndex: idx, handleType: "start" });
                  }}
                >
                  <line
                    x1={startX}
                    y1={paddingTop - 14}
                    x2={startX}
                    y2={paddingTop + drawableHeight + 4}
                    stroke={color.stroke}
                    strokeWidth={isDraggingStart ? "3.5" : "2.5"}
                  />
                  <circle
                    cx={startX}
                    cy={paddingTop - 14}
                    r={isDraggingStart ? "6.5" : "5"}
                    fill={color.stroke}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={startX}
                    y={paddingTop - 22}
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {p.start_min.toFixed(1)}'
                  </text>
                </g>

                {/* Period End Line & Draggable Handle */}
                <g
                  className="cursor-ew-resize group"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraggingHandle({ periodIndex: idx, handleType: "end" });
                  }}
                  onTouchStart={() => {
                    setDraggingHandle({ periodIndex: idx, handleType: "end" });
                  }}
                >
                  <line
                    x1={endX}
                    y1={paddingTop - 14}
                    x2={endX}
                    y2={paddingTop + drawableHeight + 4}
                    stroke={color.stroke}
                    strokeWidth={isDraggingEnd ? "3.5" : "2.5"}
                  />
                  <circle
                    cx={endX}
                    cy={paddingTop - 14}
                    r={isDraggingEnd ? "6.5" : "5"}
                    fill={color.stroke}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={endX}
                    y={paddingTop - 22}
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {p.end_min.toFixed(1)}'
                  </text>
                </g>

                {/* Period Name Badge */}
                <rect
                  x={startX + (width > 80 ? 6 : (width - 70) / 2)}
                  y={paddingTop + 6}
                  width={Math.min(70, Math.max(10, width - 8))}
                  height="16"
                  fill="#020617"
                  rx="4"
                  stroke={color.stroke}
                  strokeWidth="1"
                />
                <text
                  x={startX + (width > 80 ? 10 : width / 2)}
                  y={paddingTop + 17}
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor={width > 80 ? "start" : "middle"}
                  fontFamily="sans-serif"
                >
                  {p.name} ({(p.end_min - p.start_min).toFixed(0)} min)
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {fillAreaSvg && <path d={fillAreaSvg} fill="url(#intensityGrad)" />}

          {/* Line Curve */}
          {pointsSvg && (
            <path
              d={`M ${pointsSvg}`}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Timeline Minute Ticks */}
          {Array.from({ length: 9 }, (_, i) => {
            const minVal = Math.round((totalMins / 8) * i);
            const x = paddingX + (minVal / totalMins) * drawableWidth;
            const yTick = paddingTop + drawableHeight + 14;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={paddingTop + drawableHeight}
                  x2={x}
                  y2={paddingTop + drawableHeight + 4}
                  stroke="#475569"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={yTick}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {minVal}'
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
