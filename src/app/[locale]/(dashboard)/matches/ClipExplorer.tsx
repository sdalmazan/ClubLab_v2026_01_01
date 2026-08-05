"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { VideoClip, VideoItem } from "@/lib/clublab/types";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  shirt_number?: number | null;
  position?: string | null;
}
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { getLocalVideoFromIDB, saveLocalVideoToIDB } from "@/lib/clublab/idbVideo";
import { 
  Search, 
  Filter, 
  Film, 
  Play, 
  User, 
  Tag, 
  Calendar, 
  FileVideo, 
  UploadCloud, 
  RefreshCw, 
  Trash2, 
  ExternalLink,
  ChevronDown,
  Layers
} from "lucide-react";

interface MatchClipWrapper extends VideoClip {
  matchId: string;
  matchTitle: string;
  matchDate?: string;
  videoType: "own" | "rival";
  videoItem: VideoItem;
}

interface ClipExplorerProps {
  allMatches: any[];
  squadPlayers: Player[];
}

export function ClipExplorer({ allMatches, squadPlayers }: ClipExplorerProps) {
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<MatchClipWrapper[]>([]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [selectedDescriptor, setSelectedDescriptor] = useState<string>("all");

  // Active playing clip in preview modal/player
  const [playingClip, setPlayingClip] = useState<MatchClipWrapper | null>(null);

  useEffect(() => {
    async function loadAllClips() {
      setLoading(true);
      const allClipsList: MatchClipWrapper[] = [];

      for (const m of allMatches) {
        try {
          const res = await fetch(`/api/scouting/matches/${m.id}/video`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!data?.videos || !Array.isArray(data.videos)) continue;

          for (const vid of data.videos as VideoItem[]) {
            if (!vid.clips || !Array.isArray(vid.clips)) continue;
            
            // Check if local video blob is stored in IndexedDB
            let activeUrl = vid.url;
            try {
              const localFile = await getLocalVideoFromIDB(m.id, vid.type);
              if (localFile) {
                activeUrl = URL.createObjectURL(localFile);
              }
            } catch {}

            for (const c of vid.clips) {
              allClipsList.push({
                ...c,
                matchId: m.id,
                matchTitle: `${m.home_team || "Local"} vs ${m.away_team || "Visitante"}`,
                matchDate: m.match_date || m.created_at,
                videoType: vid.type,
                videoItem: { ...vid, url: activeUrl }
              });
            }
          }
        } catch (err) {
          console.error(`Error loading clips for match ${m.id}:`, err);
        }
      }

      setClips(allClipsList);
      setLoading(false);
    }

    loadAllClips();
  }, [allMatches]);

  // Extract unique categories and descriptors for filters
  const categoriesList = Array.from(new Set(clips.map(c => c.category).filter(Boolean))) as string[];
  const descriptorsList = Array.from(new Set(clips.flatMap(c => c.descriptors || []).filter(Boolean))) as string[];

  // Filter clips logic
  const filteredClips = clips.filter(c => {
    if (selectedMatchId !== "all" && c.matchId !== selectedMatchId) return false;
    if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
    if (selectedPlayerId !== "all" && !c.tagged_players?.includes(selectedPlayerId)) return false;
    if (selectedDescriptor !== "all" && !c.descriptors?.includes(selectedDescriptor)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitleText = c.matchTitle.toLowerCase();
      const titleText = c.title.toLowerCase();
      const commentText = (c.comment || "").toLowerCase();
      if (!matchTitleText.includes(q) && !titleText.includes(q) && !commentText.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const handleRelinkLocalVideo = async (e: React.ChangeEvent<HTMLInputElement>, clip: MatchClipWrapper) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await saveLocalVideoToIDB(clip.matchId, clip.videoType, file);
      const newBlobUrl = URL.createObjectURL(file);

      // Update state
      setClips(prev => prev.map(c => 
        c.matchId === clip.matchId && c.videoType === clip.videoType
          ? { ...c, videoItem: { ...c.videoItem, url: newBlobUrl } }
          : c
      ));

      if (playingClip?.id === clip.id) {
        setPlayingClip(prev => prev ? { ...prev, videoItem: { ...prev.videoItem, url: newBlobUrl } } : null);
      }

      alert(`¡Vídeo local ${file.name} vinculado correctamente para este partido!`);
    } catch (err) {
      console.error("Error re-linking video:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filter Controls Bar */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Historial General de Cortes Tácticos</h2>
              <p className="text-xs text-slate-400">
                Explora y filtra todos los clips editados de la temporada por partido, jugador, tipo de acción o descriptor.
              </p>
            </div>
          </div>

          <span className="bg-slate-950 border border-white/10 text-indigo-300 font-extrabold text-xs px-3.5 py-1.5 rounded-xl self-start md:self-auto">
            {filteredClips.length} cortes encontrados
          </span>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar título o nota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Match Filter */}
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="bg-slate-950 border border-white/10 text-xs text-slate-200 font-semibold rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Partidos ({allMatches.length})</option>
            {allMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.home_team} vs {m.away_team}
              </option>
            ))}
          </select>

          {/* Action Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-white/10 text-xs text-slate-200 font-semibold rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las Acciones ({categoriesList.length})</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Player Filter */}
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="bg-slate-950 border border-white/10 text-xs text-slate-200 font-semibold rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Jugadores ({squadPlayers.length})</option>
            {squadPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.shirt_number || "-"} {p.first_name} {p.last_name}
              </option>
            ))}
          </select>

          {/* Descriptor Filter */}
          <select
            value={selectedDescriptor}
            onChange={(e) => setSelectedDescriptor(e.target.value)}
            className="bg-slate-950 border border-white/10 text-xs text-slate-200 font-semibold rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Descriptores ({descriptorsList.length})</option>
            {descriptorsList.map((desc) => (
              <option key={desc} value={desc}>
                {desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading Spin State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider">Cargando historial completo de cortes...</span>
        </div>
      ) : filteredClips.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-12 text-center text-slate-400 max-w-md mx-auto space-y-3 shadow-inner">
          <Film className="h-10 w-10 text-slate-600 mx-auto stroke-[1.5]" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No se encontraron cortes con este filtro</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Prueba a cambiar el partido, jugador o descriptor seleccionado para explorar otros cortes guardados.
          </p>
        </div>
      ) : (
        /* Clip Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClips.map((clip) => {
            const hasVideoUrl = Boolean(clip.videoItem?.url);
            const taggedPlayerObjs = squadPlayers.filter(p => clip.tagged_players?.includes(p.id));

            return (
              <div
                key={clip.id}
                className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3.5 shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Match & Category */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                      {clip.category || "Jugada relevante"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {Math.floor(clip.start / 60)}:{(Math.floor(clip.start) % 60).toString().padStart(2, "0")} - {Math.floor(clip.end / 60)}:{(Math.floor(clip.end) % 60).toString().padStart(2, "0")}
                    </span>
                  </div>

                  {/* Clip Title & Match */}
                  <div>
                    <h4 className="text-xs font-black text-white truncate">{clip.title}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                      <span>{clip.matchTitle}</span>
                    </p>
                  </div>

                  {/* Descriptors Badges */}
                  {clip.descriptors && clip.descriptors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {clip.descriptors.map((desc, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-950 border border-white/10 text-slate-300 text-[9px] font-extrabold px-2 py-0.5 rounded-lg"
                        >
                          {desc}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tagged Players */}
                  {taggedPlayerObjs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <User className="h-3 w-3 text-slate-500" />
                      {taggedPlayerObjs.map(p => (
                        <span key={p.id} className="bg-slate-950 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          #{p.shirt_number || "-"} {p.first_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions: Play vs Re-link */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  {hasVideoUrl ? (
                    <button
                      onClick={() => setPlayingClip(clip)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" />
                      <span>Reproducir Corte</span>
                    </button>
                  ) : (
                    <label className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 hover:bg-amber-950/40 font-bold text-[10px] uppercase py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center">
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Vincular Vídeo Local</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleRelinkLocalVideo(e, clip)}
                        className="hidden"
                      />
                    </label>
                  )}

                  <Link
                    href={`/matches/${clip.matchId}/video`}
                    className="p-2 bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shrink-0"
                    title="Ir a la mesa de videoanálisis del partido"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Video Player for Clip Preview */}
      {playingClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-950 border border-white/10 rounded-2xl max-w-3xl w-full p-4 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase">{playingClip.category || "Corte Táctico"}</span>
                <h3 className="text-sm font-black text-white">{playingClip.title}</h3>
              </div>
              <button
                onClick={() => setPlayingClip(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-white/10"
              >
                ✕
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden min-h-[340px] bg-black">
              <VideoPlayer
                url={playingClip.videoItem.url}
                muted={false}
                annotations={playingClip.annotations}
              />
            </div>

            {playingClip.comment && (
              <p className="text-xs text-slate-300 bg-slate-900 border border-white/5 p-3 rounded-xl">
                💬 {playingClip.comment}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
