"use client";

import { useEffect, useRef } from "react";
import { WhiteboardData } from "./TaskWhiteboard";

interface WhiteboardPrintRendererProps {
  value?: WhiteboardData;
  width?: number;
  height?: number;
}

export default function WhiteboardPrintRenderer({
  value,
  width = 600,
  height = 450,
}: WhiteboardPrintRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use High DPI (Device Pixel Ratio) for razor-sharp printing
    const dpr = 2; // Fixed 2x scaling for crisp printing
    const w = width;
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Pure White Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const hasVectorData = Boolean(
      value && ((value.strokes && value.strokes.length > 0) || (value.markers && value.markers.length > 0))
    );

    if (hasVectorData) {
      // ── DRAW VECTOR LINE ART ON CLEAN WHITE PITCH ──
      const fieldZone = value?.zone ?? "full_field";
      ctx.strokeStyle = "#334155"; // Dark Slate crisp lines
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (fieldZone === "custom_area") {
        ctx.strokeRect(10, 10, w - 20, h - 20);
      } else if (fieldZone === "full_field") {
        const margin = 16;
        const fw = w - 2 * margin;
        const fh = h - 2 * margin;
        ctx.strokeRect(margin, margin, fw, fh);
        
        // Midfield line
        ctx.beginPath();
        ctx.moveTo(w / 2, margin);
        ctx.lineTo(w / 2, h - margin);
        ctx.stroke();

        // Center circle & spot
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 40, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#1e293b";
        ctx.fill();

        // Left Penalty Area
        ctx.strokeRect(margin, h / 2 - 55, 45, 110);
        ctx.strokeRect(margin, h / 2 - 28, 18, 56);
        ctx.beginPath();
        ctx.arc(margin + 32, h / 2, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(margin + 32, h / 2, 28, -1.085, 1.085);
        ctx.stroke();

        // Right Penalty Area
        ctx.strokeRect(w - margin - 45, h / 2 - 55, 45, 110);
        ctx.strokeRect(w - margin - 18, h / 2 - 28, 18, 56);
        ctx.beginPath();
        ctx.arc(w - margin - 32, h / 2, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w - margin - 32, h / 2, 28, Math.PI - 1.085, Math.PI + 1.085);
        ctx.stroke();

        // Corners
        ctx.beginPath(); ctx.arc(margin, margin, 8, 0, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(w - margin, margin, 8, Math.PI / 2, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(margin, h - margin, 8, Math.PI * 1.5, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(w - margin, h - margin, 8, Math.PI, Math.PI * 1.5); ctx.stroke();
      } else if (fieldZone === "half_field" || fieldZone === "defensive_third" || fieldZone === "offensive_third") {
        const margin = 16;
        const fw = w - 2 * margin;
        const fh = h - 2 * margin;
        ctx.strokeRect(margin, margin, fw, fh);
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, h - margin);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(margin, h / 2, 45, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.strokeRect(w - margin - 90, h / 2 - 90, 90, 180);
        ctx.strokeRect(w - margin - 30, h / 2 - 45, 30, 90);
        ctx.beginPath();
        ctx.arc(w - margin - 65, h / 2, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
      }

      // Draw strokes (crisp ink-saver lines)
      const strokes = value?.strokes ?? [];
      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = "#000000"; // Deep black ink
        ctx.lineWidth = (stroke as any).width ? Math.max((stroke as any).width, 2.5) : 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.type === "dashed_line" || stroke.type === "dashed_arrow" || stroke.type === "dashed_rectangle") {
          ctx.setLineDash([6, 6]);
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
          const start = stroke.points[0];
          const end = stroke.points[stroke.points.length - 1];
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          if (stroke.type === "arrow" || stroke.type === "dashed_arrow") {
            ctx.setLineDash([]);
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const arrowLength = 12;
            const arrowAngle = Math.PI / 6;
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - arrowLength * Math.cos(angle - arrowAngle),
              end.y - arrowLength * Math.sin(angle - arrowAngle)
            );
            ctx.lineTo(
              end.x - arrowLength * Math.cos(angle + arrowAngle),
              end.y - arrowLength * Math.sin(angle + arrowAngle)
            );
            ctx.closePath();
            ctx.fillStyle = "#000000";
            ctx.fill();
          }
        }
        ctx.setLineDash([]);
      });

      // Draw markers
      const markers = value?.markers ?? [];
      markers.forEach((marker) => {
        const { x, y, type, number } = marker;
        const rotation = marker.rotation ?? 0;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);

        if (type === "cone") {
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(-7, 7);
          ctx.lineTo(7, 7);
          ctx.closePath();
          ctx.fillStyle = "#f59e0b"; // Vibrant Cone
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (type === "player" || type === "rival") {
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, 2 * Math.PI);
          ctx.fillStyle = type === "player" ? "#ffffff" : "#fee2e2";
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#000000";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(number ?? "1", 0, 0);
        } else if (type === "ball") {
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
          ctx.moveTo(0, -5); ctx.lineTo(0, 5);
          ctx.stroke();
        } else if (type.startsWith("goal_") || type === "mini_goal") {
          const gw = type === "goal_11" ? 40 : type === "goal_7" ? 30 : 20;
          const gh = type === "goal_11" ? 16 : type === "goal_7" ? 12 : 8;
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);
        }
        ctx.restore();
      });

      // Draw texts
      const texts = value?.texts ?? [];
      texts.forEach((txt) => {
        ctx.fillStyle = "#000000";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(txt.text, txt.x, txt.y);
      });
      ctx.restore();
    } else if (value?.imageDataUrl) {
      // ── SMART INK-SAVER CONVERSION FOR DARK PITCH SNAPSHOTS ──
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext("2d");
        if (!offCtx) return;

        offCtx.drawImage(img, 0, 0);
        const imgData = offCtx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        // Invert dark background pixels into crisp white background, keep line art dark
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (brightness < 60) {
            // Dark background pixel -> convert to pure white
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else {
            // Bright drawing stroke / marker -> convert to sharp dark line
            data[i] = Math.max(0, 255 - r);
            data[i + 1] = Math.max(0, 255 - g);
            data[i + 2] = Math.max(0, 255 - b);
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        // Draw processed image onto main high-DPI canvas
        ctx.drawImage(offCanvas, 0, 0, w, h);
        ctx.restore();
      };
      img.src = value.imageDataUrl;
    } else {
      ctx.restore();
    }
  }, [value, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: `${width}px`,
        maxHeight: `${height}px`,
        objectFit: "contain",
      }}
      className="bg-white rounded-lg border border-slate-300 shadow-none"
    />
  );
}
