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

    const w = width;
    const h = height;
    canvas.width = w;
    canvas.height = h;

    // 1. White Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // 2. Pitch markings in dark grey
    const fieldZone = value?.zone ?? "full_field";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (fieldZone === "custom_area") {
      ctx.strokeRect(10, 10, w - 20, h - 20);
    } else if (fieldZone === "full_field") {
      const margin = 20;
      const fw = w - 2 * margin;
      const fh = h - 2 * margin;
      ctx.strokeRect(margin, margin, fw, fh);
      ctx.beginPath();
      ctx.moveTo(w / 2, margin);
      ctx.lineTo(w / 2, h - margin);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 2, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      // Left Penalty Area
      ctx.strokeRect(margin, h / 2 - 60, 50, 120);
      ctx.strokeRect(margin, h / 2 - 30, 20, 60);
      ctx.beginPath();
      ctx.arc(margin + 36, h / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(margin + 36, h / 2, 30, -1.085, 1.085);
      ctx.stroke();

      // Right Penalty Area
      ctx.strokeRect(w - margin - 50, h / 2 - 60, 50, 120);
      ctx.strokeRect(w - margin - 20, h / 2 - 30, 20, 60);
      ctx.beginPath();
      ctx.arc(w - margin - 36, h / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w - margin - 36, h / 2, 30, Math.PI - 1.085, Math.PI + 1.085);
      ctx.stroke();

      // Corners
      ctx.beginPath(); ctx.arc(margin, margin, 8, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, margin, 8, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(margin, h - margin, 8, Math.PI * 1.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - margin, h - margin, 8, Math.PI, Math.PI * 1.5); ctx.stroke();
    } else if (fieldZone === "half_field" || fieldZone === "defensive_third" || fieldZone === "offensive_third") {
      const margin = 20;
      const fw = w - 2 * margin;
      const fh = h - 2 * margin;
      ctx.strokeRect(margin, margin, fw, fh);
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(margin, h - margin);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(margin, h / 2, 50, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeRect(w - margin - 100, h / 2 - 100, 100, 200);
      ctx.strokeRect(w - margin - 35, h / 2 - 50, 35, 100);
      ctx.beginPath();
      ctx.arc(w - margin - 75, h / 2, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w - margin - 75, h / 2, 50, Math.PI - Math.PI / 3, Math.PI + Math.PI / 3);
      ctx.stroke();
    } else if (fieldZone === "penalty_area") {
      const margin = 10;
      ctx.strokeRect(margin, margin, w - 2 * margin, h - 2 * margin);
      const center = w / 2;
      const boxWidth = 580;
      const boxHeight = 240;
      ctx.strokeRect(center - boxWidth / 2, h - boxHeight - margin, boxWidth, boxHeight);
      ctx.strokeRect(center - 130, h - 80 - margin, 260, 80);
      ctx.beginPath();
      ctx.arc(center, h - 160 - margin, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(center, h - 160 - margin, 133, Math.PI * 1.5 - 0.925, Math.PI * 1.5 + 0.925);
      ctx.stroke();
    }

    // 3. Draw strokes (forced black for maximum ink save!)
    const strokes = value?.strokes ?? [];
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = "#000000"; // Ink saver: force black lines
      ctx.lineWidth = 2.5;
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
          // Draw arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const arrowLength = 10;
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

    // 4. Draw markers (ink saver style!)
    const markers = value?.markers ?? [];
    markers.forEach((marker) => {
      const { x, y, type, number } = marker;
      const rotation = marker.rotation ?? 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);

      if (type === "cone") {
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(-7, 7);
        ctx.lineTo(7, 7);
        ctx.closePath();
        ctx.fillStyle = "#e2e8f0"; // light grey fill
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (type === "player" || type === "rival") {
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, 2 * Math.PI);
        ctx.fillStyle = type === "player" ? "#f1f5f9" : "#fee2e2"; // Player is white-grey, Rival is light red
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(number ?? "1", 0, 0);
      } else if (type === "ball") {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.moveTo(0, -4); ctx.lineTo(0, 4);
        ctx.stroke();
      } else if (type.startsWith("goal_") || type === "mini_goal") {
        const gw = type === "goal_11" ? 40 : type === "goal_7" ? 30 : 20;
        const gh = type === "goal_11" ? 16 : type === "goal_7" ? 12 : 8;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let offset = -gw / 2; offset <= gw / 2; offset += 4) {
          ctx.moveTo(offset, -gh / 2);
          ctx.lineTo(offset * 0.7, gh / 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    });

    // 5. Draw texts
    const texts = value?.texts ?? [];
    texts.forEach((txt) => {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(txt.text, txt.x, txt.y);
    });
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
      className="bg-white rounded-xl shadow-sm border border-slate-200"
    />
  );
}
