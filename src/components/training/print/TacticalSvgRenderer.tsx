"use client";

import React from "react";
import { WhiteboardData, WhiteboardStroke, MarkerElement, TextElement } from "../TaskWhiteboard";

// ─── Default colours that mirror the canvas renderer in TaskWhiteboard ───────
const DEFAULTS = {
  player: "#3b82f6",   // blue  (equipo local)
  rival:  "#ef4444",   // red   (equipo rival)
  cone:   "#f59e0b",   // amber (conos)
  ball:   "#ffffff",   // white (balón)
  goal:   "#1e293b",   // slate (porterías)
  text:   "#1e293b",
  stroke: "#1e293b",
  field:  "#f0fdf4",   // very light green (faint grass tint - eco friendly)
  lines:  "#64748b",   // slate-500 (líneas de campo más suaves)
};

interface TacticalSvgRendererProps {
  value?: WhiteboardData;
  width?: number;
  height?: number;
  className?: string;
  /** When true renders an eco-ink version (white background, greyscale lines) */
  printMode?: boolean;
}

export function TacticalSvgRenderer({
  value,
  width = 600,
  height = 450,
  className = "",
  printMode = false,
}: TacticalSvgRendererProps) {
  if (!value) return null;

  const hasStrokes = Boolean(value.strokes && value.strokes.length > 0);
  const hasMarkers = Boolean(value.markers && value.markers.length > 0);
  const hasTexts   = Boolean(value.texts   && value.texts.length   > 0);
  const hasVectorData = hasStrokes || hasMarkers || hasTexts;

  // Fallback to raster thumbnail when no vector data
  if (!hasVectorData && value.imageDataUrl) {
    return (
      <div className={`flex items-center justify-center bg-white overflow-hidden rounded ${className}`}>
        <img
          src={value.imageDataUrl}
          alt="Esquema Táctico"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: "multiply", filter: "contrast(1.15)" }}
        />
      </div>
    );
  }

  if (!hasVectorData && !value.imageDataUrl) return null;

  const zone = value.zone || "full_field";
  const viewBox = `0 0 ${width} ${height}`;

  // Field colours
  const bgColor    = printMode ? "#ffffff" : DEFAULTS.field;
  const lineColor  = printMode ? "#94a3b8" : DEFAULTS.lines;
  const lineWidth  = printMode ? 1.5 : 2;

  // ── helper: resolve a marker colour with fallback ───────────────────────────
  function markerFill(marker: MarkerElement): string {
    if (marker.color && marker.color !== "#ffffff" && marker.color !== "inherit") {
      return marker.color;
    }
    if (marker.type === "player") return DEFAULTS.player;
    if (marker.type === "rival")  return DEFAULTS.rival;
    if (marker.type === "cone")   return DEFAULTS.cone;
    return "#ffffff";
  }

  // ── helper: text colour (white on dark, dark on light) ─────────────────────
  function textOnMarker(fill: string): string {
    // Very rough luminance check
    const hex = fill.replace("#", "");
    if (hex.length < 6) return "#ffffff";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "#1e293b" : "#ffffff";
  }

  return (
    <div className={`w-full h-full flex items-center justify-center overflow-hidden rounded ${className}`}
         style={{ background: bgColor }}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          {/* Arrowhead — dark for print, coloured for screen */}
          <marker
            id="svg-arrow-dark"
            markerWidth="8" markerHeight="8"
            refX="7" refY="3" orient="auto" markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={DEFAULTS.stroke} />
          </marker>
          {/* Player colour arrowhead */}
          <marker
            id="svg-arrow-col"
            markerWidth="8" markerHeight="8"
            refX="7" refY="3" orient="auto" markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={DEFAULTS.stroke} />
          </marker>
        </defs>

        {/* ── 1. Background ───────────────────────────────────────────── */}
        <rect width={width} height={height} fill={bgColor} />

        {/* ── 2. Field markings ───────────────────────────────────────── */}
        {zone === "full_field" && (
          <g stroke={lineColor} strokeWidth={lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="16" width={width - 32} height={height - 32} />
            <line x1={width / 2} y1="16" x2={width / 2} y2={height - 16} />
            <circle cx={width / 2} cy={height / 2} r="40" />
            <circle cx={width / 2} cy={height / 2} r="3" fill={lineColor} stroke="none" />

            {/* Left box */}
            <rect x="16" y={height / 2 - 55} width="50" height="110" />
            <rect x="16" y={height / 2 - 28} width="20" height="56" />
            <circle cx="50" cy={height / 2} r="2.5" fill={lineColor} stroke="none" />
            <path d={`M 64 ${height / 2 - 28} A 28 28 0 0 1 64 ${height / 2 + 28}`} />

            {/* Right box */}
            <rect x={width - 66} y={height / 2 - 55} width="50" height="110" />
            <rect x={width - 36} y={height / 2 - 28} width="20" height="56" />
            <circle cx={width - 50} cy={height / 2} r="2.5" fill={lineColor} stroke="none" />
            <path d={`M ${width - 64} ${height / 2 - 28} A 28 28 0 0 0 ${width - 64} ${height / 2 + 28}`} />

            {/* Corner arcs */}
            <path d="M 16 26 A 10 10 0 0 0 26 16" />
            <path d={`M ${width - 26} 16 A 10 10 0 0 0 ${width - 16} 26`} />
            <path d={`M 16 ${height - 26} A 10 10 0 0 1 26 ${height - 16}`} />
            <path d={`M ${width - 26} ${height - 16} A 10 10 0 0 1 ${width - 16} ${height - 26}`} />
          </g>
        )}

        {(zone === "half_field" || zone === "defensive_third" || zone === "offensive_third") && (
          <g stroke={lineColor} strokeWidth={lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="16" width={width - 32} height={height - 32} />
            <line x1="16" y1={height / 2} x2={width - 16} y2={height / 2} />
            <path d={`M ${width / 2 - 45} ${height / 2} A 45 45 0 0 1 ${width / 2 + 45} ${height / 2}`} />
            <rect x={width / 2 - 90} y={height - 110} width="180" height="94" />
            <rect x={width / 2 - 45} y={height - 60} width="90" height="44" />
            <circle cx={width / 2} cy={height - 84} r="3" fill={lineColor} stroke="none" />
          </g>
        )}

        {zone === "penalty_area" && (
          <g stroke={lineColor} strokeWidth={lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="14" y="14" width={width - 28} height={height - 28} />
            <rect x={width / 2 - 180} y={height - 180} width="360" height="166" />
            <rect x={width / 2 - 80} y={height - 80} width="160" height="66" />
            <circle cx={width / 2} cy={height - 130} r="3.5" fill={lineColor} stroke="none" />
          </g>
        )}

        {zone === "custom_area" && (
          <g stroke={lineColor} strokeWidth={lineWidth} fill="none">
            <rect x="10" y="10" width={width - 20} height={height - 20} strokeDasharray="6,4" />
          </g>
        )}

        {/* ── 3. Strokes ──────────────────────────────────────────────── */}
        {value.strokes?.map((stroke: WhiteboardStroke, idx: number) => {
          if (!stroke.points || stroke.points.length < 2) return null;
          const sw    = Math.max((stroke as any).width ?? 2.5, 2.5);
          const color = stroke.color && stroke.color !== "#ffffff" ? stroke.color : DEFAULTS.stroke;
          const isDashed = stroke.type.startsWith("dashed_");
          const isArrow  = stroke.type.includes("arrow");
          const dash     = isDashed ? "7,5" : undefined;

          if (stroke.type === "rectangle" || stroke.type === "dashed_rectangle") {
            const s = stroke.points[0];
            const e = stroke.points[stroke.points.length - 1];
            return (
              <rect key={stroke.id || idx}
                x={Math.min(s.x, e.x)} y={Math.min(s.y, e.y)}
                width={Math.abs(e.x - s.x)} height={Math.abs(e.y - s.y)}
                fill="none" stroke={color} strokeWidth={sw}
                strokeDasharray={dash}
              />
            );
          }
          if (stroke.type === "pencil") {
            const d = stroke.points.reduce(
              (acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, ""
            );
            return (
              <path key={stroke.id || idx} d={d} fill="none"
                stroke={color} strokeWidth={sw}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={dash}
              />
            );
          }
          const s = stroke.points[0];
          const e = stroke.points[stroke.points.length - 1];
          return (
            <line key={stroke.id || idx}
              x1={s.x} y1={s.y} x2={e.x} y2={e.y}
              stroke={color} strokeWidth={sw}
              strokeDasharray={dash} strokeLinecap="round"
              markerEnd={isArrow ? "url(#svg-arrow-dark)" : undefined}
            />
          );
        })}

        {/* ── 4. Markers ──────────────────────────────────────────────── */}
        {value.markers?.map((marker: MarkerElement, idx: number) => {
          const { x, y, type, number, rotation = 0 } = marker;
          const tf = `translate(${x},${y}) rotate(${rotation})`;
          const fill = markerFill(marker);
          const textCol = textOnMarker(fill);

          if (type === "cone") {
            return (
              <g key={marker.id || idx} transform={tf}>
                <polygon points="0,-9 -7,8 7,8" fill={fill} stroke="#00000033" strokeWidth="1" />
              </g>
            );
          }

          if (type === "player" || type === "rival") {
            return (
              <g key={marker.id || idx} transform={tf}>
                <circle r="12" fill={fill} stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
                {number && (
                  <text x="0" y="0" textAnchor="middle" dominantBaseline="central"
                    fill={textCol} fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    {number}
                  </text>
                )}
              </g>
            );
          }

          if (type === "ball") {
            return (
              <g key={marker.id || idx} transform={tf}>
                <circle r="7" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#374151" strokeWidth="1" />
                <line x1="0" y1="-5" x2="0" y2="5" stroke="#374151" strokeWidth="1" />
              </g>
            );
          }

          if (type.startsWith("goal_") || type === "mini_goal") {
            const gw = type === "goal_11" ? 44 : type === "goal_7" ? 32 : 22;
            const gh = type === "goal_11" ? 18 : type === "goal_7" ? 13 : 9;
            return (
              <g key={marker.id || idx} transform={tf}>
                <rect x={-gw / 2} y={-gh / 2} width={gw} height={gh}
                  fill="rgba(0,0,0,0.05)" stroke={DEFAULTS.goal} strokeWidth="2.5" />
                {/* Net lines */}
                <line x1={-gw / 2} y1={-gh / 2} x2={-gw / 2 - 4} y2={-gh / 2 - 4}
                  stroke={DEFAULTS.goal} strokeWidth="1.5" />
                <line x1={gw / 2} y1={-gh / 2} x2={gw / 2 + 4} y2={-gh / 2 - 4}
                  stroke={DEFAULTS.goal} strokeWidth="1.5" />
                <line x1={-gw / 2 - 4} y1={-gh / 2 - 4} x2={gw / 2 + 4} y2={-gh / 2 - 4}
                  stroke={DEFAULTS.goal} strokeWidth="1.5" />
              </g>
            );
          }

          return null;
        })}

        {/* ── 5. Text elements ────────────────────────────────────────── */}
        {value.texts?.map((txt: TextElement, idx: number) => (
          <text key={txt.id || idx} x={txt.x} y={txt.y}
            fill={txt.color && txt.color !== "#ffffff" ? txt.color : DEFAULTS.text}
            fontSize="12" fontWeight="bold" fontFamily="sans-serif">
            {txt.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
