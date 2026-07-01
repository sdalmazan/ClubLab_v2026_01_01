import { cn } from "@/lib/utils";
import type { PlayerStatus, AvailabilityStatus } from "@/types";
import { AlertCircle, RefreshCw } from "lucide-react";

// ============================================================
// STATUS BADGE
// ============================================================

const STATUS_CONFIG: Record<
  PlayerStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  green: {
    label: "Óptimo",
    dot: "bg-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    text: "text-emerald-400",
  },
  yellow: {
    label: "Control",
    dot: "bg-amber-400",
    bg: "bg-amber-400/10 border-amber-400/30",
    text: "text-amber-400",
  },
  red: {
    label: "Vigilar",
    dot: "bg-rose-400",
    bg: "bg-rose-400/10 border-rose-400/30",
    text: "text-rose-400",
  },
};

interface PlayerStatusBadgeProps {
  status: PlayerStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function PlayerStatusBadge({
  status,
  size = "md",
  showLabel = true,
}: PlayerStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        cfg.bg,
        cfg.text,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span className={cn("rounded-full shrink-0", cfg.dot, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {showLabel && cfg.label}
    </span>
  );
}

// ============================================================
// AVAILABILITY BADGE
// ============================================================

const AVAILABILITY_CONFIG: Record<
  AvailabilityStatus,
  { label: string; color: string }
> = {
  available: { label: "Disponible", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  control: { label: "Con control", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  not_available: { label: "No disponible", color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
};

interface AvailabilityBadgeProps {
  status: AvailabilityStatus;
}

export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  const cfg = AVAILABILITY_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ============================================================
// INJURY BADGE
// ============================================================

interface InjuryBadgeProps {
  status: "active" | "readaptation" | "resolved";
}

export function InjuryBadge({ status }: InjuryBadgeProps) {
  if (status === "resolved") return null;
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        isActive
          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
      )}
    >
      {isActive ? (
        <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
      ) : (
        <RefreshCw className="h-3 w-3 text-amber-400 shrink-0" />
      )}
      {isActive ? "Lesionado" : "Readaptación"}
    </span>
  );
}
