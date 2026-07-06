"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer, type VideoPlayerRef } from "@/components/video/VideoPlayer";
import type { 
  SessionVideoData, 
  VideoItem, 
  VideoClip, 
  ClipPlayerStat, 
  VideoAnnotation, 
  VideoMontage 
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
  Search, 
  Sparkles, 
  Eye, 
  Volume2, 
  Download,
  Info
} from "lucide-react";

// List of all available video statistics we support
const STAT_TYPES = [
  { key: "completed_passes", label: "Pases Completados", icon: "⚽" },
  { key: "turnovers", label: "Pérdidas de Balón", icon: "⚠️" },
  { key: "danger_plays", label: "Jugadas de Peligro", icon: "🔥" },
  { key: "shots_on_target", label: "Disparos a Portería", icon: "🎯" },
  { key: "shots_off_target", label: "Disparos Fuera", icon: "🥅" },
  { key: "interventions_own_half", label: "Intervenciones Campo Propio", icon: "🛡️" },
  { key: "interventions_rival_half", label: "Intervenciones Campo Rival", icon: "⚔️" },
  { key: "dribbles_successful", label: "Regates Completados", icon: "⚡" }
];

const CATEGORIES = ["Gol", "Ocasión de gol", "Jugada relevante", "Penalti", "Expulsión"];

interface MatchVideoClientProps {
  match: any;
  players: any[]; // Squad players list
  allMatches: any[]; // List of other matches for rival analysis
}

// Convert seconds to MM:SS string
function secondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Convert MM:SS to number of seconds
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return Number(timeStr) || 0;
}

export function MatchVideoClient({ match, players, allMatches }: MatchVideoClientProps) {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerRef>(null);

  // Video data state
  const [videoData, setVideoData] = useState<SessionVideoData>({
    general_notes: "",
    videos: [],
    montages: []
  });

  const [activeType, setActiveType] = useState<"own" | "rival">("own");
  const activeVideo = videoData.videos.find((v) => v.type === activeType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link Video form
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");

  // Clip creation state
  const [clipTitle, setClipTitle] = useState("");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [clipComment, setClipComment] = useState("");
  const [clipCategory, setClipCategory] = useState("Jugada relevante");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [clipStats, setClipStats] = useState<ClipPlayerStat[]>([]);
  
  // Search filter for player tagging
  const [playerSearch, setPlayerSearch] = useState("");

  // Video duration for timeline markers
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sidebar Layout & Controls
  const [activeSidebarTab, setActiveSidebarTab] = useState<"clean" | "manual" | "montage">("manual");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [stepSize, setStepSize] = useState<number>(1.0);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  
  // Whiteboard Active state
  const [isBoardActive, setIsBoardActive] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<any>("pointer");
  const [drawColor, setDrawColor] = useState<string>("#ef4444");

  // Presentation Playlist States
  const [presenting, setPresenting] = useState<boolean>(false);
  const [currentPresentIndex, setCurrentPresentIndex] = useState<number>(0);
  const [presentingUrl, setPresentingUrl] = useState<string>("");
  const [activeMontageId, setActiveMontageId] = useState<string | null>(null);
  const [newMontageTitle, setNewMontageTitle] = useState("");

  // Quick Cut states
  const [isCutting, setIsCutting] = useState<boolean>(false);
  const [cutStart, setCutStart] = useState<number | null>(null);

  // Cleaning and halves states
  const [localHalves, setLocalHalves] = useState<[number, number][]>([]);
  const [detectingHalves, setDetectingHalves] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionLog, setDetectionLog] = useState("");

  // Filter clips by category tab
  const [filterCategory, setFilterCategory] = useState<string>("Todos");

  // Cross-match rival analysis selections
  const [selectedRivalMatchId, setSelectedRivalMatchId] = useState<string>("");
  const [rivalMatchClips, setRivalMatchClips] = useState<any[]>([]);

  // Load video analysis from API on mount
  useEffect(() => {
    fetch(`/api/scouting/matches/${match.id}/video`)
      .then((res) => res.json())
      .then((data: SessionVideoData) => {
        setVideoData(data || { general_notes: "", videos: [], montages: [] });
        setLoading(false);
      })
      .catch((err) => {
        setError("Error al cargar el análisis de vídeo.");
        setLoading(false);
      });
  }, [match.id]);

  // Sync halves on video select
  useEffect(() => {
    if (activeVideo) {
      if (activeVideo.halves && activeVideo.halves.length > 0) {
        setLocalHalves(activeVideo.halves);
        setActiveSidebarTab("manual");
      } else {
        setLocalHalves([]);
        setActiveSidebarTab("clean");
      }
    }
  }, [activeVideo]);

  // Auto-name video based on match teams
  useEffect(() => {
    const defaultTitle = `${match.home_team} vs ${match.away_team} - ${activeType === "own" ? "Nuestro Equipo" : "Rival"}`;
    setNewTitle(defaultTitle);
  }, [activeType, match]);

  // Load clips of the other match selected for rival analysis
  useEffect(() => {
    if (!selectedRivalMatchId) {
      setRivalMatchClips([]);
      return;
    }
    fetch(`/api/scouting/matches/${selectedRivalMatchId}/video`)
      .then(res => res.json())
      .then((data: SessionVideoData) => {
        const matchInfo = allMatches.find(m => m.id === selectedRivalMatchId);
        const name = matchInfo ? `${matchInfo.home_team} vs ${matchInfo.away_team}` : "Rival";
        const clips = data.videos?.flatMap(v => v.clips.map(c => ({ 
          ...c, 
          videoUrl: v.url,
          matchName: name,
          matchId: selectedRivalMatchId
        }))) || [];
        setRivalMatchClips(clips);
      })
      .catch(err => console.error("Error loading rival match clips:", err));
  }, [selectedRivalMatchId, allMatches]);

  // Montage playback tick: checks when to switch clip or finish presentation
  useEffect(() => {
    if (!presenting || !activeMontageId) return;
    const montage = videoData.montages?.find(m => m.id === activeMontageId);
    if (!montage) return;
    const item = montage.items[currentPresentIndex];

    if (item && item.type === "clip") {
      const clipEndSec = item.end || 0;
      if (currentTime >= clipEndSec) {
        // Go to next item
        const nextIndex = currentPresentIndex + 1;
        if (nextIndex < montage.items.length) {
          setCurrentPresentIndex(nextIndex);
        } else {
          setPresenting(false);
        }
      }
    }
  }, [presenting, activeMontageId, currentPresentIndex, currentTime, videoData.montages]);

  // Montage active item URL and Start Seek sync
  useEffect(() => {
    if (!presenting || !activeMontageId) return;
    const montage = videoData.montages?.find(m => m.id === activeMontageId);
    if (!montage) return;
    const item = montage.items[currentPresentIndex];

    if (item && item.type === "clip") {
      // Find the URL (could be local or cross-match)
      const url = item.videoUrl || activeVideo?.url || "";
      setPresentingUrl(url);

      // Seek to start once the URL changes or stays same
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(item.start || 0, true);
        }
      }, 500);
    }
  }, [presenting, activeMontageId, currentPresentIndex, activeVideo]);

  // Save changes
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
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al guardar el análisis.");
    } finally {
      setSaving(false);
    }
  };

  // Video Linking
  const handleLinkVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    const videoId = `vid-${Date.now()}`;
    const newVideoItem: VideoItem = {
      id: videoId,
      type: activeType,
      url: newUrl,
      title: newTitle || `${match.home_team} vs ${match.away_team}`,
      clips: []
    };

    setVideoData((prev) => ({
      ...prev,
      videos: [...prev.videos, newVideoItem]
    }));

    setNewUrl("");
  };

  const handleUnlinkVideo = (videoId: string) => {
    if (confirm("¿Estás seguro de que quieres desvincular este vídeo y borrar todos sus clips asociados?")) {
      setVideoData((prev) => ({
        ...prev,
        videos: prev.videos.filter((v) => v.id !== videoId)
      }));
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localBlobUrl = URL.createObjectURL(file);
    const videoId = `vid-${Date.now()}`;
    const newVideoItem = {
      id: videoId,
      type: activeType,
      url: localBlobUrl,
      title: file.name,
      is_local: true,
      clips: []
    };

    setVideoData((prev) => ({
      ...prev,
      videos: [...prev.videos, newVideoItem]
    }));
  };

  const handleRelinkLocalFile = (e: React.ChangeEvent<HTMLInputElement>, videoId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localBlobUrl = URL.createObjectURL(file);
    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === videoId ? { ...v, url: localBlobUrl, title: file.name } : v
      )
    }));
  };

  // Capture current playhead timestamp
  const handleCaptureTime = (target: "start" | "end") => {
    if (playerRef.current) {
      const time = playerRef.current.getCurrentTime() || currentTime;
      const formatted = secondsToMMSS(time);
      if (target === "start") setClipStart(formatted);
      else setClipEnd(formatted);
    }
  };

  // Tagging players in clip form
  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) => {
      const exists = prev.includes(playerId);
      if (exists) {
        setClipStats((prevStats) => prevStats.filter((s) => s.player_id !== playerId));
        return prev.filter((id) => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const handleToggleStat = (playerId: string, statType: string, increment: number) => {
    setClipStats((prev) => {
      const existing = prev.find((s) => s.player_id === playerId && s.stat_type === statType);
      if (existing) {
        const newValue = existing.value + increment;
        if (newValue <= 0) {
          return prev.filter((s) => !(s.player_id === playerId && s.stat_type === statType));
        }
        return prev.map((s) =>
          s.player_id === playerId && s.stat_type === statType ? { ...s, value: newValue } : s
        );
      } else if (increment > 0) {
        return [...prev, { player_id: playerId, stat_type: statType, value: increment }];
      }
      return prev;
    });
  };

  // Add manually created clip
  const handleAddClip = () => {
    if (!clipTitle) {
      alert("Por favor introduce un título para el recorte.");
      return;
    }
    const startSec = parseTimeToSeconds(clipStart);
    const endSec = parseTimeToSeconds(clipEnd);

    if (startSec > endSec) {
      alert("El tiempo de inicio no puede ser mayor que el tiempo de fin.");
      return;
    }

    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      title: clipTitle,
      start: startSec,
      end: endSec,
      comment: clipComment,
      category: clipCategory,
      tagged_players: selectedPlayers,
      stats: clipStats,
      annotations: []
    };

    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.type === activeType
          ? { ...v, clips: [...v.clips, newClip].sort((a, b) => a.start - b.start) }
          : v
      )
    }));

    // Reset clip form
    setClipTitle("");
    setClipStart("");
    setClipEnd("");
    setClipComment("");
    setSelectedPlayers([]);
    setClipStats([]);
  };

  // Delete clip
  const handleDeleteClip = (clipId: string) => {
    if (confirm("¿Seguro que quieres borrar este clip?")) {
      setVideoData((prev) => ({
        ...prev,
        videos: prev.videos.map((v) =>
          v.type === activeType
            ? { ...v, clips: v.clips.filter((c) => c.id !== clipId) }
            : v
        )
      }));
    }
  };

  // Quick Cut
  const handleStartCut = () => {
    setIsCutting(true);
    setCutStart(currentTime);
  };

  const handleStopCut = () => {
    if (cutStart === null) return;
    setIsCutting(false);

    const title = prompt("Introduce un título para el clip rápido:", `Recorte a las ${secondsToMMSS(cutStart)}`);
    if (!title) return;

    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      title,
      start: Math.max(0, cutStart - 0.5),
      end: currentTime,
      comment: "",
      category: "Jugada relevante",
      tagged_players: [],
      stats: [],
      annotations: []
    };

    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.type === activeType
          ? { ...v, clips: [...v.clips, newClip].sort((a, b) => a.start - b.start) }
          : v
      )
    }));
    setCutStart(null);
  };

  const handleRetroactiveCut = (seconds: number) => {
    const start = Math.max(0, currentTime - seconds);
    const title = prompt("Introduce un título para el clip retrospectivo:", `Recorte rápido -${seconds}s`);
    if (!title) return;

    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      title,
      start,
      end: currentTime,
      comment: "",
      category: "Jugada relevante",
      tagged_players: [],
      stats: [],
      annotations: []
    };

    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.type === activeType
          ? { ...v, clips: [...v.clips, newClip].sort((a, b) => a.start - b.start) }
          : v
      )
    }));
  };

  // AI-simulate halves detection
  const handleDetectHalves = () => {
    setDetectingHalves(true);
    setDetectionProgress(10);
    setDetectionLog("Analizando densidad de metraje de vídeo...");

    const intervals = [
      { p: 35, log: "Escaneando densidad de jugadores en campo..." },
      { p: 70, log: "Detectando cortes y tiempos muertos..." },
      { p: 100, log: "Se han identificado las dos mitades del partido." }
    ];

    intervals.forEach((step, idx) => {
      setTimeout(() => {
        setDetectionProgress(step.p);
        setDetectionLog(step.log);
        if (step.p === 100) {
          setDetectingHalves(false);
          // Set simulated halves: Part 1 is 0:10 to 45:10, Part 2 is 55:00 to 100:00
          const duration = videoDuration || 6000;
          const half1End = Math.min(2700, duration * 0.45);
          const half2Start = Math.min(3300, duration * 0.55);
          setLocalHalves([
            [10, half1End],
            [half2Start, duration - 10]
          ]);
        }
      }, (idx + 1) * 1200);
    });
  };

  const handleSaveHalves = () => {
    if (!activeVideo) return;
    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === activeVideo.id ? { ...v, halves: localHalves, isFinalized: true } : v
      )
    }));
    setActiveSidebarTab("manual");
  };

  // Montages
  const handleCreateMontage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMontageTitle) return;

    const newM: VideoMontage = {
      id: `montage-${Date.now()}`,
      title: newMontageTitle,
      items: [],
      createdAt: new Date().toISOString()
    };

    setVideoData((prev) => ({
      ...prev,
      montages: [...(prev.montages || []), newM]
    }));
    setActiveMontageId(newM.id);
    setNewMontageTitle("");
  };

  const handleAddClipToMontage = (clip: VideoClip, isCrossMatch: boolean = false) => {
    if (!activeMontageId) return;
    const url = isCrossMatch ? clip.videoUrl : (activeVideo?.url || "");
    const name = isCrossMatch ? (clip as any).matchName : `${match.home_team} vs ${match.away_team}`;

    const newItem = {
      id: `m-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type: "clip" as const,
      clipId: clip.id,
      title: `${clip.title} (de ${name})`,
      videoUrl: url,
      start: clip.start,
      end: clip.end
    };

    setVideoData((prev) => ({
      ...prev,
      montages: (prev.montages || []).map((m) =>
        m.id === activeMontageId ? { ...m, items: [...m.items, newItem] } : m
      )
    }));
  };

  const handleRemoveMontageItem = (montageId: string, itemId: string) => {
    setVideoData((prev) => ({
      ...prev,
      montages: (prev.montages || []).map((m) =>
        m.id === montageId ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m
      )
    }));
  };

  const handleDeleteMontage = (montageId: string) => {
    if (confirm("¿Estás seguro de que quieres borrar este montaje táctico?")) {
      setVideoData((prev) => ({
        ...prev,
        montages: (prev.montages || []).filter((m) => m.id !== montageId)
      }));
      if (activeMontageId === montageId) setActiveMontageId(null);
    }
  };

  // Timeline seek trigger
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTime = pct * videoDuration;
    if (playerRef.current) {
      playerRef.current.seekTo(seekTime);
      setCurrentTime(seekTime);
    }
  };

  // Category filter list
  const filteredClips = activeVideo?.clips.filter((clip) => {
    if (filterCategory === "Todos") return true;
    return clip.category === filterCategory;
  }) || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider">Cargando herramienta de videoanálisis...</span>
      </div>
    );
  }

  const activeVideoUrl = presenting ? presentingUrl : (activeVideo?.url || "");

  if (!activeVideo) {
    return (
      <div className="space-y-6">
        {/* Toggle between Own vs Rival video slots */}
        <div className="flex gap-2 border-b border-white/5 pb-0.5">
          <button
            onClick={() => setActiveType("own")}
            className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
              activeType === "own" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Vídeo de Partido Propio
            {activeType === "own" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveType("rival")}
            className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider relative transition-colors cursor-pointer ${
              activeType === "rival" ? "text-primary font-extrabold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Vídeo de Análisis de Rival
            {activeType === "rival" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-8 shadow-2xl space-y-6 relative overflow-hidden max-w-4xl mx-auto mt-4">
          <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
          
          <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 text-3xl shadow-inner">
            🎬
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-base font-extrabold text-white uppercase tracking-wider">Vinculación de Vídeo Requerida</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              No hay ningún archivo de vídeo vinculado para el análisis de este partido (tipo: <span className="text-primary font-bold">{activeType === "own" ? "Partido Propio" : "Análisis de Rival"}</span>). Selecciona una de las siguientes opciones para empezar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-2xl mx-auto">
            {/* Option 1: Local File Selection */}
            <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between items-center text-center space-y-4 hover:border-white/10 transition-all bg-white/2">
              <div className="space-y-1.5 flex flex-col items-center">
                <span className="text-2xl">💻</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Archivo de Vídeo Local</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Carga y analiza un archivo de vídeo (.mp4, .mov, etc.) guardado directamente en tu ordenador.
                </p>
              </div>
              <div className="w-full">
                <label className="w-full bg-slate-900 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white font-bold text-xs uppercase px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-inner">
                  <span>Seleccionar Archivo Local</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleLocalFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Option 2: Web Link / Streaming URL */}
            <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between items-center text-center space-y-4 hover:border-white/10 transition-all bg-white/2">
              <div className="space-y-1.5 flex flex-col items-center">
                <span className="text-2xl">🌐</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vídeo en la Web (Streaming)</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Vincula una dirección web, vídeo de YouTube, Vimeo, o enlace MP4 directo.
                </p>
              </div>
              <form onSubmit={handleLinkVideo} className="w-full space-y-2">
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-primary text-white shadow-inner"
                />
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-slate-950 font-black text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer shadow-lg"
                >
                  Vincular Enlace
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save panel / alerts */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 border border-white/5 p-4 rounded-3xl backdrop-blur shadow-xl">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-slate-400">
            Vincula un vídeo y define recortes tácticos. Los datos se guardan en el servidor local.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {error && (
            <span className="text-[10px] font-bold text-rose-450 mr-2 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
              {error}
            </span>
          )}
          {saveSuccess && (
            <span className="text-[10px] font-extrabold text-emerald-400 mr-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Check className="h-3 w-3" />
              <span>Análisis Guardado</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover disabled:opacity-40 text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg transition-all"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? "Guardando..." : "Guardar Análisis"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Player & Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Video Box */}
          <div className="relative bg-slate-950/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-center items-center p-2 group min-h-[360px]">
            {activeVideo ? (
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
                annotations={
                  presenting 
                    ? (videoData.montages?.find(m => m.id === activeMontageId)?.items[currentPresentIndex] as any)?.annotations || []
                    : activeVideo.clips.flatMap(c => 
                        currentTime >= c.start && currentTime <= c.end ? (c.annotations || []) : []
                      )
                }
                onAnnotationsChange={(anns) => {
                  // Find the active clip and update its annotations
                  const activeClip = activeVideo.clips.find(c => currentTime >= c.start && currentTime <= c.end);
                  if (activeClip) {
                    setVideoData(prev => ({
                      ...prev,
                      videos: prev.videos.map(v => 
                        v.id === activeVideo.id 
                          ? {
                              ...v,
                              clips: v.clips.map(c => c.id === activeClip.id ? { ...c, annotations: anns } : c)
                            }
                          : v
                      )
                    }));
                  }
                }}
                isCutting={isCutting}
                cutStart={cutStart}
                onStartCut={handleStartCut}
                onStopCut={handleStopCut}
                onRetroactiveCut={handleRetroactiveCut}
              />
            ) : (
              /* Link video placeholder */
              <div className="w-full py-16 px-6 text-center space-y-5">
                <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-primary text-2xl shadow-inner">
                  🎬
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Vinculación de Vídeo de Partido</h3>
                  <p className="text-xs text-slate-400">
                    No hay un archivo de vídeo vinculado para este análisis. Introduce una URL pública (como YouTube, Vimeo o enlace de descarga MP4) para empezar.
                  </p>
                </div>
                <form onSubmit={handleLinkVideo} className="max-w-lg mx-auto flex gap-2">
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-primary text-white"
                  />
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl shrink-0 transition-colors"
                  >
                    Vincular
                  </button>
                </form>
              </div>
            )}

            {/* Toggle Whiteboard Button */}
            {activeVideo && (
              <button
                onClick={() => setIsBoardActive(!isBoardActive)}
                className={`absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-lg ${
                  isBoardActive 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-slate-955/85 border-white/10 text-slate-350 hover:bg-slate-900"
                }`}
              >
                <span>✏️</span>
                <span>{isBoardActive ? "Cerrar Whiteboard" : "Dibujar Pizarra"}</span>
              </button>
            )}
          </div>

          {/* Timeline Bar */}
          {activeVideo && videoDuration > 0 && (
            <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-4 space-y-2.5">
              <div 
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-5 bg-slate-950 border border-white/10 rounded-lg cursor-pointer overflow-hidden select-none shadow-inner"
              >
                {/* Clean halves background marks */}
                {localHalves.map((half, idx) => {
                  const startPct = (half[0] / videoDuration) * 100;
                  const widthPct = ((half[1] - half[0]) / videoDuration) * 100;
                  return (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 bg-indigo-500/10 border-x border-indigo-500/20"
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    />
                  );
                })}

                {/* Clips highlights */}
                {activeVideo.clips.map((clip) => {
                  const startPct = (clip.start / videoDuration) * 100;
                  const widthPct = ((clip.end - clip.start) / videoDuration) * 100;
                  return (
                    <div
                      key={clip.id}
                      className="absolute top-0 bottom-0 bg-emerald-500/20 border-x border-emerald-500/30"
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      title={clip.title}
                    />
                  );
                })}

                {/* Playhead bar */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none"
                  style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                />
              </div>

              {/* Controls and navigation */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>{secondsToMMSS(currentTime)}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => playerRef.current?.stepBackward(30)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
                  >
                    -1s
                  </button>
                  <button 
                    onClick={() => playerRef.current?.togglePlay()}
                    className="px-3 py-0.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded font-black text-primary uppercase"
                  >
                    Play/Pause
                  </button>
                  <button 
                    onClick={() => playerRef.current?.stepForward(30)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
                  >
                    +1s
                  </button>
                </div>
                <span>{secondsToMMSS(videoDuration)}</span>
              </div>
            </div>
          )}
        </div>

      {/* RIGHT COLUMN: Sidebar Suite */}
      <div className="space-y-6">
        {/* Active video metadata card */}
        {activeVideo && (
          <div className="flex flex-col gap-2">
            <div className="glass rounded-3xl border border-white/10 p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📹</span>
                <div>
                  <h4 className="text-xs font-black text-white truncate max-w-[160px]">{activeVideo.title}</h4>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{activeVideo.clips.length} clips grabados</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {activeVideo.url.startsWith("blob:") && (
                  <label className="h-8 w-8 hover:bg-indigo-550/10 border border-transparent hover:border-indigo-500/20 text-slate-550 hover:text-indigo-400 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Re-vincular archivo local">
                    <Download className="h-4 w-4 rotate-180" />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleRelinkLocalFile(e, activeVideo.id)}
                      className="hidden"
                    />
                  </label>
                )}
                <button
                  onClick={() => handleUnlinkVideo(activeVideo.id)}
                  className="h-8 w-8 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-550 hover:text-rose-400 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                  title="Desvincular vídeo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {activeVideo.url.startsWith("blob:") && (
              <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 px-3 py-2 text-[10px] text-indigo-300 leading-normal flex items-start gap-2">
                <span>💡</span>
                <span>Vídeo local vinculado temporalmente. Si recargas la página y no reproduce, usa el botón de flecha arriba para re-vincular el archivo.</span>
              </div>
            )}
          </div>
        )}

          {/* Navigation Tab rail */}
          <div className="flex bg-slate-900/60 border border-white/5 p-1.5 rounded-2xl gap-1">
            {activeVideo && !activeVideo.isFinalized && (
              <button
                onClick={() => setActiveSidebarTab("clean")}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeSidebarTab === "clean" ? "bg-primary text-slate-950 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Limpieza</span>
              </button>
            )}
            <button
              onClick={() => setActiveSidebarTab("manual")}
              className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeSidebarTab === "manual" ? "bg-primary text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>Cortes</span>
            </button>
            <button
              onClick={() => setActiveSidebarTab("montage")}
              className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeSidebarTab === "montage" ? "bg-primary text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Montaje</span>
            </button>
          </div>

          {/* TAB CONTENT: Limpieza */}
          {activeSidebarTab === "clean" && activeVideo && (
            <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Limpieza de Vídeo</h3>
              
              <div className="space-y-3.5">
                <div className="bg-white/2 border border-white/5 rounded-2xl p-4 space-y-3 text-xs text-slate-400">
                  <p>
                    Usa esta sección para aislar las mitades jugadas del partido del resto de metraje (calentamiento, descanso, etc.).
                  </p>
                  <button
                    onClick={handleDetectHalves}
                    disabled={detectingHalves}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow disabled:opacity-40 transition-colors"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>{detectingHalves ? "Escaneando..." : "Detectar Mitades IA"}</span>
                  </button>
                  {detectingHalves && (
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-primary" style={{ width: `${detectionProgress}%` }} />
                    </div>
                  )}
                  {detectionLog && <span className="text-[9px] text-indigo-400 font-semibold">{detectionLog}</span>}
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-350">
                    <span>Primera Mitad (Minutos):</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="00:00"
                      value={localHalves[0] ? secondsToMMSS(localHalves[0][0]) : ""}
                      onChange={(e) => {
                        const sec = parseTimeToSeconds(e.target.value);
                        setLocalHalves(prev => {
                          const next = [...prev];
                          if (!next[0]) next[0] = [0, 0];
                          next[0][0] = sec;
                          return next as any;
                        });
                      }}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <input
                      type="text"
                      placeholder="45:00"
                      value={localHalves[0] ? secondsToMMSS(localHalves[0][1]) : ""}
                      onChange={(e) => {
                        const sec = parseTimeToSeconds(e.target.value);
                        setLocalHalves(prev => {
                          const next = [...prev];
                          if (!next[0]) next[0] = [0, 0];
                          next[0][1] = sec;
                          return next as any;
                        });
                      }}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-350 pt-2">
                    <span>Segunda Mitad (Minutos):</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="45:00"
                      value={localHalves[1] ? secondsToMMSS(localHalves[1][0]) : ""}
                      onChange={(e) => {
                        const sec = parseTimeToSeconds(e.target.value);
                        setLocalHalves(prev => {
                          const next = [...prev];
                          if (!next[1]) next[1] = [0, 0];
                          next[1][0] = sec;
                          return next as any;
                        });
                      }}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <input
                      type="text"
                      placeholder="90:00"
                      value={localHalves[1] ? secondsToMMSS(localHalves[1][1]) : ""}
                      onChange={(e) => {
                        const sec = parseTimeToSeconds(e.target.value);
                        setLocalHalves(prev => {
                          const next = [...prev];
                          if (!next[1]) next[1] = [0, 0];
                          next[1][1] = sec;
                          return next as any;
                        });
                      }}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveHalves}
                  className="w-full py-2 bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase rounded-xl transition-colors shadow"
                >
                  Confirmar Ajustes y Finalizar
                </button>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Cortes (Clips List) */}
          {activeSidebarTab === "manual" && activeVideo && (
            <div className="space-y-4">
              {/* Add Clip Form */}
              <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Nuevo Corte Manual</h3>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Título del recorte"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-white"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Inicio (MM:SS)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="00:00"
                          value={clipStart}
                          onChange={(e) => setClipStart(e.target.value)}
                          className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-white font-mono text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleCaptureTime("start")}
                          className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-400 rounded-xl px-2.5 text-xs font-bold"
                          title="Capturar segundo actual"
                        >
                          ⏱
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fin (MM:SS)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="00:00"
                          value={clipEnd}
                          onChange={(e) => setClipEnd(e.target.value)}
                          className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary text-white font-mono text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleCaptureTime("end")}
                          className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-400 rounded-xl px-2.5 text-xs font-bold"
                          title="Capturar segundo actual"
                        >
                          ⏱
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tagged players in clip */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-550 uppercase tracking-wider">Etiquetar Jugadores</label>
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 h-3 w-3 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar jugador..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-1.5 border border-white/5 rounded-xl p-2 bg-slate-950/20">
                      {players
                        .filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase()))
                        .map((p) => {
                          const isSelected = selectedPlayers.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleTogglePlayer(p.id)}
                              className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors ${
                                isSelected 
                                  ? "bg-primary border-primary text-slate-950" 
                                  : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                              }`}
                            >
                              {p.first_name} {p.last_name.substring(0, 1)}.
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Stats tagger on selected players */}
                  {selectedPlayers.length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-2.5">
                      <label className="text-[8px] font-bold text-slate-550 uppercase tracking-wider block">Registrar Estadísticas Rápidas</label>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {players
                          .filter(p => selectedPlayers.includes(p.id))
                          .map((p) => (
                            <div key={p.id} className="flex flex-col gap-1 p-2 bg-white/2 rounded-xl border border-white/5 text-[9px]">
                              <span className="font-bold text-white leading-none">{p.first_name} {p.last_name}</span>
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {STAT_TYPES.map((st) => {
                                  const statVal = clipStats.find(s => s.player_id === p.id && s.stat_type === st.key)?.value || 0;
                                  return (
                                    <div key={st.key} className="flex items-center justify-between gap-1 p-1 bg-slate-950/40 border border-white/5 rounded">
                                      <span className="truncate text-slate-400" title={st.label}>{st.icon} {st.label}</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleStat(p.id, st.key, -1)}
                                          className="w-4 h-4 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center font-bold text-[8px]"
                                        >
                                          -
                                        </button>
                                        <span className="font-bold text-white font-mono w-3 text-center">{statVal}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleStat(p.id, st.key, 1)}
                                          className="w-4 h-4 bg-indigo-650 hover:bg-indigo-500 text-white rounded flex items-center justify-center font-bold text-[8px]"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Comentarios adicionales"
                    value={clipComment}
                    onChange={(e) => setClipComment(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-white"
                  />

                  <div className="flex gap-2">
                    <select
                      value={clipCategory}
                      onChange={(e) => setClipCategory(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none text-white cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddClip}
                      className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-5 py-2 rounded-xl transition-colors shrink-0"
                    >
                      Añadir Corte
                    </button>
                  </div>
                </div>
              </div>

              {/* List of Clips */}
              <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Cortes de Partido</h3>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-slate-900 border border-white/5 rounded-lg px-2 py-0.5 text-[9px] text-slate-350 focus:outline-none cursor-pointer"
                  >
                    <option value="Todos">Todos los cortes</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {filteredClips.length === 0 ? (
                    <div className="text-center py-8 text-slate-550 italic text-[10px]">
                      No hay cortes registrados en esta categoría.
                    </div>
                  ) : (
                    filteredClips.map((clip) => (
                      <div
                        key={clip.id}
                        onClick={() => playerRef.current?.seekTo(clip.start, true)}
                        className="group flex items-center justify-between p-3 bg-white/2 hover:bg-white/4 border border-white/5 rounded-2xl cursor-pointer transition-all"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-950 border border-white/10 text-primary font-mono text-[9px] px-1.5 py-0.5 rounded">
                              {secondsToMMSS(clip.start)} - {secondsToMMSS(clip.end)}
                            </span>
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                              {clip.category || "Jugada"}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-white truncate pt-1">{clip.title}</span>
                          {clip.comment && <span className="text-[9px] text-slate-500 truncate leading-relaxed">{clip.comment}</span>}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddClipToMontage(clip);
                            }}
                            className="h-7 px-2 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-550/10 text-slate-400 hover:text-indigo-400 rounded-lg flex items-center justify-center gap-1 transition-all"
                            title="Añadir a montaje activo"
                          >
                            <Plus className="h-3 w-3" />
                            <span className="text-[9px] font-bold">Montar</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClip(clip.id);
                            }}
                            className="h-7 w-7 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-500 hover:text-rose-450 rounded-lg flex items-center justify-center transition-all"
                            title="Borrar clip"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Montajes */}
          {activeSidebarTab === "montage" && (
            <div className="space-y-4">
              {/* Create Montage form */}
              <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Crear Montaje de Videoanálisis</h3>
                
                <form onSubmit={handleCreateMontage} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Título del montaje (ej: ABP Rival)"
                    value={newMontageTitle}
                    onChange={(e) => setNewMontageTitle(e.target.value)}
                    required
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-white"
                  />
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Crear</span>
                  </button>
                </form>
              </div>

              {/* Rival analysis: fetch clips from OTHER matches */}
              {activeMontageId && (
                <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 bg-indigo-950/10 border-indigo-500/20">
                  <div className="flex items-center gap-2 border-b border-indigo-500/20 pb-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                      Cortes de Otros Partidos (Rival Analysis)
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-slate-350">
                    <p className="text-[10px] text-slate-455">
                      Combina cortes de múltiples partidos para analizar el patrón de juego de un rival.
                    </p>
                    
                    <select
                      value={selectedRivalMatchId}
                      onChange={(e) => setSelectedRivalMatchId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Seleccionar otro partido --</option>
                      {allMatches
                        .filter(m => m.id !== match.id)
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            J.{m.matchday} • {m.home_team} vs {m.away_team}
                          </option>
                        ))}
                    </select>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 pt-1">
                      {selectedRivalMatchId && rivalMatchClips.length === 0 && (
                        <span className="text-[9px] text-slate-550 italic block text-center py-4">
                          No hay vídeo ni cortes guardados para este partido.
                        </span>
                      )}
                      {rivalMatchClips.map((clip) => (
                        <div
                          key={clip.id}
                          className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-xl text-[9px]"
                        >
                          <div className="min-w-0 flex-1 pr-2 flex flex-col">
                            <span className="font-bold text-white truncate">{clip.title}</span>
                            <span className="text-[8px] text-slate-500">{clip.matchName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddClipToMontage(clip, true)}
                            className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded text-[8px] flex items-center gap-1 transition-colors"
                          >
                            <Plus className="h-2 w-2" />
                            <span>Añadir</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* List of Montages */}
              {videoData.montages && videoData.montages.length > 0 && (
                <div className="glass rounded-3xl border border-white/10 p-5 shadow-xl space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Montajes Registrados</h3>

                  <div className="space-y-3.5">
                    {videoData.montages.map((mon) => {
                      const isActive = mon.id === activeMontageId;
                      return (
                        <div
                          key={mon.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isActive 
                              ? "bg-primary/5 border-primary" 
                              : "bg-white/2 border-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                setActiveMontageId(mon.id);
                                setPresenting(false);
                              }}
                              className="font-bold text-xs text-white hover:text-primary transition-colors text-left flex-1"
                            >
                              {mon.title}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              {mon.items.length > 0 && (
                                <button
                                  onClick={() => {
                                    setActiveMontageId(mon.id);
                                    setCurrentPresentIndex(0);
                                    setPresenting(true);
                                  }}
                                  className={`h-7 px-2.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all ${
                                    isActive && presenting
                                      ? "bg-rose-600 text-white animate-pulse"
                                      : "bg-indigo-950 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-900"
                                  }`}
                                >
                                  {isActive && presenting ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                  <span>{isActive && presenting ? "Parar" : "Play"}</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMontage(mon.id)}
                                className="h-7 w-7 hover:bg-rose-500/10 text-slate-500 hover:text-rose-450 rounded-lg flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Montage playlist items */}
                          <div className="mt-2.5 space-y-1.5 max-h-48 overflow-y-auto pl-2 border-l border-white/10">
                            {mon.items.map((item, idx) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-1.5 bg-[#0f1424]/40 rounded border border-white/[0.03] text-[9.5px]"
                              >
                                <span className="truncate text-slate-300 flex-1 mr-2 font-bold">
                                  {idx + 1}. {item.title || "Clip sin título"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMontageItem(mon.id, item.id)}
                                  className="text-slate-500 hover:text-rose-455 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
