"use client";

import { useState, useEffect, useRef, useMemo, useId, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, FileText, Paintbrush, RotateCcw, Trash2, Shield, Circle, UserMinus, Pencil, ArrowUpRight, Target, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PositionKey } from "@/types";
import { POSITION_LABELS } from "@/types";

interface PlayerOption {
  id: string;
  first_name: string;
  last_name: string;
  membership?: {
    positions?: PositionKey[];
    player_type?: string;
    jersey_number?: number | null;
    [key: string]: any;
  } | null;
  active_injury?: {
    id: string;
    status: string;
    [key: string]: any;
  } | null;
}

interface MatchGamePlanProps {
  presentPlayers: PlayerOption[];
  value?: {
    formation?: string;
    lineup?: Record<string, string>; // spotId -> player_id
    substitutes?: string[]; // array of player_ids
    instructions?: string;
    set_pieces_offensive?: string;
    set_pieces_defensive?: string;
    whiteboard?: string; // base64 representation
    abp_assistant?: string;
    kicker_primary?: string;
    kicker_secondary?: string;
    defensive_short_post?: string;
    defensive_long_post?: string;
    defensive_wall?: string;
    custom_positions?: Record<string, { x: number, y: number }>;
    rival_dorsals?: Record<string, string>;
    own_dorsals?: Record<string, string>;
    whiteboard_data?: any;
    habitual_kickers?: string[];
  };
  onChange?: (val: any) => void;
  interactive?: boolean;
  organizationSettings?: any;
}

// 27 Tactical Spots for a Horizontal Field (Left: Own Goal, Right: Opponent Goal)
// x: 0-100 (from own goal line to rival goal line), y: 0-100 (top to bottom sideline)
const SPOTS = [
  // Goalkeeper
  { id: "gk", label: "POR", x: 8, y: 50, posKey: "goalkeeper" as PositionKey },

  // Column 1: Defense (x: 25)
  { id: "d1", label: "LI", x: 25, y: 15, posKey: "left_back" as PositionKey },
  { id: "d2", label: "DFC", x: 25, y: 32, posKey: "left_center_back" as PositionKey },
  { id: "d3", label: "DFC", x: 25, y: 50, posKey: "left_center_back" as PositionKey },
  { id: "d4", label: "DFC", x: 25, y: 68, posKey: "right_center_back" as PositionKey },
  { id: "d5", label: "LD", x: 25, y: 85, posKey: "right_back" as PositionKey },

  // Column 2: Defensive Midfield (x: 42)
  { id: "dm1", label: "CAD", x: 42, y: 15, posKey: "left_back" as PositionKey },
  { id: "dm2", label: "MCD", x: 42, y: 32, posKey: "defensive_midfielder" as PositionKey },
  { id: "dm3", label: "MCD", x: 42, y: 50, posKey: "defensive_midfielder" as PositionKey },
  { id: "dm4", label: "MCD", x: 42, y: 68, posKey: "defensive_midfielder" as PositionKey },
  { id: "dm5", label: "CAD", x: 42, y: 85, posKey: "right_back" as PositionKey },

  // Column 3: Midfield (x: 58)
  { id: "m1", label: "MI", x: 58, y: 15, posKey: "left_winger" as PositionKey },
  { id: "m2", label: "MC", x: 58, y: 32, posKey: "playmaker_midfielder" as PositionKey },
  { id: "m3", label: "MC", x: 58, y: 50, posKey: "playmaker_midfielder" as PositionKey },
  { id: "m4", label: "MC", x: 58, y: 68, posKey: "playmaker_midfielder" as PositionKey },
  { id: "m5", label: "MD", x: 58, y: 85, posKey: "right_winger" as PositionKey },

  // Column 4: Attacking Midfield (x: 72)
  { id: "am1", label: "MCO", x: 72, y: 15, posKey: "attacking_midfielder" as PositionKey },
  { id: "am2", label: "MCO", x: 72, y: 32, posKey: "attacking_midfielder" as PositionKey },
  { id: "am3", label: "MCO", x: 72, y: 50, posKey: "attacking_midfielder" as PositionKey },
  { id: "am4", label: "MCO", x: 72, y: 68, posKey: "attacking_midfielder" as PositionKey },
  { id: "am5", label: "MCO", x: 72, y: 85, posKey: "attacking_midfielder" as PositionKey },

  // Column 5: Forward (x: 85)
  { id: "f1", label: "EI", x: 85, y: 15, posKey: "left_winger" as PositionKey },
  { id: "f2", label: "DC", x: 85, y: 32, posKey: "striker" as PositionKey },
  { id: "f3", label: "DC", x: 85, y: 50, posKey: "striker" as PositionKey },
  { id: "f4", label: "DC", x: 85, y: 68, posKey: "striker" as PositionKey },
  { id: "f5", label: "ED", x: 85, y: 85, posKey: "right_winger" as PositionKey },

  // Opponent spot
  { id: "del_rival", label: "RIV", x: 93, y: 50, posKey: "striker" as PositionKey },
];

const FORMATION_SPOTS: Record<string, string[]> = {
  "4-3-3": ["gk", "d1", "d2", "d4", "d5", "dm3", "m2", "m4", "f1", "f3", "f5"],
  "4-4-2": ["gk", "d1", "d2", "d4", "d5", "m1", "m2", "m4", "m5", "f2", "f4"],
  "3-5-2": ["gk", "d2", "d3", "d4", "m1", "dm2", "dm4", "m5", "am3", "f2", "f4"],
  "3-4-3": ["gk", "d2", "d3", "d4", "m1", "m2", "m4", "m5", "f1", "f3", "f5"],
  "5-3-2": ["gk", "d1", "d2", "d3", "d4", "d5", "m2", "m3", "m4", "f2", "f4"],
};

const JerseyIcon = ({
  primary,
  secondary,
  number,
  style = "solid",
}: {
  primary: string;
  secondary: string;
  number?: string | number;
  style?: string;
}) => {
  const clipId = useId();
  return (
    <svg viewBox="0 0 100 100" className="h-9 w-9 sm:h-11 sm:w-11 drop-shadow-md select-none pointer-events-none">
      <defs>
        <clipPath id={clipId}>
          <path d="M20,20 L32,10 L50,18 L68,10 L80,20 L72,44 L66,42 L66,66 L34,66 L34,42 L28,44 Z" />
        </clipPath>
      </defs>
      
      {/* Background (Primary color) */}
      <path
        d="M20,20 L32,10 L50,18 L68,10 L80,20 L72,44 L66,42 L66,66 L34,66 L34,42 L28,44 Z"
        fill={primary}
        stroke={secondary}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Stripes overlay based on style clipped to jersey shape */}
      {style === "vertical" && (
        <g clipPath={`url(#${clipId})`}>
          <rect x="28" y="5" width="8" height="70" fill={secondary} />
          <rect x="46" y="5" width="8" height="70" fill={secondary} />
          <rect x="64" y="5" width="8" height="70" fill={secondary} />
        </g>
      )}

      {style === "horizontal" && (
        <g clipPath={`url(#${clipId})`}>
          <rect x="15" y="18" width="70" height="8" fill={secondary} />
          <rect x="15" y="34" width="70" height="8" fill={secondary} />
          <rect x="15" y="50" width="70" height="8" fill={secondary} />
        </g>
      )}

      {/* Collar detail */}
      <path
        d="M42,14 L50,22 L58,14"
        fill="none"
        stroke={secondary}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {number !== undefined && (
        <text
          x="50"
          y="40"
          fill="#ffffff"
          stroke={style !== "solid" ? "#000000" : "none"}
          strokeWidth={style !== "solid" ? "1.5" : "0"}
          paintOrder="stroke fill"
          fontSize="21"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {number}
        </text>
      )}
    </svg>
  );
};

export function MatchGamePlan({
  presentPlayers = [],
  value = {},
  onChange,
  interactive = true,
  organizationSettings = {},
}: MatchGamePlanProps) {
  const [activeTab, setActiveTab] = useState<"lineup" | "kickers" | "abp" | "whiteboard">("lineup");
  const [activeSeasonName, setActiveSeasonName] = useState<string>("");

  useEffect(() => {
    async function loadActiveSeason() {
      try {
        const supabase = createClient();
        const activeSeasonId = document.cookie
          .split("; ")
          .find((row) => row.startsWith("cl_active_season_id="))
          ?.split("=")[1];

        if (activeSeasonId) {
          const { data: season } = await supabase
            .from("seasons")
            .select("name")
            .eq("id", activeSeasonId)
            .single();
          if (season) {
            setActiveSeasonName(season.name);
          }
        } else {
          const { data: seasons } = await supabase
            .from("seasons")
            .select("name")
            .eq("is_active", true)
            .limit(1);
          if (seasons && seasons.length > 0) {
            setActiveSeasonName(seasons[0].name);
          }
        }
      } catch (e) {
        console.error("Error loading season name for print header:", e);
      }
    }
    loadActiveSeason();
  }, []);

  const formation = value.formation ?? "4-3-3";
  const lineup = value.lineup ?? {};
  const substitutes = value.substitutes ?? [];
  const instructions = value.instructions ?? "";
  const setPiecesOffensive = value.set_pieces_offensive ?? "";
  const setPiecesDefensive = value.set_pieces_defensive ?? "";
  const whiteboard = value.whiteboard ?? "";

  const abpAssistant = value.abp_assistant ?? "";
  const kickerPrimary = value.kicker_primary ?? "";
  const kickerSecondary = value.kicker_secondary ?? "";
  const defensiveShortPost = value.defensive_short_post ?? "";
  const defensiveLongPost = value.defensive_long_post ?? "";
  const defensiveWall = value.defensive_wall ?? "";

  const pitchContainerRef = useRef<HTMLDivElement | null>(null);
  const customPositions = value.custom_positions ?? {};
  const rivalDorsals = value.rival_dorsals ?? {};
  const ownDorsals = value.own_dorsals ?? {};

  const clubPrimaryColor = organizationSettings?.club_primary_color ?? "#10b981";
  const clubSecondaryColor = organizationSettings?.club_secondary_color ?? "#6366f1";
  const homeColor = organizationSettings?.pantone_home_color || clubPrimaryColor;

  const groupedKickerOptions = useMemo(() => {
    const habitualIds = new Set<string>(value.habitual_kickers ?? organizationSettings?.habitual_kickers ?? []);
    const starterIds = new Set<string>(Object.values(lineup));

    const habitualStarters: PlayerOption[] = [];
    const otherStarters: PlayerOption[] = [];
    const habitualNonStarters: PlayerOption[] = [];
    const restOfSquad: PlayerOption[] = [];

    presentPlayers.forEach((p) => {
      const isHabitual = habitualIds.has(p.id);
      const isStarter = starterIds.has(p.id);

      if (isHabitual && isStarter) {
        habitualStarters.push(p);
      } else if (!isHabitual && isStarter) {
        otherStarters.push(p);
      } else if (isHabitual && !isStarter) {
        habitualNonStarters.push(p);
      } else {
        restOfSquad.push(p);
      }
    });

    return {
      habitualStarters,
      otherStarters,
      habitualNonStarters,
      restOfSquad,
    };
  }, [presentPlayers, lineup, value.habitual_kickers, organizationSettings]);

  const activeSpots = useMemo(() => {
    return FORMATION_SPOTS[formation] ?? FORMATION_SPOTS["4-3-3"];
  }, [formation]);

  const adjustedSpots = useMemo(() => {
    return SPOTS.map((spot) => {
      if (value.custom_positions?.[spot.id]) {
        return {
          ...spot,
          x: value.custom_positions[spot.id].x,
          y: value.custom_positions[spot.id].y,
        };
      }

      let y = spot.y;
      // Centering logic for defense: if d3 (center DFC) is empty, pull d2 and d4 closer to 50
      if (spot.id === "d2" && !lineup["d3"]) y = 35;
      else if (spot.id === "d4" && !lineup["d3"]) y = 65;
      
      // Centering logic for defensive midfield: if dm3 (center MCD) is empty, pull dm2 and dm4 closer to 50
      if (spot.id === "dm2" && !lineup["dm3"]) y = 35;
      else if (spot.id === "dm4" && !lineup["dm3"]) y = 65;
      
      // Centering logic for midfield: if m3 (center MC) is empty, pull m2 and m4 closer to 50
      if (spot.id === "m2" && !lineup["m3"]) y = 35;
      else if (spot.id === "m4" && !lineup["m3"]) y = 65;

      // Centering logic for attacking midfield: if am3 (center MCO) is empty, pull am2 and am4 closer to 50
      if (spot.id === "am2" && !lineup["am3"]) y = 35;
      else if (spot.id === "am4" && !lineup["am3"]) y = 65;

      // Centering logic for forwards: if f3 (center DC) is empty, pull f2 and f4 closer to 50
      if (spot.id === "f2" && !lineup["f3"]) y = 35;
      else if (spot.id === "f4" && !lineup["f3"]) y = 65;

      return { ...spot, y };
    });
  }, [lineup, value.custom_positions]);

  const handleFieldChange = (field: string, val: any) => {
    if (!onChange) return;
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handlePlayerSelect = (spotId: string, playerId: string) => {
    const newLineup = { ...lineup };
    if (!playerId) {
      delete newLineup[spotId];
    } else {
      // Remove this player from other spots to prevent duplication
      Object.keys(newLineup).forEach((key) => {
        if (newLineup[key] === playerId) {
          delete newLineup[key];
        }
      });
      newLineup[spotId] = playerId;

      // Remove player from substitutes if they were there
      if (substitutes.includes(playerId)) {
        const newSubs = substitutes.filter((id) => id !== playerId);
        handleFieldChange("substitutes", newSubs);
      }
    }
    handleFieldChange("lineup", newLineup);
  };

  const handleSubstituteToggle = (playerId: string) => {
    let newSubs = [...substitutes];
    if (newSubs.includes(playerId)) {
      newSubs = newSubs.filter((id) => id !== playerId);
    } else {
      newSubs.push(playerId);
      // Remove from lineup if starting
      const newLineup = { ...lineup };
      Object.keys(newLineup).forEach((key) => {
        if (newLineup[key] === playerId) {
          delete newLineup[key];
        }
      });
      handleFieldChange("lineup", newLineup);
    }
    handleFieldChange("substitutes", newSubs);
  };

  const handleRemoveFromLineup = (spotId: string) => {
    const newLineup = { ...lineup };
    delete newLineup[spotId];
    handleFieldChange("lineup", newLineup);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, playerId: string, fromSpotId?: string) => {
    e.dataTransfer.setData("text/plain", playerId);
    if (fromSpotId) {
      e.dataTransfer.setData("fromSpotId", fromSpotId);
      if (!playerId) {
        e.dataTransfer.setData("dragType", "spot");
      } else {
        e.dataTransfer.setData("dragType", "player");
      }
    } else {
      e.dataTransfer.setData("dragType", "player");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, spotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const playerId = e.dataTransfer.getData("text/plain");
    const fromSpotId = e.dataTransfer.getData("fromSpotId");
    const dragType = e.dataTransfer.getData("dragType");

    if (playerId) {
      const newLineup = { ...lineup };
      const currentPlayerAtSpot = lineup[spotId];
      let newSubs = [...substitutes];

      if (fromSpotId) {
        if (currentPlayerAtSpot) {
          // Swap
          newLineup[fromSpotId] = currentPlayerAtSpot;
        } else {
          // Clear origin
          delete newLineup[fromSpotId];
        }
      } else {
        // Dragged from pool
        if (currentPlayerAtSpot) {
          if (!newSubs.includes(currentPlayerAtSpot)) {
            newSubs.push(currentPlayerAtSpot);
          }
        }
      }

      Object.keys(newLineup).forEach((key) => {
        if (key !== fromSpotId && newLineup[key] === playerId) {
          delete newLineup[key];
        }
      });

      newLineup[spotId] = playerId;
      newSubs = newSubs.filter((id) => id !== playerId);

      onChange && onChange({
        ...value,
        lineup: newLineup,
        substitutes: newSubs,
      });
    }
  };

  const handlePitchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) return;

    const dragType = e.dataTransfer.getData("dragType");
    const spotId = e.dataTransfer.getData("fromSpotId");

    // Allow dragging any spot (empty or occupied) to move it
    if ((dragType === "spot" || dragType === "player") && spotId) {
      const pitch = pitchContainerRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const x = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100);
      const y = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100);

      const customPositions = { ...(value.custom_positions || {}) };
      customPositions[spotId] = { x, y };

      onChange && onChange({
        ...value,
        custom_positions: customPositions,
      });
    }
  };

  const handleRemoveCustomPosition = (spotId: string) => {
    const customPositions = { ...(value.custom_positions || {}) };
    delete customPositions[spotId];
    onChange && onChange({
      ...value,
      custom_positions: customPositions,
    });
  };

  const handlePitchTokenDoubleClick = (playerId: string) => {
    if (!interactive) return;
    const isRival = playerId.startsWith("rival_");
    const currentNumber = isRival
      ? (value.rival_dorsals?.[playerId] || "")
      : (value.own_dorsals?.[playerId] || presentPlayers.find((p) => p.id === playerId)?.membership?.jersey_number?.toString() || "");

    const newNumber = prompt(
      `Introduce el número de dorsal para este jugador ${isRival ? "rival" : "del club"}:`,
      currentNumber
    );

    if (newNumber === null) return;

    if (isRival) {
      const rivalDorsals = { ...(value.rival_dorsals || {}) };
      rivalDorsals[playerId] = newNumber.trim();
      onChange && onChange({
        ...value,
        rival_dorsals: rivalDorsals,
      });
    } else {
      const ownDorsals = { ...(value.own_dorsals || {}) };
      ownDorsals[playerId] = newNumber.trim();
      onChange && onChange({
        ...value,
        own_dorsals: ownDorsals,
      });
    }
  };

  const handleSidebarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const playerId = e.dataTransfer.getData("text/plain");
    const fromSpotId = e.dataTransfer.getData("fromSpotId");
    const dragType = e.dataTransfer.getData("dragType");

    const customPositions = { ...(value.custom_positions || {}) };
    const newLineup = { ...lineup };
    let newSubs = [...substitutes];

    if (dragType === "spot" && fromSpotId) {
      delete customPositions[fromSpotId];
    }

    if (playerId && fromSpotId) {
      delete newLineup[fromSpotId];
      if (!newSubs.includes(playerId) && !playerId.startsWith("rival_")) {
        newSubs.push(playerId);
      }
    }

    onChange && onChange({
      ...value,
      custom_positions: customPositions,
      lineup: newLineup,
      substitutes: newSubs,
    });
  };

  // Get physical traffic light indicator color
  const getPlayerStatus = (player: PlayerOption) => {
    if (player.active_injury?.status === "active") return "red";
    if (player.active_injury?.status === "readaptation") return "yellow";
    return "green";
  };

  const getPlayerNameShort = (id: string) => {
    const player = presentPlayers.find((p) => p.id === id);
    if (!player) return "";
    return `${player.first_name[0]}. ${player.last_name}`;
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print, header, nav, aside, button, [data-sidebar], .sidebar-inset > header {
            display: none !important;
          }
          .glass {
            background: transparent !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }
          .text-white {
            color: black !important;
          }
          .text-slate-300, .text-slate-400, .text-slate-350, .text-slate-450 {
            color: #1e293b !important;
          }
          /* Keep soccer pitch visual background */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      ` }} />

      {/* Print header */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6 w-full">
        <div className="flex items-center gap-4">
          {organizationSettings?.club_logo_url ? (
            <img
              src={organizationSettings.club_logo_url}
              alt="Escudo"
              className="h-14 w-14 object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center border border-slate-300">
              <Shield className="h-8 w-8 text-slate-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {organizationSettings?.club_name || "ClubLab"}
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Plan de Partido — Temporada {activeSeasonName || "2026/2027"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 font-semibold">ClubLab Oficial</p>
          <p className="text-[10px] text-slate-500">Fecha de exportación: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Tab Navigation (Hidden in print) */}
      <div className="flex border-b border-white/10 gap-2 mb-6 no-print overflow-x-auto pb-1 items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: "lineup" as const, label: "Convocatoria y Alineación", icon: Users },
            { id: "abp" as const, label: "Pautas y Roles ABP", icon: FileText },
            { id: "whiteboard" as const, label: "Pizarra Táctica", icon: Paintbrush },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "border-emerald-500 bg-emerald-500/5 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-white/2"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer no-print mr-2"
          title="Exportar PDF"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Exportar PDF</span>
        </button>
      </div>

      {/* ── ALINEACIÓN Y SUPLENTES (PÁGINA 1) ── */}
      <div className={cn(
        "grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch print:break-after-page",
        activeTab === "lineup" ? "grid" : "hidden print:grid"
      )}>
        {/* Sidebar: Convocation Pool & Substitutes (Left side on desktop) */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleSidebarDrop}
          className="xl:col-span-4 flex flex-col glass rounded-2xl p-5 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent"
        >
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 corp-icon" />
                Convocatoria y Suplentes ({substitutes.length})
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Arrastra jugadores al campo o añádelos a la lista de suplentes.
              </p>
            </div>

            {interactive && (
              /* Physical Status Legend */
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10 text-[9px] text-slate-400 font-semibold flex-wrap shrink-0">
                <span className="font-bold uppercase tracking-wider text-slate-400 mr-1">Leyenda:</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Disponible
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Control/Duda
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Lesionado
                </span>
              </div>
            )}

            {interactive ? (
              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                {/* Own Players Pool */}
                <div className="flex flex-col flex-1 min-h-0">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">
                    Nuestros Jugadores ({presentPlayers.length})
                  </h4>
                  <div className="space-y-1.5 flex-1 min-h-[200px] xl:min-h-0 max-h-[350px] xl:max-h-none overflow-y-auto pr-1">
                    {presentPlayers.map((p) => {
                      const isStarting = Object.values(lineup).includes(p.id) || (value.custom_positions && !!value.custom_positions[p.id]);
                      const isSub = substitutes.includes(p.id);
                      const status = getPlayerStatus(p);

                      return (
                        <div
                          key={p.id}
                          draggable={!isStarting}
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          className={cn(
                            "p-2 rounded-xl text-xs flex items-center justify-between border transition-all select-none",
                            isStarting
                              ? "border-emerald-500/10 bg-emerald-500/5 opacity-40 cursor-not-allowed"
                              : isSub
                              ? "border-sky-500/30 bg-sky-500/5 text-sky-400 font-extrabold cursor-grab"
                              : "border-white/5 bg-white/1 hover:bg-white/3 text-slate-350 hover:text-white cursor-grab"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                status === "red" && "bg-rose-500",
                                status === "yellow" && "bg-amber-400",
                                status === "green" && "bg-green-500"
                              )}
                            />
                            <span className="font-semibold">{p.first_name} {p.last_name}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {isStarting ? (
                              <span className="text-[8px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                En campo
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSubstituteToggle(p.id)}
                                className={cn(
                                  "text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                  isSub
                                    ? "bg-sky-500/15 text-sky-400 hover:bg-sky-500/25"
                                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {isSub ? "Suplente" : "Hacer suplente"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {substitutes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No se han registrado suplentes</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {substitutes.map((id) => (
                      <div
                        key={id}
                        className="p-2.5 rounded-lg border border-white/5 bg-white/2 text-xs font-semibold text-slate-350 print:border-slate-200 print:text-slate-800"
                      >
                        {getPlayerNameShort(id)} (Suplente)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-white/5 pt-3 text-[10px] text-slate-500 leading-relaxed print:hidden">
            Tip: El semáforo indica el estado físico (Verde: Disponible, Amarillo: Control/Duda, Rojo: Baja). Haz doble-click sobre un jugador en el campo para cambiar su dorsal.
          </div>
        </div>

        {/* Horizontal Soccer Field (Right side on desktop, originally on Left) */}
        <div className="xl:col-span-8 flex flex-col items-center justify-center glass rounded-2xl p-4 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent">
          <div className="w-full flex items-center justify-between gap-4 mb-4 no-print">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Alineación Horizontal (27 Spots Tácticos)
            </span>
            {interactive ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Formación:</span>
                <select
                  value={formation}
                  onChange={(e) => handleFieldChange("formation", e.target.value)}
                  className="rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                >
                  <option value="4-3-3">4-3-3 (Pivote)</option>
                  <option value="4-4-2">4-4-2 (Clásico)</option>
                  <option value="3-5-2">3-5-2 (Carrileros)</option>
                  <option value="3-4-3">3-4-3 (Ofensivo)</option>
                  <option value="5-3-2">5-3-2 (Muro)</option>
                </select>
              </div>
            ) : (
              <span className="text-xs font-extrabold text-emerald-450 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                Formación: {formation}
              </span>
            )}
          </div>

          {/* Tactical Pitch Container */}
          <div
            ref={pitchContainerRef}
            onDragOver={handleDragOver}
            onDrop={handlePitchDrop}
            className="relative w-full aspect-[3/2] bg-emerald-950/90 border-2 border-white/15 rounded-2xl overflow-hidden shadow-xl print:border-slate-400 print:bg-slate-50"
            style={{ minHeight: "280px" }}
          >
            {/* Field Markings */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
              preserveAspectRatio="none"
            >
              {/* Outer boundary */}
              <rect x="5" y="5" width="90" height="90" fill="none" stroke="white" strokeWidth="0.8" />
              {/* Halfway line */}
              <line x1="50" y1="5" x2="50" y2="95" stroke="white" strokeWidth="0.8" />
              {/* Center Circle */}
              <circle cx="50" cy="50" r="14" fill="none" stroke="white" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="0.8" fill="white" />
              {/* Penalty area left */}
              <rect x="5" y="22" width="18" height="56" fill="none" stroke="white" strokeWidth="0.8" />
              <circle cx="17" cy="50" r="0.8" fill="white" />
              {/* Penalty area right */}
              <rect x="77" y="22" width="18" height="56" fill="none" stroke="white" strokeWidth="0.8" />
              <circle cx="83" cy="50" r="0.8" fill="white" />
              {/* Goalbox left */}
              <rect x="5" y="36" width="6" height="28" fill="none" stroke="white" strokeWidth="0.8" />
              {/* Goalbox right */}
              <rect x="89" y="36" width="6" height="28" fill="none" stroke="white" strokeWidth="0.8" />
              {/* Goalposts left */}
              <rect x="2.5" y="44" width="2.5" height="12" fill="none" stroke="white" strokeWidth="0.8" />
              {/* Goalposts right */}
              <rect x="95" y="44" width="2.5" height="12" fill="none" stroke="white" strokeWidth="0.8" />
            </svg>

            {/* Render 27 Tactical Spots */}
            {adjustedSpots
              .filter((spot) => activeSpots.includes(spot.id))
              .map((spot) => {
                const isActive = activeSpots.includes(spot.id);
                const assignedPlayerId = lineup[spot.id] || "";
                const player = presentPlayers.find((p) => p.id === assignedPlayerId);
                const playerName = player ? getPlayerNameShort(assignedPlayerId) : "";
                const statusColor = player ? getPlayerStatus(player) : "green";

                // Check if playing out of position
                const playsPosition = player?.membership?.positions?.includes(spot.posKey);
                const isOutOfPosition = player && !playsPosition;

                // Filter players for select options
                const matchingSpecialists = presentPlayers.filter(
                  (p) => p.membership?.positions?.includes(spot.posKey)
                );
                const otherPlayers = presentPlayers.filter(
                  (p) => !p.membership?.positions?.includes(spot.posKey)
                );

                return (
                  <div
                    key={spot.id}
                    draggable={interactive}
                    onDragStart={(e) => handleDragStart(e, assignedPlayerId, spot.id)}
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, spot.id)}
                    className={cn(
                      "absolute z-10 flex flex-col items-center gap-0.5 text-center transition-all select-none",
                      isActive ? "opacity-100 scale-100" : "opacity-35 hover:opacity-75 scale-90",
                      interactive && "cursor-grab active:cursor-grabbing hover:scale-105"
                    )}
                  >
                    <div className="relative group flex flex-col items-center">
                      {/* Circle Node / Jersey Icon */}
                      {assignedPlayerId ? (
                        <div
                          onDoubleClick={() => handlePitchTokenDoubleClick(assignedPlayerId)}
                          className="relative cursor-pointer transition-all hover:scale-105 select-none"
                        >
                          <JerseyIcon
                            primary={spot.id === "del_rival" ? (organizationSettings?.pantone_rival_color ?? "#ef4444") : (isOutOfPosition ? "#475569" : homeColor)}
                            secondary={spot.id === "del_rival" ? "#ffffff" : clubSecondaryColor}
                            number={value.own_dorsals?.[assignedPlayerId] ?? player?.membership?.jersey_number ?? spot.label}
                            style={spot.id === "del_rival" ? "solid" : (organizationSettings?.club_jersey_style ?? "solid")}
                          />
                          {isOutOfPosition && (
                            <div className="absolute -inset-1 rounded-xl border-2 border-amber-500/85 animate-pulse pointer-events-none" />
                          )}
                          {/* Physical Status Traffic Light Badge */}
                          <span
                            className={cn(
                              "absolute -bottom-1 right-0 h-3 w-3 rounded-full border-2 border-slate-950",
                              statusColor === "red" && "bg-rose-500",
                              statusColor === "yellow" && "bg-amber-450",
                              statusColor === "green" && "bg-green-500"
                            )}
                          />
                          {/* Quick removal button in interactive mode */}
                          {interactive && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromLineup(spot.id)}
                              className="absolute -top-1.5 -left-1.5 bg-rose-600 hover:bg-rose-500 rounded-full p-0.5 border border-slate-950 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Quitar de alineación"
                            >
                              <UserMinus className="h-2 w-2" />
                            </button>
                          )}
                        </div>
                      ) : (
                        interactive && (
                          <select
                            value=""
                            onChange={(e) => handlePlayerSelect(spot.id, e.target.value)}
                            className="rounded-full bg-slate-900/90 border border-white/10 h-7 w-7 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none text-center"
                            style={{
                              backgroundImage: "none",
                              padding: 0,
                            }}
                          >
                            <option value="">+</option>
                            <optgroup label="Especialistas">
                              {matchingSpecialists.map((p) => {
                                const isStarting = Object.values(lineup).includes(p.id);
                                return (
                                  <option key={p.id} value={p.id} disabled={isStarting}>
                                    {p.first_name} {p.last_name} {isStarting ? "(T)" : ""}
                                  </option>
                                );
                              })}
                            </optgroup>
                            {otherPlayers.length > 0 && (
                              <optgroup label="Otros jugadores">
                                {otherPlayers.map((p) => {
                                  const isStarting = Object.values(lineup).includes(p.id);
                                  return (
                                    <option key={p.id} value={p.id} disabled={isStarting}>
                                      {p.first_name} {p.last_name} {isStarting ? "(T)" : ""}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                          </select>
                        )
                      )}
                      
                      {/* Reset custom position button */}
                      {interactive && value.custom_positions?.[spot.id] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomPosition(spot.id);
                          }}
                          className="absolute -bottom-1.5 -left-1.5 bg-amber-600 hover:bg-amber-500 rounded-full p-0.5 border border-slate-950 text-white z-20"
                          title="Restablecer posición"
                        >
                          <RotateCcw className="h-2 w-2" />
                        </button>
                      )}
                    </div>

                    {/* Player Name Tag */}
                    {assignedPlayerId && (
                      <span
                        className={cn(
                          "text-[8px] sm:text-[9px] font-extrabold px-1 py-0.5 rounded leading-none max-w-[65px] sm:max-w-[75px] truncate bg-black/60 backdrop-blur-xs text-white",
                          isOutOfPosition ? "text-amber-300 font-semibold" : "text-white"
                        )}
                      >
                        {playerName}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Banquillo y No Convocados below the field */}
          <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4 print:border-slate-300">
            {/* Banquillo (Suplentes) */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded bg-sky-500" />
                Banquillo (Suplentes)
              </h5>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/5 border border-white/10 min-h-[50px] items-center">
                {substitutes.length === 0 ? (
                  <span className="text-[10px] text-slate-500 italic">No hay suplentes asignados</span>
                ) : (
                  substitutes.map((subId) => {
                    const player = presentPlayers.find((p) => p.id === subId);
                    if (!player) return null;
                    const number = value.own_dorsals?.[subId] ?? player.membership?.jersey_number ?? "";
                    const status = getPlayerStatus(player);
                    return (
                      <div
                        key={subId}
                        draggable={interactive}
                        onDragStart={(e) => handleDragStart(e, subId)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold cursor-grab select-none transition-all border"
                        style={{ background: `${homeColor}18`, borderColor: `${homeColor}33`, color: homeColor }}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            status === "red" && "bg-rose-500",
                            status === "yellow" && "bg-amber-400",
                            status === "green" && "bg-green-500"
                          )}
                        />
                        <span>{player.first_name[0]}. {player.last_name} {number && `#${number}`}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* No convocados (Tachados / No incluidos) */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded bg-slate-600" />
                No Convocados
              </h5>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/2 border border-white/5 min-h-[50px] items-center">
                {(() => {
                  const starters = new Set([
                    ...Object.values(lineup),
                    ...Object.keys(value.custom_positions || {}).filter(id => !id.startsWith("rival_"))
                  ]);
                  const nonCalled = presentPlayers.filter(
                    (p) => !starters.has(p.id) && !substitutes.includes(p.id)
                  );

                  if (nonCalled.length === 0) {
                    return <span className="text-[10px] text-slate-600 italic">Todos convocados</span>;
                  }

                  return nonCalled.map((p) => {
                    const number = value.own_dorsals?.[p.id] ?? p.membership?.jersey_number ?? "";
                    return (
                      <div
                        key={p.id}
                        draggable={interactive}
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        className="flex items-center gap-1.5 bg-white/2 border border-white/5 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 line-through opacity-50 cursor-grab select-none hover:opacity-80 transition-all"
                        title="Arrastra para convocar o colocar en el campo"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                        <span>{p.first_name[0]}. {p.last_name} {number && `#${number}`}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LANZADORES HABITUALES (PÁGINA 1.5) ── */}
      <div className={cn(
        "space-y-4 no-print",
        activeTab === "kickers" ? "block" : "hidden"
      )}>
        <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-4 w-4 corp-icon" />
              Lanzadores Habituales de Balón Parado
            </h3>
            <p className="text-[10px] text-slate-400">
              Selecciona los lanzadores habituales de tu plantilla. Esto te permitirá priorizarlos y agruparlos en los desplegables de roles ABP.
            </p>
            {interactive ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[400px] overflow-y-auto pr-1 bg-white/2 border border-white/5 rounded-xl p-3">
                {presentPlayers.map((p) => {
                  const isChecked = (value.habitual_kickers ?? organizationSettings?.habitual_kickers ?? []).includes(p.id);
                  const number = p.membership?.jersey_number;
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer text-xs select-none",
                        isChecked
                          ? "border-emerald-500/30 bg-emerald-500/5 text-white font-bold"
                          : "border-white/5 bg-white/1 text-slate-405 hover:bg-white/2"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentKickers = value.habitual_kickers ?? organizationSettings?.habitual_kickers ?? [];
                          let newKickers: string[];
                          if (e.target.checked) {
                            newKickers = [...currentKickers, p.id];
                          } else {
                            newKickers = currentKickers.filter((id: string) => id !== p.id);
                          }
                          handleFieldChange("habitual_kickers", newKickers);
                        }}
                        className="rounded border-white/10 bg-slate-900 corp-accent focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="truncate">
                        {p.first_name} {p.last_name} {number && `#${number}`}
                      </span>
                    </label>
                  );
                })}
                {presentPlayers.length === 0 && (
                  <p className="text-xs text-slate-500 italic p-2 col-span-3">No hay jugadores convocados disponibles.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 bg-white/2 border border-white/5 rounded-xl p-3">
                {(value.habitual_kickers ?? organizationSettings?.habitual_kickers ?? []).map((id: string) => {
                  const p = presentPlayers.find((player) => player.id === id);
                  if (!p) return null;
                  const number = p.membership?.jersey_number;
                  return (
                    <div
                      key={id}
                      className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-white text-xs font-semibold"
                    >
                      {p.first_name} {p.last_name} {number && `#${number}`}
                    </div>
                  );
                })}
                {(value.habitual_kickers ?? organizationSettings?.habitual_kickers ?? []).length === 0 && (
                  <p className="text-xs text-slate-500 italic col-span-3">No se han definido lanzadores habituales.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── INSTRUCCIONES Y ROLES ABP (PÁGINA 2) ── */}
      <div className={cn(
        "space-y-6 print:break-before-page print:break-after-page print:pt-4",
        activeTab === "abp" ? "block" : "hidden print:block"
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
          {/* Pautas Colectivas */}
          <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 print:text-slate-800">
              Instrucciones y Pautas Colectivas
            </label>
            {interactive ? (
              <textarea
                rows={4}
                placeholder="Foco en presión tras pérdida, marcas en zona, transiciones rápidas..."
                value={instructions}
                onChange={(e) => handleFieldChange("instructions", e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            ) : (
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[60px] print:text-slate-855">
                {instructions || "Sin instrucciones específicas."}
              </p>
            )}
          </div>

          {/* ABP Estrategia Ofensiva y Defensiva */}
          <div className="grid grid-cols-1 gap-4">
            <div className="glass rounded-2xl p-4 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 print:text-slate-800">
                Estrategia ABP Ofensiva
              </label>
              {interactive ? (
                <textarea
                  rows={2}
                  placeholder="Lanzador principal, bloqueos y desmarques de apoyo..."
                  value={setPiecesOffensive}
                  onChange={(e) => handleFieldChange("set_pieces_offensive", e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              ) : (
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[40px] print:text-slate-855">
                  {setPiecesOffensive || "Sin pautas de ABP ofensivas registradas."}
                </p>
              )}
            </div>

            <div className="glass rounded-2xl p-4 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 print:text-slate-800">
                Estrategia ABP Defensiva
              </label>
              {interactive ? (
                <textarea
                  rows={2}
                  placeholder="Marcaje mixto, colocación de barrera, ayudas defensivas..."
                  value={setPiecesDefensive}
                  onChange={(e) => handleFieldChange("set_pieces_defensive", e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              ) : (
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[40px] print:text-slate-855">
                  {setPiecesDefensive || "Sin pautas de ABP defensivas registradas."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Roles y Asignaciones ABP */}
        <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent print:break-inside-avoid">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 print:text-black">
            Roles y Asignaciones ABP
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Asistente Responsable */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest print:text-slate-700">
                Delegado ABP (Cuerpo Técnico)
              </label>
              {interactive ? (
                <input
                  type="text"
                  value={abpAssistant}
                  onChange={(e) => handleFieldChange("abp_assistant", e.target.value)}
                  placeholder="Ej. Segundo Entrenador / Analista"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {abpAssistant || "No asignado (Primer Entrenador)"}
                </p>
              )}
            </div>

            {/* Lanzador Principal */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest print:text-slate-700">
                Lanzador Principal
              </label>
              {interactive ? (
                <select
                  value={kickerPrimary}
                  onChange={(e) => handleFieldChange("kicker_primary", e.target.value)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">-- Seleccionar Lanzador --</option>
                  {groupedKickerOptions.habitualStarters.length > 0 && (
                    <optgroup label="⭐ Lanzadores Habituales Titulares">
                      {groupedKickerOptions.habitualStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.otherStarters.length > 0 && (
                    <optgroup label="🏃 Otros Titulares">
                      {groupedKickerOptions.otherStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.habitualNonStarters.length > 0 && (
                    <optgroup label="📋 Lanzadores Habituales (Suplentes)">
                      {groupedKickerOptions.habitualNonStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.restOfSquad.length > 0 && (
                    <optgroup label="👥 Resto de la Plantilla">
                      {groupedKickerOptions.restOfSquad.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {kickerPrimary ? getPlayerNameShort(kickerPrimary) : "No asignado"}
                </p>
              )}
            </div>

            {/* Lanzador Secundario */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest print:text-slate-700">
                Lanzador Secundario
              </label>
              {interactive ? (
                <select
                  value={kickerSecondary}
                  onChange={(e) => handleFieldChange("kicker_secondary", e.target.value)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">-- Seleccionar Lanzador --</option>
                  {groupedKickerOptions.habitualStarters.length > 0 && (
                    <optgroup label="⭐ Lanzadores Habituales Titulares">
                      {groupedKickerOptions.habitualStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.otherStarters.length > 0 && (
                    <optgroup label="🏃 Otros Titulares">
                      {groupedKickerOptions.otherStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.habitualNonStarters.length > 0 && (
                    <optgroup label="📋 Lanzadores Habituales (Suplentes)">
                      {groupedKickerOptions.habitualNonStarters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedKickerOptions.restOfSquad.length > 0 && (
                    <optgroup label="👥 Resto de la Plantilla">
                      {groupedKickerOptions.restOfSquad.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {kickerSecondary ? getPlayerNameShort(kickerSecondary) : "No asignado"}
                </p>
              )}
            </div>

            {/* Palo Corto */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest print:text-slate-700">
                Defensa: Palo Corto
              </label>
              {interactive ? (
                <select
                  value={defensiveShortPost}
                  onChange={(e) => handleFieldChange("defensive_short_post", e.target.value)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">-- Seleccionar Jugador --</option>
                  {presentPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {defensiveShortPost ? getPlayerNameShort(defensiveShortPost) : "No asignado"}
                </p>
              )}
            </div>

            {/* Palo Largo */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest print:text-slate-700">
                Defensa: Palo Largo
              </label>
              {interactive ? (
                <select
                  value={defensiveLongPost}
                  onChange={(e) => handleFieldChange("defensive_long_post", e.target.value)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">-- Seleccionar Jugador --</option>
                  {presentPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} {p.membership?.jersey_number !== undefined ? `#${p.membership.jersey_number}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {defensiveLongPost ? getPlayerNameShort(defensiveLongPost) : "No asignado"}
                </p>
              )}
            </div>

            {/* Composición Barrera */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest print:text-slate-700">
                Composición Barrera
              </label>
              {interactive ? (
                <input
                  type="text"
                  value={defensiveWall}
                  onChange={(e) => handleFieldChange("defensive_wall", e.target.value)}
                  placeholder="Ej. 4 jugadores (dorsales 4, 8, 9, 11)"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              ) : (
                <p className="text-xs text-slate-200 print:text-black font-semibold">
                  {defensiveWall || "Sin configurar"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PIZARRA DE BALÓN PARADO ABP (PÁGINA 3) ── */}
      <div className={cn(
        "print:break-before-page print:pt-4",
        activeTab === "whiteboard" ? "block" : "hidden print:block"
      )}>
        <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 print:border-slate-300 print:bg-transparent">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 print:text-black">
                <Paintbrush className="h-4.5 w-4.5 corp-icon" />
                Pizarra Balón Parado (ABP)
              </h2>
              <p className="text-[10px] text-slate-450 mt-0.5 print:hidden">
                Dibuja jugadas tácticas sobre la pizarra y arrastra las fichas de los jugadores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Sidebar with Players Pool for Whiteboard */}
            {interactive && (
              <div className="lg:col-span-3 space-y-4 flex flex-col p-4 bg-white/2 border border-white/5 rounded-xl no-print">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nuestros Jugadores ({presentPlayers.length})
                  </h4>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {presentPlayers.map((p) => {
                      const number = value.own_dorsals?.[p.id] ?? p.membership?.jersey_number ?? "";
                      const status = getPlayerStatus(p);
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          className="p-1.5 rounded-lg border border-white/5 bg-white/1 hover:bg-white/3 text-xs text-slate-350 hover:text-white cursor-grab select-none flex items-center justify-between transition-all"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                status === "red" && "bg-rose-500",
                                status === "yellow" && "bg-amber-400",
                                status === "green" && "bg-green-500"
                              )}
                            />
                            <span>{p.first_name[0]}. {p.last_name}</span>
                          </div>
                          {number && <span className="text-[9px] font-extrabold text-slate-500">#{number}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-rose-500" />
                    Equipo Rival (11 jugadores)
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {Array.from({ length: 11 }).map((_, idx) => {
                      const rivalId = `rival_${idx + 1}`;
                      const customDorsal = value.rival_dorsals?.[rivalId] || "";
                      return (
                        <div
                          key={rivalId}
                          draggable
                          onDragStart={(e) => handleDragStart(e, rivalId)}
                          className="p-1.5 rounded-lg border border-white/5 bg-white/1 hover:bg-white/3 text-xs text-slate-350 hover:text-white cursor-grab select-none flex items-center justify-between transition-all"
                        >
                          <span>Rival {idx + 1}</span>
                          <span className="text-[9px] font-extrabold text-rose-400">
                            {customDorsal ? `#${customDorsal}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 leading-relaxed italic border-t border-white/5 pt-2">
                  Tip: Arrastra a los jugadores desde aquí directamente a la pizarra para colocarlos como fichas.
                </div>
              </div>
            )}

            {/* Whiteboard Canvas */}
            <div className={cn(interactive ? "lg:col-span-9" : "lg:col-span-12")}>
              <WhiteboardCanvas
                savedData={whiteboard}
                savedState={value.whiteboard_data}
                onChangeState={(base64, state) => {
                  if (onChange) {
                    onChange({
                      ...value,
                      whiteboard: base64,
                      whiteboard_data: state,
                    });
                  }
                }}
                interactive={interactive}
                homeColor={organizationSettings?.pantone_home_color || organizationSettings?.club_primary_color || "#10b981"}
                rivalColor={organizationSettings?.pantone_rival_color || "#3b82f6"}
                presentPlayers={presentPlayers}
                rivalDorsals={value.rival_dorsals}
                ownDorsals={value.own_dorsals}
                lineup={lineup}
                activeSpots={activeSpots}
                adjustedSpots={adjustedSpots}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PIZARRA TÁCTICA INTERACTIVA DE BALÓN PARADO ──
interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  isArrow?: boolean;
}

interface Chip {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface WhiteboardCanvasProps {
  savedData?: string;
  savedState?: any;
  onChangeState?: (base64: string, state: { strokes: Stroke[]; chips: Chip[] }) => void;
  interactive?: boolean;
  homeColor: string;
  rivalColor: string;
  presentPlayers?: PlayerOption[];
  rivalDorsals?: Record<string, string>;
  ownDorsals?: Record<string, string>;
  lineup?: Record<string, string>;
  activeSpots?: string[];
  adjustedSpots?: Array<{ id: string; label: string; x: number; y: number; posKey: PositionKey }>;
}

function WhiteboardCanvas({
  savedData = "",
  savedState,
  onChangeState,
  interactive = true,
  homeColor,
  rivalColor,
  presentPlayers = [],
  rivalDorsals = {},
  ownDorsals = {},
  lineup = {},
  activeSpots = [],
  adjustedSpots = [],
}: WhiteboardCanvasProps) {
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activePenColor, setActivePenColor] = useState<string>("#ffffff");
  const [activeDrawMode, setActiveDrawMode] = useState<"pencil" | "arrow">("pencil");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [pitchZone, setPitchZone] = useState<"full_field" | "half_field" | "penalty_area">("half_field");

  const draggedChipIdRef = useRef<string | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<Point[]>([]);

  const [editingChip, setEditingChip] = useState<Chip | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const [playbook, setPlaybook] = useState<{ id?: string; name: string; state: any }[]>([]);
  const [newPlayName, setNewPlayName] = useState<string>("");
  const [selectedPlayIndex, setSelectedPlayIndex] = useState<string>("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Load playbook from Supabase on mount
  useEffect(() => {
    async function loadPlaybook() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgRole } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (!orgRole) return;

        const { data, error } = await supabase
          .from("abp_plays")
          .select("*")
          .eq("organization_id", orgRole.organization_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setPlaybook(data.map((play: any) => ({
            id: play.id,
            name: play.title,
            state: play.whiteboard_data,
          })));
        } else {
          // Pre-populate with default plays if library is completely empty
          const defaultPlays = [
            {
              name: "Córner en Corto",
              state: {
                strokes: [],
                chips: [
                  { id: "ball", label: "⚽", x: 620, y: 15, radius: 10, color: "#ffffff" },
                  { id: "h0_gk", label: "1", x: 60, y: 240, radius: 12, color: "#111111" },
                  { id: "h1", label: "10", x: 600, y: 40, radius: 12, color: homeColor },
                  { id: "h2", label: "8", x: 570, y: 70, radius: 12, color: homeColor },
                  { id: "r1_gk", label: "R1", x: 580, y: 240, radius: 12, color: "#111111" },
                  { id: "r2", label: "R2", x: 580, y: 30, radius: 12, color: rivalColor },
                ]
              }
            },
            {
              name: "Córner Segundo Palo",
              state: {
                strokes: [],
                chips: [
                  { id: "ball", label: "⚽", x: 620, y: 15, radius: 10, color: "#ffffff" },
                  { id: "h0_gk", label: "1", x: 60, y: 240, radius: 12, color: "#111111" },
                  { id: "h1", label: "9", x: 450, y: 200, radius: 12, color: homeColor },
                  { id: "h2", label: "4", x: 480, y: 240, radius: 12, color: homeColor },
                  { id: "r1_gk", label: "R1", x: 580, y: 240, radius: 12, color: "#111111" },
                ]
              }
            }
          ];
          setPlaybook(defaultPlays);
        }
      } catch (e) {
        console.error("Error reading playbook library", e);
      }
    }

    loadPlaybook();
  }, [homeColor, rivalColor]);

  const handleSaveToLibrary = async () => {
    const name = newPlayName.trim();
    if (!name) {
      alert("Introduce un nombre para la jugada");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgRole) return;

      const newState = {
        strokes,
        chips,
      };

      const canvas = canvasRef.current;
      const base64Image = canvas ? canvas.toDataURL("image/png") : "";

      const playPayload = {
        organization_id: orgRole.organization_id,
        title: name,
        type: "corner",
        is_offensive: true,
        whiteboard_data: newState,
        whiteboard_image: base64Image,
        scope: "coach",
        created_by: user.id,
      };

      // Check if title already exists in playbook
      const existingPlay = playbook.find((p) => p.name.toLowerCase() === name.toLowerCase());
      
      if (existingPlay && existingPlay.id) {
        if (!confirm(`Ya existe una jugada llamada "${name}". ¿Deseas sobrescribirla?`)) {
          return;
        }

        const { error } = await supabase
          .from("abp_plays")
          .update({
            whiteboard_data: newState,
            whiteboard_image: base64Image,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPlay.id);

        if (error) throw error;

        setPlaybook((prev) =>
          prev.map((p) => (p.name.toLowerCase() === name.toLowerCase() ? { ...p, state: newState } : p))
        );
      } else {
        const { data, error } = await supabase
          .from("abp_plays")
          .insert(playPayload)
          .select()
          .single();

        if (error) throw error;

        setPlaybook((prev) => [
          { id: data.id, name: data.title, state: data.whiteboard_data },
          ...prev,
        ]);
      }

      setNewPlayName("");
      alert(`Jugada "${name}" guardada en la base de datos.`);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar la jugada: " + err.message);
    }
  };

  const handleLoadPlay = (indexStr: string) => {
    if (indexStr === "") return;
    const idx = parseInt(indexStr, 10);
    const play = playbook[idx];
    if (play) {
      if (confirm(`¿Deseas cargar la jugada "${play.name}"? Esto reemplazará el dibujo actual.`)) {
        setStrokes(play.state.strokes || []);
        setChips(play.state.chips || []);
        setSelectedPlayIndex("");
      }
    }
  };

  const handleDeletePlay = async (indexStr: string) => {
    if (indexStr === "") return;
    const idx = parseInt(indexStr, 10);
    const play = playbook[idx];
    if (play) {
      if (confirm(`¿Deseas eliminar la jugada "${play.name}" de la biblioteca?`)) {
        try {
          if (play.id) {
            const { error } = await supabase
              .from("abp_plays")
              .delete()
              .eq("id", play.id);

            if (error) throw error;
          }

          setPlaybook((prev) => prev.filter((_, i) => i !== idx));
          setSelectedPlayIndex("");
        } catch (err: any) {
          console.error(err);
          alert("Error al eliminar la jugada: " + err.message);
        }
      }
    }
  };

  // Initialize chips once or on clear
  const resetChips = useCallback(() => {
    const list: Chip[] = [];
    // 1 Soccer Ball
    list.push({
      id: "ball",
      label: "⚽",
      x: 320,
      y: 240,
      radius: 10,
      color: "#ffffff",
    });

    if (adjustedSpots && activeSpots && lineup) {
      adjustedSpots
        .filter((spot) => activeSpots.includes(spot.id))
        .forEach((spot) => {
          const playerId = lineup[spot.id];
          if (!playerId) return;

          const player = presentPlayers.find((p) => p.id === playerId);
          let label = "";
          let color = "";

          if (player) {
            const customDorsal = ownDorsals?.[playerId] ?? player.membership?.jersey_number?.toString() ?? "";
            label = customDorsal ? `${customDorsal}` : (player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "");
            const isGk = spot.id === "gk" || player.membership?.positions?.includes("goalkeeper");
            if (isGk) {
              color = "#111111";
            } else {
              color = homeColor;
            }
          } else {
            label = spot.label;
            color = homeColor;
          }

          list.push({
            id: `player_${playerId}_wb_${spot.id}`,
            label,
            x: (spot.x / 100) * 640,
            y: (spot.y / 100) * 480,
            radius: 12,
            color,
          });
        });
    }

    setChips(list);
  }, [adjustedSpots, activeSpots, lineup, presentPlayers, ownDorsals, homeColor, rivalColor]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (savedState) {
      if (!hasInitializedRef.current) {
        try {
          const parsed = typeof savedState === "string" ? JSON.parse(savedState) : savedState;
          if (parsed.strokes) setStrokes(parsed.strokes);
          if (parsed.chips) setChips(parsed.chips);
          hasInitializedRef.current = true;
        } catch (e) {
          console.error("Error parsing whiteboard state", e);
        }
      }
      return;
    }

    if (strokes.length === 0) {
      resetChips();
      hasInitializedRef.current = true;
    }
  }, [savedState, resetChips, strokes.length]);



  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked chip (within radius + 6)
    const hitChip = [...chips]
      .reverse()
      .find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 6);

    if (hitChip) {
      setEditingChip(hitChip);
      setEditingText(hitChip.label);
    }
  };

  const handleSaveChipLabel = () => {
    if (!editingChip) return;
    setChips((prev) =>
      prev.map((c) => (c.id === editingChip.id ? { ...c, label: editingText.trim() } : c))
    );
    setEditingChip(null);
  };

  // Draw the entire whiteboard (background pitch, drawing lines, chips)
  const drawWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Draw Field Background
    ctx.fillStyle = "#0c3b24"; // deep tactical pitch green
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Pitch Outlines
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2.5;

    if (pitchZone === "half_field") {
      // Center halfway line (on the left edge, x = 0)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, h);
      ctx.stroke();

      // Center circle semicircle (on the left edge, x = 0)
      ctx.beginPath();
      ctx.arc(0, h / 2, 80, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Center spot on halfway line
      ctx.beginPath();
      ctx.arc(0, h / 2, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fill();

      // Corner box right side (useful for corner ABP)
      ctx.beginPath();
      ctx.arc(w, 0, 30, Math.PI / 2, Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w, h, 30, Math.PI, Math.PI * 1.5);
      ctx.stroke();

      // Goalbox area on the right side
      ctx.strokeRect(w - 70, h / 2 - 90, 70, 180);
      // Goal box goalie area
      ctx.strokeRect(w - 25, h / 2 - 45, 25, 90);
      // Goalposts right side
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(w - 3, h / 2 - 30, 6, 60);

      // Penalty Spot and arc touching the vertical line (x = w - 70)
      ctx.beginPath();
      ctx.arc(w - 55, h / 2, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      const arcRadius = 40;
      const dx = 15; // distance from spot (w - 55) to box boundary (w - 70)
      const arcAngle = Math.acos(dx / arcRadius);
      ctx.beginPath();
      ctx.arc(w - 55, h / 2, arcRadius, Math.PI - arcAngle, Math.PI + arcAngle);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.stroke();

      // Border outline
      ctx.strokeRect(0, 0, w, h);
    } else if (pitchZone === "full_field") {
      const margin = 20;
      const fw = w - 2 * margin;
      const fh = h - 2 * margin;

      // Outer boundary
      ctx.strokeRect(margin, margin, fw, fh);

      // Center line
      ctx.beginPath();
      ctx.moveTo(w / 2, margin);
      ctx.lineTo(w / 2, h - margin);
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 50, 0, 2 * Math.PI);
      ctx.stroke();

      // Center spot
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();

      // Left Penalty Area
      ctx.strokeRect(margin, h / 2 - 70, 60, 140);
      ctx.strokeRect(margin, h / 2 - 35, 25, 70); // goal area
      ctx.beginPath(); // penalty spot
      ctx.arc(margin + 42, h / 2, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath(); // arc
      ctx.arc(margin + 42, h / 2, 35, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      // Right Penalty Area
      ctx.strokeRect(w - margin - 60, h / 2 - 70, 60, 140);
      ctx.strokeRect(w - margin - 25, h / 2 - 35, 25, 70); // goal area
      ctx.beginPath(); // penalty spot
      ctx.arc(w - margin - 42, h / 2, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath(); // arc
      ctx.arc(w - margin - 42, h / 2, 35, Math.PI - Math.PI / 3, Math.PI + Math.PI / 3);
      ctx.stroke();

      // Corner arcs
      ctx.beginPath(); ctx.arc(margin, margin, 10, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, margin, 10, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(margin, h - margin, 10, Math.PI * 1.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, h - margin, 10, Math.PI, Math.PI * 1.5); ctx.stroke();

      // Goal posts
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(margin - 4, h / 2 - 20, 4, 40);
      ctx.fillRect(w - margin, h / 2 - 20, 4, 40);
    } else if (pitchZone === "penalty_area") {
      const margin = 20;
      const goalLine = h - margin;
      const center = w / 2;

      // Draw outer pitch boundary inside margin
      ctx.strokeRect(margin, margin, w - 2 * margin, h - 2 * margin);

      // Draw penalty box (width: 460, depth: 240)
      ctx.strokeRect(center - 230, goalLine - 240, 460, 240);

      // Draw goal area (small box, width: 220, depth: 80)
      ctx.strokeRect(center - 110, goalLine - 80, 220, 80);

      // Draw goal posts
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center - 50, goalLine - 2, 100, 4);

      // Penalty spot (y = 300)
      const spotY = goalLine - 160;
      ctx.beginPath();
      ctx.arc(center, spotY, 3.5, 0, 2 * Math.PI);
      ctx.fill();

      // Penalty arc (radius 133, centered at spotY, only drawn above y = goalLine - 240)
      const radius = 133;
      const startAngle = Math.PI + 0.93;
      const endAngle = Math.PI * 2 - 0.93;
      ctx.beginPath();
      ctx.arc(center, spotY, radius, startAngle, endAngle);
      ctx.stroke();
    }

    // 3. Draw All Drawings (Strokes)
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();

      if (stroke.isArrow) {
        const p1 = stroke.points[stroke.points.length - 2];
        const p2 = stroke.points[stroke.points.length - 1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const arrowLength = 12;
        const arrowAngle = Math.PI / 6;

        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - arrowLength * Math.cos(angle - arrowAngle),
          p2.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
          p2.x - arrowLength * Math.cos(angle + arrowAngle),
          p2.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fillStyle = stroke.color;
        ctx.fill();
      }
    });

    // 4. Draw Current Drawing Stroke (Realtime)
    if (isDrawingRef.current && currentPointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = activePenColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(currentPointsRef.current[0].x, currentPointsRef.current[0].y);
      for (let i = 1; i < currentPointsRef.current.length; i++) {
        ctx.lineTo(currentPointsRef.current[i].x, currentPointsRef.current[i].y);
      }
      ctx.stroke();

      if (activeDrawMode === "arrow") {
        const p1 = currentPointsRef.current[currentPointsRef.current.length - 2];
        const p2 = currentPointsRef.current[currentPointsRef.current.length - 1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const arrowLength = 12;
        const arrowAngle = Math.PI / 6;

        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - arrowLength * Math.cos(angle - arrowAngle),
          p2.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
          p2.x - arrowLength * Math.cos(angle + arrowAngle),
          p2.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fillStyle = activePenColor;
        ctx.fill();
      }
    }

    // 5. Draw Chips
    chips.forEach((chip) => {
      ctx.beginPath();
      ctx.arc(chip.x, chip.y, chip.radius, 0, 2 * Math.PI);
      ctx.fillStyle = chip.color;
      ctx.fill();
      ctx.strokeStyle = chip.id === "ball" ? "#000000" : "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Chip Number/Label
      ctx.fillStyle = chip.id === "ball" ? "#000000" : "#ffffff";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(chip.label, chip.x, chip.y + (chip.id === "ball" ? 0 : 0.5));
    });
  };

  // We track initial mount so we don't trigger updates during load
  const isInitialMount = useRef(true);

  // Re-draw whenever state changes & save state synchronously
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    drawWhiteboard();

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !onChangeState) return;
    const base64 = canvas.toDataURL("image/png");
    onChangeState(base64, { strokes, chips });
  }, [strokes, chips, activePenColor, pitchZone]);

  // Pointer event handlers to support dragging chips & drawing simultaneously
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const { x, y } = getCanvasCoords(e);

    // Check if clicked a chip
    const hitChip = [...chips]
      .reverse() // check top-most chips first
      .find((c) => Math.hypot(c.x - x, c.y - y) <= c.radius + 4);

    if (hitChip) {
      draggedChipIdRef.current = hitChip.id;
    } else {
      isDrawingRef.current = true;
      currentPointsRef.current = [{ x, y }];
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const { x, y } = getCanvasCoords(e);

    if (draggedChipIdRef.current) {
      setChips((prev) =>
        prev.map((c) => (c.id === draggedChipIdRef.current ? { ...c, x, y } : c))
      );
    } else if (isDrawingRef.current) {
      if (activeDrawMode === "arrow") {
        currentPointsRef.current = [currentPointsRef.current[0], { x, y }];
      } else {
        currentPointsRef.current.push({ x, y });
      }
      drawWhiteboard();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.releasePointerCapture(e.pointerId);

    if (draggedChipIdRef.current) {
      draggedChipIdRef.current = null;
      // Trigger state save by updating state to same values
      setChips((prev) => [...prev]);
    } else if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPointsRef.current.length > 1) {
        setStrokes((prev) => [
          ...prev,
          {
            points: currentPointsRef.current,
            color: activePenColor,
            isArrow: activeDrawMode === "arrow",
          },
        ]);
      }
      currentPointsRef.current = [];
    }
  };

  const handleUndo = () => {
    setStrokes((prev) => {
      const copy = [...prev];
      copy.pop();
      return copy;
    });
  };

  const handleClear = () => {
    setStrokes([]);
    resetChips();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleWhiteboardDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) return;

    const playerId = e.dataTransfer.getData("text/plain");
    if (!playerId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const isRival = playerId.startsWith("rival_");
    let label = "";
    let color = "";

    if (isRival) {
      const idx = playerId.split("_")[1];
      const customDorsal = rivalDorsals?.[playerId] || idx;
      label = `R${customDorsal}`;
      // Paint goalkeeper black, others rivalColor
      if (playerId === "rival_1") {
        color = "#111111";
      } else {
        color = rivalColor;
      }
    } else {
      const player = presentPlayers.find((p) => p.id === playerId);
      if (player) {
        const customDorsal = ownDorsals?.[playerId] ?? player.membership?.jersey_number?.toString() ?? "";
        label = customDorsal ? `${customDorsal}` : player.first_name[0] + player.last_name[0];
        // Paint goalkeeper black, others homeColor
        const isGk = player.membership?.positions?.includes("goalkeeper");
        if (isGk) {
          color = "#111111";
        } else {
          color = homeColor;
        }
      } else {
        label = "?";
        color = homeColor;
      }
    }

    const newChip: Chip = {
      id: `${playerId}_wb_${Date.now()}`,
      label,
      x,
      y,
      radius: 12,
      color,
    };

    setChips((prev) => [...prev, newChip]);
  };

  return (
    <div className="space-y-3">
      {/* Tools & Controls (Only interactive mode) */}
      {interactive && (
        <div className="flex flex-col gap-2 p-2 bg-slate-900/60 rounded-xl border border-white/5 no-print">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Colors selector */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Colors selector popover */}
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  className="h-6 w-6 rounded-full border border-white/20 shadow-md transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: activePenColor }}
                  title="Seleccionar color de pincel"
                />
                {colorPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColorPickerOpen(false)} />
                    <div className="absolute left-0 mt-1.5 w-28 rounded-lg border border-white/10 bg-slate-950/95 backdrop-blur-md p-1.5 shadow-2xl z-50 flex flex-col gap-1">
                      {[
                        { hex: "#ffffff", name: "Blanco" },
                        { hex: "#eab308", name: "Amarillo" },
                        { hex: "#ef4444", name: "Rojo" },
                        { hex: "#10b981", name: "Verde" },
                        { hex: "#3b82f6", name: "Azul" },
                        { hex: "#000000", name: "Negro" },
                      ].map((col) => (
                        <button
                          key={col.hex}
                          type="button"
                          onClick={() => {
                            setActivePenColor(col.hex);
                            setColorPickerOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 rounded px-2 py-1 text-[10px] text-left transition-colors cursor-pointer",
                            activePenColor === col.hex
                              ? "bg-white/10 text-white font-extrabold"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <span className="h-2.5 w-2.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: col.hex }} />
                          <span>{col.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Mode selection buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveDrawMode("pencil")}
                  title="Pincel"
                  className={cn(
                    "p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer",
                    activeDrawMode === "pencil" && "bg-emerald-500/25 text-emerald-450 hover:bg-emerald-500/25 hover:text-emerald-450"
                  )}
                >
                  <Pencil className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawMode("arrow")}
                  title="Flecha (Recta)"
                  className={cn(
                    "p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer",
                    activeDrawMode === "arrow" && "bg-emerald-500/25 text-emerald-450 hover:bg-emerald-500/25 hover:text-emerald-450"
                  )}
                >
                  <ArrowUpRight className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Pitch Zone Selector */}
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5 ml-1">
                {(["half_field", "full_field", "penalty_area"] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setPitchZone(z)}
                    className={cn(
                      "px-2 py-1 text-[9px] font-bold rounded transition-all cursor-pointer uppercase tracking-wider",
                      pitchZone === z
                        ? "bg-emerald-500 text-white"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {z === "half_field" ? "Medio" : z === "full_field" ? "Completo" : "Área"}
                  </button>
                ))}
              </div>
            </div>

            {/* Undo and Clear */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                title="Deshacer"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <RotateCcw className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                title="Limpiar"
                className="p-1.5 text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Biblioteca Section */}
          <div className="flex items-center gap-2 flex-wrap border-t border-white/5 pt-2 text-xs">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Biblioteca:
            </span>
            <input
              type="text"
              placeholder="Nueva jugada..."
              value={newPlayName}
              onChange={(e) => setNewPlayName(e.target.value)}
              className="rounded-lg bg-slate-800 border border-white/10 px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none corp-input-focus w-28"
            />
            <button
              type="button"
              onClick={handleSaveToLibrary}
              className="btn-corporate-solid text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
            >
              Guardar
            </button>

            <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-2">
              <select
                value={selectedPlayIndex}
                onChange={(e) => setSelectedPlayIndex(e.target.value)}
                className="rounded-lg bg-slate-800 border border-white/10 px-2 py-1 text-[10px] text-white focus:outline-none corp-input-focus cursor-pointer"
              >
                <option value="">-- Cargar jugada --</option>
                {playbook.map((play, i) => (
                  <option key={i} value={i}>
                    {play.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleLoadPlay(selectedPlayIndex)}
                disabled={selectedPlayIndex === ""}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none text-white text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                Cargar
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlay(selectedPlayIndex)}
                disabled={selectedPlayIndex === ""}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Board */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] max-w-[560px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-white/10"
      >
        {interactive ? (
          <>
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
              onDragOver={handleDragOver}
              onDrop={handleWhiteboardDrop}
              className="w-full h-full bg-emerald-950 cursor-crosshair touch-none"
              style={{ display: "block" }}
            />
            {editingChip && (
              <div
                className="absolute z-50 bg-slate-950/95 border border-white/10 rounded-xl p-2 flex flex-col gap-1 shadow-2xl no-print"
                style={{
                  left: `${(editingChip.x / 640) * 100}%`,
                  top: `${(editingChip.y / 480) * 100}%`,
                  transform: "translate(-50%, -120%)",
                  minWidth: "100px",
                }}
              >
                <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500">Dorsal:</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={3}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-11 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-center text-white focus:outline-none corp-input-focus"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveChipLabel();
                      if (e.key === "Escape") setEditingChip(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveChipLabel}
                    className="btn-corporate-solid text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </>
        ) : savedData ? (
          <img
            src={savedData}
            alt="Pizarra Balón Parado"
            className="w-full h-full object-contain bg-[#0c3b24]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0c3b24] text-slate-500 text-xs italic">
            No se ha guardado ninguna jugada en la pizarra
          </div>
        )}
      </div>
    </div>
  );
}
