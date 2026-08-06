import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import type { VideoAnnotation, KeyframeData } from "../../lib/clublab/types";
import { 
  MousePointer, 
  Pencil, 
  MoveRight, 
  Circle, 
  Target, 
  Minus, 
  Flag, 
  MessageSquare, 
  Type, 
  Tag, 
  ZoomIn, 
  Undo, 
  Redo, 
  Scissors, 
  Square, 
  RotateCcw,
  X
} from "lucide-react";

export interface VideoPlayerRef {
  seekTo: (seconds: number, play?: boolean) => void;
  getCurrentTime: () => number | null;
  stepForward: (frames?: number) => void;
  stepBackward: (frames?: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  isPlaying: () => boolean;
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  setSpeed: (speed: number) => void;
  toggleFullscreen: () => void;
  getZoomScale: () => number;
  setZoomScale: (scale: number) => void;
  getPanOffset: () => { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number }) => void;
  getSelectedId: () => string | null;
  setSelectedId: (id: string | null) => void;
}

interface VideoPlayerProps {
  url: string;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (duration: number) => void;
  annotations?: VideoAnnotation[];
  onAnnotationsChange?: (annotations: VideoAnnotation[]) => void;
  readOnly?: boolean;
  onStartCut?: () => void;
  onStopCut?: () => void;
  onRetroactiveCut?: (seconds: number) => void;
  isCutting?: boolean;
  cutStart?: number | null;
  isBoardActive?: boolean;
  onBoardActiveChange?: (active: boolean) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onToggleManualForm?: () => void;
  activeTool?: VideoAnnotation["type"] | "pointer";
  onActiveToolChange?: (tool: VideoAnnotation["type"] | "pointer") => void;
  hideControls?: boolean;
  hideToolbar?: boolean;
  drawColor?: string;
  onDrawColorChange?: (color: string) => void;
  onSelectedIdChange?: (id: string | null) => void;
  stepSize?: number;
  largeStepSize?: number;
  muted?: boolean;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ url, onTimeUpdate, onDurationChange, annotations = [], onAnnotationsChange, readOnly = false, onStartCut, onStopCut, onRetroactiveCut, isCutting = false, cutStart = null, isBoardActive: isBoardActiveProp, onBoardActiveChange, onPlayStateChange, onToggleManualForm, activeTool: activeToolProp, onActiveToolChange, hideControls = false, hideToolbar = false, drawColor: drawColorProp, onDrawColorChange, onSelectedIdChange, stepSize = 1.0, largeStepSize = 5.0, muted = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [playerType, setPlayerType] = useState<"youtube" | "vimeo" | "veo" | "html5" >("html5");
    const [videoId, setVideoId] = useState<string>("");
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(document.fullscreenElement === containerRef.current);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }, []);

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    // Aspect ratio and play status
    const [videoAspect, setVideoAspect] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    // Image adjustment state
    const [brightness, setBrightness] = useState<number>(100);
    const [contrast, setContrast] = useState<number>(100);
    const [saturation, setSaturation] = useState<number>(100);
    const [showSettings, setShowSettings] = useState<boolean>(false);

    // Playback Speed
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

    // Vector Annotations States
    const [localAnnotations, setLocalAnnotations] = useState<VideoAnnotation[]>([]);

    // Full Video Zoom & Pan States
    const [zoomScale, setZoomScale] = useState<number>(1.0);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
      if (onSelectedIdChange) {
        onSelectedIdChange(selectedId);
      }
    }, [selectedId, onSelectedIdChange]);

    // Undo/Redo Stacks
    const [undoStack, setUndoStack] = useState<VideoAnnotation[][]>([]);
    const [redoStack, setRedoStack] = useState<VideoAnnotation[][]>([]);

    // Drawing States
    const [localBoardActive, setLocalBoardActive] = useState<boolean>(false);
    const isBoardActive = isBoardActiveProp !== undefined ? isBoardActiveProp : localBoardActive;
    const setIsBoardActive = (active: boolean) => {
      setLocalBoardActive(active);
      if (onBoardActiveChange) onBoardActiveChange(active);
    };

    const [localActiveTool, setLocalActiveTool] = useState<VideoAnnotation["type"] | "pointer">("pointer");
    const activeTool = activeToolProp !== undefined ? activeToolProp : localActiveTool;
    const setActiveTool = (tool: VideoAnnotation["type"] | "pointer") => {
      setLocalActiveTool(tool);
      if (onActiveToolChange) onActiveToolChange(tool);
    };
    const [localDrawColor, setLocalDrawColor] = useState<string>("#ef4444"); // Red
    const drawColor = drawColorProp !== undefined ? drawColorProp : localDrawColor;
    const setDrawColor = (c: string) => {
      setLocalDrawColor(c);
      if (onDrawColorChange) onDrawColorChange(c);
    };
    const [lineWidth, setLineWidth] = useState<number>(3);
    const [fontSize, setFontSize] = useState<number>(14);
    const [stickerType, setStickerType] = useState<Required<VideoAnnotation>["stickerType"]>("ball");

    // Toolbar positioning configuration
    const [toolbarPosition, setToolbarPosition] = useState<"left" | "right" | "top" | "bottom" | "floating">("left");

    // Interaction State
    const [interactionState, setInteractionState] = useState<{
      mode: "none" | "drawing" | "moving" | "resizing";
      startPos: { x: number; y: number };
      shapeStartPoints: { x: number; y: number }[];
      shapeStartSize?: number;
      resizeNodeIndex?: number; // 0 for start, 1 for end, etc.
    }>({ mode: "none", startPos: { x: 0, y: 0 }, shapeStartPoints: [] });

    const localAnnotationsRef = useRef<VideoAnnotation[]>([]);
    const selectedIdRef = useRef<string | null>(null);
    const interactionStateRef = useRef(interactionState);
    const frozenAnnIds = useRef<Set<string>>(new Set());
    const activeFreezeTimeRef = useRef<number | null>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const selectedIdsRef = useRef<string[]>([]);
    const multiStartPointsRef = useRef<Record<string, { x: number; y: number }[]>>({});
    const copiedAnnotationsRef = useRef<VideoAnnotation[]>([]);

    const currentTimeRef = useRef<number>(0);
    const undoStackRef = useRef<VideoAnnotation[][]>([]);
    const redoStackRef = useRef<VideoAnnotation[][]>([]);

    // Keep refs in sync with state
    useEffect(() => {
      currentTimeRef.current = currentTime;
    }, [currentTime]);

    useEffect(() => {
      undoStackRef.current = undoStack;
    }, [undoStack]);

    useEffect(() => {
      redoStackRef.current = redoStack;
    }, [redoStack]);

    useEffect(() => {
      localAnnotationsRef.current = localAnnotations;
    }, [localAnnotations]);

    useEffect(() => {
      selectedIdsRef.current = selectedIds;
      const primary = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
      setSelectedId(primary);
      selectedIdRef.current = primary;
      if (onSelectedIdChange) {
        onSelectedIdChange(primary);
      }
    }, [selectedIds, onSelectedIdChange]);

    useEffect(() => {
      interactionStateRef.current = interactionState;
    }, [interactionState]);

    const updateSelectedId = (id: string | null) => {
      setSelectedId(id);
      selectedIdRef.current = id;
      setSelectedIds(id === null ? [] : [id]);
    };

    const updateInteractionState = (state: typeof interactionState) => {
      setInteractionState(state);
      interactionStateRef.current = state;
    };

    // Sync local state when prop changes, but only if not currently interacting
    useEffect(() => {
      if (interactionState.mode === "none") {
        setLocalAnnotations(annotations);
      }
    }, [annotations, interactionState.mode]);

    const notifyChange = (newAnnotations: VideoAnnotation[]) => {
      setLocalAnnotations(newAnnotations);
      if (onAnnotationsChange) {
        onAnnotationsChange(newAnnotations);
      }
    };

    // Save history state for Undo/Redo
    const pushToUndo = (currentList: VideoAnnotation[]) => {
      // Limit history to 40 items
      setUndoStack(prev => [...prev.slice(-39), JSON.parse(JSON.stringify(currentList))]);
      setRedoStack([]); // Clear redo
    };

    const handleUndo = () => {
      if (undoStackRef.current.length === 0) return;
      const prev = undoStackRef.current[undoStackRef.current.length - 1];
      setUndoStack(prevStack => prevStack.slice(0, -1));
      setRedoStack(prevStack => [...prevStack, JSON.parse(JSON.stringify(localAnnotationsRef.current))]);
      setLocalAnnotations(prev);
      if (onAnnotationsChange) onAnnotationsChange(prev);
      updateSelectedId(null);
    };

    const handleRedo = () => {
      if (redoStackRef.current.length === 0) return;
      const next = redoStackRef.current[redoStackRef.current.length - 1];
      setRedoStack(prevStack => prevStack.slice(0, -1));
      setUndoStack(prevStack => [...prevStack, JSON.parse(JSON.stringify(localAnnotationsRef.current))]);
      setLocalAnnotations(next);
      if (onAnnotationsChange) onAnnotationsChange(next);
      updateSelectedId(null);
    };

    const handleDeleteSelected = () => {
      const activeSelectedIds = selectedIdsRef.current;
      if (activeSelectedIds.length === 0) return;
      pushToUndo(localAnnotationsRef.current);
      const filtered = localAnnotationsRef.current.filter(a => !activeSelectedIds.includes(a.id));
      notifyChange(filtered);
      updateSelectedId(null);
    };

    const handleCopy = () => {
      const activeSelectedIds = selectedIdsRef.current;
      if (activeSelectedIds.length === 0) return;
      const toCopy = localAnnotationsRef.current.filter(a => activeSelectedIds.includes(a.id));
      copiedAnnotationsRef.current = JSON.parse(JSON.stringify(toCopy));
    };

    const handlePaste = () => {
      if (copiedAnnotationsRef.current.length === 0) return;
      pushToUndo(localAnnotationsRef.current);

      // Check if there is an active freeze at the current time
      const activeFreezeAnn = localAnnotationsRef.current.find(
        (ann) => ann.freezeDuration && ann.freezeDuration > 0 && Math.abs(currentTimeRef.current - ann.startTime) < 0.25
      );

      let finalStartTime = Number(currentTimeRef.current.toFixed(2));
      let finalDurationOverride: number | null = null;
      if (activeFreezeAnn) {
        finalStartTime = activeFreezeAnn.startTime;
        finalDurationOverride = activeFreezeAnn.freezeDuration ?? null;
      }

      const pasted: VideoAnnotation[] = copiedAnnotationsRef.current.map((ann, idx) => {
        const newPoints = ann.points.map(p => ({
          x: Math.min(1, p.x + 0.03),
          y: Math.min(1, p.y + 0.03)
        }));

        const newKeyframes = ann.keyframes ? ann.keyframes.map(k => ({
          ...k,
          x: Math.min(1, k.x + 0.03),
          y: Math.min(1, k.y + 0.03)
        })) : [];

        return {
          ...ann,
          id: `ann-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          startTime: finalStartTime,
          duration: finalDurationOverride !== null ? finalDurationOverride : ann.duration,
          points: newPoints,
          keyframes: newKeyframes
        };
      });

      const next = [...localAnnotationsRef.current, ...pasted];
      notifyChange(next);

      const newIds = pasted.map(p => p.id);
      setSelectedIds(newIds);
      selectedIdsRef.current = newIds;
    };

    // Helper to get active annotations for the current timestamp
    const getActiveAnnotations = useCallback((): VideoAnnotation[] => {
      const t = activeFreezeTimeRef.current !== null ? activeFreezeTimeRef.current : currentTime;
      return localAnnotations.filter(
        a => a.id === selectedId || (t >= a.startTime - 0.05 && t <= a.startTime + a.duration + 0.05)
      );
    }, [localAnnotations, currentTime, selectedId]);

    // Interpolate keyframe coordinates for tracking shapes
    const getInterpolatedPoints = useCallback((ann: VideoAnnotation, t: number): { x: number; y: number }[] => {
      if (!ann.isTracking || !ann.keyframes || ann.keyframes.length === 0) {
        return ann.points;
      }

      const keys = [...ann.keyframes].sort((a, b) => a.time - b.time);

      if (t <= keys[0].time) {
        // Before first keyframe, shift all points by the first keyframe offset
        const dx = keys[0].x - ann.points[0].x;
        const dy = keys[0].y - ann.points[0].y;
        return ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      }

      if (t >= keys[keys.length - 1].time) {
        // After last keyframe
        const lastKey = keys[keys.length - 1];
        const dx = lastKey.x - ann.points[0].x;
        const dy = lastKey.y - ann.points[0].y;
        return ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      }

      // Linear interpolation between the surrounding keyframes
      let prevK = keys[0];
      let nextK = keys[0];
      for (let i = 0; i < keys.length - 1; i++) {
        if (t >= keys[i].time && t <= keys[i + 1].time) {
          prevK = keys[i];
          nextK = keys[i + 1];
          break;
        }
      }

      const totalD = nextK.time - prevK.time;
      const pct = totalD > 0 ? (t - prevK.time) / totalD : 0;
      const interpX = prevK.x + (nextK.x - prevK.x) * pct;
      const interpY = prevK.y + (nextK.y - prevK.y) * pct;

      const dx = interpX - ann.points[0].x;
      const dy = interpY - ann.points[0].y;
      return ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }, []);

    // Draw canvas overlay
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      const activeList = getActiveAnnotations();
      const drawTime = activeFreezeTimeRef.current !== null ? activeFreezeTimeRef.current : currentTime;

      // Spotlight Mask (Pre-render)
      const spotlightAnn = activeList.find(a => a.type === "spotlight");
      if (spotlightAnn) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, 0, W, H);

        const pts = getInterpolatedPoints(spotlightAnn, drawTime);
        if (pts.length > 0) {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          const rX = (spotlightAnn.size || 0.08) * W;
          const aspect = spotlightAnn.aspect !== undefined ? spotlightAnn.aspect : 1.0;
          const rY = rX * aspect;
          const feather = spotlightAnn.feather !== undefined ? spotlightAnn.feather : 0.2;

          ctx.save();
          // Create glow radial gradient
          const grad = ctx.createRadialGradient(cx, cy, rY * (1 - feather), cx, cy, rY);
          grad.addColorStop(0, "rgba(0, 0, 0, 1)");
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = grad;
          if (feather > 0) {
            ctx.beginPath();
            if (aspect !== 1.0) {
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(1, aspect);
              ctx.translate(-cx, -cy);
              ctx.restore();
            }
            ctx.arc(cx, cy, rX, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Render active annotations
      activeList.forEach((ann) => {
        const pts = getInterpolatedPoints(ann, drawTime);
        if (pts.length === 0) return;

        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;
        ctx.lineWidth = ann.lineWidth || 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const isSelected = selectedIds.includes(ann.id);
        const isPrimarySelected = ann.id === selectedId;

        // Draw tactical elements
        if (ann.type === "pencil") {
          if (pts.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(pts[0].x * W, pts[0].y * H);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * W, pts[i].y * H);
          }
          ctx.stroke();
        } else if (ann.type === "arrow") {
          if (pts.length < 2) return;
          const p1 = { x: pts[0].x * W, y: pts[0].y * H };
          const p2 = { x: pts[1].x * W, y: pts[1].y * H };
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p2.x - 12 * Math.cos(angle - Math.PI / 6), p2.y - 12 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(p2.x - 12 * Math.cos(angle + Math.PI / 6), p2.y - 12 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (ann.type === "circle") {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          const rX = (ann.size || 0.06) * W;
          const rY = rX * 0.45; // Perspective oval

          ctx.beginPath();
          ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Semi-transparent base fill
          ctx.fillStyle = ann.color + "25";
          ctx.fill();
        } else if (ann.type === "link") {
          if (pts.length < 2) return;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(pts[0].x * W, pts[0].y * H);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * W, pts[i].y * H);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw small base dots for connected players
          pts.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
            ctx.fillStyle = ann.color;
            ctx.fill();
          });
        } else if (ann.type === "offside") {
          if (pts.length < 2) return;
          // Perspective horizontal offside line
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = (ann.lineWidth || 3) + 1;
          ctx.beginPath();
          ctx.moveTo(pts[0].x * W, pts[0].y * H);
          ctx.lineTo(pts[1].x * W, pts[1].y * H);
          ctx.stroke();

          // Red translucent offside plane
          ctx.fillStyle = ann.color + "15";
          ctx.beginPath();
          ctx.moveTo(pts[0].x * W, pts[0].y * H);
          ctx.lineTo(pts[1].x * W, pts[1].y * H);
          ctx.lineTo(pts[1].x * W, H);
          ctx.lineTo(pts[0].x * W, H);
          ctx.closePath();
          ctx.fill();
        } else if (ann.type === "text") {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          const textVal = ann.text || "Nota Táctica";

          ctx.font = `bold ${ann.fontSize || 13}px sans-serif`;
          ctx.textBaseline = "middle";
          const tw = ctx.measureText(textVal).width;
          const padding = 8;
          const boxW = tw + padding * 2;
          const boxH = (ann.fontSize || 13) + padding * 2;

          // Capsule box
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(textVal, cx, cy);
        } else if (ann.type === "header") {
          const bannerH = 50;
          // Translucent top banner
          ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
          ctx.strokeStyle = ann.color + "50";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(0, 0, W, bannerH);
          ctx.fill();
          ctx.stroke();

          ctx.font = `bold 14px sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ann.text || "ANÁLISIS TÁCTICO", W / 2, bannerH / 2);
        } else if (ann.type === "sticker") {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          let icon = "⚽";
          if (ann.stickerType === "cone") icon = "📐";
          else if (ann.stickerType === "card_yellow") icon = "🟨";
          else if (ann.stickerType === "card_red") icon = "🟥";
          else if (ann.stickerType === "shield") icon = "🛡️";

          ctx.font = `${W * 0.05}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, cx, cy);
        } else if (ann.type === "spotlight") {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          const rX = (ann.size || 0.08) * W;
          const aspect = ann.aspect !== undefined ? ann.aspect : 1.0;
          const rY = rX * aspect;

          ctx.save();
          ctx.strokeStyle = isSelected ? "#eab308" : "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (ann.type === "magnifier") {
          const cx = pts[0].x * W;
          const cy = pts[0].y * H;
          const r = (ann.size || 0.08) * W;
          const zoom = ann.zoom || 2.0;

          if (videoRef.current) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();

            const sourceW = (r * 2) / zoom;
            const sourceH = (r * 2) / zoom;
            const sourceX = (pts[0].x) * videoRef.current.videoWidth - sourceW / 2;
            const sourceY = (pts[0].y) * videoRef.current.videoHeight - sourceH / 2;

            ctx.drawImage(
              videoRef.current,
              Math.max(0, Math.min(videoRef.current.videoWidth - sourceW, sourceX)),
              Math.max(0, Math.min(videoRef.current.videoHeight - sourceH, sourceY)),
              sourceW,
              sourceH,
              cx - r,
              cy - r,
              r * 2,
              r * 2
            );
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = isSelected ? "#eab308" : ann.color;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw visual resizer nodes if selected and isBoardActive
        if (isPrimarySelected && isBoardActive && !readOnly && ann.type !== "pencil") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.fillStyle = "#4f46e5";

          pts.forEach((p, idx) => {
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, W * 0.012 < 6 ? 6 : W * 0.012, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });

          // Spotlight, Circle & Magnifier outline boundary resizer
          if (ann.type === "circle" || ann.type === "spotlight" || ann.type === "magnifier") {
            const cx = pts[0].x * W;
            const cy = pts[0].y * H;
            const r = (ann.size || 0.06) * W;
            ctx.beginPath();
            ctx.arc(cx + r, cy, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#10b981"; // green resizer for radius
            ctx.fill();
            ctx.stroke();
          }
        }
      });
    }, [getActiveAnnotations, getInterpolatedPoints, currentTime, selectedId, isBoardActive, readOnly, selectedIds]);

    // ResizeObserver to adjust canvas coordinates dynamically
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          canvas.width = width;
          canvas.height = height;
          redrawCanvas();
        }
      });
      resizeObserver.observe(canvas);
      return () => resizeObserver.disconnect();
    }, [redrawCanvas]);

    // Redraw trigger on annotations change
    useEffect(() => {
      redrawCanvas();
    }, [localAnnotations, selectedId, currentTime, redrawCanvas]);

    // Vector Collisions Detection to select shapes
    const findAnnotationAtPos = (nx: number, ny: number): { ann: VideoAnnotation; nodeIndex: number } | null => {
      const activeList = localAnnotationsRef.current.filter(
        a => a.id === selectedIdRef.current || (currentTime >= a.startTime - 0.05 && currentTime <= a.startTime + a.duration + 0.05)
      );
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const threshold = 0.025; // 2.5% coordinate threshold

      // Search backward to pick the topmost elements first
      for (let i = activeList.length - 1; i >= 0; i--) {
        const ann = activeList[i];
        const pts = getInterpolatedPoints(ann, currentTime);
        if (pts.length === 0) continue;

        // Check Resizer nodes collision first
        if (ann.type !== "pencil") {
          for (let k = 0; k < pts.length; k++) {
            const dist = Math.sqrt((pts[k].x - nx) ** 2 + (pts[k].y - ny) ** 2);
            if (dist < threshold) {
              return { ann, nodeIndex: k };
            }
          }
        }

        // Special resizer node for Circle/Spotlight/Magnifier radius
        if (ann.type === "circle" || ann.type === "spotlight" || ann.type === "magnifier") {
          const cx = pts[0].x;
          const cy = pts[0].y;
          const r = ann.size || 0.06;
          const rxPos = cx + r;
          const dist = Math.sqrt((rxPos - nx) ** 2 + (cy - ny) ** 2);
          if (dist < threshold) {
            return { ann, nodeIndex: 99 }; // 99 as special radius handler
          }
        }

        // Check shape boundaries
        if (ann.type === "circle" || ann.type === "spotlight" || ann.type === "magnifier" || ann.type === "sticker" || ann.type === "text") {
          const cx = pts[0].x;
          const cy = pts[0].y;
          const r = ann.type === "circle" || ann.type === "spotlight" || ann.type === "magnifier" ? (ann.size || 0.06) : 0.04;
          const dist = Math.sqrt((cx - nx) ** 2 + (cy - ny) ** 2);
          if (dist < r) {
            return { ann, nodeIndex: -1 }; // -1 indicates dragging the body
          }
        } else if (ann.type === "arrow" || ann.type === "link" || ann.type === "offside") {
          if (pts.length >= 2) {
            // Check distance from click to line segment
            const p1 = pts[0];
            const p2 = pts[1];
            const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
            let t_ratio = ((nx - p1.x) * (p2.x - p1.x) + (ny - p1.y) * (p2.y - p1.y)) / l2;
            t_ratio = Math.max(0, Math.min(1, t_ratio));
            const proj = {
              x: p1.x + t_ratio * (p2.x - p1.x),
              y: p1.y + t_ratio * (p2.y - p1.y)
            };
            const dist = Math.sqrt((proj.x - nx) ** 2 + (proj.y - ny) ** 2);
            if (dist < threshold) {
              return { ann, nodeIndex: -1 };
            }
          }
        } else if (ann.type === "header") {
          if (ny <= 0.15) {
            return { ann, nodeIndex: -1 };
          }
        } else if (ann.type === "pencil") {
          // Check proximity to any pencil points
          for (let p of pts) {
            const dist = Math.sqrt((p.x - nx) ** 2 + (p.y - ny) ** 2);
            if (dist < threshold) return { ann, nodeIndex: -1 };
          }
        }
      }

      return null;
    };

    // Auto-update keyframes on movement if tracking is enabled
    const recordMovementKeyframe = (ann: VideoAnnotation, newPoints: { x: number; y: number }[]) => {
      if (!ann.isTracking) {
        return {
          ...ann,
          points: newPoints
        };
      }

      const newK: KeyframeData = {
        time: Number(currentTime.toFixed(2)),
        x: newPoints[0].x,
        y: newPoints[0].y
      };

      const keys = ann.keyframes ? [...ann.keyframes] : [];
      const idx = keys.findIndex(k => Math.abs(k.time - newK.time) < 0.15); // replace matching time
      if (idx >= 0) {
        keys[idx] = newK;
      } else {
        keys.push(newK);
      }

      return {
        ...ann,
        points: newPoints,
        keyframes: keys.sort((a, b) => a.time - b.time)
      };
    };

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBoardActive || readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const nx = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      const ny = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;

      const hit = findAnnotationAtPos(nx, ny);

      // AUTO-SELECTION: If there's a hit on an existing drawing shape, we switch activeTool to "pointer" automatically!
      if (hit && activeTool !== "pointer") {
        if (onActiveToolChange) {
          onActiveToolChange("pointer");
        }
      }

      // MODE: Pointer selection and dragging (or auto-selecting an existing shape)
      if (activeTool === "pointer" || hit) {
        if (hit) {
          const clickedId = hit.ann.id;
          let newSelectedIds = [...selectedIdsRef.current];

          if (e.shiftKey) {
            // Shift + Click: toggle selection
            if (newSelectedIds.includes(clickedId)) {
              newSelectedIds = newSelectedIds.filter(id => id !== clickedId);
            } else {
              newSelectedIds.push(clickedId);
            }
          } else {
            // Normal Click: if not already selected, select only this
            if (!newSelectedIds.includes(clickedId)) {
              newSelectedIds = [clickedId];
            }
          }

          setSelectedIds(newSelectedIds);
          selectedIdsRef.current = newSelectedIds;

          const primaryId = newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null;
          setSelectedId(primaryId);
          selectedIdRef.current = primaryId;

          // Record starting points of all selected annotations
          const startPointsMap: Record<string, { x: number; y: number }[]> = {};
          newSelectedIds.forEach(id => {
            const ann = localAnnotationsRef.current.find(a => a.id === id);
            if (ann) {
              startPointsMap[id] = JSON.parse(JSON.stringify(ann.points));
            }
          });
          multiStartPointsRef.current = startPointsMap;

          const points = hit.ann.points;

          if (hit.nodeIndex >= 0 && !e.shiftKey) {
            // Resize is only allowed if not multi-selecting and clicked node is valid
            updateInteractionState({
              mode: "resizing",
              startPos: { x: nx, y: ny },
              shapeStartPoints: JSON.parse(JSON.stringify(points)),
              shapeStartSize: hit.ann.size,
              resizeNodeIndex: hit.nodeIndex
            });
          } else {
            updateInteractionState({
              mode: "moving",
              startPos: { x: nx, y: ny },
              shapeStartPoints: JSON.parse(JSON.stringify(points))
            });
          }
        } else {
          setSelectedIds([]);
          selectedIdsRef.current = [];
          setSelectedId(null);
          selectedIdRef.current = null;
          if (zoomScale > 1.0) {
            updateInteractionState({
              mode: "panning" as any,
              startPos: { x: e.clientX, y: e.clientY },
              shapeStartPoints: [{ x: panOffset.x, y: panOffset.y }]
            });
          }
        }
        return;
      }

      // MODE: Drawing shapes
      pushToUndo(localAnnotationsRef.current);
      const newAnnId = `ann-${Date.now()}`;
      let defaultDuration = 0.1; // default duration 0.1s (appears only on that frame moment)

      // Check if there is an active freeze at the current time
      const activeFreezeAnn = localAnnotationsRef.current.find(
        (ann) => ann.freezeDuration && ann.freezeDuration > 0 && Math.abs(currentTime - ann.startTime) < 0.25
      );

      let finalStartTime = Number(currentTime.toFixed(2));
      let finalDuration = defaultDuration;

      if (activeFreezeAnn) {
        finalStartTime = activeFreezeAnn.startTime;
        finalDuration = activeFreezeAnn.freezeDuration ?? defaultDuration;
      }

      let newAnn: VideoAnnotation = {
        id: newAnnId,
        type: activeTool,
        startTime: finalStartTime,
        duration: finalDuration,
        color: drawColor,
        lineWidth: lineWidth,
        fontSize: fontSize,
        points: [{ x: nx, y: ny }],
        isTracking: false,
        keyframes: []
      };

      if (activeTool === "circle" || activeTool === "spotlight" || activeTool === "magnifier") {
        newAnn.size = 0.06;
        if (activeTool === "magnifier") {
          newAnn.zoom = 2.0;
        }
      } else if (activeTool === "arrow" || activeTool === "link" || activeTool === "offside") {
        newAnn.points = [{ x: nx, y: ny }, { x: nx, y: ny }];
      } else if (activeTool === "text") {
        newAnn.text = "Haz doble clic para editar";
        newAnn.points = [{ x: nx, y: ny }];
      } else if (annTypeIsHeader(activeTool)) {
        newAnn.text = "ANÁLISIS TÁCTICO";
        newAnn.points = [{ x: 0.5, y: 0.05 }];
      } else if (activeTool === "sticker") {
        newAnn.stickerType = stickerType;
      }

      notifyChange([...localAnnotationsRef.current, newAnn]);
      updateSelectedId(newAnnId);

      updateInteractionState({
        mode: "drawing",
        startPos: { x: nx, y: ny },
        shapeStartPoints: JSON.parse(JSON.stringify(newAnn.points)),
        resizeNodeIndex: 1
      });
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const nx = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      const ny = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;

      const activeInteraction = interactionStateRef.current;
      const activeSelectedId = selectedIdRef.current;

      if (activeInteraction.mode === "none") {
        if (!readOnly && activeTool === "pointer") {
          const hit = findAnnotationAtPos(nx, ny);
          if (hit) {
            canvas.style.cursor = hit.nodeIndex >= 0 ? "col-resize" : "move";
          } else if (zoomScale > 1.0) {
            canvas.style.cursor = "grab";
          } else {
            canvas.style.cursor = "default";
          }
        }
        return;
      }

      if ((activeInteraction.mode as any) === "panning") {
        canvas.style.cursor = "grabbing";
        const dxPixels = e.clientX - activeInteraction.startPos.x;
        const dyPixels = e.clientY - activeInteraction.startPos.y;
        setPanOffset({
          x: activeInteraction.shapeStartPoints[0].x + dxPixels,
          y: activeInteraction.shapeStartPoints[0].y + dyPixels
        });
        return;
      }

      if (!activeSelectedId || readOnly) return;

      const dx = nx - activeInteraction.startPos.x;
      const dy = ny - activeInteraction.startPos.y;

      const selectedList = selectedIdsRef.current;
      const updatedAnnotations = localAnnotationsRef.current.map(ann => {
        const isMovingSelected = activeInteraction.mode === "moving" && selectedList.includes(ann.id);
        const isOtherActive = (activeInteraction.mode === "drawing" || activeInteraction.mode === "resizing") && ann.id === activeSelectedId;

        if (!isMovingSelected && !isOtherActive) return ann;

        if (activeInteraction.mode === "drawing") {
          if (ann.type === "pencil") {
            const pts = [...ann.points, { x: nx, y: ny }];
            return { ...ann, points: pts };
          }
          if (ann.type === "arrow" || ann.type === "link" || ann.type === "offside") {
            const pts = [ann.points[0], { x: nx, y: ny }];
            return { ...ann, points: pts };
          }
          if (ann.type === "circle" || ann.type === "spotlight" || ann.type === "magnifier") {
            const rad = Math.sqrt((nx - ann.points[0].x) ** 2 + (ny - ann.points[0].y) ** 2);
            return { ...ann, size: Math.max(0.015, rad) };
          }
        }

        if (activeInteraction.mode === "moving") {
          const startPts = multiStartPointsRef.current[ann.id] || ann.points;
          const movedPts = startPts.map(p => ({
            x: Math.max(0, Math.min(1, p.x + dx)),
            y: Math.max(0, Math.min(1, p.y + dy))
          }));

          return recordMovementKeyframe(ann, movedPts);
        }

        if (activeInteraction.mode === "resizing") {
          const pts = [...ann.points];
          const nodeIdx = activeInteraction.resizeNodeIndex!;

          if (nodeIdx === 99) { // radius resizer for circle/spotlight
            const rad = Math.sqrt((nx - ann.points[0].x) ** 2 + (ny - ann.points[0].y) ** 2);
            return { ...ann, size: Math.max(0.015, rad) };
          }

          if (nodeIdx >= 0 && nodeIdx < pts.length) {
            pts[nodeIdx] = { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) };
            return recordMovementKeyframe(ann, pts);
          }
        }

        return ann;
      });

      setLocalAnnotations(updatedAnnotations);
    };

    const handleCanvasMouseUp = () => {
      const activeInteraction = interactionStateRef.current;
      if (activeInteraction.mode !== "none") {
        if (onAnnotationsChange) {
          onAnnotationsChange(localAnnotationsRef.current);
        }
        if (activeInteraction.mode === "drawing") {
          updateSelectedId(null);
        }
      }
      updateInteractionState({ mode: "none", startPos: { x: 0, y: 0 }, shapeStartPoints: [] });
    };

    const annTypeIsHeader = (type: any): type is "header" => type === "header";

    const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBoardActive || readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const nx = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      const ny = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;

      const hit = findAnnotationAtPos(nx, ny);
      if (hit && (hit.ann.type === "text" || hit.ann.type === "header")) {
        const newText = prompt("Introduce el nuevo texto de la anotación táctica:", hit.ann.text || "");
        if (newText !== null) {
          pushToUndo(localAnnotations);
          const updated = localAnnotations.map(ann => {
            if (ann.id === hit.ann.id) {
              return { ...ann, text: newText };
            }
            return ann;
          });
          notifyChange(updated);
        }
      }
    };

    // Toggle selected tracking keyframing
    const handleToggleTracking = () => {
      if (!selectedId) return;
      pushToUndo(localAnnotations);

      const updated = localAnnotations.map(ann => {
        if (ann.id === selectedId) {
          const nowTracking = !ann.isTracking;
          return {
            ...ann,
            isTracking: nowTracking,
            keyframes: nowTracking
              ? [{ time: Number(currentTime.toFixed(2)), x: ann.points[0].x, y: ann.points[0].y }]
              : []
          };
        }
        return ann;
      });
      notifyChange(updated);
    };

    const handleAddManualKeyframe = () => {
      if (!selectedId) return;
      const ann = localAnnotations.find(a => a.id === selectedId);
      if (!ann) return;

      pushToUndo(localAnnotations);
      const updated = localAnnotations.map(a => {
        if (a.id === selectedId) {
          const newK: KeyframeData = {
            time: Number(currentTime.toFixed(2)),
            x: a.points[0].x,
            y: a.points[0].y
          };
          const keys = a.keyframes ? [...a.keyframes] : [];
          const existsIdx = keys.findIndex(k => Math.abs(k.time - newK.time) < 0.2);
          if (existsIdx >= 0) {
            keys[existsIdx] = newK;
          } else {
            keys.push(newK);
          }
          return { ...a, keyframes: keys.sort((v1, v2) => v1.time - v2.time) };
        }
        return a;
      });
      notifyChange(updated);
    };

    const handleClearKeyframes = () => {
      if (!selectedId) return;
      pushToUndo(localAnnotations);
      const updated = localAnnotations.map(a => {
        if (a.id === selectedId) {
          return { ...a, keyframes: [], isTracking: false };
        }
        return a;
      });
      notifyChange(updated);
    };

    // Update properties of selected element
    const handleUpdateSelectedProperty = (key: keyof VideoAnnotation, val: any) => {
      const activeSelectedId = selectedIdRef.current;
      if (!activeSelectedId) return;
      pushToUndo(localAnnotationsRef.current);
      const updated = localAnnotationsRef.current.map(a => {
        if (a.id === activeSelectedId) {
          return { ...a, [key]: val };
        }
        return a;
      });
      notifyChange(updated);
    };

    // Speed synchronization
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackSpeed;
      }
    }, [playbackSpeed, playerType]);

    // Spacebar Play/Pause & Arrow Keys Step Navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeTag = document.activeElement?.tagName;
        const isEditable = document.activeElement?.getAttribute("contenteditable") === "true";
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT" || isEditable) {
          return;
        }

        // Global Play/Pause and Seek Shortcuts
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          const video = videoRef.current;
          if (video) {
            if (video.paused) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          }
        } else if (e.code === "ArrowLeft" || e.key === "ArrowLeft") {
          e.preventDefault();
          const video = videoRef.current;
          if (video) {
            const step = stepSize || 1.0;
            video.currentTime = Math.max(0, video.currentTime - step);
          }
        } else if (e.code === "ArrowRight" || e.key === "ArrowRight") {
          e.preventDefault();
          const video = videoRef.current;
          if (video) {
            const step = stepSize || 1.0;
            video.currentTime = Math.min(video.duration || 0, video.currentTime + step);
          }
        } else if (e.code === "ArrowUp" || e.key === "ArrowUp") {
          e.preventDefault();
          const video = videoRef.current;
          if (video) {
            const step = largeStepSize || 5.0;
            video.currentTime = Math.min(video.duration || 0, video.currentTime + step);
          }
        } else if (e.code === "ArrowDown" || e.key === "ArrowDown") {
          e.preventDefault();
          const video = videoRef.current;
          if (video) {
            const step = largeStepSize || 5.0;
            video.currentTime = Math.max(0, video.currentTime - step);
          }
        }

        // Pizarra-specific shortcuts (Delete, Undo, Redo, Copy, Paste)
        if (isBoardActive && !readOnly) {
          if (e.key === "Delete" || e.code === "Delete") {
            e.preventDefault();
            handleDeleteSelected();
          } else if (e.ctrlKey && e.key?.toLowerCase() === "z") {
            e.preventDefault();
            handleUndo();
          } else if (e.ctrlKey && e.key?.toLowerCase() === "y") {
            e.preventDefault();
            handleRedo();
          } else if (e.ctrlKey && e.key?.toLowerCase() === "c") {
            e.preventDefault();
            handleCopy();
          } else if (e.ctrlKey && e.key?.toLowerCase() === "v") {
            e.preventDefault();
            handlePaste();
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isBoardActive, readOnly, stepSize, largeStepSize]);

    // Freeze frame playback watcher: auto-pause video for freezeDuration seconds
    const activeFreezeIdRef = useRef<string | null>(null);
    useEffect(() => {
      if (playerType !== "html5" || !videoRef.current) return;
      const currentVid = videoRef.current;
      const activeFreezeAnn = localAnnotations.find(
        (ann) => ann.freezeDuration && ann.freezeDuration > 0 && Math.abs(currentTime - ann.startTime) <= 0.35
      );

      if (activeFreezeAnn && !currentVid.paused && activeFreezeIdRef.current !== activeFreezeAnn.id) {
        activeFreezeIdRef.current = activeFreezeAnn.id;
        currentVid.pause();
        const durationMs = (activeFreezeAnn.freezeDuration || 3) * 1000;
        const timer = setTimeout(() => {
          activeFreezeIdRef.current = null;
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }, durationMs);
        return () => clearTimeout(timer);
      }
    }, [currentTime, localAnnotations, playerType]);

    // Parse URL to detect type
    useEffect(() => {
      if (!url) return;

      const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i;
      const veoRegex = /app\.veo\.co\/matches\/([^/?#\s]+)/i;

      const ytMatch = url.match(ytRegex);
      const vimeoMatch = url.match(vimeoRegex);
      const veoMatch = url.match(veoRegex);

      if (ytMatch) {
        setPlayerType("youtube");
        setVideoId(ytMatch[1]);
      } else if (vimeoMatch) {
        setPlayerType("vimeo");
        setVideoId(vimeoMatch[1]);
      } else if (veoMatch) {
        setPlayerType("veo");
        setVideoId(veoMatch[1]);
      } else {
        setPlayerType("html5");
        setVideoId("");
      }
    }, [url]);

    // Robust aspect ratio sync
    useEffect(() => {
      const video = videoRef.current;
      if (!video || playerType !== "html5") return;

      const updateAspect = () => {
        if (video.videoWidth && video.videoHeight) {
          setVideoAspect(`${video.videoWidth}/${video.videoHeight}`);
        }
      };

      video.addEventListener("loadedmetadata", updateAspect);
      video.addEventListener("playing", updateAspect);

      return () => {
        video.removeEventListener("loadedmetadata", updateAspect);
        video.removeEventListener("playing", updateAspect);
      };
    }, [url, playerType]);

    // Track HTML5 video progress
    useEffect(() => {
      const video = videoRef.current;
      if (!video || playerType !== "html5") return;

      const handleTimeUpdate = () => {
        const time = video.currentTime;
        setCurrentTime(time);
        if (onTimeUpdate) {
          onTimeUpdate(time);
        }

        // Freeze frame logic during playback
        if (!video.paused) {
          localAnnotationsRef.current.forEach(ann => {
            if (ann.freezeDuration && ann.freezeDuration > 0) {
              if (time < ann.startTime - 0.2) {
                frozenAnnIds.current.delete(ann.id);
              }
            }
          });

          const annToFreeze = localAnnotationsRef.current.find(ann => {
            return (
              ann.freezeDuration &&
              ann.freezeDuration > 0 &&
              time >= ann.startTime &&
              time <= ann.startTime + 0.25 &&
              !frozenAnnIds.current.has(ann.id)
            );
          });

          if (annToFreeze) {
            frozenAnnIds.current.add(annToFreeze.id);
            activeFreezeTimeRef.current = annToFreeze.startTime;
            video.pause();
            setIsPlaying(false);
            if (onPlayStateChange) onPlayStateChange(false);

            setTimeout(() => {
              activeFreezeTimeRef.current = null;
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
                if (onPlayStateChange) onPlayStateChange(true);
              }
            }, annToFreeze.freezeDuration! * 1000);
          }
        }
      };

      const handleDurationChange = () => {
        if (onDurationChange) {
          onDurationChange(video.duration);
        }
      };

      const handlePlay = () => {
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      };

      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("durationchange", handleDurationChange);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("durationchange", handleDurationChange);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
      };
    }, [playerType, onTimeUpdate, onDurationChange, onPlayStateChange]);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number, play: boolean = false) => {
        activeFreezeTimeRef.current = null;
        setCurrentTime(seconds);

        if (playerType === "html5" && videoRef.current) {
          videoRef.current.currentTime = seconds;
          if (play) {
            videoRef.current.play().catch(() => {});
          } else {
            videoRef.current.pause();
          }
        } else if (playerType === "youtube" && iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
            "*"
          );
        }
      },
      getCurrentTime: () => {
        if (playerType === "html5" && videoRef.current) {
          return videoRef.current.currentTime;
        }
        return currentTime;
      },
      stepForward: (frames: number = 1) => {
        const video = videoRef.current;
        if (video) {
          video.pause();
          video.currentTime = Math.min(video.duration, video.currentTime + frames / 30);
        }
      },
      stepBackward: (frames: number = 1) => {
        const video = videoRef.current;
        if (video) {
          video.pause();
          video.currentTime = Math.max(0, video.currentTime - frames / 30);
        }
      },
      play: () => {
        if (playerType === "html5" && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      },
      pause: () => {
        if (playerType === "html5" && videoRef.current) {
          videoRef.current.pause();
        }
      },
      togglePlay: () => {
        if (playerType === "html5" && videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          } else {
            videoRef.current.pause();
          }
        }
      },
      isPlaying: () => {
        if (playerType === "html5" && videoRef.current) {
          return !videoRef.current.paused;
        }
        return isPlaying;
      },
      undo: () => {
        handleUndo();
      },
      redo: () => {
        handleRedo();
      },
      deleteSelected: () => {
        handleDeleteSelected();
      },
      setSpeed: (speed: number) => {
        setPlaybackSpeed(speed);
      },
      toggleFullscreen: () => {
        toggleFullscreen();
      },
      getZoomScale: () => zoomScale,
      setZoomScale: (scale: number) => {
        setZoomScale(scale);
        if (scale === 1.0) setPanOffset({ x: 0, y: 0 });
      },
      getPanOffset: () => panOffset,
      setPanOffset: (offset: { x: number; y: number }) => setPanOffset(offset),
      getSelectedId: () => selectedIdRef.current,
      setSelectedId: (id: string | null) => updateSelectedId(id),
    }));

    const filterStyle = {
      filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    };

    const selectedAnnotation = localAnnotations.find(a => a.id === selectedId);

    const renderSelectedProperties = () => {
      if (!isBoardActive || readOnly || !selectedAnnotation) return null;
      return (
        <div className="absolute top-3 left-3 z-30 bg-slate-950/85 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-3 text-white text-[9px] shadow-xl backdrop-blur-xs">
          <span className="font-bold text-indigo-400">Edición:</span>
          <div className="flex items-center gap-1">
            <span>Inicio:</span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={selectedAnnotation.startTime}
              onChange={(e) => handleUpdateSelectedProperty("startTime", Number(e.target.value))}
              className="bg-slate-900 border border-white/10 w-10 rounded px-1 py-0.5 text-white text-center font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1">
            <span>Duración:</span>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={selectedAnnotation.duration}
              onChange={(e) => handleUpdateSelectedProperty("duration", Number(e.target.value))}
              className="bg-slate-900 border border-white/10 w-9 rounded px-1 py-0.5 text-white text-center font-mono focus:outline-none focus:border-indigo-500"
            />
            <span>s</span>
          </div>
          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <span>Congelar:</span>
            <input
              type="number"
              step="1"
              min="0"
              value={selectedAnnotation.freezeDuration || 0}
              onChange={(e) => handleUpdateSelectedProperty("freezeDuration", Number(e.target.value))}
              className="bg-slate-900 border border-white/10 w-8 rounded px-1 py-0.5 text-white text-center font-mono focus:outline-none focus:border-indigo-500"
            />
            <span>s</span>
          </div>
          {(selectedAnnotation.type === "circle" || selectedAnnotation.type === "spotlight" || selectedAnnotation.type === "magnifier") && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
              <span>Tamaño:</span>
              <input
                type="range"
                min="0.015"
                max="0.4"
                step="0.005"
                value={selectedAnnotation.size || 0.06}
                onChange={(e) => handleUpdateSelectedProperty("size", Number(e.target.value))}
                className="w-12 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}
          {selectedAnnotation.type === "spotlight" && (
            <>
              <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                <span>Forma/Aspecto:</span>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={selectedAnnotation.aspect !== undefined ? selectedAnnotation.aspect : 1.0}
                  onChange={(e) => handleUpdateSelectedProperty("aspect", Number(e.target.value))}
                  className="w-12 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                <span>Borde/Foco:</span>
                <input
                  type="range"
                  min="0.0"
                  max="0.8"
                  step="0.05"
                  value={selectedAnnotation.feather !== undefined ? selectedAnnotation.feather : 0.2}
                  onChange={(e) => handleUpdateSelectedProperty("feather", Number(e.target.value))}
                  className="w-12 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </>
          )}
          {selectedAnnotation.type === "magnifier" && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
              <span>Aumento:</span>
              <input
                type="range"
                min="1.1"
                max="5.0"
                step="0.1"
                value={selectedAnnotation.zoom || 2.0}
                onChange={(e) => handleUpdateSelectedProperty("zoom", Number(e.target.value))}
                className="w-12 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-mono text-indigo-400">{(selectedAnnotation.zoom || 2.0).toFixed(1)}x</span>
            </div>
          )}
          <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-slate-355">
            <input
              type="checkbox"
              checked={selectedAnnotation.isTracking || false}
              onChange={handleToggleTracking}
              className="accent-indigo-500 rounded h-3 w-3"
            />
            <span>Trayectoria</span>
          </label>
          {selectedAnnotation.isTracking && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAddManualKeyframe}
                className="bg-indigo-605 hover:bg-indigo-550 text-white px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors"
              >
                📍 Clave
              </button>
              {selectedAnnotation.keyframes && selectedAnnotation.keyframes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearKeyframes}
                  className="bg-slate-805 hover:bg-rose-950/40 text-rose-450 px-1.5 py-0.5 rounded text-[8px]"
                >
                  Limpiar ({selectedAnnotation.keyframes.length})
                </button>
              )}
            </div>
          )}
        </div>
      );
    };

    const renderPlaybackControlsOverlay = () => {
      if (hideControls || !url) return null;
      return (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 z-20 bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold shadow-2xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-all"
          title="Pantalla Completa"
        >
          <span>{isFullscreen ? "🗖" : "⛶"}</span>
          <span>{isFullscreen ? "Salir Fullscreen" : "Pantalla Completa"}</span>
        </button>
      );
    };

    const renderToolbar = () => {
      if (!isBoardActive || readOnly) return null;

      return (
        <div className="absolute top-3 left-3 right-28 z-30 bg-slate-950/95 border border-white/15 shadow-2xl backdrop-blur-md flex items-center justify-between text-white text-[10px] px-3 py-1.5 rounded-xl animate-fade-in">
          {/* Whiteboard Tools */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="font-extrabold text-indigo-400 text-[9px] uppercase tracking-wider shrink-0 mr-1">Pizarra</span>
            {[
              {
                key: "pointer",
                title: "Seleccionar / Mover",
                icon: <MousePointer className="h-3.5 w-3.5" />
              },
              {
                key: "pencil",
                title: "Lápiz Trazo Libre",
                icon: <Pencil className="h-3.5 w-3.5" />
              },
              {
                key: "arrow",
                title: "Flecha Desmarque",
                icon: <MoveRight className="h-3.5 w-3.5" />
              },
              {
                key: "circle",
                title: "Zona Círculo",
                icon: <Circle className="h-3.5 w-3.5" />
              },
              {
                key: "spotlight",
                title: "Foco Jugador",
                icon: <Target className="h-3.5 w-3.5" />
              },
              {
                key: "link",
                title: "Línea Conexión",
                icon: <Minus className="h-3.5 w-3.5" />
              },
              {
                key: "offside",
                title: "Línea Fuera de Juego",
                icon: <Flag className="h-3.5 w-3.5 text-rose-400" />
              },
              {
                key: "text",
                title: "Anotación de Texto / Comentario",
                icon: <MessageSquare className="h-3.5 w-3.5" />
              },
              {
                key: "magnifier",
                title: "Lupa de Ampliación",
                icon: <ZoomIn className="h-3.5 w-3.5" />
              },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                title={t.title}
                onClick={() => {
                  setActiveTool(t.key as any);
                  if (t.key !== "pointer") setSelectedId(null);
                }}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                  activeTool === t.key
                    ? "bg-indigo-600 text-white border border-indigo-400/50 ring-2 ring-indigo-500/40 shadow-indigo-500/30 scale-105"
                    : "bg-slate-900/90 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {t.icon}
              </button>
            ))}

            {/* Colors */}
            {activeTool !== "pointer" && (
              <div className="flex items-center gap-1 px-2 border-l border-white/10 ml-1">
                {[
                  { color: "#ef4444", title: "Rojo" },
                  { color: "#eab308", title: "Amarillo" },
                  { color: "#3b82f6", title: "Azul" },
                  { color: "#22c55e", title: "Verde" },
                  { color: "#ffffff", title: "Blanco" },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    title={c.title}
                    onClick={() => {
                      setDrawColor(c.color);
                      if (selectedId) handleUpdateSelectedProperty("color", c.color);
                    }}
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      drawColor === c.color ? "ring-2 ring-white scale-110 shadow-md" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.color }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Action Controls: Undo, Redo, Close */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              title="Deshacer trazo (Ctrl+Z)"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:bg-slate-800 disabled:opacity-20 text-slate-300 transition-all cursor-pointer"
            >
              <Undo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Rehacer trazo (Ctrl+Y)"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:bg-slate-800 disabled:opacity-20 text-slate-300 transition-all cursor-pointer"
            >
              <Redo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Cerrar Pizarra Táctica"
              onClick={() => setIsBoardActive(false)}
              className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    };

    const renderAdjustmentsPanel = () => (
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="bg-slate-950/80 hover:bg-slate-900 text-white rounded-xl px-3 py-1.5 text-[10px] font-bold border border-white/10 shadow-lg backdrop-blur flex items-center gap-1.5"
        >
          <span>🎨</span> Filtros
        </button>

        {showSettings && (
          <div className="bg-slate-950/95 border border-white/10 rounded-2xl p-4 mt-2 shadow-2xl text-[10px] w-48 space-y-3.5 backdrop-blur text-slate-355 z-30">
            <div className="space-y-1">
              <div className="flex justify-between font-extrabold text-[9px] uppercase tracking-wider text-slate-400">
                <span>Brillo</span>
                <span className="text-white font-mono">{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 rounded bg-white/10 appearance-none"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-extrabold text-[9px] uppercase tracking-wider text-slate-400">
                <span>Contraste</span>
                <span className="text-white font-mono">{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 rounded bg-white/10 appearance-none"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-extrabold text-[9px] uppercase tracking-wider text-slate-400">
                <span>Saturación</span>
                <span className="text-white font-mono">{saturation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={saturation}
                onChange={(e) => setSaturation(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 rounded bg-white/10 appearance-none"
              />
            </div>
            <div className="space-y-1.5 border-t border-white/[0.05] pt-2">
              <div className="flex justify-between font-extrabold text-[9px] uppercase tracking-wider text-slate-400">
                <span>Zoom del Vídeo</span>
                <span className="text-white font-mono">{zoomScale.toFixed(1)}x</span>
              </div>
              <div className="flex gap-1">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => {
                      setZoomScale(z);
                      if (z === 1.0) setPanOffset({ x: 0, y: 0 });
                    }}
                    className={`flex-1 py-1 rounded text-[8px] font-bold border ${
                      zoomScale === z ? "bg-indigo-600 text-white border-indigo-500/30" : "bg-white/5 border-transparent text-slate-400"
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setBrightness(100);
                setContrast(100);
                setSaturation(100);
                setZoomScale(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="w-full bg-white/5 hover:bg-white/10 rounded-xl py-1.5 text-[9px] font-bold text-center border border-white/5 transition-colors text-white"
            >
              Restablecer
            </button>
          </div>
        )}
      </div>
    );

    const renderPlayerContent = () => {
      if (playerType === "youtube") {
        return (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&autoplay=1`}
            className="absolute top-0 left-0 w-full h-full animate-fade-in"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
      if (playerType === "vimeo") {
        return (
          <iframe
            ref={iframeRef}
            src={`https://player.vimeo.com/video/${videoId}?api=1&autoplay=1`}
            className="absolute top-0 left-0 w-full h-full animate-fade-in"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        );
      }
      if (playerType === "veo") {
        const embedUrl = `https://app.veo.co/matches/${videoId}/embed/`;
        return (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="absolute top-0 left-0 w-full h-full animate-fade-in"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        );
      }
      if (!url) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 select-none bg-slate-950">
            <span className="text-4xl">🎬</span>
            <p className="text-xs font-bold text-slate-450">Sin vídeo disponible</p>
            <p className="text-[10px] text-slate-600 text-center px-6">
              Vincula un vídeo usando una URL pública o local
            </p>
          </div>
        );
      }
      return (
        <video
          key={url}
          ref={videoRef}
          src={url}
          muted={muted}
          className="w-full h-full object-contain"
          style={{ objectFit: "contain" }}
          controls={false}
          playsInline
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            if (video.videoWidth && video.videoHeight) {
              setVideoAspect(`${video.videoWidth}/${video.videoHeight}`);
            }
            if (onDurationChange) {
              onDurationChange(video.duration);
            }
          }}
          onLoadedData={(e) => {
            const video = e.currentTarget;
            if (video.videoWidth && video.videoHeight) {
              setVideoAspect(`${video.videoWidth}/${video.videoHeight}`);
            }
          }}
        />
      );
    };

    const containerStyle: React.CSSProperties = {
      ...filterStyle,
      aspectRatio: videoAspect ? `${videoAspect}` : "16/9",
      width: "100%",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "100%",
    };

    return (
      <div ref={containerRef} className="w-full h-full relative flex flex-col justify-center items-center overflow-hidden gap-3">
        {isBoardActive && !readOnly && !hideToolbar && toolbarPosition === "top" && renderToolbar()}

        <div className="flex-1 w-full min-h-0 flex flex-row justify-center items-center overflow-hidden gap-3">
          {isBoardActive && !readOnly && !hideToolbar && toolbarPosition === "left" && renderToolbar()}

          <div style={containerStyle} className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl flex justify-center items-center">
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `scale(${zoomScale}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: "center center",
                transition: (interactionState.mode as any) === "panning" ? "none" : "transform 0.1s ease-out",
              }}
              className="absolute inset-0 flex justify-center items-center"
            >
              {renderPlayerContent()}

              <canvas
                ref={canvasRef}
                className={`absolute top-0 left-0 w-full h-full z-10 ${
                  isBoardActive && !readOnly
                    ? activeTool === "pointer"
                      ? "cursor-default"
                      : "cursor-crosshair"
                    : "pointer-events-none"
                }`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onDoubleClick={handleCanvasDoubleClick}
              />
            </div>

            {renderAdjustmentsPanel()}
            {renderSelectedProperties()}
            {renderPlaybackControlsOverlay()}

            {isBoardActive && !readOnly && !hideToolbar && toolbarPosition === "floating" && renderToolbar()}
          </div>

          {isBoardActive && !readOnly && !hideToolbar && toolbarPosition === "right" && renderToolbar()}
        </div>

        {isBoardActive && !readOnly && !hideToolbar && toolbarPosition === "bottom" && renderToolbar()}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
