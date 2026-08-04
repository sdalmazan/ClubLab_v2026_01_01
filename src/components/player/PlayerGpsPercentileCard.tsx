"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Zap,
  Flame,
  Award,
  TrendingUp,
  MapPin,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  BarChart3,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PlayerGpsPercentileCard() {
  const [data, setData] = useState<{
    player: { id: string; name: string; position: string };
    summary: {
      sessionCount: number;
      avgDist: number;
      avgHsr: number;
      avgSprints: number;
      maxSpeed: number;
      avgPlMin: number;
    };
    latestHeatmap: any[];
    percentiles: {
      general: Record<string, number>;
      byPosition: Record<string, number>;
      global: Record<string, number>;
    };
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"position" | "general" | "global">("position");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function fetchPlayerGps() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/player/gps-stats");
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err) {
        console.error("Error fetching player GPS stats:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlayerGps();
  }, []);

  // Render heatmap when data is available
  useEffect(() => {
    if (!data?.latestHeatmap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.beginPath();
    ctx.moveTo(width / 2, 8);
    ctx.lineTo(width / 2, height - 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 28, 0, Math.PI * 2);
    ctx.stroke();

    data.latestHeatmap.forEach((pt) => {
      const posX = 8 + (pt.x / 100) * (width - 16);
      const posY = 8 + (pt.y / 100) * (height - 16);
      const radius = 18 * (pt.value || 0.5);

      const radGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, radius);
      radGrad.addColorStop(0, "rgba(239, 68, 68, 0.8)");
      radGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.5)");
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(posX, posY, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-lg animate-pulse space-y-4">
        <div className="h-4 bg-accent/40 rounded w-1/3" />
        <div className="h-24 bg-accent/30 rounded-2xl" />
      </div>
    );
  }

  if (!data || data.summary.sessionCount === 0) {
    return null; // Don't render if no GPS data exists for this player
  }

  const { summary, percentiles } = data;
  const currentPercentileSet = activeTab === "position"
    ? percentiles.byPosition
    : activeTab === "general"
    ? percentiles.general
    : percentiles.global;

  const metricsList = [
    { key: "distance", label: "Distancia Media", val: `${summary.avgDist} km`, unit: "km", pct: currentPercentileSet.distance },
    { key: "hsr", label: "HSR (>19.8 km/h)", val: `${summary.avgHsr} m`, unit: "m", pct: currentPercentileSet.hsr },
    { key: "sprints", label: "Sprints (>25.2 km/h)", val: `${summary.avgSprints}`, unit: "sprints", pct: currentPercentileSet.sprints },
    { key: "maxSpeed", label: "Velocidad Máxima", val: `${summary.maxSpeed} km/h`, unit: "km/h", pct: currentPercentileSet.maxSpeed },
    { key: "playerLoadMin", label: "Player Load / min", val: `${summary.avgPlMin}`, unit: "PL/min", pct: currentPercentileSet.playerLoadMin },
  ];

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-lg space-y-5 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Rendimiento GPS & Comparativa de Percentiles
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Basado en {summary.sessionCount} sesiones procesadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-accent px-2.5 py-1 rounded-full border border-border/40">
          <HelpCircle className="size-3" />
          <span>Datos anónimos</span>
        </div>
      </div>

      {/* Main Grid: Heatmap + Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Heatmap Canvas */}
        <div className="bg-accent/30 p-3.5 rounded-2xl border border-border/40 space-y-2">
          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" />
            Tu Mapa de Calor Posicional (Última Sesión)
          </span>
          <div className="flex justify-center">
            <canvas ref={canvasRef} width={280} height={170} className="rounded-xl border border-border/40 shadow" />
          </div>
        </div>

        {/* Right: Personal Records */}
        <div className="bg-accent/30 p-3.5 rounded-2xl border border-border/40 space-y-3">
          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
            <Award className="size-3.5 text-amber-500" />
            Tus Medias de Rendimiento WIMU
          </span>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-card p-2.5 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground block font-sans">Distancia Media</span>
              <span className="font-bold text-foreground">{summary.avgDist} km</span>
            </div>
            <div className="bg-card p-2.5 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground block font-sans">HSR (&gt;19.8 km/h)</span>
              <span className="font-bold text-emerald-500">{summary.avgHsr} m</span>
            </div>
            <div className="bg-card p-2.5 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground block font-sans">Velocidad Máx.</span>
              <span className="font-bold text-amber-500">{summary.maxSpeed} km/h</span>
            </div>
            <div className="bg-card p-2.5 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground block font-sans">Player Load / min</span>
              <span className="font-bold text-primary">{summary.avgPlMin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Percentiles Benchmark Selector & Bars */}
      <div className="space-y-3 border-t border-border/40 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Comparativa de Percentiles
          </span>

          <div className="flex bg-accent p-1 rounded-xl border border-border/40 gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("position")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                activeTab === "position"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Por Posición ({data.player.position})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                activeTab === "general"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              General Equipo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("global")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                activeTab === "global"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Global Entidad
            </button>
          </div>
        </div>

        {/* Percentile Progress Bars */}
        <div className="space-y-3 pt-1">
          {metricsList.map((item) => (
            <div key={item.key} className="bg-accent/20 p-3 rounded-2xl border border-border/40 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-foreground font-mono">{item.val}</span>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    Percentil P{item.pct} (Top {100 - item.pct}%)
                  </span>
                </div>
              </div>

              {/* Progress bar track */}
              <div className="relative w-full bg-accent h-2.5 rounded-full overflow-hidden border border-border/40">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-700"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
