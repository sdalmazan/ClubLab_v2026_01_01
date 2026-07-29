"use client";

import { useState, useEffect, useRef } from "react";
import {
  Pencil,
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
  Goal,
  Square,
  MousePointer,
  Copy,
  ChevronRight,
  User,
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
  type: "pencil" | "line" | "dashed_line" | "arrow" | "dashed_arrow" | "rectangle" | "dashed_rectangle";
}

export interface MarkerElement {
  id: string;
  x: number;
  y: number;
  type: "cone" | "player" | "rival" | "ball" | "goal_11" | "goal_7" | "mini_goal";
  number?: string; // for players/rivals
  color?: string; // custom color if any
  rotation?: number; // rotation in degrees
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
  full_field: "Campo Entero",
  half_field: "Medio Campo",
  defensive_third: "Tercio Defensivo",
  offensive_third: "Tercio Ofensivo",
  penalty_area: "Área",
  custom_area: "Campo Libre",
};

const COLOR_OPTIONS = [
  { value: "#ffffff", name: "Blanco" },
  { value: "#facc15", name: "Amarillo" },
  { value: "#ef4444", name: "Rojo" },
  { value: "#22c55e", name: "Verde" },
  { value: "#3b82f6", name: "Azul" },
  { value: "#000000", name: "Negro" },
];

function getDistanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

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
    | "line"
    | "dashed_line"
    | "arrow"
    | "dashed_arrow"
    | "rectangle"
    | "dashed_rectangle"
    | "cone"
    | "player"
    | "rival"
    | "ball"
    | "goal_11"
    | "goal_7"
    | "mini_goal"
    | "text"
    | "eraser"
    | "select"
  >("pencil");
  const [activeColor, setActiveColor] = useState("#ffffff");
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [playerNumberMode, setPlayerNumberMode] = useState<"none" | "auto">("auto");
  const [playerNumber, setPlayerNumber] = useState("1");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textCoords, setTextCoords] = useState<{ x: number; y: number } | null>(
    null
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"stroke" | "marker" | "text" | null>(null);
  const [hoveredToolLabel, setHoveredToolLabel] = useState<string | null>(null);

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
  const draggedTextIdRef = useRef<string | null>(null);
  const dragStartTextsRef = useRef<TextElement[] | null>(null);
  const draggedStrokeIdRef = useRef<string | null>(null);
  const dragStartStrokesRef = useRef<WhiteboardStroke[] | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const isResizingRef = useRef(false);
  const draggedHandleRef = useRef<string | null>(null);

  // Grouped tools tracking states
  const [lastShapeTool, setLastShapeTool] = useState<"line" | "dashed_line" | "arrow" | "dashed_arrow" | "rectangle" | "dashed_rectangle">("line");
  const [lastGoalTool, setLastGoalTool] = useState<"goal_11" | "goal_7" | "mini_goal">("goal_11");
  const [activeShapesMenu, setActiveShapesMenu] = useState(false);
  const [activeGoalsMenu, setActiveGoalsMenu] = useState(false);

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

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Keyboard shortcut listener for deleting selected element
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
            return;
          }
          e.preventDefault();
          deleteSelectedElement();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, strokes, markers, texts]);

  // Initialize or re-draw when data changes and trigger auto-save
  useEffect(() => {
    drawAll();
    if (onChangeRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        onChangeRef.current({
          strokes,
          markers,
          texts,
          zone,
          spaceDimensions,
          imageDataUrl: dataUrl,
        });
      }
    }
  }, [zone, strokes, markers, texts, spaceDimensions]);

  const getRectBounds = (stroke: WhiteboardStroke) => {
    if (stroke.points.length < 2) return null;
    const p0 = stroke.points[0];
    const p1 = stroke.points[stroke.points.length - 1];
    return {
      minX: Math.min(p0.x, p1.x),
      maxX: Math.max(p0.x, p1.x),
      minY: Math.min(p0.y, p1.y),
      maxY: Math.max(p0.y, p1.y)
    };
  };

  const isNearRectBorder = (x: number, y: number, stroke: WhiteboardStroke) => {
    const bounds = getRectBounds(stroke);
    if (!bounds) return false;
    const { minX, maxX, minY, maxY } = bounds;
    const threshold = 10;
    
    const nearLeft = Math.abs(x - minX) < threshold && y >= minY - threshold && y <= maxY + threshold;
    const nearRight = Math.abs(x - maxX) < threshold && y >= minY - threshold && y <= maxY + threshold;
    const nearTop = Math.abs(y - minY) < threshold && x >= minX - threshold && x <= maxX + threshold;
    const nearBottom = Math.abs(y - maxY) < threshold && x >= minX - threshold && x <= maxX + threshold;
    
    return nearLeft || nearRight || nearTop || nearBottom;
  };

  const deleteSelectedElement = () => {
    if (!selectedId) return;
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setRedoStack([]);
    if (selectedType === "marker") {
      setMarkers((prev) => prev.filter((m) => m.id !== selectedId));
    } else if (selectedType === "text") {
      setTexts((prev) => prev.filter((t) => t.id !== selectedId));
    } else if (selectedType === "stroke") {
      setStrokes((prev) => prev.filter((s) => s.id !== selectedId));
    }
    setSelectedId(null);
    setSelectedType(null);
  };

  const duplicateSelectedElement = () => {
    if (!selectedId) return;
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setRedoStack([]);
    if (selectedType === "marker") {
      const original = markers.find((m) => m.id === selectedId);
      if (original) {
        const copy: MarkerElement = {
          ...original,
          id: `marker-${Date.now()}`,
          x: original.x + 15,
          y: original.y + 15,
        };
        setMarkers((prev) => [...prev, copy]);
        setSelectedId(copy.id);
      }
    } else if (selectedType === "text") {
      const original = texts.find((t) => t.id === selectedId);
      if (original) {
        const copy: TextElement = {
          ...original,
          id: `text-${Date.now()}`,
          x: original.x + 15,
          y: original.y + 15,
        };
        setTexts((prev) => [...prev, copy]);
        setSelectedId(copy.id);
      }
    } else if (selectedType === "stroke") {
      const original = strokes.find((s) => s.id === selectedId);
      if (original) {
        const copyPoints = original.points.map((p) => ({
          x: p.x + 15,
          y: p.y + 15,
        }));
        const copy: WhiteboardStroke = {
          ...original,
          id: `stroke-${Date.now()}`,
          points: copyPoints,
        };
        setStrokes((prev) => [...prev, copy]);
        setSelectedId(copy.id);
      }
    }
  };

  const rotateSelectedMarker = () => {
    if (selectedId && selectedType === "marker") {
      setHistory((prev) => [...prev, { strokes, markers, texts }]);
      setRedoStack([]);
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === selectedId
            ? { ...m, rotation: ((m.rotation ?? 0) + 45) % 360 }
            : m
        )
      );
    }
  };

  const changeSelectedMarkerNumber = (numStr: string) => {
    if (!selectedId || selectedType !== "marker") return;
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setRedoStack([]);
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === selectedId ? { ...m, number: numStr.trim() ? numStr.trim() : undefined } : m
      )
    );
  };

  const changeSelectedElementColor = (color: string) => {
    if (!selectedId) return;
    setHistory((prev) => [...prev, { strokes, markers, texts }]);
    setRedoStack([]);
    if (selectedType === "marker") {
      setMarkers((prev) =>
        prev.map((m) => (m.id === selectedId ? { ...m, color } : m))
      );
    } else if (selectedType === "text") {
      setTexts((prev) =>
        prev.map((t) => (t.id === selectedId ? { ...t, color } : t))
      );
    } else if (selectedType === "stroke") {
      setStrokes((prev) =>
        prev.map((s) => (s.id === selectedId ? { ...s, color } : s))
      );
    }
  };

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

    // Draw selection outline and resize handles for selected rectangle
    if (selectedId && selectedType === "stroke") {
      const selStroke = strokes.find((s) => s.id === selectedId);
      if (selStroke && (selStroke.type === "rectangle" || selStroke.type === "dashed_rectangle")) {
        const bounds = getRectBounds(selStroke);
        if (bounds) {
          const { minX, maxX, minY, maxY } = bounds;
          // Outline border
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(minX - 4, minY - 4, (maxX - minX) + 8, (maxY - minY) + 8);
          ctx.setLineDash([]);

          // corner handles
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          const handleSize = 6;
          const corners = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: minX, y: maxY },
            { x: maxX, y: maxY }
          ];
          corners.forEach((c) => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, handleSize, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        }
      } else if (selStroke && ["line", "dashed_line", "arrow", "dashed_arrow"].includes(selStroke.type)) {
        if (selStroke.points.length >= 2) {
          const p0 = selStroke.points[0];
          const p1 = selStroke.points[1];
          
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          const handleSize = 6;

          ctx.beginPath();
          ctx.arc(p0.x, p0.y, handleSize, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p1.x, p1.y, handleSize, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
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

    if (stroke.type === "dashed_line" || stroke.type === "dashed_arrow" || stroke.type === "dashed_rectangle") {
      ctx.setLineDash([8, 8]);
    } else {
      ctx.setLineDash([]);
    }

    if (stroke.type === "rectangle" || stroke.type === "dashed_rectangle") {
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (stroke.type === "pencil") {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else {
      // Straight line or arrow
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      if (stroke.type === "arrow" || stroke.type === "dashed_arrow") {
        ctx.setLineDash([]); // arrow head must be solid
        drawArrowhead(ctx, start, end, stroke.color);
      }
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
    const rotation = marker.rotation ?? 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    if (type === "cone") {
      // Small yellow/amber cone (drawn as a triangle)
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-8, 8);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fillStyle = marker.color || "#eab308"; // amber
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (type === "player") {
      // Blue circle with white jersey number
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, 2 * Math.PI);
      ctx.fillStyle = marker.color || "#3b82f6"; // blue
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (number) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(number, 0, 0);
      }
    } else if (type === "rival") {
      // Red circle with white jersey number
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, 2 * Math.PI);
      ctx.fillStyle = marker.color || "#ef4444"; // red
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (number) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(number, 0, 0);
      }
    } else if (type === "ball") {
      // Small white circle with cross markings (soccer ball)
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ball design lines
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.stroke();
    } else if (type === "goal_11") {
      // Soccer Goal (White posts and net)
      ctx.strokeStyle = marker.color || "#ffffff";
      ctx.lineWidth = 3.5;
      ctx.strokeRect(-22, -10, 44, 20);
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let offset = -22; offset <= 22; offset += 5.5) {
        ctx.moveTo(offset, -10);
        ctx.lineTo(offset * 0.7, 10);
      }
      ctx.stroke();
    } else if (type === "goal_7") {
      // Fútbol 7 Goal
      ctx.strokeStyle = marker.color || "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-16, -8, 32, 16);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let offset = -16; offset <= 16; offset += 4) {
        ctx.moveTo(offset, -8);
        ctx.lineTo(offset * 0.7, 8);
      }
      ctx.stroke();
    } else if (type === "mini_goal") {
      // Mini Goal (smaller)
      ctx.strokeStyle = marker.color || "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -5, 20, 10);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let offset = -10; offset <= 10; offset += 2.5) {
        ctx.moveTo(offset, -5);
        ctx.lineTo(offset * 0.7, 5);
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  // Event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // 1. Check if clicked near one of the handles of the selected shape
    if (selectedId && selectedType === "stroke") {
      const selStroke = strokes.find((s) => s.id === selectedId);
      if (selStroke && (selStroke.type === "rectangle" || selStroke.type === "dashed_rectangle")) {
        const bounds = getRectBounds(selStroke);
        if (bounds) {
          const { minX, maxX, minY, maxY } = bounds;
          const handleSize = 12; // hit target radius
          let handleHit: string | null = null;
          
          if (Math.sqrt((x - minX) ** 2 + (y - minY) ** 2) < handleSize) handleHit = "tl";
          else if (Math.sqrt((x - maxX) ** 2 + (y - minY) ** 2) < handleSize) handleHit = "tr";
          else if (Math.sqrt((x - minX) ** 2 + (y - maxY) ** 2) < handleSize) handleHit = "bl";
          else if (Math.sqrt((x - maxX) ** 2 + (y - maxY) ** 2) < handleSize) handleHit = "br";
          
          if (handleHit) {
            isResizingRef.current = true;
            draggedHandleRef.current = handleHit;
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      } else if (selStroke && ["line", "dashed_line", "arrow", "dashed_arrow"].includes(selStroke.type)) {
        if (selStroke.points.length >= 2) {
          const p0 = selStroke.points[0];
          const p1 = selStroke.points[1];
          const handleSize = 12; // hit target radius
          let handleHit: string | null = null;
          
          if (Math.sqrt((x - p0.x) ** 2 + (y - p0.y) ** 2) < handleSize) handleHit = "line_start";
          else if (Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2) < handleSize) handleHit = "line_end";
          
          if (handleHit) {
            isResizingRef.current = true;
            draggedHandleRef.current = handleHit;
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }
    }

    // UX Enhancement: Prioritize selecting/dragging existing players/markers
    const markerHit = markers.find(
      (m) => Math.sqrt((m.x - x) ** 2 + (m.y - y) ** 2) < 18
    );

    if (markerHit && activeTool !== "eraser") {
      setSelectedId(markerHit.id);
      setSelectedType("marker");
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
        setSelectedId(null);
        setSelectedType(null);
        return;
      }

      // Remove clicked text
      const textHit = texts.find(
        (t) => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 25
      );
      if (textHit) {
        pushState(strokes, markers, texts.filter((t) => t.id !== textHit.id));
        setSelectedId(null);
        setSelectedType(null);
        return;
      }

      // Remove clicked stroke (approximate)
      const strokeHit = strokes.find((stroke) => {
        if (stroke.type === "rectangle" || stroke.type === "dashed_rectangle") {
          return isNearRectBorder(x, y, stroke);
        }
        return stroke.points.some(
          (pt) => Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 12
        );
      });
      if (strokeHit) {
        pushState(strokes.filter((s) => s.id !== strokeHit.id), markers, texts);
        setSelectedId(null);
        setSelectedType(null);
        return;
      }
      return;
    }

    // Selection mode: check if clicked text or shape
    const textHit = texts.find(
      (t) => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 25
    );
    if (textHit) {
      setSelectedId(textHit.id);
      setSelectedType("text");
      draggedTextIdRef.current = textHit.id;
      dragStartTextsRef.current = [...texts];
      dragOffsetRef.current = { x, y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const strokeHit = strokes.find((stroke) => {
      if (stroke.type === "rectangle" || stroke.type === "dashed_rectangle") {
        return isNearRectBorder(x, y, stroke);
      }
      if (stroke.type === "pencil") {
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const pA = stroke.points[i];
          const pB = stroke.points[i + 1];
          if (getDistanceToSegment(x, y, pA.x, pA.y, pB.x, pB.y) < 12) {
            return true;
          }
        }
        return stroke.points.some(
          (pt) => Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 12
        );
      }
      // For lines and arrows (which have 2 points: start and end)
      if (stroke.points.length >= 2) {
        const p0 = stroke.points[0];
        const p1 = stroke.points[1];
        return getDistanceToSegment(x, y, p0.x, p0.y, p1.x, p1.y) < 12;
      }
      return stroke.points.some(
        (pt) => Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 12
      );
    });
    if (strokeHit) {
      setSelectedId(strokeHit.id);
      setSelectedType("stroke");
      draggedStrokeIdRef.current = strokeHit.id;
      dragStartStrokesRef.current = JSON.parse(JSON.stringify(strokes));
      dragOffsetRef.current = { x, y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Clicked empty space
    setSelectedId(null);
    setSelectedType(null);

    // Place new marker
    if (
      activeTool === "cone" ||
      activeTool === "player" ||
      activeTool === "rival" ||
      activeTool === "ball" ||
      activeTool === "goal_11" ||
      activeTool === "goal_7" ||
      activeTool === "mini_goal"
    ) {
      const isNumbered = playerNumberMode === "auto" && Boolean(playerNumber);
      const newMarker: MarkerElement = {
        id: `marker-${Date.now()}`,
        x,
        y,
        type: activeTool,
        number: (activeTool === "player" || activeTool === "rival") && isNumbered ? playerNumber : undefined,
        color: activeTool === "player" ? activeColor : undefined,
      };
      pushState(strokes, [...markers, newMarker], texts);

      // increment player number for convenience (order of entry / postas)
      if ((activeTool === "player" || activeTool === "rival") && isNumbered) {
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

    // Drawing tools: pencil, arrow, dashed_arrow, rectangle
    if (activeTool === "select") return;

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

    // If dragging text, update its coordinate
    if (draggedTextIdRef.current && dragOffsetRef.current) {
      const dx = x - dragOffsetRef.current.x;
      const dy = y - dragOffsetRef.current.y;
      const originalTexts = dragStartTextsRef.current || [];
      const original = originalTexts.find(t => t.id === draggedTextIdRef.current);
      if (original) {
        setTexts((prev) =>
          prev.map((t) =>
            t.id === draggedTextIdRef.current ? { ...t, x: original.x + dx, y: original.y + dy } : t
          )
        );
      }
      return;
    }

    // If dragging a stroke, update all its points coordinates
    if (draggedStrokeIdRef.current && dragOffsetRef.current) {
      const dx = x - dragOffsetRef.current.x;
      const dy = y - dragOffsetRef.current.y;
      const originalStrokes = dragStartStrokesRef.current || [];
      const original = originalStrokes.find(s => s.id === draggedStrokeIdRef.current);
      if (original) {
        const shiftedPoints = original.points.map(pt => ({
          x: pt.x + dx,
          y: pt.y + dy
        }));
        setStrokes((prev) =>
          prev.map((s) =>
            s.id === draggedStrokeIdRef.current ? { ...s, points: shiftedPoints } : s
          )
        );
      }
      return;
    }

    // If resizing selected shape or adjusting endpoints
    if (isResizingRef.current && selectedId) {
      setStrokes((prev) =>
        prev.map((stroke) => {
          if (stroke.id !== selectedId) return stroke;
          const points = [...stroke.points];
          if (points.length < 2) return stroke;
          
          const handle = draggedHandleRef.current;
          if (handle === "line_start") {
            points[0] = { x, y };
          } else if (handle === "line_end") {
            points[1] = { x, y };
          } else if (handle === "tl") {
            points[0] = { x, y };
          } else if (handle === "tr") {
            points[0] = { x: points[0].x, y };
            points[1] = { x, y: points[1].y };
          } else if (handle === "bl") {
            points[0] = { x, y: points[0].y };
            points[1] = { x: points[1].x, y };
          } else if (handle === "br") {
            points[1] = { x, y };
          }
          
          return { ...stroke, points };
        })
      );
      return;
    }

    if (!isDrawingRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    currentPointsRef.current.push({ x, y });

    // Draw realtime line/shape
    drawAll();
    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    if (activeTool === "dashed_arrow" || activeTool === "dashed_line" || activeTool === "dashed_rectangle") {
      ctx.setLineDash([8, 8]);
    } else {
      ctx.setLineDash([]);
    }

    const start = currentPointsRef.current[0];
    let current = { x, y };

    if (e.shiftKey && activeTool !== "pencil") {
      const dx = Math.abs(x - start.x);
      const dy = Math.abs(y - start.y);
      if (dx > dy) {
        current = { x, y: start.y };
      } else {
        current = { x: start.x, y };
      }
    }

    if (activeTool === "pencil") {
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < currentPointsRef.current.length; i++) {
        ctx.lineTo(currentPointsRef.current[i].x, currentPointsRef.current[i].y);
      }
      ctx.stroke();
    } else if (activeTool === "rectangle" || activeTool === "dashed_rectangle") {
      ctx.strokeRect(start.x, start.y, current.x - start.x, current.y - start.y);
      ctx.setLineDash([]);
    } else {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (activeTool === "arrow" || activeTool === "dashed_arrow") {
        drawArrowhead(ctx, start, current, activeColor);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    // End resize
    if (isResizingRef.current) {
      isResizingRef.current = false;
      draggedHandleRef.current = null;
      setHistory((prev) => [...prev, { strokes, markers, texts }]);
      setRedoStack([]);
      return;
    }

    // End marker dragging and commit to history
    if (draggedMarkerIdRef.current) {
      const startMarkers = dragStartMarkersRef.current || [];
      const currentMarker = markers.find(m => m.id === draggedMarkerIdRef.current);
      const originalMarker = startMarkers.find(m => m.id === draggedMarkerIdRef.current);

      if (currentMarker && originalMarker && (currentMarker.x !== originalMarker.x || currentMarker.y !== originalMarker.y)) {
        setHistory((prev) => [...prev, { strokes, markers: startMarkers, texts }]);
        setRedoStack([]);
      }
      draggedMarkerIdRef.current = null;
      dragStartMarkersRef.current = null;
      return;
    }

    // End text dragging and commit to history
    if (draggedTextIdRef.current) {
      const startTexts = dragStartTextsRef.current || [];
      const current = texts.find(t => t.id === draggedTextIdRef.current);
      const original = startTexts.find(t => t.id === draggedTextIdRef.current);

      if (current && original && (current.x !== original.x || current.y !== original.y)) {
        setHistory((prev) => [...prev, { strokes, markers, texts: startTexts }]);
        setRedoStack([]);
      }
      draggedTextIdRef.current = null;
      dragStartTextsRef.current = null;
      dragOffsetRef.current = null;
      return;
    }

    // End stroke dragging and commit to history
    if (draggedStrokeIdRef.current) {
      const startStrokes = dragStartStrokesRef.current || [];
      const current = strokes.find(s => s.id === draggedStrokeIdRef.current);
      const original = startStrokes.find(s => s.id === draggedStrokeIdRef.current);

      if (current && original && (current.points[0]?.x !== original.points[0]?.x || current.points[0]?.y !== original.points[0]?.y)) {
        setHistory((prev) => [...prev, { strokes: startStrokes, markers, texts }]);
        setRedoStack([]);
      }
      draggedStrokeIdRef.current = null;
      dragStartStrokesRef.current = null;
      dragOffsetRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentPointsRef.current.length >= 2 && canvas) {
      const rect = canvas.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const rawY = (e.clientY - rect.top) * (canvas.height / rect.height);
      const start = currentPointsRef.current[0];
      let end = { x: rawX, y: rawY };

      if (e.shiftKey && activeTool !== "pencil") {
        const dx = Math.abs(rawX - start.x);
        const dy = Math.abs(rawY - start.y);
        if (dx > dy) {
          end = { x: rawX, y: start.y };
        } else {
          end = { x: start.x, y: rawY };
        }
      }

      const strokePoints = activeTool === "pencil" ? [...currentPointsRef.current] : [start, end];
      const newStroke: WhiteboardStroke = {
        id: drawingIdRef.current || `stroke-${Date.now()}`,
        points: strokePoints,
        color: activeColor,
        type: activeTool as any,
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
            {/* Tool name badge */}
            <div className="bg-slate-950/65 px-2 py-1.5 rounded-lg border border-white/5 text-center min-h-[28px] flex items-center justify-center">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">
                {hoveredToolLabel || (activeTool ? `Uso: ${activeTool.replace("_", " ")}` : "Selección")}
              </span>
            </div>

            {/* Draw tools */}
            <div className="flex md:flex-col gap-1 bg-white/5 p-1 rounded-xl max-h-[60vh] md:overflow-y-visible relative">
              {/* Select Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("select");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Seleccionar / Modificar")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "select"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <MousePointer className="h-4.5 w-4.5" />
              </button>

              {/* Lápiz Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("pencil");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Lápiz")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "pencil"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Pencil className="h-4.5 w-4.5" />
              </button>

              {/* Goma Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("eraser");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Borrar elemento")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "eraser"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>

              {/* Balón Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("ball");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Añadir Balón")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "ball"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Disc className="h-4.5 w-4.5" />
              </button>

              {/* Cono Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("cone");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Añadir Cono")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "cone"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Disc className="h-4.5 w-4.5 rotate-45" />
              </button>

              {/* Texto Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("text");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Añadir Texto")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "text"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Type className="h-4.5 w-4.5" />
              </button>

              {/* Jugador Tool */}
              <button
                type="button"
                onClick={() => {
                  setActiveTool("player");
                  setActiveShapesMenu(false);
                  setActiveGoalsMenu(false);
                }}
                onMouseEnter={() => setHoveredToolLabel("Añadir Jugador")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                  activeTool === "player"
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <User className="h-4.5 w-4.5" />
                  <span
                    className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full border border-slate-950"
                    style={{ backgroundColor: activeColor }}
                  />
                </div>
              </button>

              {/* Líneas y Formas Group */}
              {(() => {
                const isShapeActive = ["line", "dashed_line", "arrow", "dashed_arrow", "rectangle", "dashed_rectangle"].includes(activeTool);
                let ShapeIcon = Minus;
                let isDashed = false;
                if (lastShapeTool.includes("arrow")) ShapeIcon = TrendingUp;
                else if (lastShapeTool.includes("rectangle")) ShapeIcon = Square;
                if (lastShapeTool.includes("dashed")) isDashed = true;

                return (
                  <div className="relative flex md:flex-col items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(lastShapeTool);
                        setActiveShapesMenu(prev => !prev);
                        setActiveGoalsMenu(false);
                      }}
                      onMouseEnter={() => setHoveredToolLabel(`Líneas/Formas (${lastShapeTool.replace("_", " ")})`)}
                      onMouseLeave={() => setHoveredToolLabel(null)}
                      className={cn(
                        "p-2 rounded-l-lg md:rounded-t-lg md:rounded-b-none transition-all flex items-center justify-center cursor-pointer relative",
                        isShapeActive
                          ? "bg-emerald-500 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      )}
                    >
                      <ShapeIcon className="h-4.5 w-4.5" />
                      {isDashed && (
                        <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-slate-950 text-emerald-400 rounded px-0.5 scale-75 border border-white/10">
                          - -
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveShapesMenu(prev => !prev);
                        setActiveGoalsMenu(false);
                      }}
                      className={cn(
                        "p-1 rounded-r-lg md:rounded-b-lg md:rounded-t-none border-l md:border-l-0 md:border-t border-white/10 transition-all flex items-center justify-center cursor-pointer text-slate-450 hover:text-white",
                        isShapeActive ? "bg-emerald-600 text-white" : "bg-white/3 hover:bg-white/8"
                      )}
                    >
                      <ChevronRight className="h-3 w-3 rotate-90 md:rotate-0" />
                    </button>

                    {/* Shapes Submenu */}
                    {activeShapesMenu && (
                      <div className="absolute left-[54px] md:left-[60px] top-0 z-50 bg-slate-950/95 border border-white/10 rounded-xl p-1.5 flex md:flex-row gap-1 shadow-2xl backdrop-blur-md">
                        {[
                          { id: "line", icon: Minus, label: "Línea Sólida" },
                          { id: "dashed_line", icon: Minus, label: "Línea Discont.", dashed: true },
                          { id: "arrow", icon: TrendingUp, label: "Flecha Sólida" },
                          { id: "dashed_arrow", icon: TrendingUp, label: "Flecha Discont.", dashed: true },
                          { id: "rectangle", icon: Square, label: "Rectángulo Sólido" },
                          { id: "dashed_rectangle", icon: Square, label: "Rectángulo Discont.", dashed: true },
                        ].map((sTool) => {
                          const SIcon = sTool.icon;
                          return (
                            <button
                              key={sTool.id}
                              type="button"
                              onClick={() => {
                                setLastShapeTool(sTool.id as any);
                                setActiveTool(sTool.id as any);
                                setActiveShapesMenu(false);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                                activeTool === sTool.id
                                  ? "bg-emerald-500 text-white"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                              title={sTool.label}
                            >
                              <SIcon className="h-4.5 w-4.5" />
                              {sTool.dashed && (
                                <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-slate-950 text-emerald-400 rounded px-0.5 scale-75 border border-white/10">
                                  - -
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Porterías Group */}
              {(() => {
                const isGoalActive = ["goal_11", "goal_7", "mini_goal"].includes(activeTool);

                return (
                  <div className="relative flex md:flex-col items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(lastGoalTool);
                        setActiveGoalsMenu(prev => !prev);
                        setActiveShapesMenu(false);
                      }}
                      onMouseEnter={() => setHoveredToolLabel(`Porterías (${lastGoalTool.replace("goal_", "F")})`)}
                      onMouseLeave={() => setHoveredToolLabel(null)}
                      className={cn(
                        "p-2 rounded-l-lg md:rounded-t-lg md:rounded-b-none transition-all flex items-center justify-center cursor-pointer relative",
                        isGoalActive
                          ? "bg-emerald-500 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      )}
                    >
                      <Goal className="h-4.5 w-4.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGoalsMenu(prev => !prev);
                        setActiveShapesMenu(false);
                      }}
                      className={cn(
                        "p-1 rounded-r-lg md:rounded-b-lg md:rounded-t-none border-l md:border-l-0 md:border-t border-white/10 transition-all flex items-center justify-center cursor-pointer text-slate-450 hover:text-white",
                        isGoalActive ? "bg-emerald-600 text-white" : "bg-white/3 hover:bg-white/8"
                      )}
                    >
                      <ChevronRight className="h-3 w-3 rotate-90 md:rotate-0" />
                    </button>

                    {/* Goals Submenu */}
                    {activeGoalsMenu && (
                      <div className="absolute left-[54px] md:left-[60px] top-0 z-50 bg-slate-950/95 border border-white/10 rounded-xl p-1.5 flex md:flex-row gap-1 shadow-2xl backdrop-blur-md">
                        {[
                          { id: "goal_11", icon: Goal, label: "Portería F11" },
                          { id: "goal_7", icon: Goal, label: "Portería F7" },
                          { id: "mini_goal", icon: Goal, label: "Mini Portería" },
                        ].map((gTool) => {
                          const GIcon = gTool.icon;
                          return (
                            <button
                              key={gTool.id}
                              type="button"
                              onClick={() => {
                                setLastGoalTool(gTool.id as any);
                                setActiveTool(gTool.id as any);
                                setActiveGoalsMenu(false);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer relative",
                                activeTool === gTool.id
                                  ? "bg-emerald-500 text-white"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                              title={gTool.label}
                            >
                              <GIcon className="h-4.5 w-4.5" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* If player/rival tool is selected, show number mode selector */}
            {(activeTool === "player" || activeTool === "rival") && (
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 p-1.5 rounded-xl shadow-lg">
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                  <button
                    type="button"
                    onClick={() => setPlayerNumberMode("none")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1",
                      playerNumberMode === "none"
                        ? "bg-slate-700 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    )}
                    title="Colocar jugadores sin número"
                  >
                    <span>Sin Nº</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlayerNumberMode("auto");
                      if (!playerNumber || playerNumber === "") setPlayerNumber("1");
                    }}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1",
                      playerNumberMode === "auto"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    )}
                    title="Colocar jugadores numerados correlativos por orden de entrada (1, 2, 3...)"
                  >
                    <span>🔢 Orden / Postas</span>
                  </button>
                </div>

                {playerNumberMode === "auto" && (
                  <div className="flex items-center gap-1 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-emerald-300">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide">Sig:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(playerNumber || "1");
                        if (!isNaN(current) && current > 1) setPlayerNumber((current - 1).toString());
                      }}
                      className="h-4 w-4 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-extrabold text-xs flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      maxLength={3}
                      value={playerNumber}
                      onChange={(e) => setPlayerNumber(e.target.value)}
                      className="w-6 text-center bg-slate-900 border border-emerald-500/40 rounded text-xs font-black text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(playerNumber || "1");
                        if (!isNaN(current)) setPlayerNumber((current + 1).toString());
                      }}
                      className="h-4 w-4 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-extrabold text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerNumber("1")}
                      className="text-[9px] font-bold text-emerald-400 hover:text-emerald-200 underline ml-1 cursor-pointer"
                      title="Reiniciar contador a 1"
                    >
                      🔄 1
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Colors (Single button with horizontal popover) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPalette(!showColorPalette)}
                onMouseEnter={() => setHoveredToolLabel("Paleta de Color")}
                onMouseLeave={() => setHoveredToolLabel(null)}
                style={{ backgroundColor: activeColor }}
                className="h-9 w-9 rounded-xl border border-white/20 transition-all cursor-pointer flex items-center justify-center shadow-lg hover:border-white/40"
                title="Seleccionar Color"
              >
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  activeColor === "#ffffff" || activeColor === "#facc15" ? "bg-slate-900" : "bg-white"
                )} />
              </button>

              {showColorPalette && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPalette(false)} />
                  <div className="absolute left-12 top-0 ml-2 flex gap-1.5 bg-slate-950/95 border border-white/10 rounded-xl p-1.5 shadow-2xl z-50 animate-in slide-in-from-left-1 duration-150">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setActiveColor(c.value);
                          setShowColorPalette(false);
                        }}
                        style={{ backgroundColor: c.value }}
                        className={cn(
                          "h-6 w-6 rounded-full border transition-all cursor-pointer flex items-center justify-center",
                          activeColor === c.value
                            ? "border-emerald-500 scale-110 ring-2 ring-emerald-500/30"
                            : "border-white/10 hover:scale-105 hover:border-white/30"
                        )}
                        title={c.name}
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
                </>
              )}
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

      {/* Element modification contextual bar */}
      {selectedId && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-emerald-500/20 px-4 py-2.5 rounded-xl animate-fade-in no-print">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-extrabold text-emerald-450 uppercase tracking-wide">
              Selección Activa
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-300 font-semibold">
              {selectedType === "marker"
                ? `Marcador (${markers.find((m) => m.id === selectedId)?.type.replace("_", " ") || ""})`
                : selectedType === "text"
                ? "Texto"
                : "Forma / Rectángulo"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Rotate option (only for markers) */}
            {selectedType === "marker" && (
              <button
                type="button"
                onClick={rotateSelectedMarker}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                title="Rotar 45º"
              >
                <RotateCw className="h-3 w-3 text-slate-400" />
                Rotar 45º
              </button>
            )}

            {/* Change player/rival number directly */}
            {selectedType === "marker" && (() => {
              const selMarker = markers.find((m) => m.id === selectedId);
              if (selMarker && (selMarker.type === "player" || selMarker.type === "rival")) {
                return (
                  <div className="flex items-center gap-1.5 bg-slate-950/60 border border-white/10 px-2 py-1 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Nº / Posta:</span>
                    <input
                      type="text"
                      maxLength={3}
                      value={selMarker.number ?? ""}
                      onChange={(e) => changeSelectedMarkerNumber(e.target.value)}
                      placeholder="Sin Nº"
                      className="w-10 text-center bg-slate-800 border border-white/15 rounded px-1 py-0.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                );
              }
              return null;
            })()}

            {/* Color modifier */}
            <div className="flex items-center gap-1 bg-slate-950/45 p-1 rounded-lg border border-white/5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => changeSelectedElementColor(c.value)}
                  className="h-4.5 w-4.5 rounded-full border border-white/20 transition-transform hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Duplicate option */}
            <button
              type="button"
              onClick={duplicateSelectedElement}
              className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Duplicar elemento"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </button>

            {/* Delete option */}
            <button
              type="button"
              onClick={deleteSelectedElement}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-350 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Eliminar elemento"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      )}

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
