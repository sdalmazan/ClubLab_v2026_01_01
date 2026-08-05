"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer, type VideoPlayerRef } from "@/components/video/VideoPlayer";
import { saveLocalVideoToIDB, getLocalVideoFromIDB } from "@/lib/clublab/idbVideo";
import { compileAndDownloadMontageMP4 } from "@/lib/clublab/videoCompiler";
import type { 
  SessionVideoData, 
  VideoItem, 
  VideoClip, 
  ClipPlayerStat, 
  VideoAnnotation, 
  VideoMontage,
  VideoMontageItem
} from "@/lib/clublab/types";
import { 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Wand2, 
  Scissors, 
  Film, 
  ChevronRight, 
  ChevronLeft,
  Search, 
  Sparkles, 
  Eye, 
  Volume2, 
  VolumeX,
  Download,
  Info,
  Clock,
  Layers,
  Archive,
  ArrowRight,
  RefreshCw,
  FileText,
  Tag,
  AlignLeft,
  Layout,
  UploadCloud,
  PenTool,
  PauseCircle,
  Square,
  Sliders,
  CheckCircle2,
  Image as ImageIcon,
  Edit2,
  Video,
  ShieldCheck,
  Award,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  UserCheck
} from "lucide-react";

// Standard action categories with separate ABP Ofensivo / Defensivo
const DEFAULT_ACTION_TYPES = [
  { name: "Ataque", color: "#3b82f6" },
  { name: "Defensa", color: "#ef4444" },
  { name: "Transición Ofensiva", color: "#10b981" },
  { name: "Transición Defensiva", color: "#f59e0b" },
  { name: "Balón Parado Ofensivo", color: "#8b5cf6" },
  { name: "Balón Parado Defensivo", color: "#ec4899" },
  { name: "Presión", color: "#06b6d4" },
  { name: "Salida de Balón", color: "#14b8a6" },
  { name: "Jugada relevante", color: "#6366f1" },
];

const DEFAULT_DESCRIPTORS = ["Bien", "Mal", "Gol a favor", "Gol en contra"];

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  shirt_number?: number | null;
  number?: number | null;
  position?: string | null;
}

interface MatchVideoClientProps {
  match: any;
  players: Player[];
  allMatches: any[];
  matchEvents?: any[];
}

function secondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map((p) => parseFloat(p) || 0);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return Number(timeStr) || 0;
}

export function MatchVideoClient({ match, players = [], allMatches = [], matchEvents = [] }: MatchVideoClientProps) {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerRef>(null);

  // Wizard active step: 1 | 2 | 3
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Video data state
  const [videoData, setVideoData] = useState<SessionVideoData>({
    general_notes: "",
    videos: [],
    montages: [],
    cut_bank: []
  });

  // Analysis type: "own" (Partido propio) vs "rival" (Análisis de Rival)
  const [activeType, setActiveType] = useState<"own" | "rival">("own");
  const [selectedRivalName, setSelectedRivalName] = useState<string>(match.away_team || "");

  const activeVideo = videoData.videos.find((v) => v.type === activeType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if own team is playing in this match
  const isOwnTeamMatch = activeType === "own";

  // Match sheet roster cross-referenced with squad players
  const matchRoster: Player[] = React.useMemo(() => {
    if (!isOwnTeamMatch) return [];
    
    const rosterList = match.home_team_roster || match.away_team_roster || [];
    if (rosterList.length > 0) {
      return rosterList.map((rPlayer: any, idx: number) => {
        const foundSquad = players.find(p => 
          p.id === rPlayer.id || 
          `${p.first_name} ${p.last_name}`.toLowerCase() === (rPlayer.name || "").toLowerCase()
        );
        return {
          id: rPlayer.id || foundSquad?.id || `roster-${idx}`,
          first_name: foundSquad?.first_name || rPlayer.name?.split(" ")[0] || rPlayer.first_name || `Jugador`,
          last_name: foundSquad?.last_name || rPlayer.name?.split(" ").slice(1).join(" ") || rPlayer.last_name || `${idx + 1}`,
          shirt_number: rPlayer.number || rPlayer.shirt_number || foundSquad?.shirt_number || idx + 1,
          position: foundSquad?.position || rPlayer.position || "Campo"
        };
      });
    }

    return players;
  }, [isOwnTeamMatch, match, players]);

  // Paso 1: Partes (seconds)
  const [t1Start, setT1Start] = useState<number>(0);
  const [t1End, setT1End] = useState<number>(2700);
  const [t2Start, setT2Start] = useState<number>(3600);
  const [t2End, setT2End] = useState<number>(6300);

  // Cutting Modes: "manual" vs "auto_10s" (±5s)
  const [cutMode, setCutMode] = useState<"manual" | "auto_10s">("manual");
  const [isCutting, setIsCutting] = useState<boolean>(false);
  const [cutStart, setCutStart] = useState<number | null>(null);

  // Active clip form state (Right sidebar)
  const [activeEditingClip, setActiveEditingClip] = useState<VideoClip | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [clipComment, setClipComment] = useState("");
  const [clipCategory, setClipCategory] = useState("Ataque");
  const [clipDescriptors, setClipDescriptors] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showNotesInVideo, setShowNotesInVideo] = useState(false);
  const [notesPosition, setNotesPosition] = useState<"bottom" | "top" | "left" | "right" | "center">("bottom");

  // Video duration & time watchers
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [previewingClipEnd, setPreviewingClipEnd] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Whiteboard Active state
  const [isBoardActive, setIsBoardActive] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<any>("pointer");
  const [drawColor, setDrawColor] = useState<string>("#ef4444");

  // Presentation Playlist States (Paso 3)
  const [activeMontageId, setActiveMontageId] = useState<string | null>(null);
  const [montageSortMode, setMontageSortMode] = useState<"chrono" | "category" | "attack_defense">("chrono");

  // Cover creation form state with Live Preview & Positioning
  const [coverTitle, setCoverTitle] = useState(`${match.home_team} vs ${match.away_team}`);
  const [coverSubtitle, setCoverSubtitle] = useState("Análisis Táctico de Partido");
  const [coverBgColor, setCoverBgColor] = useState("#0f172a");
  const [coverBgImage, setCoverBgImage] = useState("");
  const [coverTextColor, setCoverTextColor] = useState("#ffffff");
  const [coverFontSize, setCoverFontSize] = useState<"sm" | "md" | "lg">("md");
  const [coverShowBadge, setCoverShowBadge] = useState<boolean>(true);
  const [coverBadgePosition, setCoverBadgePosition] = useState<"top" | "center" | "bottom">("center");
  const [coverDuration, setCoverDuration] = useState(4);
  const [coverInsertionPos, setCoverInsertionPos] = useState<"start" | "end">("start");
  const [showCoverForm, setShowCoverForm] = useState(false);

  // Global Audio & MP4 Export
  const [exportIncludeSound, setExportIncludeSound] = useState(true);
  const [exportingMp4, setExportingMp4] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");

  const isInitialLoadedRef = useRef(false);

  useEffect(() => {
    isInitialLoadedRef.current = false;
    setLoading(true);

    fetch(`/api/scouting/matches/${match.id}/video`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (loadedData: SessionVideoData | null) => {
        if (loadedData) {
          if (loadedData.videos && Array.isArray(loadedData.videos)) {
            for (const vid of loadedData.videos) {
              try {
                const storedLocalBlob = await getLocalVideoFromIDB(match.id, vid.type);
                if (storedLocalBlob) {
                  vid.url = URL.createObjectURL(storedLocalBlob);
                }
              } catch {}
            }
          }
          setVideoData(loadedData);

          if (loadedData.montages && loadedData.montages.length > 0) {
            setActiveMontageId(loadedData.montages[0].id);
          }
        }

        setLoading(false);

        if (!isInitialLoadedRef.current) {
          isInitialLoadedRef.current = true;
          const activeVid = loadedData?.videos?.find(v => v.type === activeType) || loadedData?.videos?.[0];
          if (activeVid) {
            if (activeVid.halves && activeVid.halves.length >= 2) {
              setT1Start(activeVid.halves[0][0]);
              setT1End(activeVid.halves[0][1]);
              setT2Start(activeVid.halves[1][0]);
              setT2End(activeVid.halves[1][1]);
            }
            const hasClips = Boolean(activeVid.clips && activeVid.clips.length > 0);
            if (hasClips) {
              setWizardStep(2);
            } else {
              setWizardStep(1);
            }
          }
        }
      })
      .catch((err) => {
        setError("Error al cargar el análisis de vídeo.");
        setLoading(false);
      });
  }, [match.id, activeType]);

  // Step 2 Clip Preview Watcher: Auto-pause when clip reaches end time
  useEffect(() => {
    if (previewingClipEnd !== null && currentTime >= previewingClipEnd) {
      playerRef.current?.pause();
      setPreviewingClipEnd(null);
    }
  }, [currentTime, previewingClipEnd]);

  // Step 2 Clean Match Timeline Calculations
  const dur1 = Math.max(1, t1End - t1Start);
  const dur2 = Math.max(1, t2End - t2Start);
  const totalMatchSec = dur1 + dur2;

  const getEffectiveMatchTime = (realSec: number) => {
    if (realSec < t1Start) return 0;
    if (realSec <= t1End) return realSec - t1Start;
    if (realSec < t2Start) return dur1;
    if (realSec <= t2End) return dur1 + (realSec - t2Start);
    return dur1 + dur2;
  };

  const getRealTimeFromEffective = (effSec: number) => {
    if (effSec <= dur1) {
      return t1Start + effSec;
    } else {
      return t2Start + (effSec - dur1);
    }
  };

  const currentEffectiveSec = getEffectiveMatchTime(currentTime);

  const handleTimelineClickStep2 = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetEffSec = pct * totalMatchSec;
    const targetRealSec = getRealTimeFromEffective(targetEffSec);
    if (playerRef.current) {
      playerRef.current.seekTo(targetRealSec, true);
      setCurrentTime(targetRealSec);
    }
  };

  // Confirm Halves (Step 1 -> Step 2)
  const handleConfirmHalves = async () => {
    if (!activeVideo) return;
    const halves: [number, number][] = [
      [t1Start, t1End],
      [t2Start, t2End]
    ];
    const updatedVideos = videoData.videos.map((v) =>
      v.id === activeVideo.id ? { ...v, halves, isFinalized: true } : v
    );
    const updatedData = { ...videoData, videos: updatedVideos };
    setVideoData(updatedData);
    setWizardStep(2);

    setTimeout(() => {
      if (playerRef.current && t1Start > 0) {
        playerRef.current.seekTo(t1Start, true);
      }
    }, 150);

    handleSave();
  };

  // Save changes to API
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/scouting/matches/${match.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoData)
      });
      if (!response.ok) throw new Error("Error al guardar en el servidor");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Error al guardar el análisis.");
    } finally {
      setSaving(false);
    }
  };

  // Cutting logic
  const handleStartCut = () => {
    if (cutMode === "auto_10s") {
      const start = Math.max(0, currentTime - 5);
      const end = Math.min(videoDuration || currentTime + 10, currentTime + 5);

      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        title: `Corte ${secondsToMMSS(start)} - ${secondsToMMSS(end)}`,
        start,
        end,
        comment: "",
        category: "Ataque",
        descriptors: [],
        tagged_players: [],
        stats: [],
        annotations: [],
        notesOverlay: { text: "", showInVideo: false, position: "bottom" },
        playbackSpeed: 1.0,
        scoreboardOverlay: { show: true }
      };

      setActiveEditingClip(newClip);
      setClipTitle(`Corte a las ${secondsToMMSS(start)}`);
      setClipStart(secondsToMMSS(start));
      setClipEnd(secondsToMMSS(end));
      setClipCategory("Ataque");
      setClipComment("");
      setClipDescriptors([]);
      setSelectedPlayers([]);
      setShowNotesInVideo(false);
      setNotesPosition("bottom");
    } else {
      setIsCutting(true);
      setCutStart(currentTime);
    }
  };

  const handleStopCut = () => {
    if (cutStart === null) return;
    setIsCutting(false);
    const start = Math.max(0, cutStart);
    const end = currentTime;
    setCutStart(null);

    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      title: `Recorte ${secondsToMMSS(start)} - ${secondsToMMSS(end)}`,
      start,
      end,
      comment: "",
      category: "Ataque",
      descriptors: [],
      tagged_players: [],
      stats: [],
      annotations: [],
      notesOverlay: { text: "", showInVideo: false, position: "bottom" },
      playbackSpeed: 1.0,
      scoreboardOverlay: { show: true }
    };

    setActiveEditingClip(newClip);
    setClipTitle(`Recorte ${secondsToMMSS(start)} - ${secondsToMMSS(end)}`);
    setClipStart(secondsToMMSS(start));
    setClipEnd(secondsToMMSS(end));
    setClipCategory("Ataque");
    setClipComment("");
    setClipDescriptors([]);
    setSelectedPlayers([]);
    setShowNotesInVideo(false);
    setNotesPosition("bottom");
  };

  // Play clip in Step 2 with auto-pause at end
  const handlePlayClipInStep2 = (clip: VideoClip) => {
    if (playerRef.current) {
      playerRef.current.seekTo(clip.start, true);
      setCurrentTime(clip.start);
      setPreviewingClipEnd(clip.end);
    }
  };

  // Save clip from sidebar
  const handleSaveActiveClip = () => {
    if (!activeEditingClip) return;
    const startSec = parseTimeToSeconds(clipStart);
    const endSec = parseTimeToSeconds(clipEnd);

    if (startSec > endSec) {
      alert("El tiempo de inicio no puede ser mayor que el tiempo de fin.");
      return;
    }

    const updatedClip: VideoClip = {
      ...activeEditingClip,
      title: clipTitle.trim() || `Corte ${secondsToMMSS(startSec)}`,
      start: startSec,
      end: endSec,
      category: clipCategory,
      descriptors: clipDescriptors,
      tagged_players: selectedPlayers,
      comment: clipComment,
      notesOverlay: {
        text: clipComment,
        showInVideo: showNotesInVideo,
        position: notesPosition
      },
      playbackSpeed: 1.0,
      scoreboardOverlay: { show: true }
    };

    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.type === activeType
          ? {
              ...v,
              clips: v.clips.some(c => c.id === updatedClip.id)
                ? v.clips.map(c => c.id === updatedClip.id ? updatedClip : c)
                : [...v.clips, updatedClip].sort((a, b) => a.start - b.start)
            }
          : v
      )
    }));

    setActiveEditingClip(null);
    handleSave();
  };

  // Add cover to montage with placement (start / end) and logo upload
  const handleAddCoverToMontage = (e: React.FormEvent) => {
    e.preventDefault();
    let targetMontageId = activeMontageId;
    if (!targetMontageId) {
      const defaultM: VideoMontage = {
        id: `montage-${Date.now()}`,
        title: `Montaje ${match.home_team} vs ${match.away_team}`,
        items: [],
        createdAt: new Date().toISOString()
      };
      setVideoData(prev => ({
        ...prev,
        montages: [...(prev.montages || []), defaultM]
      }));
      setActiveMontageId(defaultM.id);
      targetMontageId = defaultM.id;
    }

    const newCoverItem: VideoMontageItem = {
      id: `cover-${Date.now()}`,
      type: "cover",
      title: coverTitle || `${match.home_team} vs ${match.away_team}`,
      subtitle: coverSubtitle || "Análisis Táctico",
      duration: coverDuration,
      bgColor: coverBgColor || "#0f172a",
      bgImage: coverBgImage,
      textColor: coverTextColor || "#ffffff",
      fontSize: coverFontSize,
      showBadge: coverShowBadge
    };

    setVideoData((prev) => ({
      ...prev,
      montages: (prev.montages || []).map((m) => {
        if (m.id !== targetMontageId) return m;
        const newItems = coverInsertionPos === "start" ? [newCoverItem, ...m.items] : [...m.items, newCoverItem];
        return { ...m, items: newItems };
      })
    }));

    setShowCoverForm(false);
    handleSave();
  };

  // Add all clips to montage automatically in Step 3
  const handlePopulateMontageWithClips = () => {
    if (!activeVideo || activeVideo.clips.length === 0) return;
    let targetMontageId = activeMontageId;
    if (!targetMontageId) {
      const defaultM: VideoMontage = {
        id: `montage-${Date.now()}`,
        title: `Montaje ${match.home_team} vs ${match.away_team}`,
        items: [],
        createdAt: new Date().toISOString()
      };
      setVideoData(prev => ({
        ...prev,
        montages: [...(prev.montages || []), defaultM]
      }));
      setActiveMontageId(defaultM.id);
      targetMontageId = defaultM.id;
    }

    const montageClipsItems: VideoMontageItem[] = activeVideo.clips.map(c => ({
      id: `m-item-${c.id}`,
      type: "clip",
      clipId: c.id,
      title: c.title,
      videoUrl: activeVideo.url,
      start: c.start,
      end: c.end,
      playbackSpeed: 1.0,
      showScoreboard: true,
      notesOverlay: c.notesOverlay
    }));

    setVideoData(prev => ({
      ...prev,
      montages: (prev.montages || []).map(m =>
        m.id === targetMontageId ? { ...m, items: [...m.items, ...montageClipsItems] } : m
      )
    }));

    handleSave();
  };

  // Auto-sort montage items in Step 3
  const handleSortMontageItems = (mode: "chrono" | "category" | "attack_defense") => {
    setMontageSortMode(mode);
    const montage = videoData.montages?.find(m => m.id === activeMontageId);
    if (!montage) return;

    const covers = montage.items.filter(i => i.type === "cover");
    const clips = [...montage.items.filter(i => i.type === "clip")];

    if (mode === "chrono") {
      clips.sort((a, b) => (a.start || 0) - (b.start || 0));
    } else if (mode === "category") {
      const allClips = activeVideo?.clips || [];
      clips.sort((a, b) => {
        const catA = allClips.find(c => c.id === a.clipId)?.category || "";
        const catB = allClips.find(c => c.id === b.clipId)?.category || "";
        return catA.localeCompare(catB);
      });
    } else if (mode === "attack_defense") {
      const allClips = activeVideo?.clips || [];
      clips.sort((a, b) => {
        const catA = allClips.find(c => c.id === a.clipId)?.category || "";
        const catB = allClips.find(c => c.id === b.clipId)?.category || "";
        const orderA = catA.includes("Ataque") ? 1 : catA.includes("Defensa") ? 2 : 3;
        const orderB = catB.includes("Ataque") ? 1 : catB.includes("Defensa") ? 2 : 3;
        return orderA - orderB;
      });
    }

    setVideoData(prev => ({
      ...prev,
      montages: (prev.montages || []).map(m =>
        m.id === activeMontageId ? { ...m, items: [...covers, ...clips] } : m
      )
    }));
  };

  // Handle Cover background image upload
  const handleCoverBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverBgImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Export MP4
  const handleExportFinalVideo = async () => {
    if (!activeMontageId) {
      alert("Por favor selecciona o crea un montaje táctico.");
      return;
    }
    const montage = videoData.montages?.find(m => m.id === activeMontageId);
    if (!montage || montage.items.length === 0) {
      alert("El montaje está vacío. Añade carátulas y cortes en el Paso 3.");
      return;
    }

    setExportingMp4(true);
    setExportProgress(5);
    setExportMessage("Inicializando motor de vídeo Canvas HD...");

    try {
      const allClips = activeVideo?.clips || [];
      await compileAndDownloadMontageMP4(
        montage,
        allClips,
        {
          includeSound: exportIncludeSound,
          resolution: "1080p",
          clubLogoUrl: match.home_team_logo || undefined,
          homeTeamName: match.home_team,
          awayTeamName: match.away_team,
          matchDate: match.match_date ? new Date(match.match_date).toLocaleDateString("es-ES") : undefined
        },
        (pct, msg) => {
          setExportProgress(pct);
          setExportMessage(msg);
        }
      );
    } catch (err: any) {
      alert(`Error al generar el archivo .mp4: ${err.message}`);
    } finally {
      setExportingMp4(false);
    }
  };

  const activeVideoUrl = activeVideo?.url || "";

  // Live Action & Descriptor Counters
  const actionCounts: Record<string, number> = {};
  const descriptorCounts: Record<string, number> = {};

  activeVideo?.clips.forEach(c => {
    const cat = c.category || "Jugada relevante";
    actionCounts[cat] = (actionCounts[cat] || 0) + 1;
    c.descriptors?.forEach(d => {
      descriptorCounts[d] = (descriptorCounts[d] || 0) + 1;
    });
  });

  if (activeEditingClip) {
    if (clipCategory) actionCounts[clipCategory] = (actionCounts[clipCategory] || 0) + 1;
    clipDescriptors.forEach(d => {
      descriptorCounts[d] = (descriptorCounts[d] || 0) + 1;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider">Cargando mesa de videoanálisis...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12 text-slate-100">
      {/* ── TOP BANNER WITH ANALYSIS TYPE & RIVAL SELECTOR ── */}
      <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-black shadow-inner">
            🎬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white leading-none">
                {match.home_team} vs {match.away_team}
              </h1>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                {activeType === "own" ? "Partido Propio" : `Análisis Rival: ${selectedRivalName}`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {match.competition || "Oficial"} • {match.match_date ? new Date(match.match_date).toLocaleDateString("es-ES") : "Fecha por confirmar"}
            </p>
          </div>
        </div>

        {/* Rival Selection & Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-white/10 p-1 rounded-lg flex items-center gap-1">
            <button
              onClick={() => setActiveType("own")}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                activeType === "own" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Equipo Propio
            </button>
            <button
              onClick={() => setActiveType("rival")}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                activeType === "rival" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Análisis Rival
            </button>
          </div>

          {activeType === "rival" && (
            <select
              value={selectedRivalName}
              onChange={(e) => setSelectedRivalName(e.target.value)}
              className="bg-slate-950 border border-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              <option value={match.away_team}>{match.away_team}</option>
              <option value={match.home_team}>{match.home_team}</option>
              {allMatches.map(m => (
                <option key={m.id} value={m.away_team}>{m.away_team}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-[11px] uppercase px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <div className="h-3 w-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{saving ? "Guardando..." : "Guardar Edición"}</span>
          </button>
        </div>
      </div>

      {/* ── 3-STEP WIZARD BAR ── */}
      <div className="bg-slate-900/80 border border-white/10 rounded-xl p-1.5 shadow-md">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setWizardStep(1)}
            className={`py-2 px-3 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
              wizardStep === 1 ? "bg-indigo-600 text-white border-indigo-500 shadow" : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <div className="h-5 w-5 rounded bg-white/10 flex items-center justify-center font-black text-[10px] shrink-0">1</div>
            <span className="text-[11px] font-black block leading-none">Paso 1: Delimitar Partes</span>
          </button>

          <button
            onClick={() => setWizardStep(2)}
            className={`py-2 px-3 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
              wizardStep === 2 ? "bg-indigo-600 text-white border-indigo-500 shadow" : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <div className="h-5 w-5 rounded bg-white/10 flex items-center justify-center font-black text-[10px] shrink-0">2</div>
            <span className="text-[11px] font-black block leading-none">Paso 2: Edición & Cortes</span>
          </button>

          <button
            onClick={() => setWizardStep(3)}
            className={`py-2 px-3 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
              wizardStep === 3 ? "bg-indigo-600 text-white border-indigo-500 shadow" : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <div className="h-5 w-5 rounded bg-white/10 flex items-center justify-center font-black text-[10px] shrink-0">3</div>
            <span className="text-[11px] font-black block leading-none">Paso 3: Montaje & Exportar</span>
          </button>
        </div>
      </div>

      {/* ── STEP 1: Delimitar Partes ── */}
      {wizardStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start animate-fade-in">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              <VideoPlayer
                ref={playerRef}
                url={activeVideoUrl}
                muted={false}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={(d) => setVideoDuration(d)}
              />
            </div>

            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Marcas de Tiempo del Partido</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setT1Start(currentTime)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg shadow cursor-pointer"
                >
                  ⏱ Marcar posición como Inicio 1ª Parte
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Inicio 1ª Parte</label>
                  <input
                    type="text"
                    value={secondsToMMSS(t1Start)}
                    onChange={(e) => setT1Start(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-primary/30">
                  <label className="text-[9px] font-bold text-primary uppercase block mb-1">Final 1ª Parte</label>
                  <input
                    type="text"
                    value={secondsToMMSS(t1End)}
                    onChange={(e) => setT1End(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-primary/40 rounded px-2 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Inicio 2ª Parte</label>
                  <input
                    type="text"
                    value={secondsToMMSS(t2Start)}
                    onChange={(e) => setT2Start(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Final 2ª Parte</label>
                  <input
                    type="text"
                    value={secondsToMMSS(t2End)}
                    onChange={(e) => setT2End(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-white/5">
                <span>💡 Al pasar al Paso 2 la reproducción se iniciará en el segundo exacto de la 1ª parte.</span>
                <button
                  type="button"
                  onClick={handleConfirmHalves}
                  className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-lg shrink-0 flex items-center gap-1 shadow cursor-pointer"
                >
                  <span>Pasar al Paso 2</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
            <h4 className="text-xs font-black uppercase text-white">Instrucciones del Paso 1</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Confirma las marcas de inicio/fin de cada mitad. Al guardar, los tramos sin juego se omiten automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Edición & Cortes (Sin botón +Montaje) ── */}
      {wizardStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start animate-fade-in">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              <VideoPlayer
                ref={playerRef}
                url={activeVideoUrl}
                muted={false}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={(d) => setVideoDuration(d)}
                isBoardActive={isBoardActive}
                onBoardActiveChange={(active) => setIsBoardActive(active)}
                activeTool={activeTool}
                onActiveToolChange={(tool) => setActiveTool(tool)}
                drawColor={drawColor}
                onDrawColorChange={(c) => setDrawColor(c)}
              />
            </div>

            {/* Timeline with Match Events */}
            <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono font-bold">
                <span>00:00 (Inicio 1ª Parte)</span>
                <span className="text-white text-xs font-black">
                  {secondsToMMSS(currentEffectiveSec)} / {secondsToMMSS(totalMatchSec)}
                </span>
                <span>{secondsToMMSS(totalMatchSec)} (Final 2ª Parte)</span>
              </div>

              <div
                ref={timelineRef}
                onClick={handleTimelineClickStep2}
                className="relative h-6 bg-slate-950 border border-white/10 rounded-lg cursor-pointer overflow-hidden group shadow-inner"
              >
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-600/60 border-r border-indigo-400/80"
                  style={{ width: `${(dur1 / totalMatchSec) * 100}%` }}
                />
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 z-20 flex items-center justify-center shadow-lg"
                  style={{ left: `${(dur1 / totalMatchSec) * 100}%` }}
                >
                  <span className="text-[7px] font-black uppercase text-amber-950 bg-amber-400 px-1 rounded select-none">
                    DESCANSO
                  </span>
                </div>
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-700/60 border-l border-indigo-400/80"
                  style={{ left: `${(dur1 / totalMatchSec) * 100}%`, width: `${(dur2 / totalMatchSec) * 100}%` }}
                />

                {/* Match Events Markers */}
                {matchEvents.map((ev, idx) => {
                  let eventEffSec = 0;
                  if (ev.minute <= 45) {
                    eventEffSec = (ev.minute / 45) * dur1;
                  } else {
                    eventEffSec = dur1 + ((ev.minute - 45) / 45) * dur2;
                  }
                  const leftPct = (eventEffSec / totalMatchSec) * 100;
                  const icon = ev.event_type === "goal" ? "⚽" : ev.event_type === "yellow_card" ? "🟨" : ev.event_type === "red_card" ? "🟥" : "🔄";

                  return (
                    <div
                      key={ev.id || idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playerRef.current) {
                          const realSec = ev.minute <= 45 ? t1Start + (ev.minute * 60) : t2Start + ((ev.minute - 45) * 60);
                          playerRef.current.seekTo(realSec, true);
                        }
                      }}
                      className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center z-25 hover:scale-130 transition-transform cursor-pointer"
                      style={{ left: `${leftPct}%` }}
                      title={`Min ${ev.minute}': ${ev.description || ev.event_type}`}
                    >
                      <span className="text-[11px] drop-shadow">{icon}</span>
                    </div>
                  );
                })}

                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-40 shadow-lg pointer-events-none"
                  style={{ left: `${(currentEffectiveSec / totalMatchSec) * 100}%` }}
                />
              </div>

              {/* Control Rail */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-white/5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => playerRef.current && playerRef.current.seekTo(Math.max(0, currentTime - 10), true)}
                    className="px-2 py-1 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    -10s
                  </button>
                  <button
                    onClick={() => playerRef.current && playerRef.current.seekTo(Math.max(0, currentTime - 1), true)}
                    className="px-2 py-1 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    -1s
                  </button>
                  <button 
                    onClick={() => playerRef.current?.togglePlay()}
                    className="w-8 h-8 bg-gradient-to-r from-primary to-emerald-400 text-slate-950 rounded-full flex items-center justify-center shadow font-black cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-slate-950 translate-x-[1px]" />
                  </button>
                  <button
                    onClick={() => playerRef.current && playerRef.current.seekTo(Math.min(videoDuration || 0, currentTime + 1), true)}
                    className="px-2 py-1 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    +1s
                  </button>
                  <button
                    onClick={() => playerRef.current && playerRef.current.seekTo(Math.min(videoDuration || 0, currentTime + 10), true)}
                    className="px-2 py-1 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    +10s
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="bg-slate-950 border border-white/10 p-0.5 rounded-lg flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCutMode("manual")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                        cutMode === "manual" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Rango Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setCutMode("auto_10s")}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                        cutMode === "auto_10s" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Auto (±5s)
                    </button>
                  </div>

                  <button
                    onClick={() => isCutting ? handleStopCut() : handleStartCut()}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                      isCutting ? "bg-rose-600 text-white animate-pulse" : "bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white"
                    }`}
                  >
                    {isCutting ? <Square className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
                    <span>{isCutting ? "Finalizar Corte" : "Iniciar Corte"}</span>
                  </button>

                  <button
                    onClick={() => setIsBoardActive(!isBoardActive)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                      isBoardActive ? "bg-indigo-600 text-white shadow" : "bg-slate-950 border border-white/10 text-slate-300"
                    }`}
                  >
                    <PenTool className="h-3 w-3 text-indigo-400" />
                    <span>Pizarra</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Form & Saved Clips */}
          <div className="space-y-3">
            <div className="bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 shadow-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-black uppercase text-white">
                  {activeEditingClip ? "Procesar Corte Activo" : "Nuevo Corte Táctico"}
                </h3>
                {activeEditingClip && (
                  <button onClick={() => setActiveEditingClip(null)} className="text-slate-400 hover:text-white text-[10px] font-bold">
                    ✕ Cancelar
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Título del corte..."
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Inicio</label>
                    <input
                      type="text"
                      value={clipStart}
                      onChange={(e) => setClipStart(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Fin</label>
                    <input
                      type="text"
                      value={clipEnd}
                      onChange={(e) => setClipEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white text-center font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Action Categories with separate ABP Ofensivo / Defensivo */}
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Tipo de Acción</label>
                  <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-white/5">
                    {DEFAULT_ACTION_TYPES.map(act => (
                      <button
                        key={act.name}
                        type="button"
                        onClick={() => setClipCategory(act.name)}
                        className={`p-1.5 rounded-lg text-[9px] font-bold flex items-center justify-between border transition-all ${
                          clipCategory === act.name
                            ? "bg-indigo-950 border-indigo-500 text-white ring-1 ring-indigo-500/50"
                            : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{act.name}</span>
                        <span className="bg-slate-900 text-indigo-300 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-white/10">
                          {actionCounts[act.name] || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descriptors */}
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-400 uppercase block">Descriptores</label>
                  <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-lg border border-white/5">
                    {DEFAULT_DESCRIPTORS.map(desc => {
                      const isSel = clipDescriptors.includes(desc);
                      return (
                        <button
                          key={desc}
                          type="button"
                          onClick={() => {
                            setClipDescriptors(prev => 
                              prev.includes(desc) ? prev.filter(d => d !== desc) : [...prev, desc]
                            );
                          }}
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold border transition-all flex items-center gap-1 ${
                            isSel ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span>{desc}</span>
                          <span className="text-[8px] opacity-75 font-mono">({descriptorCounts[desc] || 0})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Squad Player Tagging only if Own Team match */}
                {isOwnTeamMatch && (
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase block">Etquetar Jugadores del Acta</label>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-slate-950 rounded-lg border border-white/5">
                      {matchRoster.map((p) => {
                        const isSel = selectedPlayers.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPlayers(prev => 
                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                              isSel ? "bg-primary border-primary text-slate-950 font-extrabold" : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            #{p.shirt_number} {p.first_name} {p.last_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <textarea
                  rows={2}
                  placeholder="Observaciones tácticas..."
                  value={clipComment}
                  onChange={(e) => setClipComment(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg p-1.5 text-[11px] text-white"
                />

                <button
                  type="button"
                  onClick={handleSaveActiveClip}
                  className="w-full bg-gradient-to-r from-primary to-emerald-400 text-slate-950 font-black text-xs uppercase py-2.5 rounded-lg shadow cursor-pointer text-center"
                >
                  Aceptar y Guardar Corte
                </button>
              </div>
            </div>

            {/* Saved Clips List without +Montaje Button */}
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-black uppercase text-white">Cortes Guardados ({activeVideo?.clips.length || 0})</h3>
                <button
                  onClick={() => setWizardStep(3)}
                  className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-[9px] uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 shadow cursor-pointer"
                >
                  <span>Ir al Paso 3</span>
                  <ChevronRight className="h-3 w-3 stroke-[3]" />
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {activeVideo?.clips.map((clip) => (
                  <div key={clip.id} className="p-2.5 bg-slate-950 border border-white/5 hover:border-indigo-500/40 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate max-w-[130px]">{clip.title}</span>
                      <span className="bg-slate-900 border border-white/10 text-indigo-300 font-mono text-[9px] px-1.5 py-0.5 rounded">
                        {secondsToMMSS(clip.start)} - {secondsToMMSS(clip.end)}
                      </span>
                    </div>

                    {clip.descriptors && clip.descriptors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {clip.descriptors.map((desc, idx) => (
                          <span key={idx} className="bg-emerald-500/20 text-emerald-300 text-[8px] font-extrabold px-1.5 py-0.2 rounded">
                            {desc}
                          </span>
                        ))}
                      </div>
                    )}

                    {clip.comment && (
                      <p className="text-[10px] text-slate-300 italic bg-slate-900/60 p-1 rounded border border-white/5">
                        📝 {clip.comment}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handlePlayClipInStep2(clip)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="h-2.5 w-2.5 fill-white" />
                        <span>Reproducir Corte</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVideoData((prev) => ({
                            ...prev,
                            videos: prev.videos.map((v) =>
                              v.type === activeType ? { ...v, clips: v.clips.filter((c) => c.id !== clip.id) } : v
                            )
                          }));
                          handleSave();
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Montaje Final & Generador MP4 con Preview de Carátula ── */}
      {wizardStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start animate-fade-in">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              <VideoPlayer
                ref={playerRef}
                url={activeVideoUrl}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={(d) => setVideoDuration(d)}
                isBoardActive={isBoardActive}
                onBoardActiveChange={(active) => setIsBoardActive(active)}
                activeTool={activeTool}
                onActiveToolChange={(tool) => setActiveTool(tool)}
                drawColor={drawColor}
                onDrawColorChange={(c) => setDrawColor(c)}
              />
            </div>

            {/* Montage Builder Controls */}
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Línea del Tiempo de Montaje Final</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePopulateMontageWithClips}
                    className="bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    + Cargar Todos los Cortes
                  </button>

                  <button
                    onClick={() => setShowCoverForm(!showCoverForm)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Layout className="h-3 w-3" />
                    <span>+ Crear Carátula</span>
                  </button>

                  <button
                    onClick={handleExportFinalVideo}
                    disabled={exportingMp4}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-lg flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                  >
                    <Video className="h-4 w-4" />
                    <span>Generar .MP4</span>
                  </button>
                </div>
              </div>

              {/* Sorting Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg border border-white/5 text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Ordenar Montaje:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSortMontageItems("chrono")}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase ${
                      montageSortMode === "chrono" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Cronológico
                  </button>
                  <button
                    onClick={() => handleSortMontageItems("category")}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase ${
                      montageSortMode === "category" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Por Tipo Acción
                  </button>
                  <button
                    onClick={() => handleSortMontageItems("attack_defense")}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase ${
                      montageSortMode === "attack_defense" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Ataque vs Defensa
                  </button>
                </div>
              </div>

              {/* Cover Slide Editor with Real-Time Canvas Preview & Logo Upload */}
              {showCoverForm && (
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/40 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-xs font-black text-indigo-300 uppercase">Editor & Previsualización de Carátula</h4>
                    <button onClick={() => setShowCoverForm(false)} className="text-slate-400 hover:text-white text-xs">✕ Cerrar</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Real-time Preview Box */}
                    <div 
                      className="relative h-44 rounded-xl border border-white/20 p-4 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden"
                      style={{
                        backgroundColor: coverBgColor,
                        backgroundImage: coverBgImage ? `url(${coverBgImage})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        color: coverTextColor
                      }}
                    >
                      {coverShowBadge && (
                        <div className="mb-2 h-10 w-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shadow">
                          <ShieldCheck className="h-6 w-6 text-amber-400" />
                        </div>
                      )}
                      <h2 className="text-sm font-black uppercase tracking-wider">{coverTitle || "Título Carátula"}</h2>
                      <p className="text-xs opacity-80 mt-1">{coverSubtitle || "Subtítulo de la diapositiva"}</p>
                    </div>

                    {/* Cover Inputs */}
                    <form onSubmit={handleAddCoverToMontage} className="space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="Título de la carátula..."
                        value={coverTitle}
                        onChange={(e) => setCoverTitle(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-white/10 rounded px-2.5 py-1 text-white font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Subtítulo..."
                        value={coverSubtitle}
                        onChange={(e) => setCoverSubtitle(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2.5 py-1 text-white"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase">Fondo</label>
                          <input
                            type="color"
                            value={coverBgColor}
                            onChange={(e) => setCoverBgColor(e.target.value)}
                            className="w-full h-6 rounded border-0 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase">Texto</label>
                          <input
                            type="color"
                            value={coverTextColor}
                            onChange={(e) => setCoverTextColor(e.target.value)}
                            className="w-full h-6 rounded border-0 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase">Posición</label>
                          <select
                            value={coverInsertionPos}
                            onChange={(e) => setCoverInsertionPos(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 text-white rounded px-1 py-0.5 text-[9px]"
                          >
                            <option value="start">Al principio</option>
                            <option value="end">Al final</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={coverShowBadge}
                            onChange={(e) => setCoverShowBadge(e.target.checked)}
                          />
                          <span>Mostrar Escudo del Club</span>
                        </label>

                        <label className="bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold px-2 py-1 rounded text-[9px] border border-white/10 cursor-pointer">
                          <span>📷 Imagen de Fondo</span>
                          <input type="file" accept="image/*" onChange={handleCoverBgUpload} className="hidden" />
                        </label>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
                      >
                        Confirmar e Insertar Carátula
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Montage Playlist */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(() => {
                  const montage = videoData.montages?.find(m => m.id === activeMontageId);
                  if (!montage || montage.items.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-500 italic text-xs">
                        El montaje está vacío. Carga los cortes creados o añade carátulas.
                      </div>
                    );
                  }
                  return montage.items.map((item, idx) => (
                    <div key={item.id} className="p-2.5 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[9px] text-indigo-400 font-bold uppercase">{item.type === "cover" ? "Diapositiva Carátula" : "Corte Táctico"}</span>
                        <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoData(prev => ({
                            ...prev,
                            montages: (prev.montages || []).map(m =>
                              m.id === activeMontageId ? { ...m, items: m.items.filter(i => i.id !== item.id) } : m
                            )
                          }));
                          handleSave();
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
            <h4 className="text-xs font-black uppercase text-white">Exportación MP4 HD</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Descarga tu archivo de vídeo compilado en 1080p con carátulas, marcador y anotaciones sobreimpresas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
