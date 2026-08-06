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
  UserCheck,
  Filter,
  Calendar,
  X,
  Tv
} from "lucide-react";

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
  season?: string | null;
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

// Strict Spanish Match Date Formatter (e.g. 02/07/2026 without UTC shift)
function formatSpanishMatchDate(dateStr?: string): string {
  if (!dateStr) return "Fecha por confirmar";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function MatchVideoClient({ match, players = [], allMatches = [], matchEvents = [] }: MatchVideoClientProps) {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerRef>(null);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  const [videoData, setVideoData] = useState<SessionVideoData>({
    general_notes: "",
    videos: [],
    montages: [],
    cut_bank: []
  });

  const [activeType, setActiveType] = useState<"own" | "rival">("own");
  const [selectedRivalName, setSelectedRivalName] = useState<string>(match.away_team || "");

  const activeVideo = videoData.videos.find((v) => v.type === activeType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnTeamMatch = activeType === "own";
  
  const matchSeason = React.useMemo(() => {
    if (match.season) return match.season;
    if (match.season_name) return match.season_name;
    if (match.match_date) {
      const clean = match.match_date.split("T")[0];
      const [yStr, mStr] = clean.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);
      if (!isNaN(year) && !isNaN(month)) {
        if (month >= 7) return `${year}/${year + 1}`;
        return `${year - 1}/${year}`;
      }
    }
    return "2025/2026";
  }, [match]);

  const formattedMatchDate = formatSpanishMatchDate(match.match_date);

  // Filter roster strictly by match sheet or match season (prevents 2026/2027 cross-contamination)
  const matchRoster: Player[] = React.useMemo(() => {
    if (!isOwnTeamMatch) return [];

    const seasonPlayers = players.filter(p => {
      if (!p.season) return true;
      return p.season === matchSeason;
    });
    
    const rosterList = match.home_team_roster || match.away_team_roster || [];
    if (rosterList.length > 0) {
      return rosterList.map((rPlayer: any, idx: number) => {
        const foundSquad = seasonPlayers.find(p => 
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

    return seasonPlayers;
  }, [isOwnTeamMatch, match, players, matchSeason]);

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

  // Video duration & time watchers
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [previewingClipEnd, setPreviewingClipEnd] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Whiteboard Active state
  const [isBoardActive, setIsBoardActive] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<any>("pointer");
  const [drawColor, setDrawColor] = useState<string>("#ef4444");

  // Step 3 Montage Playlist States & Library Multi-filtering
  const [activeMontageId, setActiveMontageId] = useState<string | null>(null);
  const [activeStep3PreviewIndex, setActiveStep3PreviewIndex] = useState<number>(0);

  // Step 3 Library Filters & Sorting
  const [step3FilterCategory, setStep3FilterCategory] = useState<string>("Todos");
  const [step3FilterDescriptor, setStep3FilterDescriptor] = useState<string>("Todos");
  const [step3SortMode, setStep3SortMode] = useState<"chrono" | "category">("chrono");

  // Cover creation form state with Main On-Screen Preview
  const [coverTitle, setCoverTitle] = useState(`${match.home_team} vs ${match.away_team}`);
  const [coverSubtitle, setCoverSubtitle] = useState("Análisis Táctico de Partido");
  const [coverBgColor, setCoverBgColor] = useState("#0f172a");
  const [coverBgImage, setCoverBgImage] = useState("");
  const [coverTextColor, setCoverTextColor] = useState("#ffffff");
  const [coverFontSize, setCoverFontSize] = useState<"sm" | "md" | "lg">("md");
  const [coverShowBadge, setCoverShowBadge] = useState<boolean>(true);
  const [coverDuration, setCoverDuration] = useState(4);
  const [coverInsertionPos, setCoverInsertionPos] = useState<"start" | "end">("start");
  const [showCoverForm, setShowCoverForm] = useState(false);

  // Pre-Export Preview Modal
  const [showPreExportModal, setShowPreExportModal] = useState(false);

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

  // Auto-pause watcher in Step 2 when clip ends
  useEffect(() => {
    if (previewingClipEnd !== null && currentTime >= previewingClipEnd) {
      playerRef.current?.pause();
      setPreviewingClipEnd(null);
    }
  }, [currentTime, previewingClipEnd]);

  // Clean Match Calculations
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

      const effStart = getEffectiveMatchTime(start);
      const effEnd = getEffectiveMatchTime(end);

      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        title: `Corte ${secondsToMMSS(effStart)} - ${secondsToMMSS(effEnd)}`,
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
      setClipTitle(`Corte ${secondsToMMSS(effStart)} - ${secondsToMMSS(effEnd)}`);
      setClipStart(secondsToMMSS(effStart));
      setClipEnd(secondsToMMSS(effEnd));
      setClipCategory("Ataque");
      setClipComment("");
      setClipDescriptors([]);
      setSelectedPlayers([]);
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

    const effStart = getEffectiveMatchTime(start);
    const effEnd = getEffectiveMatchTime(end);

    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      title: `Recorte ${secondsToMMSS(effStart)} - ${secondsToMMSS(effEnd)}`,
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
    setClipTitle(`Recorte ${secondsToMMSS(effStart)} - ${secondsToMMSS(effEnd)}`);
    setClipStart(secondsToMMSS(effStart));
    setClipEnd(secondsToMMSS(effEnd));
    setClipCategory("Ataque");
    setClipComment("");
    setClipDescriptors([]);
    setSelectedPlayers([]);
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
    const effStartSec = parseTimeToSeconds(clipStart);
    const effEndSec = parseTimeToSeconds(clipEnd);

    const realStartSec = getRealTimeFromEffective(effStartSec);
    const realEndSec = getRealTimeFromEffective(effEndSec);

    const updatedClip: VideoClip = {
      ...activeEditingClip,
      title: clipTitle.trim() || `Corte ${secondsToMMSS(effStartSec)}`,
      start: realStartSec,
      end: realEndSec,
      category: clipCategory,
      descriptors: clipDescriptors,
      tagged_players: selectedPlayers,
      comment: clipComment,
      notesOverlay: {
        text: clipComment,
        showInVideo: true,
        position: "bottom"
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

  // Add clip to Step 3 Montage Timeline
  const handleAddSingleClipToMontage = (clip: VideoClip) => {
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

    const newItem: VideoMontageItem = {
      id: `m-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type: "clip",
      clipId: clip.id,
      title: clip.title,
      videoUrl: activeVideo?.url || clip.videoUrl || "",
      start: clip.start,
      end: clip.end,
      playbackSpeed: 1.0,
      showScoreboard: true,
      notesOverlay: clip.notesOverlay
    };

    setVideoData((prev) => ({
      ...prev,
      montages: (prev.montages || []).map((m) =>
        m.id === targetMontageId ? { ...m, items: [...m.items, newItem] } : m
      )
    }));

    handleSave();
  };

  // Add cover to montage with placement
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

  // Edit Cover Duration directly on timeline item
  const handleUpdateCoverDuration = (itemId: string, newDuration: number) => {
    setVideoData(prev => ({
      ...prev,
      montages: (prev.montages || []).map(m =>
        m.id === activeMontageId
          ? {
              ...m,
              items: m.items.map(item => item.id === itemId ? { ...item, duration: newDuration } : item)
            }
          : m
      )
    }));
    handleSave();
  };

  // Cover Image upload
  const handleCoverBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverBgImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Export MP4 Confirmation Execution
  const handleConfirmExportFinalVideo = async () => {
    setShowPreExportModal(false);
    setExportingMp4(true);
    setExportProgress(5);
    setExportMessage("Inicializando motor de vídeo Canvas HD...");

    try {
      const montage = videoData.montages?.find(m => m.id === activeMontageId);
      const allClips = activeVideo?.clips || [];
      if (!montage) return;

      await compileAndDownloadMontageMP4(
        montage,
        allClips,
        {
          includeSound: exportIncludeSound,
          resolution: "1080p",
          clubLogoUrl: match.home_team_logo || undefined,
          homeTeamName: match.home_team,
          awayTeamName: match.away_team,
          matchDate: formattedMatchDate,
          isRivalAnalysis: activeType === "rival",
          rivalTeamName: selectedRivalName || match.away_team || "Rival",
          seasonName: matchSeason
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

  const activeMontage = videoData.montages?.find(m => m.id === activeMontageId);
  const montageItems = activeMontage?.items || [];
  const activePreviewItem = montageItems[activeStep3PreviewIndex] || montageItems[0];

  // Filtered & Sorted Step 3 Clip Bank
  const filteredStep3Clips = React.useMemo(() => {
    let list = activeVideo?.clips || [];

    if (step3FilterCategory !== "Todos") {
      list = list.filter(c => c.category === step3FilterCategory);
    }
    if (step3FilterDescriptor !== "Todos") {
      list = list.filter(c => c.descriptors?.includes(step3FilterDescriptor));
    }

    if (step3SortMode === "chrono") {
      return [...list].sort((a, b) => a.start - b.start);
    } else {
      return [...list].sort((a, b) => (a.category || "").localeCompare(b.category || ""));
    }
  }, [activeVideo, step3FilterCategory, step3FilterDescriptor, step3SortMode]);

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
      {/* ── TOP BANNER ── */}
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
                Temporada {matchSeason} • {activeType === "own" ? "Partido Propio" : `Análisis Rival: ${selectedRivalName}`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
              <Calendar className="h-3 w-3 text-primary" />
              <span>{formattedMatchDate}</span>
              <span>• {match.competition || "Oficial"}</span>
            </p>
          </div>
        </div>

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

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-[11px] uppercase px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
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
              Confirms las marcas de inicio y fin de cada parte. Al avanzar, se descarta cualquier parón y descanso.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Edición & Cortes ── */}
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

            {/* Step 2 Timeline */}
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
                className="relative h-7 bg-slate-950 border border-white/10 rounded-lg cursor-pointer overflow-hidden group shadow-inner"
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

                {/* Step 2 Saved Clips High-Contrast Markers */}
                {activeVideo?.clips.map((clip) => {
                  const clipStartEff = getEffectiveMatchTime(clip.start);
                  const clipEndEff = getEffectiveMatchTime(clip.end);
                  const startPct = (clipStartEff / totalMatchSec) * 100;
                  const widthPct = Math.max(1.0, ((clipEndEff - clipStartEff) / totalMatchSec) * 100);
                  const isEditing = activeEditingClip?.id === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveEditingClip(clip);
                        handlePlayClipInStep2(clip);
                      }}
                      className={`absolute top-0 bottom-0 cursor-pointer transition-all z-25 ${
                        isEditing 
                          ? "bg-rose-500/90 border-2 border-rose-300 shadow-lg scale-y-110" 
                          : "bg-emerald-500/70 border-x-2 border-emerald-300 hover:bg-emerald-400"
                      }`}
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      title={`${clip.title} (${secondsToMMSS(clipStartEff)} - ${secondsToMMSS(clipEndEff)})`}
                    />
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
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Inicio (Tiempo Real)</label>
                    <input
                      type="text"
                      value={clipStart}
                      onChange={(e) => setClipStart(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Fin (Tiempo Real)</label>
                    <input
                      type="text"
                      value={clipEnd}
                      onChange={(e) => setClipEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white text-center font-mono font-bold"
                    />
                  </div>
                </div>

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

                {/* Filtered Squad Roster by Season */}
                {isOwnTeamMatch && (
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase block">Etiquetar Jugadores (Temp {matchSeason})</label>
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

            {/* Saved Clips List */}
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
                {activeVideo?.clips.map((clip) => {
                  const effStart = getEffectiveMatchTime(clip.start);
                  const effEnd = getEffectiveMatchTime(clip.end);
                  return (
                    <div key={clip.id} className="p-2.5 bg-slate-950 border border-white/5 hover:border-indigo-500/40 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-[130px]">{clip.title}</span>
                        <span className="bg-slate-900 border border-white/10 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                          {secondsToMMSS(effStart)} - {secondsToMMSS(effEnd)}
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
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Montaje Final & Generador MP4 con Preview Real y Overlays ── */}
      {wizardStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start animate-fade-in">
          {/* Main Top Display (Cover Preview OR Clip Video Player with TV Overlays) */}
          <div className="lg:col-span-2 space-y-3">
            <div 
              className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[380px] flex items-center justify-center"
              style={{
                backgroundColor: (showCoverForm || activePreviewItem?.type === "cover") ? (activePreviewItem?.bgColor || coverBgColor) : undefined,
                backgroundImage: (showCoverForm || activePreviewItem?.type === "cover") && (activePreviewItem?.bgImage || coverBgImage) ? `url(${activePreviewItem?.bgImage || coverBgImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {(showCoverForm || activePreviewItem?.type === "cover") ? (
                /* Full Main Display Cover Live Preview with Official Club Logo Badge */
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 animate-fade-in max-w-lg z-20" style={{ color: activePreviewItem?.textColor || coverTextColor }}>
                  {(activePreviewItem?.showBadge !== false || coverShowBadge) && (
                    <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/30 shadow-2xl backdrop-blur-md">
                      {match.home_team_logo ? (
                        <img src={match.home_team_logo} alt="Escudo Club" className="h-12 w-12 object-contain" />
                      ) : (
                        <ShieldCheck className="h-10 w-10 text-amber-400" />
                      )}
                    </div>
                  )}
                  <h1 className="text-xl font-black uppercase tracking-wider drop-shadow-md">
                    {activePreviewItem?.title || coverTitle || `${match.home_team} vs ${match.away_team}`}
                  </h1>
                  <p className="text-sm opacity-85 font-medium">
                    {activePreviewItem?.subtitle || coverSubtitle || "Análisis Táctico de Partido"}
                  </p>
                  <span className="text-[10px] uppercase font-bold tracking-widest bg-white/10 border border-white/20 px-3 py-1 rounded-full">
                    Previsualización de Carátula Inicial
                  </span>
                </div>
              ) : (
                <div className="relative w-full h-full">
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

                  {/* Overlays: Top Pro TV Broadcast Scoreboard Header */}
                  <div className="absolute top-4 left-4 z-20 flex flex-col gap-0.5 shadow-2xl pointer-events-none select-none">
                    <div className="bg-white text-slate-950 px-2 py-1 rounded-t-md font-black text-xs flex items-center justify-between gap-3 shadow border border-slate-300">
                      <span className="bg-slate-950 text-white font-mono font-black px-1.5 py-0.5 rounded text-[10px]">0</span>
                      <span className="tracking-wider uppercase font-black">{match.home_team?.substring(0, 4) || "SDA"}</span>
                      <span className="text-slate-400 font-bold text-[10px]">VS</span>
                      <span className="tracking-wider uppercase font-black">{match.away_team?.substring(0, 5) || "UDSMT"}</span>
                      <span className="bg-slate-950 text-white font-mono font-black px-1.5 py-0.5 rounded text-[10px]">0</span>
                    </div>
                    <div className="bg-white/90 text-indigo-900 px-2 py-0.5 rounded-b-md font-mono font-black text-[10px] text-center shadow border border-t-0 border-slate-300">
                      {secondsToMMSS(currentEffectiveSec)}
                    </div>
                  </div>

                  {/* Overlays: Bottom Left Match Date (Subtle Pill) */}
                  <div className="absolute bottom-4 left-4 z-20 bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-md text-slate-300 text-[10px] font-mono flex items-center gap-1.5 shadow-xl backdrop-blur-sm pointer-events-none">
                    <Calendar className="h-3 w-3 text-primary" />
                    <span>{formattedMatchDate}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 Timeline Rail (Sequence of Covers + Added Clips) */}
            <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-2 gap-2">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase text-white">Línea del Tiempo del Montaje Final ({montageItems.length} Elementos)</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCoverForm(!showCoverForm)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Layout className="h-3 w-3" />
                    <span>+ Crear Carátula</span>
                  </button>

                  <button
                    onClick={() => setShowPreExportModal(true)}
                    disabled={exportingMp4}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-lg flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                  >
                    <Video className="h-4 w-4" />
                    <span>Generar .MP4</span>
                  </button>
                </div>
              </div>

              {/* Cover Slide Options Form */}
              {showCoverForm && (
                <form onSubmit={handleAddCoverToMontage} className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/40 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Título principal..."
                      value={coverTitle}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      required
                      className="bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Subtítulo..."
                      value={coverSubtitle}
                      onChange={(e) => setCoverSubtitle(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        <option value="start">Al principio del vídeo</option>
                        <option value="end">Al final del vídeo</option>
                      </select>
                    </div>
                    <div className="pt-3">
                      <label className="bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold px-2 py-1 rounded text-[9px] border border-white/10 cursor-pointer block text-center">
                        <span>📷 Foto de Fondo</span>
                        <input type="file" accept="image/*" onChange={handleCoverBgUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
                  >
                    Confirmar e Insertar Carátula en el Montaje
                  </button>
                </form>
              )}

              {/* Interactive Timeline Track with Editable Cover Duration */}
              <div className="flex gap-2 overflow-x-auto p-2 bg-slate-950 rounded-xl border border-white/5 scrollbar-thin">
                {montageItems.length === 0 ? (
                  <div className="w-full text-center py-6 text-slate-500 italic text-xs">
                    La línea del tiempo está vacía. Añade carátulas o cortes desde la Librería de la derecha.
                  </div>
                ) : (
                  montageItems.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setActiveStep3PreviewIndex(idx)}
                      className={`shrink-0 w-48 p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        activeStep3PreviewIndex === idx
                          ? "bg-indigo-950 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg scale-102"
                          : "bg-slate-900 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="font-mono text-indigo-400 font-bold">#{idx + 1}</span>
                        <span className="uppercase font-extrabold text-slate-400">{item.type === "cover" ? "Carátula" : "Corte"}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>

                      {/* Editable Duration for Covers */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        {item.type === "cover" ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] text-slate-400">Duración:</span>
                            <select
                              value={item.duration || 4}
                              onChange={(e) => handleUpdateCoverDuration(item.id, Number(e.target.value))}
                              className="bg-slate-900 border border-white/10 text-emerald-400 font-bold text-[9px] rounded px-1 py-0.2"
                            >
                              {[2, 3, 4, 5, 6, 8, 10].map(dur => (
                                <option key={dur} value={dur}>{dur}s</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-mono">
                            {secondsToMMSS(getEffectiveMatchTime(item.start || 0))} - {secondsToMMSS(getEffectiveMatchTime(item.end || 0))}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoData(prev => ({
                              ...prev,
                              montages: (prev.montages || []).map(m =>
                                m.id === activeMontageId ? { ...m, items: m.items.filter(i => i.id !== item.id) } : m
                              )
                            }));
                            handleSave();
                          }}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Step 3 Clip Library Bank with Multi-filtering & Sorting */}
          <div className="space-y-3">
            <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <Archive className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-xs font-black uppercase text-white">Librería de Cortes Realizados</h3>
                </div>
                <span className="bg-indigo-600/30 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {filteredStep3Clips.length}
                </span>
              </div>

              {/* Multi-Filters & Sorting Controls */}
              <div className="space-y-2 bg-slate-950 p-2.5 rounded-xl border border-white/5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Acción</label>
                    <select
                      value={step3FilterCategory}
                      onChange={(e) => setStep3FilterCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white text-[10px] font-bold px-1.5 py-1 rounded"
                    >
                      <option value="Todos">Todas las Acciones</option>
                      {DEFAULT_ACTION_TYPES.map(a => (
                        <option key={a.name} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Descriptor</label>
                    <select
                      value={step3FilterDescriptor}
                      onChange={(e) => setStep3FilterDescriptor(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white text-[10px] font-bold px-1.5 py-1 rounded"
                    >
                      <option value="Todos">Todos Descriptores</option>
                      {DEFAULT_DESCRIPTORS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Ordenación</label>
                  <select
                    value={step3SortMode}
                    onChange={(e) => setStep3SortMode(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 text-indigo-300 text-[10px] font-bold px-1.5 py-1 rounded"
                  >
                    <option value="chrono">Cronológico (Minuto de Juego)</option>
                    <option value="category">Por Tipología (Categoría)</option>
                  </select>
                </div>
              </div>

              {/* Clip Bank List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredStep3Clips.map((clip) => {
                  const effStart = getEffectiveMatchTime(clip.start);
                  const effEnd = getEffectiveMatchTime(clip.end);
                  const isInMontage = montageItems.some(i => i.clipId === clip.id);

                  return (
                    <div key={clip.id} className="p-2.5 bg-slate-950 border border-white/5 hover:border-indigo-500/40 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-[130px]">{clip.title}</span>
                        <span className="bg-slate-900 border border-white/10 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                          {secondsToMMSS(effStart)} - {secondsToMMSS(effEnd)}
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

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-[9px] text-slate-400 font-bold">{clip.category}</span>
                        <button
                          type="button"
                          onClick={() => handleAddSingleClipToMontage(clip)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                            isInMontage 
                              ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30" 
                              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                          }`}
                        >
                          <Plus className="h-3 w-3" />
                          <span>{isInMontage ? "Añadido (+1)" : "Añadir a Montaje"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRE-EXPORT PREVIEW MODAL BEFORE DOWNLOADING MP4 ── */}
      {showPreExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmar Generación de Vídeo MP4</h3>
              </div>
              <button onClick={() => setShowPreExportModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Elementos a compilar:</span>
                <strong className="text-white">{montageItems.length} (Carátulas + Cortes)</strong>
              </div>
              <div className="flex justify-between">
                <span>Resolución Final:</span>
                <strong className="text-indigo-300">1080p Full HD (1920x1080)</strong>
              </div>
              <div className="flex justify-between">
                <span>Fecha del Partido:</span>
                <strong className="text-emerald-400 font-mono">{formattedMatchDate}</strong>
              </div>
              <div className="flex justify-between">
                <span>Audio Incluido:</span>
                <strong className={exportIncludeSound ? "text-emerald-400" : "text-rose-400"}>
                  {exportIncludeSound ? "Sí (Sonido ON)" : "No (Silenciado)"}
                </strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              El navegador renderizará el canvas en alta definición incluyendo las carátulas, marcador de TV y fecha. Al finalizar, la descarga se iniciará automáticamente.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreExportModal(false)}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs uppercase py-2.5 rounded-xl border border-white/10 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExportFinalVideo}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase py-2.5 rounded-xl shadow cursor-pointer text-center"
              >
                Confirmar y Descargar MP4
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
