"use client";

import { useState, useEffect, useRef } from "react";
import {
  Paintbrush,
  TrendingUp,
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
  Maximize2,
  Minus,
  Circle,
  HelpCircle,
  X,
  Check,
  Disc,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type FieldZone =
  | "full_field"
  | "half_field"
  | "defensive_third"
  | "offensive_third"
  | "penalty_area"
  | "custom_area";

export interface StrokePoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  points: StrokePoint[];
  color: string;
  type: "pencil" | "arrow" | "dashed_arrow";
}

export interface MarkerElement {
  id: string;
  x: number;
  y: number;
  type: "cone" | "player" | "rival" | "ball";
  number?: string; // for players/rivals
  color?: string; // custom color if any
}

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface WhiteboardData {
  strokes: WhiteboardStroke[];
  markers: MarkerElement[];
  texts: TextElement[];
  zone: FieldZone;
  spaceDimensions: string;
  imageDataUrl?: string; // base64 thumbnail
}

interface TaskWhiteboardProps {
  value?: WhiteboardData;
  onChange?: (data: WhiteboardData) => void;
  interactive?: boolean;
  onClose?: () => void;
  title?: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ZONE_LABELS: Record<FieldZone, string> = {
  full_field: "Campo Completo",
  half_field: "Medio Campo",
  defensive_third: "Tercio Defensivo",
  offensive_third: "Tercio Ofensivo",
  penalty_area: "Área de Penalti",
  custom_area: "Espacio Libre",
};

const COLOR_OPTIONS = [
  { value: "#ffffff", name: "Blanco" },
  { value: "#facc15", name: "Amarillo" },
  { value: "#ef4444", name: "Rojo" },
  { value: "#22c55e", name: "Verde" },
  { value: "#3b82f6", name: "Azul" },
  { value: "#000000", name: "Negro" },
];

export function TaskWhiteboard({
  value,
  onChange,
  interactive = true,
  onClose,
  title = "Diseño de Tarea",
}: TaskWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [zone, setZone] = useState<FieldZone>(value?.zone ?? "full_field");
  const [spaceDimensions, setSpaceDimensions] = useState(
    value?.spaceDimensions ?? ""
  );
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(
    value?.strokes ?? []
  );
  const [markers, setMarkers] = useState<MarkerElement[]>(value?.markers ?? []);
  const [texts, setTexts] = useState<TextElement[]>(value?.texts ?? []);

  // Tool settings
  const [activeTool, setActiveTool] = useState<
    | "pencil"
    | "arrow"
    | "dashed_arrow"
    | "cone"
    | "player"
    | "rival"
    | "ball"
    | "text"
    | "eraser"
  >("pencil");
  const [activeColor, setActiveColor] = useState("#ffffff");
  const [playerNumber, setPlayerNumber] = useState("1");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textCoords, setTextCoords] = useState<{ x: number; y: number } | null>(
    null
  );

  // Drawing state refs (non-react to avoid re-renders during mousemove)
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const drawingIdRef = useRef<string | null>(null);

  // Undo/Redo History
  const [history, setHistory] = useState<{ strokes: WhiteboardStroke[]; markers: MarkerElement[]; texts: TextElement[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ strokes: WhiteboardStroke[]; markers: MarkerElement[]; texts: TextElement[] }[]>([]);

  // Dragging state refs
  const draggedMarkerIdRef = useRef<string | null>(null);
  const dragStartMarkersRef = useRef<MarkerElement[] | null>(null);

  // Helper to push state to history
  const pushState = (
    newStrokes: WhiteboardStroke[],
    newMarkers: MarkerElement[],
    newTexts: TextElement[]
  ) => {
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setRedoStack([]);
    setStrokes(newStrokes);
    setMarkers(newMarkers);
    setTexts(newTexts);
  };

  // Keyboard listener for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!interactive) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, redoStack, strokes, markers, texts, interactive]);

  // Initialize or re-draw when data changes
  useEffect(() => {
    drawAll();
  }, [zone, strokes, markers, texts, activeColor, activeTool]);

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear and draw background field
    drawFieldBackground(ctx, w, h, zone);

    // Draw all completed strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw markers
    markers.forEach((marker) => {
      drawMarker(ctx, marker);
    });

    // Draw texts
    texts.forEach((txt) => {
      ctx.fillStyle = txt.color;
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(txt.text, txt.x, txt.y);
    });
  };

  // Helper to draw the field markings onto the canvas context
  const drawFieldBackground = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fieldZone: FieldZone
  ) => {
    // Green background
    ctx.fillStyle = "#14532d"; // dark green
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (fieldZone === "custom_area") {
      // Outline border only
      ctx.strokeRect(10, 10, w - 20, h - 20);
      return;
    }

    if (fieldZone === "full_field") {
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
      ctx.arc(w / 2, h / 2, 45, 0, 2 * Math.PI);
      ctx.stroke();

      // Center spot
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();

      // Left Penalty Area
      ctx.strokeRect(margin, h / 2 - 60, 50, 120);
      ctx.strokeRect(margin, h / 2 - 30, 20, 60); // goal area
      ctx.beginPath(); // penalty spot
      ctx.arc(margin + 36, h / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath(); // arc
      ctx.arc(margin + 36, h / 2, 30, -1.085, 1.085);
      ctx.stroke();

      // Right Penalty Area
      ctx.strokeRect(w - margin - 50, h / 2 - 60, 50, 120);
      ctx.strokeRect(w - margin - 20, h / 2 - 30, 20, 60); // goal area
      ctx.beginPath(); // penalty spot
      ctx.arc(w - margin - 36, h / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath(); // arc
      ctx.arc(w - margin - 36, h / 2, 30, Math.PI - 1.085, Math.PI + 1.085);
      ctx.stroke();

      // Corner arcs
      ctx.beginPath(); ctx.arc(margin, margin, 8, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, margin, 8, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(margin, h - margin, 8, Math.PI * 1.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, h - margin, 8, Math.PI, Math.PI * 1.5); ctx.stroke();

      // Goal posts
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(margin - 4, h / 2 - 18, 4, 36);
      ctx.fillRect(w - margin, h / 2 - 18, 4, 36);
    } else if (fieldZone === "half_field" || fieldZone === "defensive_third" || fieldZone === "offensive_third") {
      // Draw half pitch
      const margin = 20;
      const fw = w - 2 * margin;
      const fh = h - 2 * margin;

      // Outer boundary
      ctx.strokeRect(margin, margin, fw, fh);

      // Center halfway line
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(margin, h - margin);
      ctx.stroke();

      // Center circle arc
      ctx.beginPath();
      ctx.arc(margin, h / 2, 50, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Penalty Area on the right
      ctx.strokeRect(w - margin - 100, h / 2 - 100, 100, 200);
      ctx.strokeRect(w - margin - 35, h / 2 - 50, 35, 100); // goal area
      
      // Penalty Spot
      ctx.beginPath();
      ctx.arc(w - margin - 75, h / 2, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Penalty Arc (touches frontal line exactly at endpoints)
      ctx.beginPath();
      ctx.arc(w - margin - 75, h / 2, 50, Math.PI - Math.PI / 3, Math.PI + Math.PI / 3);
      ctx.stroke();

      // Goalposts
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(w - margin, h / 2 - 30, 4, 60);
    } else if (fieldZone === "penalty_area") {
      // Zoomed-in penalty area
      const margin = 10;
      ctx.strokeRect(margin, margin, w - 2 * margin, h - 2 * margin);

      const center = w / 2;
      const boxWidth = 580;
      const boxHeight = 240;

      // Penalty Box
      ctx.strokeRect(center - boxWidth / 2, h - boxHeight - margin, boxWidth, boxHeight);

      // Goal Area
      ctx.strokeRect(center - 130, h - 80 - margin, 260, 80);

      // Goal posts on the bottom line
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center - 50, h - margin - 3, 100, 6);

      // Penalty spot
      ctx.beginPath();
      ctx.arc(center, h - 160 - margin, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Penalty Arc (touches frontal line exactly at endpoints)
      ctx.beginPath();
      ctx.arc(center, h - 160 - margin, 133, Math.PI * 1.5 - 0.925, Math.PI * 1.5 + 0.925);
      ctx.stroke();
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) => {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.type === "dashed_arrow") {
      ctx.setLineDash([8, 8]);
    } else {
      ctx.setLineDash([]);
    }

    if (stroke.type === "pencil") {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else {
      // Straight Arrow or Dashed Arrow (drawn as line from start to end)
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrowhead at end
      ctx.setLineDash([]); // arrow head must be solid
      drawArrowhead(ctx, start, end, stroke.color);
    }
    ctx.setLineDash([]); // restore default
  };

  const drawArrowhead = (
    ctx: CanvasRenderingContext2D,
    from: StrokePoint,
    to: StrokePoint,
    color: string
  ) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLength = 12;
    const arrowAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowLength * Math.cos(angle - arrowAngle),
      to.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
      to.x - arrowLength * Math.cos(angle + arrowAngle),
      to.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawMarker = (ctx: CanvasRenderingContext2D, marker: MarkerElement) => {
    const { x, y, type, number } = marker;
    if (type === "cone") {
      // Small yellow/amber cone (drawn as a triangle)
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x - 8, y + 8);
      ctx.lineTo(x + 8, y + 8);
      ctx.closePath();
      ctx.fillStyle = "#eab308"; // amber
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (type === "player") {
      // Blue circle with white jersey number
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = "#3b82f6"; // blue
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(number ?? "1", x, y);
    } else if (type === "rival") {
      // Red circle with white jersey number
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444"; // red
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(number ?? "X", x, y);
    } else if (type === "ball") {
      // Small white circle with cross markings (soccer ball)
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ball design lines
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    }
  };

  // Event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // UX Enhancement: Prioritize selecting/dragging existing players/markers
    const markerHit = markers.find(
      (m) => Math.sqrt((m.x - x) ** 2 + (m.y - y) ** 2) < 18
    );

    if (markerHit && activeTool !== "eraser") {
      // Start dragging marker
      dragStartMarkersRef.current = [...markers];
      draggedMarkerIdRef.current = markerHit.id;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "eraser") {
      // Remove clicked markers
      if (markerHit) {
        pushState(strokes, markers.filter((m) => m.id !== markerHit.id), texts);
        return;
      }

      // Remove clicked text
      const textHit = texts.find(
        (t) => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 25
      );
      if (textHit) {
        pushState(strokes, markers, texts.filter((t) => t.id !== textHit.id));
        return;
      }

      // Remove clicked stroke (approximate)
      const strokeHit = strokes.find((stroke) => {
        return stroke.points.some(
          (pt) => Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 8
        );
      });
      if (strokeHit) {
        pushState(strokes.filter((s) => s.id !== strokeHit.id), markers, texts);
        return;
      }
      return;
    }

    if (
      activeTool === "cone" ||
      activeTool === "player" ||
      activeTool === "rival" ||
      activeTool === "ball"
    ) {
      const newMarker: MarkerElement = {
        id: `marker-${Date.now()}`,
        x,
        y,
        type: activeTool,
        number: activeTool === "player" || activeTool === "rival" ? playerNumber : undefined,
      };
      pushState(strokes, [...markers, newMarker], texts);

      // increment player number for convenience
      if (activeTool === "player" || activeTool === "rival") {
        const nextNum = parseInt(playerNumber);
        if (!isNaN(nextNum)) {
          setPlayerNumber((nextNum + 1).toString());
        }
      }
      return;
    }

    if (activeTool === "text") {
      setTextCoords({ x, y });
      setTextInput("");
      setShowTextInput(true);
      return;
    }

    // Drawing tools: pencil, arrow, dashed_arrow
    isDrawingRef.current = true;
    const strokeId = `stroke-${Date.now()}`;
    drawingIdRef.current = strokeId;
    currentPointsRef.current = [{ x, y }];

    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // If dragging a marker, update its coordinate
    if (draggedMarkerIdRef.current) {
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === draggedMarkerIdRef.current ? { ...m, x, y } : m
        )
      );
      return;
    }

    if (!isDrawingRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    currentPointsRef.current.push({ x, y });

    // Draw realtime line
    drawAll();
    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    if (activeTool === "dashed_arrow") {
      ctx.setLineDash([8, 8]);
    } else {
      ctx.setLineDash([]);
    }

    const start = currentPointsRef.current[0];
    const current = { x, y };

    if (activeTool === "pencil") {
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < currentPointsRef.current.length; i++) {
        ctx.lineTo(currentPointsRef.current[i].x, currentPointsRef.current[i].y);
      }
      ctx.stroke();
    } else {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrowhead(ctx, start, current, activeColor);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    // End marker dragging and commit to history
    if (draggedMarkerIdRef.current) {
      const startMarkers = dragStartMarkersRef.current || [];
      const currentMarker = markers.find(m => m.id === draggedMarkerIdRef.current);
      const originalMarker = startMarkers.find(m => m.id === draggedMarkerIdRef.current);

      if (currentMarker && originalMarker && (currentMarker.x !== originalMarker.x || currentMarker.y !== originalMarker.y)) {
        // Committing to history using startMarkers as previous state
        setHistory((prev) => [...prev, { strokes, markers: startMarkers, texts }]);
        setRedoStack([]);
      }
      draggedMarkerIdRef.current = null;
      dragStartMarkersRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentPointsRef.current.length >= 2) {
      const newStroke: WhiteboardStroke = {
        id: drawingIdRef.current || `stroke-${Date.now()}`,
        points: [...currentPointsRef.current],
        color: activeColor,
        type: activeTool === "arrow" ? "arrow" : activeTool === "dashed_arrow" ? "dashed_arrow" : "pencil",
      };
      pushState([...strokes, newStroke], markers, texts);
    }

    currentPointsRef.current = [];
    drawingIdRef.current = null;
  };

  const handleSaveText = () => {
    if (textInput.trim() && textCoords) {
      const newText: TextElement = {
        id: `text-${Date.now()}`,
        x: textCoords.x,
        y: textCoords.y,
        text: textInput.trim(),
        color: activeColor,
      };
      pushState(strokes, markers, [...texts, newText]);
    }
    setShowTextInput(false);
    setTextCoords(null);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, { strokes, markers, texts }]);
    setStrokes(previousState.strokes);
    setMarkers(previousState.markers);
    setTexts(previousState.texts);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setStrokes(nextState.strokes);
    setMarkers(nextState.markers);
    setTexts(nextState.texts);
  };

  const handleClear = () => {
    if (window.confirm("¿Seguro que deseas borrar todo el dibujo?")) {
      pushState([], [], []);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;

    // Export image
    const dataUrl = canvas.toDataURL("image/png");

    const exportData: WhiteboardData = {
      strokes,
      markers,
      texts,
      zone,
      spaceDimensions,
      imageDataUrl: dataUrl,
    };

    onChange(exportData);
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-900 border border-white/10 rounded-2xl p-4 overflow-hidden max-h-[85vh]">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        {/* Zone selection */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
          {(["full_field", "half_field", "penalty_area", "custom_area"] as FieldZone[]).map(
            (z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZone(z)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  zone === z
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {ZONE_LABELS[z]}
              </button>
            )
          )}
        </div>

        {/* Space dimensions */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Dimensiones:
          </label>
          <input
            type="text"
            placeholder="Ej: 30x20m"
            value={spaceDimensions}
            onChange={(e) => setSpaceDimensions(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[100px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[60px_1fr] gap-4 items-start">
        {/* Left Toolbar (vertical) */}
        {interactive && (
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {/* Draw tools */}
            <div className="flex md:flex-col gap-1 bg-white/5 p-1 rounded-xl">
              {[
                { id: "pencil", icon: Paintbrush, label: "Lápiz" },
                { id: "arrow", icon: TrendingUp, label: "Flecha" },
                { id: "dashed_arrow", icon: Minus, label: "Dashed" },
                { id: "cone", icon: Disc, label: "Cono" },
                { id: "player", icon: Circle, label: "Jugador" },
                { id: "rival", icon: HelpCircle, label: "Rival" },
                { id: "ball", icon: Disc, label: "Balón" },
                { id: "text", icon: Type, label: "Texto" },
                { id: "eraser", icon: Trash2, label: "Goma" },
              ].map((tool) => {
                const Icon = tool.icon;
                const isSelected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveTool(tool.id as any)}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative group",
                      isSelected
                        ? "bg-emerald-500 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {/* Tooltip */}
                    <span className="absolute left-full ml-2 px-2 py-1 bg-slate-950 text-[10px] text-white rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden md:block z-10">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* If player/rival tool is selected, show number selector */}
            {(activeTool === "player" || activeTool === "rival") && (
              <div className="flex md:flex-col items-center gap-1.5 bg-white/5 p-1.5 rounded-xl">
                <span className="text-[8px] font-bold text-slate-450 uppercase">Nº</span>
                <input
                  type="text"
                  maxLength={2}
                  value={playerNumber}
                  onChange={(e) => setPlayerNumber(e.target.value)}
                  className="w-8 text-center rounded bg-slate-800 border border-white/10 text-xs font-bold py-0.5 text-white"
                />
              </div>
            )}

            {/* Colors */}
            <div className="flex md:flex-col gap-1 bg-white/5 p-1 rounded-xl">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setActiveColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-all cursor-pointer flex items-center justify-center",
                    activeColor === c.value
                      ? "border-emerald-500 scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                >
                  {activeColor === c.value && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        c.value === "#ffffff" || c.value === "#facc15"
                          ? "bg-slate-900"
                          : "bg-white"
                      )}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div className="relative border border-white/10 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={700}
            height={420}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="touch-none bg-[#14532d] max-w-full aspect-[5/3] cursor-crosshair shadow-2xl"
          />

          {/* Inline Text Input Dialog overlay */}
          {showTextInput && textCoords && (
            <div
              className="absolute bg-slate-900 border border-white/15 p-2 rounded-xl flex items-center gap-2 shadow-2xl z-20"
              style={{
                left: `${(textCoords.x / 700) * 100}%`,
                top: `${(textCoords.y / 420) * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <input
                type="text"
                autoFocus
                placeholder="Añadir nota..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveText();
                  if (e.key === "Escape") {
                    setShowTextInput(false);
                    setTextCoords(null);
                  }
                }}
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveText}
                className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-450 cursor-pointer"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTextInput(false);
                  setTextCoords(null);
                }}
                className="p-1 rounded bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center border-t border-white/5 pt-3">
        <div className="flex gap-2">
          {interactive && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Deshacer
              </button>
              <button
                type="button"
                onClick={handleRedo}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
                disabled={redoStack.length === 0}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rehacer
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-350 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Borrar todo
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              Cerrar
            </button>
          )}
          {interactive && (
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-450 text-white font-bold rounded-lg shadow-lg cursor-pointer"
            >
              Guardar Dibujo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
