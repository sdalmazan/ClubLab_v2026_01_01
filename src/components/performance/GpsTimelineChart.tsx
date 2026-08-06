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
  const chartHeight = 170;
  const chartWidth = 700;
  const paddingX = 40;
  const paddingTop = 40;
  const paddingBottom = 30;

  const drawableWidth = chartWidth - paddingX * 2;
  const drawableHeight = chartHeight - paddingTop - paddingBottom;

  const pointsSvg = useMemo(() => {
    if (timelineSeries.length === 0) return "";
    return timelineSeries
      .map((pt) => {
        const x = paddingX + (pt.minute / totalMins) * drawableWidth;
        // Leave 6px padding from paddingTop for top peaks
        const clampedIntensity = Math.min(1, Math.max(0, pt.intensity));
        const y = paddingTop + 6 + (1 - clampedIntensity) * (drawableHeight - 6);
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
    { fill: "rgba(16, 185, 129, 0.15)", stroke: "#10b981", label: "1ª Parte / Bloque 1" },
    { fill: "rgba(56, 189, 248, 0.15)", stroke: "#38bdf8", label: "2ª Parte / Bloque 2" },
    { fill: "rgba(245, 158, 11, 0.15)", stroke: "#f59e0b", label: "3ª Parte / Bloque 3" },
  ];

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Timeline de la Grabación Completa ({totalMins} min)
            </h4>
            <p className="text-[11px] text-slate-400">
              Detección de comportamiento colectivo de los futbolistas e intervalos de partido
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
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto max-h-56 drop-shadow-md select-none overflow-visible"
        >
          <defs>
            <linearGradient id="intensityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid lines */}
          {[0, 0.5, 1].map((pct, idx) => {
            const y = paddingTop + pct * drawableHeight;
            return (
              <line
                key={idx}
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="#1e293b"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          {/* Period Overlays */}
          {periods.map((p, idx) => {
            const color = periodColors[idx % periodColors.length];
            const startX = paddingX + (Math.max(0, p.start_min) / totalMins) * drawableWidth;
            const endX = paddingX + (Math.min(totalMins, p.end_min) / totalMins) * drawableWidth;
            const width = Math.max(2, endX - startX);

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
                  strokeDasharray="2 2"
                  rx="4"
                />

                {/* Period Start Line & Handle */}
                <line
                  x1={startX}
                  y1={paddingTop - 5}
                  x2={startX}
                  y2={paddingTop + drawableHeight + 5}
                  stroke={color.stroke}
                  strokeWidth="2"
                />
                <circle cx={startX} cy={paddingTop - 5} r="4" fill={color.stroke} />

                {/* Period End Line & Handle */}
                <line
                  x1={endX}
                  y1={paddingTop - 5}
                  x2={endX}
                  y2={paddingTop + drawableHeight + 5}
                  stroke={color.stroke}
                  strokeWidth="2"
                />
                <circle cx={endX} cy={paddingTop - 5} r="4" fill={color.stroke} />

                {/* Period Name Badge */}
                <rect
                  x={startX + 4}
                  y={paddingTop + 6}
                  width={Math.min(65, width - 8)}
                  height="16"
                  fill="#0f172a"
                  rx="3"
                  stroke={color.stroke}
                  strokeWidth="0.8"
                />
                <text
                  x={startX + 8}
                  y={paddingTop + 17}
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {p.name}
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
