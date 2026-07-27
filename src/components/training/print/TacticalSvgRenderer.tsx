"use client";

import React from "react";
import { WhiteboardData, WhiteboardStroke, MarkerElement, TextElement } from "../TaskWhiteboard";

interface TacticalSvgRendererProps {
  value?: WhiteboardData;
  width?: number;
  height?: number;
  className?: string;
}

export function TacticalSvgRenderer({
  value,
  width = 600,
  height = 450,
  className = "",
}: TacticalSvgRendererProps) {
  if (!value) return null;

  const hasStrokes = Boolean(value.strokes && value.strokes.length > 0);
  const hasMarkers = Boolean(value.markers && value.markers.length > 0);
  const hasTexts = Boolean(value.texts && value.texts.length > 0);
  const hasVectorData = hasStrokes || hasMarkers || hasTexts;

  // Fallback to image if no vector data exists but imageDataUrl is present
  if (!hasVectorData && value.imageDataUrl) {
    return (
      <div className={`flex items-center justify-center p-1 bg-white border border-slate-300 rounded-lg overflow-hidden ${className}`}>
        <img
          src={value.imageDataUrl}
          alt="Esquema Táctico"
          className="w-full h-auto max-h-40 object-contain rounded print:mix-blend-multiply"
          style={{ mixBlendMode: "multiply", filter: "contrast(1.2)" }}
        />
      </div>
    );
  }

  if (!hasVectorData && !value.imageDataUrl) {
    return null;
  }

  const zone = value.zone || "full_field";
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <div className={`w-full h-full flex items-center justify-center bg-white border border-slate-300 rounded-lg p-1 overflow-hidden shadow-none ${className}`}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        className="w-full h-full object-contain bg-white font-sans"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Arrowhead Marker */}
          <marker
            id="svg-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="0,0 L0,6 L9,3 z" fill="#000000" />
          </marker>
        </defs>

        {/* 1. White Pitch Surface */}
        <rect width={width} height={height} fill="#ffffff" />

        {/* 2. Pitch Markings (Slate-700 2px crisp lines) */}
        {zone === "full_field" && (
          <g stroke="#334155" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Outer Boundary */}
            <rect x="16" y="16" width={width - 32} height={height - 32} />
            {/* Midfield Line */}
            <line x1={width / 2} y1="16" x2={width / 2} y2={height - 16} />
            {/* Center Circle & Spot */}
            <circle cx={width / 2} cy={height / 2} r="40" />
            <circle cx={width / 2} cy={height / 2} r="2.5" fill="#1e293b" />
            
            {/* Left Penalty Box */}
            <rect x="16" y={height / 2 - 55} width="45" height="110" />
            <rect x="16" y={height / 2 - 28} width="18" height="56" />
            <circle cx="48" cy={height / 2} r="2" fill="#1e293b" />
            <path d={`M 61 ${height / 2 - 28} A 28 28 0 0 1 61 ${height / 2 + 28}`} />

            {/* Right Penalty Box */}
            <rect x={width - 61} y={height / 2 - 55} width="45" height="110" />
            <rect x={width - 34} y={height / 2 - 28} width="18" height="56" />
            <circle cx={width - 48} cy={height / 2} r="2" fill="#1e293b" />
            <path d={`M ${width - 61} ${height / 2 - 28} A 28 28 0 0 0 ${width - 61} ${height / 2 + 28}`} />

            {/* Corner Arcs */}
            <path d="M 16 24 A 8 8 0 0 0 24 16" />
            <path d={`M ${width - 24} 16 A 8 8 0 0 0 ${width - 16} 24`} />
            <path d={`M 16 ${height - 24} A 8 8 0 0 1 24 ${height - 16}`} />
            <path d={`M ${width - 24} ${height - 16} A 8 8 0 0 1 ${width - 16} ${height - 24}`} />
          </g>
        )}

        {(zone === "half_field" || zone === "defensive_third" || zone === "offensive_third") && (
          <g stroke="#334155" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="16" width={width - 32} height={height - 32} />
            <line x1="16" y1="16" x2="16" y2={height - 16} />
            <path d={`M 16 ${height / 2 - 45} A 45 45 0 0 1 16 ${height / 2 + 45}`} />
            <rect x={width - 106} y={height / 2 - 90} width="90" height="180" />
            <rect x={width - 46} y={height / 2 - 45} width="30" height="90" />
            <circle cx={width - 81} cy={height / 2} r="2.5" fill="#1e293b" />
          </g>
        )}

        {zone === "penalty_area" && (
          <g stroke="#334155" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width={width - 24} height={height - 24} />
            <rect x={width / 2 - 180} y={height - 160} width="360" height="148" />
            <rect x={width / 2 - 80} y={height - 60} width="160" height="48" />
            <circle cx={width / 2} cy={height - 100} r="3" fill="#1e293b" />
          </g>
        )}

        {zone === "custom_area" && (
          <g stroke="#334155" strokeWidth="2" fill="none">
            <rect x="10" y="10" width={width - 20} height={height - 20} strokeDasharray="4,4" />
          </g>
        )}

        {/* 3. Strokes Layer */}
        {value.strokes?.map((stroke: WhiteboardStroke, idx: number) => {
          if (!stroke.points || stroke.points.length < 2) return null;
          const strokeWidth = (stroke as any).width ? Math.max((stroke as any).width, 2.5) : 3;
          const isDashed = stroke.type.startsWith("dashed_");
          const isArrow = stroke.type.includes("arrow");

          if (stroke.type === "rectangle" || stroke.type === "dashed_rectangle") {
            const start = stroke.points[0];
            const end = stroke.points[stroke.points.length - 1];
            const rectW = end.x - start.x;
            const rectH = end.y - start.y;
            return (
              <rect
                key={stroke.id || idx}
                x={Math.min(start.x, end.x)}
                y={Math.min(start.y, end.y)}
                width={Math.abs(rectW)}
                height={Math.abs(rectH)}
                fill="none"
                stroke="#000000"
                strokeWidth={strokeWidth}
                strokeDasharray={isDashed ? "6,6" : "none"}
              />
            );
          }

          if (stroke.type === "pencil") {
            const pathData = stroke.points.reduce(
              (acc, pt, pIdx) => (pIdx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
              ""
            );
            return (
              <path
                key={stroke.id || idx}
                d={pathData}
                fill="none"
                stroke="#000000"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }

          // Line & Arrow
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1];
          return (
            <line
              key={stroke.id || idx}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#000000"
              strokeWidth={strokeWidth}
              strokeDasharray={isDashed ? "6,6" : "none"}
              strokeLinecap="round"
              markerEnd={isArrow ? "url(#svg-arrowhead)" : undefined}
            />
          );
        })}

        {/* 4. Markers Layer */}
        {value.markers?.map((marker: MarkerElement, idx: number) => {
          const { x, y, type, number } = marker;
          const rotation = marker.rotation ?? 0;
          const transform = `translate(${x}, ${y}) rotate(${rotation})`;

          if (type === "cone") {
            return (
              <g key={marker.id || idx} transform={transform}>
                <polygon points="0,-8 -7,7 7,7" fill="#f59e0b" stroke="#000000" strokeWidth="1.5" />
              </g>
            );
          }

          if (type === "player" || type === "rival") {
            const isPlayer = type === "player";
            return (
              <g key={marker.id || idx} transform={transform}>
                <circle
                  r="11"
                  fill={isPlayer ? "#ffffff" : "#fee2e2"}
                  stroke="#000000"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#000000"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {number ?? "1"}
                </text>
              </g>
            );
          }

          if (type === "ball") {
            return (
              <g key={marker.id || idx} transform={transform}>
                <circle r="7" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                <line x1="-5" y1="0" x2="5" y2="0" stroke="#000000" strokeWidth="1" />
                <line x1="0" y1="-5" x2="0" y2="5" stroke="#000000" strokeWidth="1" />
              </g>
            );
          }

          if (type.startsWith("goal_") || type === "mini_goal") {
            const gw = type === "goal_11" ? 40 : type === "goal_7" ? 30 : 20;
            const gh = type === "goal_11" ? 16 : type === "goal_7" ? 12 : 8;
            return (
              <g key={marker.id || idx} transform={transform}>
                <rect
                  x={-gw / 2}
                  y={-gh / 2}
                  width={gw}
                  height={gh}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                />
              </g>
            );
          }

          return null;
        })}

        {/* 5. Texts Layer */}
        {value.texts?.map((txt: TextElement, idx: number) => (
          <text
            key={txt.id || idx}
            x={txt.x}
            y={txt.y}
            fill="#000000"
            fontSize="12"
            fontWeight="bold"
          >
            {txt.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
