import React from "react";

interface Dataset {
  label: string;
  values: Record<string, number | string>;
  color: string;
}

interface RadarChartProps {
  labels: { key: string; label: string }[];
  datasets: Dataset[];
  size?: number;
}

/**
 * Custom SVG Radar Chart.
 * Avoids any React 19 package version conflicts by drawing a pure SVG radar grid,
 * axis lines, data polygons, and text labels with smart alignment.
 */
export const RadarChart: React.FC<RadarChartProps> = ({
  labels,
  datasets,
  size = 400,
}) => {
  const totalPoints = labels.length;
  if (totalPoints < 3) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Se necesitan al menos 3 métricas para generar un gráfico de radar.
      </div>
    );
  }

  const padding = 60;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size - padding * 2) / 2;

  // Concentric grids levels (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Helper to compute (x, y) coordinates for a given value (0-100) and index
  const getCoordinates = (index: number, value: number) => {
    const angle = (index * 2 * Math.PI) / totalPoints - Math.PI / 2; // Offset by -90 deg (upwards)
    const factor = Math.min(100, Math.max(0, value)) / 100;
    const x = centerX + radius * Math.cos(angle) * factor;
    const y = centerY + radius * Math.sin(angle) * factor;
    return { x, y };
  };

  // Helper to compute label anchor position
  const getLabelAnchor = (index: number) => {
    const angle = (index * 2 * Math.PI) / totalPoints - Math.PI / 2;
    const cos = Math.cos(angle);
    if (cos > 0.1) return "start";
    if (cos < -0.1) return "end";
    return "middle";
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-[450px] overflow-visible"
      >
        <defs>
          {/* Glowing Drop Shadow Filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Draw Concentric Circular Grids */}
        {gridLevels.map((level, lvlIdx) => (
          <circle
            key={`grid-${lvlIdx}`}
            cx={centerX}
            cy={centerY}
            r={radius * level}
            fill="none"
            stroke="#1e293b"
            strokeWidth={1}
            strokeDasharray={level < 1 ? "4,4" : undefined}
          />
        ))}

        {/* 2. Draw Axis Lines */}
        {labels.map((_, idx) => {
          const outerPoint = getCoordinates(idx, 100);
          return (
            <line
              key={`axis-${idx}`}
              x1={centerX}
              y1={centerY}
              x2={outerPoint.x}
              y2={outerPoint.y}
              stroke="#334155"
              strokeWidth={1}
            />
          );
        })}

        {/* 3. Draw Data Polygons */}
        {datasets.map((dataset, dsIdx) => {
          const points = labels.map((label, idx) => {
            // Check if the value is numeric, otherwise default to 0
            const val = Number(dataset.values[label.key]) || 0;
            return getCoordinates(idx, val);
          });

          const pathData = points
            .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ") + " Z";

          return (
            <g key={`dataset-${dsIdx}`}>
              {/* Filled area with opacity */}
              <path
                d={pathData}
                fill={dataset.color}
                fillOpacity={0.2}
                className="transition-all duration-300"
              />
              {/* Glowing stroke */}
              <path
                d={pathData}
                fill="none"
                stroke={dataset.color}
                strokeWidth={2.5}
                filter="url(#glow)"
                className="transition-all duration-300"
              />
              {/* Vertex points */}
              {points.map((p, pIdx) => (
                <circle
                  key={`point-${dsIdx}-${pIdx}`}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="#ffffff"
                  stroke={dataset.color}
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}

        {/* 4. Draw Outer Axis Labels */}
        {labels.map((label, idx) => {
          const outerPoint = getCoordinates(idx, 100);
          const angle = (idx * 2 * Math.PI) / totalPoints - Math.PI / 2;
          
          // Push text outward slightly beyond the radius limit
          const pushDistance = 18;
          const labelX = outerPoint.x + Math.cos(angle) * pushDistance;
          const labelY = outerPoint.y + Math.sin(angle) * pushDistance + 4; // slight vertical adjustment

          return (
            <text
              key={`label-${idx}`}
              x={labelX}
              y={labelY}
              fill="#94a3b8"
              fontSize={11}
              fontWeight={600}
              textAnchor={getLabelAnchor(idx)}
              className="font-sans select-none"
            >
              {label.label}
            </text>
          );
        })}
      </svg>

      {/* 5. Custom Legend */}
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {datasets.map((dataset, idx) => (
          <div key={`legend-${idx}`} className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-white/20"
              style={{
                backgroundColor: dataset.color,
                boxShadow: `0 0 8px ${dataset.color}`,
              }}
            />
            <span className="text-sm font-semibold text-slate-300">
              {dataset.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default RadarChart;
