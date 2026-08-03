"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer, type VideoPlayerRef } from "@/components/video/VideoPlayer";
import { saveLocalVideoToIDB, getLocalVideoFromIDB } from "@/lib/clublab/idbVideo";
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
  Search, 
  Sparkles, 
  Eye, 
  Volume2, 
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
  UploadCloud
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

const CATEGORIES = ["Gol", "Ocasión de gol", "Jugada relevante", "Penalti", "Expulsión", "Ataque", "Defensa", "Balón Parado", "Transición"];

const TACTICAL_CONCEPTS = [
  "Presión Tras Pérdida",
  "Salida de Balón",
  "Bloque Alto",
  "Bloque Bajo",
  "Repliegue",
  "Contraataque",
  "Centro al Área",
  "Córner a Favor",
  "Córner en Contra",
  "Falta Directa"
];

interface MatchVideoClientProps {
  match: any;
  players: any[]; // Squad players list
  allMatches: any[]; // List of other matches for rival analysis
  matchEvents?: any[]; // Events from stat_events (acta del partido)
}

// Convert seconds to MM:SS or HH:MM:SS string
function secondsToMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Convert MM:SS or HH:MM:SS to number of seconds
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return Number(timeStr) || 0;
}

export function MatchVideoClient({ match, players, allMatches, matchEvents = [] }: MatchVideoClientProps) {
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

  const [activeType, setActiveType] = useState<"own" | "rival">("own");
  const activeVideo = videoData.videos.find((v) => v.type === activeType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link Video form & Drag-and-Drop state
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Paso 1: Partes semiautomáticas (seconds)
  const [t1Start, setT1Start] = useState<number>(0);
  const [t1End, setT1End] = useState<number>(2700); // +45 min
  const [t2Start, setT2Start] = useState<number>(3600); // +15 min rest
  const [t2End, setT2End] = useState<number>(6300); // +45 min

  // Clip creation state (Paso 2)
  const [clipTitle, setClipTitle] = useState("");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [clipComment, setClipComment] = useState("");
  const [clipCategory, setClipCategory] = useState("Jugada relevante");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [clipStats, setClipStats] = useState<ClipPlayerStat[]>([]);
  const [selectedTacticalConcepts, setSelectedTacticalConcepts] = useState<string[]>([]);
  
  // Search filter for player tagging
  const [playerSearch, setPlayerSearch] = useState("");

  // Video duration for timeline markers
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [largeStepSize, setLargeStepSize] = useState<number>(10); // 5s, 10s, 15s, 30s
  const [step1SubStep, setStep1SubStep] = useState<"t1_start" | "t1_end" | "t2_start" | "t2_end">("t1_start");
  const timelineRef = useRef<HTMLDivElement>(null);

  // Whiteboard Active state & Controls
  const [isBoardActive, setIsBoardActive] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<any>("pointer");
  const [drawColor, setDrawColor] = useState<string>("#ef4444");
  const [freezeSeconds, setFreezeSeconds] = useState<number>(3);

  // Presentation Playlist States (Paso 3)
  const [presenting, setPresenting] = useState<boolean>(false);
  const [currentPresentIndex, setCurrentPresentIndex] = useState<number>(0);
  const [presentingUrl, setPresentingUrl] = useState<string>("");
  const [activeMontageId, setActiveMontageId] = useState<string | null>(null);
  const [newMontageTitle, setNewMontageTitle] = useState("");

  // Cover creation form state
  const [coverTitle, setCoverTitle] = useState("");
  const [coverSubtitle, setCoverSubtitle] = useState("");
  const [coverBgColor, setCoverBgColor] = useState("#0f172a");
  const [coverDuration, setCoverDuration] = useState(4);
  const [showCoverForm, setShowCoverForm] = useState(false);

  // Quick Cut states
  const [isCutting, setIsCutting] = useState<boolean>(false);
  const [cutStart, setCutStart] = useState<number | null>(null);

  // Filter clips by category tab
  const [filterCategory, setFilterCategory] = useState<string>("Todos");

  // Cross-match rival analysis selections
  const [selectedRivalMatchId, setSelectedRivalMatchId] = useState<string>("");
  const [rivalMatchClips, setRivalMatchClips] = useState<any[]>([]);

  // Ref to ensure initial step determination runs only ONCE on initial page load
  const isInitialLoadedRef = useRef(false);

  // Load video analysis from API on mount + restore local video from IndexedDB if present
  useEffect(() => {
    fetch(`/api/scouting/matches/${match.id}/video`)
      .then((res) => res.json())
      .then(async (data: SessionVideoData) => {
        let loadedData = data || { general_notes: "", videos: [], montages: [], cut_bank: [] };

        // Restore local video files from IndexedDB for own and rival types if present
        for (const type of ["own", "rival"]) {
          const localFile = await getLocalVideoFromIDB(match.id, type);
          if (localFile) {
            const restoredUrl = URL.createObjectURL(localFile);
            const existingIndex = loadedData.videos.findIndex(v => v.type === type);
            if (existingIndex >= 0) {
              loadedData.videos[existingIndex].url = restoredUrl;
              if (!loadedData.videos[existingIndex].title) {
                loadedData.videos[existingIndex].title = localFile.name;
              }
            } else {
              loadedData.videos.push({
                id: `vid-idb-${type}`,
                type: type as "own" | "rival",
                url: restoredUrl,
                title: localFile.name,
                clips: [],
                halves: [[0, 2700], [3600, 6300]]
              });
            }
          }
        }

        setVideoData(loadedData);
        setLoading(false);

        // Initial wizard step determination (ONLY ONCE on page load!)
        if (!isInitialLoadedRef.current) {
          isInitialLoadedRef.current = true;
          const activeVid = loadedData.videos?.find(v => v.type === activeType) || loadedData.videos?.[0];
          if (activeVid) {
            if (activeVid.halves && activeVid.halves.length >= 2) {
              setT1Start(activeVid.halves[0][0]);
              setT1End(activeVid.halves[0][1]);
              setT2Start(activeVid.halves[1][0]);
              setT2End(activeVid.halves[1][1]);
            }
            const hasClips = Boolean(activeVid.clips && activeVid.clips.length > 0);
            const hasMontages = Boolean(loadedData.montages && loadedData.montages.length > 0);
            const hasCutBank = Boolean(loadedData.cut_bank && loadedData.cut_bank.length > 0);
            const isFinalized = Boolean(activeVid.isFinalized);

            if (hasClips || hasMontages || hasCutBank || isFinalized) {
              setWizardStep(3);
              if (hasMontages && loadedData.montages && loadedData.montages.length > 0) {
                setActiveMontageId(loadedData.montages[0].id);
              }
            } else {
              setWizardStep(1);
            }
          } else {
            setWizardStep(1);
          }
        }
      })
      .catch((err) => {
        setError("Error al cargar el análisis de vídeo.");
        setLoading(false);
      });
  }, [match.id, activeType]);

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
        const name = matchInfo ? `${matchInfo.home_team} vs ${matchInfo.away_team}` : "Rival font-bold";
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
        const nextIndex = currentPresentIndex + 1;
        if (nextIndex < montage.items.length) {
          setCurrentPresentIndex(nextIndex);
        } else {
          setPresenting(false);
        }
      }
    } else if (item && item.type === "cover") {
      // For cover slides, wait for duration then proceed
      const timer = setTimeout(() => {
        const nextIndex = currentPresentIndex + 1;
        if (nextIndex < montage.items.length) {
          setCurrentPresentIndex(nextIndex);
        } else {
          setPresenting(false);
        }
      }, (item.duration || 4) * 1000);
      return () => clearTimeout(timer);
    }
  }, [presenting, activeMontageId, currentPresentIndex, currentTime, videoData.montages]);

  // Montage active item URL and Start Seek sync
  useEffect(() => {
    if (!presenting || !activeMontageId) return;
    const montage = videoData.montages?.find(m => m.id === activeMontageId);
    if (!montage) return;
    const item = montage.items[currentPresentIndex];

    if (item && item.type === "clip") {
      const url = item.videoUrl || activeVideo?.url || "";
      setPresentingUrl(url);

      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(item.start || 0, true);
        }
      }, 300);
    }
  }, [presenting, activeMontageId, currentPresentIndex, activeVideo]);

  // PASO 1 HANDLERS: Semiautomatic Half Calculations with Step-by-Step Guided Auto-Jumps
  const handleSetT1Start = (seconds: number) => {
    const s = Math.max(0, seconds);
    setT1Start(s);
    setT1End(s + 2700); // +45 min
    setT2Start(s + 2700 + 900); // +15 min rest
    setT2End(s + 2700 + 900 + 2700); // +45 min
  };

  const handleSetT1End = (seconds: number) => {
    const s = Math.max(t1Start + 60, seconds);
    setT1End(s);
    const newT2Start = s + 900; // +15 min rest
    setT2Start(newT2Start);
    setT2End(newT2Start + 2700); // +45 min
  };

  const handleMarkT1Start = (seconds?: number) => {
    const s = Math.max(0, seconds !== undefined ? seconds : currentTime);
    setT1Start(s);
    const newT1End = s + 2700; // +45 min
    const newT2Start = newT1End + 900; // +15 min rest
    const newT2End = newT2Start + 2700; // +45 min
    setT1End(newT1End);
    setT2Start(newT2Start);
    setT2End(newT2End);

    // Auto-jump to estimated end of 1st half for confirmation!
    setStep1SubStep("t1_end");
    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.seekTo(newT1End, true);
        setCurrentTime(newT1End);
      }
    }, 150);
  };

  const handleConfirmT1End = (seconds?: number) => {
    const finalT1End = seconds !== undefined ? seconds : (currentTime > t1Start ? currentTime : t1End);
    setT1End(finalT1End);
    const newT2Start = finalT1End + 900; // +15 min rest
    const newT2End = newT2Start + 2700; // +45 min
    setT2Start(newT2Start);
    setT2End(newT2End);

    // Auto-jump to estimated start of 2nd half!
    setStep1SubStep("t2_start");
    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.seekTo(newT2Start, true);
        setCurrentTime(newT2Start);
      }
    }, 150);
  };

  const handleConfirmT2Start = (seconds?: number) => {
    const finalT2Start = seconds !== undefined ? seconds : (currentTime > t1End ? currentTime : t2Start);
    setT2Start(finalT2Start);
    const newT2End = finalT2Start + 2700; // +45 min
    setT2End(newT2End);

    // Auto-jump to estimated end of 2nd half!
    setStep1SubStep("t2_end");
    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.seekTo(newT2End, true);
        setCurrentTime(newT2End);
      }
    }, 150);
  };

  const handleConfirmT2End = (seconds?: number) => {
    const finalT2End = seconds !== undefined ? seconds : (currentTime > t2Start ? currentTime : t2End);
    setT2End(finalT2End);
    handleConfirmHalves();
  };

  const handleConfirmHalves = () => {
    if (!activeVideo) return;
    const halves: [number, number][] = [
      [t1Start, t1End],
      [t2Start, t2End]
    ];
    setVideoData((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === activeVideo.id ? { ...v, halves, isFinalized: true } : v
      )
    }));
    setWizardStep(2);
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
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al guardar el análisis.");
    } finally {
      setSaving(false);
    }
  };

  // Local file loading handlers with IndexedDB persistence per match
  const handleLoadLocalFile = async (file: File) => {
    if (!file) return;
    const localBlobUrl = URL.createObjectURL(file);
    const videoId = `vid-${Date.now()}`;
    const newVideoItem: VideoItem = {
      id: videoId,
      type: activeType,
      url: localBlobUrl,
      title: file.name,
      clips: [],
      halves: [[0, 2700], [3600, 6300]]
    };

    try {
      await saveLocalVideoToIDB(match.id, activeType, file);
    } catch (err) {
      console.error("IndexedDB local video save error:", err);
    }

    setVideoData((prev) => ({
      ...prev,
      videos: [...prev.videos.filter(v => v.type !== activeType), newVideoItem]
    }));
    setWizardStep(1);
  };

  const handleLinkVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    const videoId = `vid-${Date.now()}`;
    const newVideoItem: VideoItem = {
      id: videoId,
      type: activeType,
      url: newUrl,
      title: newTitle || `${match.home_team} vs ${match.away_team}`,
      clips: [],
      halves: [[0, 2700], [3600, 6300]]
    };

    setVideoData((prev) => ({
      ...prev,
      videos: [...prev.videos.filter(v => v.type !== activeType), newVideoItem]
    }));
    setNewUrl("");
    setWizardStep(1);
  };

  const handleUnlinkVideo = (videoId: string) => {
    if (confirm("¿Estás seguro de que quieres desvincular este vídeo y borrar todos sus clips asociados?")) {
      setVideoData((prev) => ({
        ...prev,
        videos: prev.videos.filter((v) => v.id !== videoId)
      }));
      setWizardStep(1);
    }
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

  const handleToggleTacticalConcept = (concept: string) => {
    setSelectedTacticalConcepts(prev => 
      prev.includes(concept) ? prev.filter(c => c !== concept) : [...prev, concept]
    );
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

  // Add clip
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
      tacticalConcepts: selectedTacticalConcepts,
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
    setSelectedTacticalConcepts([]);
  };

  // Freeze frame screen helper
  const handleAddFreezeFrame = () => {
    if (!activeVideo) return;
    const activeClip = activeVideo.clips.find(c => currentTime >= c.start && currentTime <= c.end);
    
    const freezeAnn: VideoAnnotation = {
      id: `freeze-${Date.now()}`,
      type: "text",
      color: "#f59e0b",
      points: [{ x: 0.05, y: 0.9 }],
      startTime: Number(currentTime.toFixed(2)),
      duration: freezeSeconds,
      freezeDuration: freezeSeconds,
      text: `⏸ Frame Congelado (${freezeSeconds}s)`
    };

    if (activeClip) {
      setVideoData(prev => ({
        ...prev,
        videos: prev.videos.map(v => 
          v.id === activeVideo.id 
            ? {
                ...v,
                clips: v.clips.map(c => c.id === activeClip.id ? { ...c, annotations: [...(c.annotations || []), freezeAnn] } : c)
              }
            : v
        )
      }));
    } else {
      // Create quick clip containing this freeze
      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        title: `Congelado ${secondsToMMSS(currentTime)}`,
        start: Math.max(0, currentTime - 1),
        end: currentTime + freezeSeconds + 2,
        comment: `Congelación de pantalla durante ${freezeSeconds}s`,
        category: "Jugada relevante",
        tagged_players: [],
        stats: [],
        annotations: [freezeAnn]
      };
      setVideoData(prev => ({
        ...prev,
        videos: prev.videos.map(v =>
          v.type === activeType ? { ...v, clips: [...v.clips, newClip].sort((a, b) => a.start - b.start) } : v
        )
      }));
    }
  };

  // Move clip to Cut Bank (Armario)
  const handleMoveToCutBank = (clip: VideoClip) => {
    setVideoData(prev => {
      const updatedVideos = prev.videos.map(v => 
        v.type === activeType ? { ...v, clips: v.clips.filter(c => c.id !== clip.id) } : v
      );
      const existingBank = prev.cut_bank || [];
      const bankItem: VideoClip = {
        ...clip,
        isSavedInBank: true,
        videoUrl: activeVideo?.url
      };
      return {
        ...prev,
        videos: updatedVideos,
        cut_bank: [...existingBank, bankItem]
      };
    });
  };

  const handleRestoreFromCutBank = (clip: VideoClip) => {
    setVideoData(prev => {
      const updatedBank = (prev.cut_bank || []).filter(c => c.id !== clip.id);
      const restoredClip: VideoClip = {
        ...clip,
        isSavedInBank: false
      };
      const updatedVideos = prev.videos.map(v => 
        v.type === activeType ? { ...v, clips: [...v.clips, restoredClip].sort((a, b) => a.start - b.start) } : v
      );
      return {
        ...prev,
        videos: updatedVideos,
        cut_bank: updatedBank
      };
    });
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

  // Montages & Carátulas
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

    const newItem: VideoMontageItem = {
      id: `m-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type: "clip",
      clipId: clip.id,
      title: `${clip.title} (${name})`,
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

  const handleAddCoverToMontage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMontageId || !coverTitle) return;

    const newCoverItem: VideoMontageItem = {
      id: `cover-${Date.now()}`,
      type: "cover",
      title: coverTitle,
      subtitle: coverSubtitle,
      bgColor: coverBgColor,
      duration: coverDuration
    };

    setVideoData((prev) => ({
      ...prev,
      montages: (prev.montages || []).map((m) =>
        m.id === activeMontageId ? { ...m, items: [...m.items, newCoverItem] } : m
      )
    }));

    setCoverTitle("");
    setCoverSubtitle("");
    setShowCoverForm(false);
  };

  const handleSortMontage = (montageId: string, sortMode: "chronological" | "category") => {
    setVideoData(prev => ({
      ...prev,
      montages: (prev.montages || []).map(m => {
        if (m.id !== montageId) return m;
        const itemsCopy = [...m.items];
        if (sortMode === "chronological") {
          itemsCopy.sort((a, b) => (a.start || 0) - (b.start || 0));
        } else {
          itemsCopy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        }
        return { ...m, items: itemsCopy };
      })
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

  // Seek video from match sheet event (Acta)
  const handleSeekFromMatchEvent = (eventMinute: number) => {
    if (!playerRef.current) return;
    let targetSecond = 0;
    if (eventMinute <= 45) {
      targetSecond = t1Start + (eventMinute * 60);
    } else {
      targetSecond = t2Start + ((eventMinute - 45) * 60);
    }
    playerRef.current.seekTo(targetSecond, true);
    setCurrentTime(targetSecond);
  };

  // Timeline seek trigger
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTime = pct * videoDuration;
    if (playerRef.current) {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    }
  };

  // Drag and drop handlers for local file drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      handleLoadLocalFile(file);
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

  // If no video is linked yet, show initial linking/drag & drop card
  if (!activeVideo) {
    return (
      <div className="space-y-6">
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

        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-card rounded-2xl border-2 ${
            isDraggingFile ? "border-primary bg-primary/10" : "border-dashed border-border"
          } p-8 shadow-xl space-y-6 relative overflow-hidden max-w-4xl mx-auto mt-4 text-center transition-all`}
        >
          <div className="h-16 w-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-primary text-3xl shadow-inner">
            🎬
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-base font-extrabold text-white uppercase tracking-wider">Cargar Vídeo de Partido</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Arrastra y suelta tu archivo de vídeo aquí o selecciona una opción. La aplicación guardará únicamente las acciones y ediciones realizadas, manteniendo la privacidad de tus vídeos locales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-2xl mx-auto text-left">
            {/* Local Video Option */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase">
                  <span>💻</span>
                  <span>Archivo Local (.mp4, .mkv)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Reproducción en local mediante memoria del navegador sin subir megabytes a la base de datos.
                </p>
              </div>
              <label className="w-full bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg">
                <UploadCloud className="h-4 w-4" />
                <span>Seleccionar Vídeo Local</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLoadLocalFile(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Web Video Option */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase">
                  <span>🌐</span>
                  <span>Enlace Web / Streaming</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Vincula una URL de YouTube, Vimeo, Veo o enlace HTTP MP4 directo.
                </p>
              </div>
              <form onSubmit={handleLinkVideo} className="space-y-2">
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-primary text-white"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Vincular URL
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
      {/* HEADER WIZARD BAR (3 PASOS) */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Step 1 */}
          <button
            onClick={() => setWizardStep(1)}
            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
              wizardStep === 1
                ? "bg-primary text-slate-950 shadow-md"
                : "bg-slate-950/60 text-slate-400 hover:text-white border border-white/5"
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-slate-950/40 flex items-center justify-center text-[10px] font-mono">1</span>
            <span>1. Sincronizar Partes</span>
          </button>

          <ChevronRight className="h-4 w-4 text-slate-600 hidden md:block" />

          {/* Step 2 */}
          <button
            onClick={() => setWizardStep(2)}
            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
              wizardStep === 2
                ? "bg-primary text-slate-950 shadow-md"
                : "bg-slate-950/60 text-slate-400 hover:text-white border border-white/5"
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-slate-950/40 flex items-center justify-center text-[10px] font-mono">2</span>
            <span>2. Edición & Acta</span>
          </button>

          <ChevronRight className="h-4 w-4 text-slate-600 hidden md:block" />

          {/* Step 3 */}
          <button
            onClick={() => setWizardStep(3)}
            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${
              wizardStep === 3
                ? "bg-primary text-slate-950 shadow-md"
                : "bg-slate-950/60 text-slate-400 hover:text-white border border-white/5"
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-slate-950/40 flex items-center justify-center text-[10px] font-mono">3</span>
            <span>3. Montaje & Armario</span>
          </button>
        </div>

        {/* Global Save Button */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          {saveSuccess && (
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Check className="h-3 w-3" />
              <span>Acciones Guardadas en BD</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover disabled:opacity-40 text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Guardando Metadatos..." : "Guardar Edición"}</span>
          </button>
        </div>
      </div>

      {/* STEP 1 VIEW: Semiautomatic Half Definition */}
      {wizardStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Main Player Preview & Controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Guided Calibrator Banner */}
            <div className="bg-indigo-950/60 border border-indigo-500/40 rounded-2xl p-4.5 space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 shadow">
                    {step1SubStep === "t1_start" ? "1A" : step1SubStep === "t1_end" ? "1B" : step1SubStep === "t2_start" ? "1C" : "1D"}
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                      {step1SubStep === "t1_start" && "Fase 1A: Pitido Inicial (1ª Parte)"}
                      {step1SubStep === "t1_end" && "Fase 1B: Calibración Final 1ª Parte (Minuto 45)"}
                      {step1SubStep === "t2_start" && "Fase 1C: Calibración Inicio 2ª Parte (+15 min Descanso)"}
                      {step1SubStep === "t2_end" && "Fase 1D: Calibración Pitido Final (+45 min)"}
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                      {step1SubStep === "t1_start" && "Busca el momento del pitido inicial de la 1ª parte y haz clic en 'Marcar Inicio 1ª Parte'. El reproductor saltará automáticamente al minuto 45 estimado."}
                      {step1SubStep === "t1_end" && "📍 El vídeo ha saltado al final estimado de la 1ª Parte. Muévete libremente si hubo tiempo de descuento y pulsa 'Confirmar Final 1ª Parte'."}
                      {step1SubStep === "t2_start" && "📍 El vídeo ha saltado al Inicio estimado de la 2ª Parte tras el descanso. Ajusta si duró más o menos y pulsa 'Confirmar Inicio 2ª Parte'."}
                      {step1SubStep === "t2_end" && "📍 El vídeo ha saltado al Final estimado del Partido. Revisa el pitido final y confirma para guardar las partes e ir al Paso 2."}
                    </p>
                  </div>
                </div>

                {/* Primary Action Button according to current sub-step */}
                <div className="shrink-0 w-full sm:w-auto">
                  {step1SubStep === "t1_start" && (
                    <button
                      type="button"
                      onClick={() => handleMarkT1Start(currentTime)}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Marcar Inicio 1ª Parte</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {step1SubStep === "t1_end" && (
                    <button
                      type="button"
                      onClick={() => handleConfirmT1End()}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Confirmar Final 1ª Parte</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {step1SubStep === "t2_start" && (
                    <button
                      type="button"
                      onClick={() => handleConfirmT2Start()}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Confirmar Inicio 2ª Parte</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {step1SubStep === "t2_end" && (
                    <button
                      type="button"
                      onClick={() => handleConfirmT2End()}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Confirmar Partes y Pasar al Paso 2</span>
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Player Preview */}
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              <VideoPlayer
                ref={playerRef}
                url={activeVideoUrl}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={(d) => setVideoDuration(d)}
                largeStepSize={largeStepSize}
                readOnly
              />
            </div>

            {/* Interactive Timeline Bar & Integrated Jump Controls for Step 1 */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-350 font-semibold">
                <span>Línea Temporal Completa del Vídeo (Navegación con Ratón)</span>
                <span className="font-mono text-primary font-bold">{secondsToMMSS(currentTime)} / {secondsToMMSS(videoDuration)}</span>
              </div>

              <div 
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-6 bg-slate-950 border border-white/10 rounded-xl cursor-pointer overflow-hidden select-none shadow-inner"
              >
                {/* 1st Half region highlight */}
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-500/25 border-x border-indigo-500/40"
                  style={{ left: `${(t1Start / (videoDuration || 1)) * 100}%`, width: `${((t1End - t1Start) / (videoDuration || 1)) * 100}%` }}
                  title="1ª Parte"
                />

                {/* Rest Gap marker */}
                <div 
                  className="absolute top-0 bottom-0 bg-amber-500/20 border-r border-amber-500/40 flex items-center justify-center"
                  style={{ left: `${(t1End / (videoDuration || 1)) * 100}%`, width: `${((t2Start - t1End) / (videoDuration || 1)) * 100}%` }}
                  title="Descanso"
                >
                  <span className="text-[8px] font-black uppercase text-amber-400">Descanso</span>
                </div>

                {/* 2nd Half region highlight */}
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-500/25 border-x border-indigo-500/40"
                  style={{ left: `${(t2Start / (videoDuration || 1)) * 100}%`, width: `${((t2End - t2Start) / (videoDuration || 1)) * 100}%` }}
                  title="2ª Parte"
                />

                {/* Playhead bar */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-20"
                  style={{ left: `${(currentTime / (videoDuration || 1)) * 100}%` }}
                />
              </div>

              {/* Integrated Control Rail with Streamlined -10s, -1s, Play, +1s, +10s Buttons & Inline Salto Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.max(0, currentTime - largeStepSize);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-extrabold cursor-pointer"
                    title={`Retroceder ${largeStepSize}s (Flecha Abajo)`}
                  >
                    -{largeStepSize}s
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.max(0, currentTime - 1.0);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer"
                    title="Retroceder 1s (Flecha Izquierda)"
                  >
                    -1s
                  </button>
                  <button 
                    onClick={() => playerRef.current?.togglePlay()}
                    className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-slate-950 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer shadow"
                  >
                    Play/Pausa
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.min(videoDuration || 0, currentTime + 1.0);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer"
                    title="Avanzar 1s (Flecha Derecha)"
                  >
                    +1s
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.min(videoDuration || 0, currentTime + largeStepSize);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-extrabold cursor-pointer"
                    title={`Avanzar ${largeStepSize}s (Flecha Arriba)`}
                  >
                    +{largeStepSize}s
                  </button>
                </div>

                {/* Integrated Jump Selector */}
                <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/10 px-3 py-1 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Avanzar (↑/↓):</span>
                  {[5, 10, 15, 30].map(s => (
                    <button
                      key={s}
                      onClick={() => setLargeStepSize(s)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer ${
                        largeStepSize === s
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Semiautomatic Half Control Rail */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Marcas de Tiempo de las Partes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleMarkT1Start(currentTime)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  ⏱ Recalcular desde posición actual
                </button>
              </div>

              {/* Grid Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1st Half Start */}
                <div className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Inicio 1ª Parte</label>
                  <input
                    type="text"
                    value={secondsToMMSS(t1Start)}
                    onChange={(e) => handleSetT1Start(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>

                {/* 1st Half End */}
                <div className="bg-slate-950 p-3 rounded-xl border border-primary/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-primary uppercase">Final 1ª Parte</label>
                    <span className="text-[8px] text-primary/70 font-mono">+45m</span>
                  </div>
                  <input
                    type="text"
                    value={secondsToMMSS(t1End)}
                    onChange={(e) => handleSetT1End(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-primary/40 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold text-center focus:border-primary"
                  />
                </div>

                {/* 2nd Half Start */}
                <div className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Inicio 2ª Parte</label>
                    <span className="text-[8px] text-slate-500 font-mono">+15m Descanso</span>
                  </div>
                  <input
                    type="text"
                    value={secondsToMMSS(t2Start)}
                    onChange={(e) => setT2Start(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>

                {/* 2nd Half End */}
                <div className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Final 2ª Parte</label>
                    <span className="text-[8px] text-slate-500 font-mono">+45m</span>
                  </div>
                  <input
                    type="text"
                    value={secondsToMMSS(t2End)}
                    onChange={(e) => setT2End(parseTimeToSeconds(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold text-center"
                  />
                </div>
              </div>

              {/* Explanatory note */}
              <div className="text-[10px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <span>💡 Si modificas el **Final de la 1ª Parte**, el sistema recalcula automáticamente los inicios y finales posteriores (+15m descanso, +45m 2ª parte).</span>
                <button
                  type="button"
                  onClick={handleConfirmHalves}
                  className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl shrink-0 flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                >
                  <span>Confirmar y Pasar al Paso 2</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Info Sidebar */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Instrucciones del Paso 1</h4>
            <div className="space-y-3 text-xs text-slate-350 leading-relaxed">
              <p>
                1. Busca en el vídeo el momento exacto del pitido inicial del partido.
              </p>
              <p>
                2. Haz clic en <span className="text-primary font-bold">"Marcar posición actual como Inicio 1ª Parte"</span>.
              </p>
              <p>
                3. Comprueba las marcas de la 1ª y 2ª parte. Puedes modificar manualmente cualquiera de los minutos.
              </p>
              <p className="text-[11px] text-slate-400 border-t border-white/5 pt-3">
                Una vez confirmado, el paso 2 mostrará únicamente el metraje de juego activo descontando pausas y calentamientos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 VIEW: Clean Timeline + Match Sheet Events + Tactical Editing & Freeze Frame */}
      {wizardStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Main Video Box & Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              <VideoPlayer
                ref={playerRef}
                url={activeVideoUrl}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={(d) => setVideoDuration(d)}
                largeStepSize={largeStepSize}
                isBoardActive={isBoardActive}
                onBoardActiveChange={(active) => setIsBoardActive(active)}
                activeTool={activeTool}
                onActiveToolChange={(tool) => setActiveTool(tool)}
                drawColor={drawColor}
                onDrawColorChange={(c) => setDrawColor(c)}
                annotations={
                  activeVideo.clips.flatMap(c => 
                    currentTime >= c.start && currentTime <= c.end ? (c.annotations || []) : []
                  )
                }
                onAnnotationsChange={(anns) => {
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

              {/* Whiteboard and Freeze Frame Bar */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => setIsBoardActive(!isBoardActive)}
                  className={`px-3.5 py-1.5 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
                    isBoardActive 
                      ? "bg-indigo-600 border-indigo-500 text-white" 
                      : "bg-slate-950/85 border-white/10 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <span>✏️</span>
                  <span>{isBoardActive ? "Cerrar Pizarra" : "Dibujar en Pizarra"}</span>
                </button>

                <div className="flex items-center gap-1 bg-slate-950/85 border border-white/10 rounded-xl p-1 shadow-lg">
                  <button
                    onClick={handleAddFreezeFrame}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all cursor-pointer"
                    title="Congelar fotograma actual durante X segundos"
                  >
                    <span>⏸ Congelar</span>
                  </button>
                  <select
                    value={freezeSeconds}
                    onChange={(e) => setFreezeSeconds(Number(e.target.value))}
                    className="bg-slate-900 border border-white/10 text-white text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                  >
                    <option value={2}>2s</option>
                    <option value={3}>3s</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Timeline Bar with Match Events */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                <span>Línea de Tiempo del Partido (1ª y 2ª Parte)</span>
                <span className="font-mono text-primary font-bold">{secondsToMMSS(currentTime)} / {secondsToMMSS(videoDuration)}</span>
              </div>

              <div 
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-7 bg-slate-950 border border-white/10 rounded-xl cursor-pointer overflow-hidden select-none shadow-inner"
              >
                {/* 1st Half track */}
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-500/20 border-r border-indigo-500/40"
                  style={{ left: `${(t1Start / (videoDuration || 1)) * 100}%`, width: `${((t1End - t1Start) / (videoDuration || 1)) * 100}%` }}
                />

                {/* Rest Gap marker */}
                <div 
                  className="absolute top-0 bottom-0 bg-amber-500/20 border-r border-amber-500/40 flex items-center justify-center"
                  style={{ left: `${(t1End / (videoDuration || 1)) * 100}%`, width: `${((t2Start - t1End) / (videoDuration || 1)) * 100}%` }}
                >
                  <span className="text-[8px] font-black uppercase text-amber-400 tracking-wider">Descanso</span>
                </div>

                {/* 2nd Half track */}
                <div 
                  className="absolute top-0 bottom-0 bg-indigo-500/20"
                  style={{ left: `${(t2Start / (videoDuration || 1)) * 100}%`, width: `${((t2End - t2Start) / (videoDuration || 1)) * 100}%` }}
                />

                {/* Match Sheet Events overlay on timeline */}
                {matchEvents.map((ev, idx) => {
                  let eventSec = 0;
                  if (ev.minute <= 45) {
                    eventSec = t1Start + (ev.minute * 60);
                  } else {
                    eventSec = t2Start + ((ev.minute - 45) * 60);
                  }
                  const leftPct = (eventSec / (videoDuration || 1)) * 100;
                  const icon = ev.event_type === "goal" ? "⚽" : ev.event_type === "yellow_card" ? "🟨" : ev.event_type === "red_card" ? "🟥" : "🔄";

                  return (
                    <div
                      key={ev.id || idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeekFromMatchEvent(ev.minute);
                      }}
                      className="absolute top-0 bottom-0 w-3 -ml-1.5 flex items-center justify-center z-10 hover:scale-125 transition-transform"
                      style={{ left: `${leftPct}%` }}
                      title={`Min ${ev.minute}': ${ev.description || ev.player_name || ev.event_type}`}
                    >
                      <span className="text-[10px] shadow-lg">{icon}</span>
                    </div>
                  );
                })}

                {/* Clips highlights */}
                {activeVideo.clips.map((clip) => {
                  const startPct = (clip.start / (videoDuration || 1)) * 100;
                  const widthPct = ((clip.end - clip.start) / (videoDuration || 1)) * 100;
                  return (
                    <div
                      key={clip.id}
                      className="absolute top-0 bottom-0 bg-emerald-500/30 border-x border-emerald-500/50"
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      title={clip.title}
                    />
                  );
                })}

                {/* Playhead bar */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-20"
                  style={{ left: `${(currentTime / (videoDuration || 1)) * 100}%` }}
                />
              </div>

              {/* Integrated Control Rail for Step 2 */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.max(0, currentTime - largeStepSize);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-extrabold cursor-pointer"
                    title={`Retroceder ${largeStepSize}s (Flecha Abajo)`}
                  >
                    -{largeStepSize}s
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.max(0, currentTime - 1.0);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer"
                    title="Retroceder 1s (Flecha Izquierda)"
                  >
                    -1s
                  </button>
                  <button 
                    onClick={() => playerRef.current?.togglePlay()}
                    className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-slate-950 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer shadow"
                  >
                    Play/Pausa
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.min(videoDuration || 0, currentTime + 1.0);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer"
                    title="Avanzar 1s (Flecha Derecha)"
                  >
                    +1s
                  </button>
                  <button 
                    onClick={() => {
                      if (playerRef.current) {
                        const t = Math.min(videoDuration || 0, currentTime + largeStepSize);
                        playerRef.current.seekTo(t, true);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-extrabold cursor-pointer"
                    title={`Avanzar ${largeStepSize}s (Flecha Arriba)`}
                  >
                    +{largeStepSize}s
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Integrated Jump Selector */}
                  <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/10 px-3 py-1 rounded-xl">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Avanzar (↑/↓):</span>
                    {[5, 10, 15, 30].map(s => (
                      <button
                        key={s}
                        onClick={() => setLargeStepSize(s)}
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer ${
                          largeStepSize === s
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="text-primary hover:underline font-bold uppercase text-[10px] flex items-center gap-1 ml-2"
                  >
                    <span>Paso 3</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Match Sheet Events List (Acta del Partido) */}
            {matchEvents.length > 0 && (
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">Sucesos del Acta del Partido</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">{matchEvents.length} sucesos registrados</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {matchEvents.map((ev, idx) => {
                    const icon = ev.event_type === "goal" ? "⚽" : ev.event_type === "yellow_card" ? "🟨" : ev.event_type === "red_card" ? "🟥" : "🔄";
                    return (
                      <button
                        key={ev.id || idx}
                        onClick={() => handleSeekFromMatchEvent(ev.minute)}
                        className="bg-slate-950 hover:bg-slate-800 border border-white/10 hover:border-primary/50 text-left p-2.5 rounded-xl shrink-0 min-w-[140px] space-y-1 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-white">
                          <span>{icon} Min {ev.minute}'</span>
                          <span className="text-primary text-[9px] font-mono">Ir ⏱</span>
                        </div>
                        <p className="text-[10px] text-slate-300 truncate max-w-[130px]">
                          {ev.player_name || ev.description || ev.event_type}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Clip Form & Clips List */}
          <div className="space-y-4">
            {/* New Clip Form */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                <span>Crear Corte de Vídeo</span>
              </h3>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Título del recorte"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-white"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Inicio (MM:SS)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="00:00"
                        value={clipStart}
                        onChange={(e) => setClipStart(e.target.value)}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white font-mono text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleCaptureTime("start")}
                        className="bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-xl px-2 text-xs font-bold"
                        title="Capturar segundo actual"
                      >
                        ⏱
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Fin (MM:SS)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="00:00"
                        value={clipEnd}
                        onChange={(e) => setClipEnd(e.target.value)}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white font-mono text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleCaptureTime("end")}
                        className="bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-xl px-2 text-xs font-bold"
                        title="Capturar segundo actual"
                      >
                        ⏱
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tactical concepts tags */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Conceptos Tácticos</label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-white/5">
                    {TACTICAL_CONCEPTS.map(c => {
                      const isSel = selectedTacticalConcepts.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleToggleTacticalConcept(c)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                            isSel ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Player Tagging */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Etiquetar Jugadores</label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-white/5">
                    {players.map(p => {
                      const isSel = selectedPlayers.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTogglePlayer(p.id)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                            isSel ? "bg-primary border-primary text-slate-950" : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          {p.first_name} {p.last_name.substring(0, 1)}.
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={clipCategory}
                    onChange={(e) => setClipCategory(e.target.value)}
                    className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddClip}
                    className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-4 py-2 rounded-xl shrink-0 cursor-pointer"
                  >
                    Guardar Corte
                  </button>
                </div>
              </div>
            </div>

            {/* List of active Clips */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center justify-between">
                <span>Cortes Guardados ({filteredClips.length})</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded px-2 py-0.5 text-[9px] text-slate-300"
                >
                  <option value="Todos">Todos</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </h3>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredClips.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic text-xs">No hay cortes registrados.</div>
                ) : (
                  filteredClips.map((clip) => (
                    <div
                      key={clip.id}
                      onClick={() => playerRef.current?.seekTo(clip.start, true)}
                      className="p-3 bg-slate-950 border border-white/5 hover:border-primary/40 rounded-xl cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate max-w-[140px]">{clip.title}</span>
                        <span className="bg-slate-900 border border-white/10 text-primary font-mono text-[9px] px-1.5 py-0.5 rounded">
                          {secondsToMMSS(clip.start)} - {secondsToMMSS(clip.end)}
                        </span>
                      </div>

                      {clip.tacticalConcepts && clip.tacticalConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {clip.tacticalConcepts.map(tc => (
                            <span key={tc} className="bg-indigo-500/20 text-indigo-300 text-[8px] px-1.5 py-0.5 rounded font-semibold">
                              {tc}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveToCutBank(clip);
                          }}
                          className="text-[9px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                          title="Mover al Banco de Cortes para otras ocasiones"
                        >
                          <Archive className="h-3 w-3" />
                          <span>Guardar en Armario</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClip(clip.id);
                          }}
                          className="text-rose-450 hover:text-rose-400 p-1"
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
        </div>
      )}

      {/* STEP 3 VIEW: Final Montage Builder, Cover Slides & Cut Bank */}
      {wizardStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Left Column: Presentation Player / Montage Builder */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl p-2 min-h-[360px]">
              {presenting && activeMontageId ? (
                (() => {
                  const montage = videoData.montages?.find(m => m.id === activeMontageId);
                  const currentItem = montage?.items[currentPresentIndex];
                  if (currentItem?.type === "cover") {
                    return (
                      <div 
                        className="w-full h-80 flex flex-col items-center justify-center text-center p-8 rounded-xl transition-all"
                        style={{ backgroundColor: currentItem.bgColor || "#0f172a" }}
                      >
                        <Film className="h-10 w-10 text-primary mb-3 animate-bounce" />
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2">{currentItem.title}</h1>
                        {currentItem.subtitle && (
                          <h3 className="text-sm font-semibold text-slate-300">{currentItem.subtitle}</h3>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono mt-4">Diapositiva ({currentPresentIndex + 1}/{montage?.items.length})</span>
                      </div>
                    );
                  }
                  return (
                    <VideoPlayer
                      ref={playerRef}
                      url={activeVideoUrl}
                      onTimeUpdate={(t) => setCurrentTime(t)}
                      onDurationChange={(d) => setVideoDuration(d)}
                      readOnly
                    />
                  );
                })()
              ) : (
                <VideoPlayer
                  ref={playerRef}
                  url={activeVideoUrl}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  onDurationChange={(d) => setVideoDuration(d)}
                  readOnly
                />
              )}
            </div>

            {/* Active Montage Playlist Editor */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Montaje Final Seleccionado</h3>
                </div>

                <div className="flex items-center gap-2">
                  {activeMontageId && (
                    <>
                      <button
                        onClick={() => setShowCoverForm(!showCoverForm)}
                        className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                      >
                        <Layout className="h-3 w-3" />
                        <span>+ Carátula</span>
                      </button>
                      <button
                        onClick={() => handleSortMontage(activeMontageId, "chronological")}
                        className="bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Ordenar por Minuto
                      </button>
                      <button
                        onClick={() => handleSortMontage(activeMontageId, "category")}
                        className="bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Ordenar por Concepto
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Cover Slide Creation Modal / Inline Form */}
              {showCoverForm && activeMontageId && (
                <form onSubmit={handleAddCoverToMontage} className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase">Añadir Carátula de Presentación</h4>
                  <input
                    type="text"
                    placeholder="Título principal (ej: Análisis Táctico vs Numancia)"
                    value={coverTitle}
                    onChange={(e) => setCoverTitle(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Subtítulo opcional (ej: Bloque defensivo 1ª Parte)"
                    value={coverSubtitle}
                    onChange={(e) => setCoverSubtitle(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <div className="flex gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Color Fondo:</label>
                      <input
                        type="color"
                        value={coverBgColor}
                        onChange={(e) => setCoverBgColor(e.target.value)}
                        className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">Duración:</label>
                      <select
                        value={coverDuration}
                        onChange={(e) => setCoverDuration(Number(e.target.value))}
                        className="bg-slate-900 border border-white/10 text-white text-xs rounded px-2 py-1"
                      >
                        <option value={3}>3s</option>
                        <option value={4}>4s</option>
                        <option value={5}>5s</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase px-4 py-1.5 rounded-xl ml-auto cursor-pointer"
                    >
                      Añadir Carátula
                    </button>
                  </div>
                </form>
              )}

              {/* Playlist Items */}
              {activeMontageId ? (
                (() => {
                  const montage = videoData.montages?.find(m => m.id === activeMontageId);
                  if (!montage || montage.items.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 italic text-xs">
                        Este montaje está vacío. Haz clic en "Añadir a montaje" en los cortes de la derecha o crea una carátula.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {montage.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-slate-950 border border-white/5 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-primary font-bold text-[10px]">{idx + 1}.</span>
                            {item.type === "cover" ? (
                              <span className="bg-indigo-500/20 text-indigo-300 font-bold text-[10px] px-2 py-0.5 rounded">
                                🖼 Carátula: {item.title} ({item.duration}s)
                              </span>
                            ) : (
                              <span className="font-bold text-white truncate">{item.title}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMontageItem(activeMontageId, item.id)}
                            className="text-slate-500 hover:text-rose-450 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Crea o selecciona un montaje en el menú lateral derecho para editar su secuencia.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Cut Bank (Armario) & Montages List */}
          <div className="space-y-4">
            {/* Cut Bank (Armario de Cortes Reutilizables) */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Banco de Cortes (Armario)</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{(videoData.cut_bank || []).length} cortes guardados</span>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Cortes almacenados para otras ocasiones o rivales. Puedes etiquetarlos con conceptos tácticos o jugadores.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(videoData.cut_bank || []).length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic text-xs">El armario de cortes está vacío.</div>
                ) : (
                  (videoData.cut_bank || []).map((clip) => (
                    <div
                      key={clip.id}
                      className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">{clip.title}</span>
                        <span className="bg-amber-500/10 text-amber-300 font-mono text-[9px] px-1.5 py-0.5 rounded">
                          {secondsToMMSS(clip.start)} - {secondsToMMSS(clip.end)}
                        </span>
                      </div>

                      {clip.tacticalConcepts && clip.tacticalConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {clip.tacticalConcepts.map(tc => (
                            <span key={tc} className="bg-indigo-500/20 text-indigo-300 text-[8px] px-1.5 py-0.5 rounded">
                              {tc}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => handleRestoreFromCutBank(clip)}
                          className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Restaurar al Partido</span>
                        </button>
                        {activeMontageId && (
                          <button
                            type="button"
                            onClick={() => handleAddClipToMontage(clip)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded text-[9px]"
                          >
                            + Montaje
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Registered Montages */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Crear Nuevo Montaje</h3>

              <form onSubmit={handleCreateMontage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre del montaje (ej: Informe Defensa)"
                  value={newMontageTitle}
                  onChange={(e) => setNewMontageTitle(e.target.value)}
                  required
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                >
                  Crear
                </button>
              </form>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(videoData.montages || []).map((m) => {
                  const isActive = m.id === activeMontageId;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setActiveMontageId(m.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isActive ? "bg-primary/10 border-primary text-white" : "bg-slate-950 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="font-bold text-xs truncate">{m.title}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMontageId(m.id);
                            setCurrentPresentIndex(0);
                            setPresenting(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded"
                          title="Reproducir Montaje"
                        >
                          <Play className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMontage(m.id);
                          }}
                          className="text-rose-450 hover:text-rose-400 p-1"
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
    </div>
  );
}
