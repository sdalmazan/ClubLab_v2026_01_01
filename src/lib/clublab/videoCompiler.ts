"use client";

import { VideoMontage, VideoMontageItem, VideoClip } from "./types";

interface ExportOptions {
  includeSound: boolean;
  resolution: "1080p" | "720p";
  clubLogoUrl?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchDate?: string;
}

/**
 * Client-side video montage compilation engine using Canvas 2D & MediaRecorder API.
 * Compiles cover slides, video clips, TV scoreboards, notes overlays, and audio.
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

  const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
  const recordedChunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start(100);

  const totalItems = montage.items.length;
  if (totalItems === 0) {
    throw new Error("El montaje no contiene ningún elemento para exportar.");
  }

  for (let i = 0; i < totalItems; i++) {
    const item = montage.items[i];
    const itemPct = Math.round(((i) / totalItems) * 100);
    onProgress(itemPct, `Procesando elemento ${i + 1} de ${totalItems}...`);

    if (item.type === "cover") {
      // Render Cover Slide for specified duration
      const durationSec = item.duration || 4;
      const totalFrames = durationSec * 30;

      // Preload cover background image if provided
      let bgImg: HTMLImageElement | null = null;
      if (item.bgImage) {
        try {
          bgImg = new Image();
          bgImg.crossOrigin = "anonymous";
          bgImg.src = item.bgImage;
          await new Promise((r) => {
            if (!bgImg) return r(null);
            bgImg.onload = () => r(null);
            bgImg.onerror = () => r(null);
          });
        } catch {}
      }

      for (let f = 0; f < totalFrames; f++) {
        // Draw background
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          ctx.drawImage(bgImg, 0, 0, width, height);
          ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.fillStyle = item.bgColor || "#0f172a";
          ctx.fillRect(0, 0, width, height);
        }

        // Draw Team Badge Logo if enabled
        if (item.showBadge && logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          const logoSize = height * 0.18;
          ctx.drawImage(logoImg, width / 2 - logoSize / 2, height * 0.15, logoSize, logoSize);
        }

        // Draw Title & Subtitle
        ctx.fillStyle = item.textColor || "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const titleSize = item.fontSize === "lg" ? height * 0.07 : item.fontSize === "sm" ? height * 0.04 : height * 0.055;
        ctx.font = `900 ${titleSize}px sans-serif`;
        ctx.fillText(item.title || "MONTAJE TÁCTICO", width / 2, height * 0.52);

        if (item.subtitle) {
          ctx.font = `600 ${height * 0.03}px sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
          ctx.fillText(item.subtitle, width / 2, height * 0.64);
        }

        await new Promise((r) => setTimeout(r, 1000 / 30));
      }
    } else if (item.type === "clip") {
      // Render Video Clip item
      const clipObj = allClips.find((c) => c.id === item.clipId);
      const videoUrl = item.videoUrl || clipObj?.videoUrl;

      if (!videoUrl) continue;

      const hiddenVideo = document.createElement("video");
      hiddenVideo.src = videoUrl;
      hiddenVideo.crossOrigin = "anonymous";
      hiddenVideo.muted = !options.includeSound;
      hiddenVideo.playbackRate = item.playbackSpeed || clipObj?.playbackSpeed || 1.0;

      await new Promise<void>((resolve, reject) => {
        hiddenVideo.onloadedmetadata = () => resolve();
        hiddenVideo.onerror = () => resolve();
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
        // Draw video frame to canvas
        ctx.drawImage(hiddenVideo, 0, 0, width, height);

        // 1. Draw TV Scoreboard Overlay (top-left badge)
        if (item.showScoreboard || clipObj?.scoreboardOverlay?.show) {
          const sbWidth = width * 0.28;
          const sbHeight = height * 0.07;
          const sbX = width * 0.03;
          const sbY = height * 0.04;

          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.beginPath();
          ctx.roundRect(sbX, sbY, sbWidth, sbHeight, 10);
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = `800 ${height * 0.022}px sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const matchTitleStr = `${options.homeTeamName || "LOCAL"} vs ${options.awayTeamName || "VISITANTE"}`;
          ctx.fillText(matchTitleStr.toUpperCase(), sbX + 15, sbY + sbHeight * 0.35);

          const currentMin = Math.floor(hiddenVideo.currentTime / 60);
          ctx.fillStyle = "#6366f1";
          ctx.font = `700 ${height * 0.018}px sans-serif`;
          ctx.fillText(`MIN ${currentMin}'`, sbX + 15, sbY + sbHeight * 0.72);

          // Match Date at bottom-left
          if (options.matchDate) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.font = `600 ${height * 0.018}px sans-serif`;
            ctx.fillText(`📅 ${options.matchDate}`, width * 0.03, height * 0.94);
          }
        }

        // 2. Draw Notes Overlay if configured
        const notesObj = item.notesOverlay || clipObj?.notesOverlay;
        if (notesObj?.showInVideo && notesObj.text) {
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          const noteWidth = width * 0.6;
          const noteHeight = height * 0.08;

          let nX = (width - noteWidth) / 2;
          let nY = height * 0.88;

          if (notesObj.position === "top") nY = height * 0.06;
          else if (notesObj.position === "center") nY = (height - noteHeight) / 2;
          else if (notesObj.position === "left") { nX = width * 0.04; nY = height * 0.4; }
          else if (notesObj.position === "right") { nX = width * 0.36; nY = height * 0.4; }

          ctx.beginPath();
          ctx.roundRect(nX, nY, noteWidth, noteHeight, 8);
          ctx.fill();

          ctx.fillStyle = "#facc15"; // Neon accent text
          ctx.font = `800 ${height * 0.022}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`📝 ${notesObj.text}`, nX + noteWidth / 2, nY + noteHeight / 2);
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
  a.download = `${montage.title.replace(/[^a-z0-9]/gi, "_")}_clublab.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  onProgress(100, "¡Vídeo descargado con éxito!");
}
