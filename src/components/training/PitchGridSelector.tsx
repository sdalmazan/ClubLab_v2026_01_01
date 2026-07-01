"use client";

import { cn } from "@/lib/utils";

interface PitchGridSelectorProps {
  selectedZones: string[];
  onChange?: (zones: string[]) => void;
  interactive?: boolean;
}

// Tactical grid definition (6 rows x 4 columns)
// From top to bottom (opponent goal to own goal)
const ROWS = [
  { key: "F", label: "Finalización (Ataque)" },
  { key: "E", label: "Creación Alta" },
  { key: "D", label: "Creación Central" },
  { key: "C", label: "Construcción Central" },
  { key: "B", label: "Construcción Baja" },
  { key: "A", label: "Iniciación (Defensa)" },
];

const COLS = [
  { key: "1", label: "Banda Izquierda" },
  { key: "2", label: "Canal Interior Izquierdo" },
  { key: "3", label: "Canal Interior Derecho" },
  { key: "4", label: "Banda Derecha" },
];

export function PitchGridSelector({
  selectedZones = [],
  onChange,
  interactive = true,
}: PitchGridSelectorProps) {
  const toggleZone = (zoneId: string) => {
    if (!interactive || !onChange) return;
    if (selectedZones.includes(zoneId)) {
      onChange(selectedZones.filter((z) => z !== zoneId));
    } else {
      onChange([...selectedZones, zoneId]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-[280px] mx-auto select-none aspect-[100/140] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-slate-950">
        {/* Field Background & Lines */}
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(28%_0.10_145)] to-[oklch(18%_0.08_145)]">
          <svg
            viewBox="0 0 100 140"
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
            preserveAspectRatio="none"
          >
            {/* Outer border */}
            <rect x="4" y="4" width="92" height="132" fill="none" stroke="white" strokeWidth="0.8" />
            {/* Centre line */}
            <line x1="4" y1="70" x2="96" y2="70" stroke="white" strokeWidth="0.6" />
            {/* Centre circle */}
            <circle cx="50" cy="70" r="12" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="50" cy="70" r="0.8" fill="white" />
            {/* Penalty area top (Spans cols 2 & 3, row F) */}
            <rect x="27" y="4" width="46" height="23" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Goal area top */}
            <rect x="36" y="4" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Penalty area bottom (Spans cols 2 & 3, row A) */}
            <rect x="27" y="113" width="46" height="23" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Goal area bottom */}
            <rect x="36" y="127" width="28" height="9" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Penalty spots */}
            <circle cx="50" cy="18" r="0.8" fill="white" />
            <circle cx="50" cy="122" r="0.8" fill="white" />
            {/* Goals */}
            <rect x="38" y="1.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
            <rect x="38" y="135.5" width="24" height="3" fill="none" stroke="white" strokeWidth="0.6" />
          </svg>
        </div>

        {/* Grid Cells (Aligned with x=4..96 and y=4..136) */}
        <div
          className="absolute"
          style={{
            top: "2.85%",
            bottom: "2.85%",
            left: "4%",
            right: "4%",
          }}
        >
          <div className="grid grid-cols-4 grid-rows-6 w-full h-full border border-white/5">
            {ROWS.map((row) =>
              COLS.map((col) => {
                const zoneId = `${row.key}${col.key}`;
                const isSelected = selectedZones.includes(zoneId);

                return (
                  <button
                    key={zoneId}
                    type="button"
                    disabled={!interactive}
                    onClick={() => toggleZone(zoneId)}
                    className={cn(
                      "relative border border-white/10 transition-all flex items-center justify-center text-[10px] font-bold",
                      isSelected
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/60 shadow-[inset_0_0_12px_rgba(16,185,129,0.2)]"
                        : "text-slate-500/40 border-white/5 hover:bg-white/5 hover:border-white/20 hover:text-slate-400",
                      interactive ? "cursor-pointer" : "cursor-default"
                    )}
                    title={`${row.label} — ${col.label}`}
                  >
                    {zoneId}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {interactive && (
        <p className="text-[10px] text-slate-500 text-center italic leading-tight">
          Haz clic en las celdas del campo para seleccionar las zonas de la tarea.
        </p>
      )}
    </div>
  );
}
