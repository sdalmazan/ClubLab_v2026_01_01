"use client";

import { VideoMontage, VideoMontageItem, VideoClip } from "./types";

interface ExportOptions {
  includeSound: boolean;
  resolution: "1080p" | "720p";
  clubLogoUrl?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchDate?: string;
  isRivalAnalysis?: boolean;
  rivalTeamName?: string;
  seasonName?: string;
}

function getTeamAcronym(name?: string): string {
  if (!name) return "EQP";
  const stopWords = new Set(["de", "del", "la", "las", "los", "el", "en", "a", "y"]);
  const clean = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, " ").trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()));
  
  if (words.length === 0) return name.substring(0, 3).toUpperCase();
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  return words.map(w => w[0].toUpperCase()).join("");
}

function secondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Client-side video montage compilation engine using Canvas 2D & MediaRecorder API.
 * Compiles cover slides, video clips, broadcast TV scoreboards, notes overlays, and audio.
 */
export async function compileAndDownloadMontageMP4(
  montage: VideoMontage,
  allClips: VideoClip[],
  options: ExportOptions,
  onProgress: (pct: number, statusMessage: string) => void
): Promise<void> {
  const width = options.resolution === "1080p" ? 1920 : 1280;
  const height = options.resolution === "1080p" ? 1080 : 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No se pudo inicializar el motor gráfico Canvas 2D.");
  }

  // Pre-load club logo if available
  let logoImg: HTMLImageElement | null = null;
  if (options.clubLogoUrl) {
    try {
      logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = options.clubLogoUrl;
      await new Promise((res) => {
        if (!logoImg) return res(null);
        logoImg.onload = () => res(null);
        logoImg.onerror = () => res(null);
      });
    } catch {}
  }

  const stream = canvas.captureStream(30);
  let mimeType = "video/webm;codecs=vp9";
  if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264")) {
    mimeType = "video/mp4;codecs=h264";
  } else if (MediaRecorder.isTypeSupported("video/mp4")) {
    mimeType = "video/mp4";
  } else if (MediaRecorder.isTypeSupported("video/webm")) {
    mimeType = "video/webm";
  }

  const recordedChunks: Blob[] = [];
  const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.start(100);

  const homeAcronym = getTeamAcronym(options.homeTeamName || "LOCAL");
  const awayAcronym = getTeamAcronym(options.awayTeamName || "VISITA");

  const totalItems = montage.items.length;

  for (let i = 0; i < totalItems; i++) {
    const item = montage.items[i];
    const itemPctStart = Math.floor((i / totalItems) * 90);
    onProgress(itemPctStart, `Procesando elemento ${i + 1}/${totalItems}: ${item.title}`);

    if (item.type === "cover") {
      // Draw Cover Slide
      const durationSec = item.duration || 4;
      const totalFrames = durationSec * 30;

      for (let f = 0; f < totalFrames; f++) {
        // Background
        ctx.fillStyle = item.bgColor || "#0f172a";
        ctx.fillRect(0, 0, width, height);

        // Logo
        if (item.showBadge !== false && logoImg) {
          const logoSize = height * 0.18;
          ctx.drawImage(logoImg, (width - logoSize) / 2, height * 0.22, logoSize, logoSize);
        }

        // Title
        ctx.fillStyle = item.textColor || "#ffffff";
        ctx.font = `900 ${height * 0.045}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((item.title || "ANÁLISIS TÁCTICO").toUpperCase(), width / 2, height * 0.52);

        // Subtitle
        if (item.subtitle) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.font = `600 ${height * 0.025}px sans-serif`;
          ctx.fillText(item.subtitle, width / 2, height * 0.62);
        }

        // Footer Date Badge
        if (options.matchDate) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.font = `700 ${height * 0.02}px sans-serif`;
          ctx.fillText(`📅 ${options.matchDate}`, width / 2, height * 0.88);
        }

        await new Promise((r) => setTimeout(r, 1000 / 30));
      }
    } else {
      // Draw Video Clip
      const clipObj = allClips.find((c) => c.id === item.clipId);
      const videoUrl = item.videoUrl || clipObj?.videoUrl;

      if (!videoUrl) continue;

      const hiddenVideo = document.createElement("video");
      hiddenVideo.crossOrigin = "anonymous";
      hiddenVideo.src = videoUrl;
      hiddenVideo.muted = !options.includeSound;
      hiddenVideo.playsInline = true;

      await new Promise((resolve) => {
        hiddenVideo.onloadedmetadata = () => resolve(null);
        hiddenVideo.onerror = () => resolve(null);
        setTimeout(resolve, 3000);
      });

      const startTime = item.start ?? clipObj?.start ?? 0;
      const endTime = item.end ?? clipObj?.end ?? Math.min(hiddenVideo.duration || 10, startTime + 10);
      hiddenVideo.currentTime = startTime;

      await new Promise((r) => setTimeout(r, 300));
      try {
        await hiddenVideo.play();
      } catch {}

      while (!hiddenVideo.paused && !hiddenVideo.ended && hiddenVideo.currentTime < endTime) {
        // 1. Draw video frame to canvas
        ctx.drawImage(hiddenVideo, 0, 0, width, height);

        // 2. Broadcast TV Scoreboard Overlay (Pro TV style based on reference screenshot)
        if (item.showScoreboard !== false && (clipObj?.scoreboardOverlay?.show !== false)) {
          const sbWidth = width * 0.26;
          const sbHeight = height * 0.065;
          const sbX = width * 0.03;
          const sbY = height * 0.04;

          // Scoreboard Main Pill (White background with black score boxes)
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(sbX, sbY, sbWidth, sbHeight, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Left Score Box
          const scoreBoxWidth = sbHeight;
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(sbX, sbY, scoreBoxWidth, sbHeight);

          // Right Score Box
          ctx.fillRect(sbX + sbWidth - scoreBoxWidth, sbY, scoreBoxWidth, sbHeight);

          // Scores (0 - 0 default fallback)
          ctx.fillStyle = "#ffffff";
          ctx.font = `900 ${height * 0.032}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("0", sbX + scoreBoxWidth / 2, sbY + sbHeight / 2);
          ctx.fillText("0", sbX + sbWidth - scoreBoxWidth / 2, sbY + sbHeight / 2);

          // Team Acronyms (SDA vs UDSMT)
          ctx.fillStyle = "#0f172a";
          ctx.font = `900 ${height * 0.024}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(homeAcronym, sbX + scoreBoxWidth + 12, sbY + sbHeight / 2);

          ctx.textAlign = "right";
          ctx.fillText(awayAcronym, sbX + sbWidth - scoreBoxWidth - 12, sbY + sbHeight / 2);

          // Dynamic Clock Pill (Sub-bar right below main scoreboard)
          const clockPillWidth = sbWidth * 0.45;
          const clockPillHeight = sbHeight * 0.65;
          const clockX = sbX;
          const clockY = sbY + sbHeight + 4;

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(clockX, clockY, clockPillWidth, clockPillHeight, 6);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.stroke();

          // Dynamic Running Clock (MM:SS)
          const runningClockStr = secondsToMMSS(hiddenVideo.currentTime);
          ctx.fillStyle = "#1e3a8a"; // Deep navy blue text
          ctx.font = `900 ${height * 0.022}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(runningClockStr, clockX + clockPillWidth / 2, clockY + clockPillHeight / 2);
        }

        // 3. Subtle Match Date Overlay (Bottom-left disimulada)
        if (options.matchDate) {
          const dateWidth = width * 0.14;
          const dateHeight = height * 0.04;
          const dateX = width * 0.03;
          const dateY = height * 0.92;

          ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
          ctx.beginPath();
          ctx.roundRect(dateX, dateY, dateWidth, dateHeight, 6);
          ctx.fill();

          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.font = `700 ${height * 0.016}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`📅 ${options.matchDate}`, dateX + dateWidth / 2, dateY + dateHeight / 2);
        }

        // 4. Draw Action Notes Overlay (Without notebook icon `📝`)
        const notesObj = item.notesOverlay || clipObj?.notesOverlay;
        if (notesObj?.showInVideo && notesObj.text) {
          ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
          const noteWidth = width * 0.55;
          const noteHeight = height * 0.07;

          let nX = (width - noteWidth) / 2;
          let nY = height * 0.88;

          if (notesObj.position === "top") nY = height * 0.06;
          else if (notesObj.position === "center") nY = (height - noteHeight) / 2;
          else if (notesObj.position === "left") { nX = width * 0.04; nY = height * 0.4; }
          else if (notesObj.position === "right") { nX = width * 0.41; nY = height * 0.4; }

          ctx.beginPath();
          ctx.roundRect(nX, nY, noteWidth, noteHeight, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#facc15"; // Neon yellow accent text
          ctx.font = `800 ${height * 0.022}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(notesObj.text, nX + noteWidth / 2, nY + noteHeight / 2);
        }

        await new Promise((r) => setTimeout(r, 1000 / 30));
      }

      hiddenVideo.pause();
    }
  }

  onProgress(98, "Finalizando codificación de archivo MP4...");
  mediaRecorder.stop();

  await new Promise((res) => {
    mediaRecorder.onstop = () => res(null);
  });

  const blob = new Blob(recordedChunks, { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  
  if (options.isRivalAnalysis) {
    const rival = options.rivalTeamName || options.awayTeamName || "Rival";
    const seasonClean = (options.seasonName || "2025-2026").replace(/\//g, "-");
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayStr = `${dd}${mm}${yyyy}`;
    a.download = `Análisis ${rival}_${seasonClean}_${todayStr}.${extension}`;
  } else {
    const rawDateStr = (options.matchDate || "").replace(/[^0-9]/g, "");
    const home = options.homeTeamName || "Equipo1";
    const away = options.awayTeamName || "Equipo2";
    a.download = `Análisis ${home} vs ${away}_${rawDateStr}.${extension}`;
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  onProgress(100, "¡Vídeo descargado con éxito!");
}
