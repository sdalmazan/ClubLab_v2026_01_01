"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, AlertTriangle, RefreshCw, Zap, LogOut, Settings } from "lucide-react";
import { ClubBranding } from "@/components/ui/ClubBranding";

interface HeroStatusCardProps {
  playerName: string;
  status: "GOOD" | "READY" | "RECOVER" | "ATTENTION" | "PENDING";
  message: string;
  clubLogoUrl?: string | null;
  clubName?: string | null;
  onOpenSettings?: () => void;
}

export function HeroStatusCard({
  playerName,
  status,
  message,
  clubLogoUrl,
  clubName,
  onOpenSettings,
}: HeroStatusCardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const statusConfig: Record<string, { label: string; badgeBg: string; icon: any; glowColor: string }> = {
    PREPARADO: {
      label: "PREPARADO",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      icon: CheckCircle,
      glowColor: "from-emerald-500/20 via-transparent to-transparent",
    },
    GOOD: {
      label: "PREPARADO",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      icon: CheckCircle,
      glowColor: "from-emerald-500/20 via-transparent to-transparent",
    },
    READY: {
      label: "PREPARADO",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      icon: CheckCircle,
      glowColor: "from-emerald-500/20 via-transparent to-transparent",
    },
    FATIGADO: {
      label: "FATIGADO",
      badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      icon: AlertTriangle,
      glowColor: "from-amber-500/20 via-transparent to-transparent",
    },
    RECOVER: {
      label: "FATIGADO",
      badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      icon: AlertTriangle,
      glowColor: "from-amber-500/20 via-transparent to-transparent",
    },
    ATTENTION: {
      label: "FATIGADO",
      badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      icon: AlertTriangle,
      glowColor: "from-rose-500/20 via-transparent to-transparent",
    },
    READAPTACIÓN: {
      label: "READAPTACIÓN",
      badgeBg: "bg-sky-500/10 border-sky-500/30 text-sky-400",
      icon: Zap,
      glowColor: "from-sky-500/20 via-transparent to-transparent",
    },
    RECUPERACIÓN: {
      label: "RECUPERACIÓN",
      badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      icon: RefreshCw,
      glowColor: "from-rose-500/20 via-transparent to-transparent",
    },
    PENDING: {
      label: "PENDIENTE",
      badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      icon: RefreshCw,
      glowColor: "from-amber-500/20 via-transparent to-transparent",
    },
  };

  const config = statusConfig[status] || statusConfig.PREPARADO;
  const Icon = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-blue-500/20 bg-card/90 p-6 backdrop-blur-xl shadow-xl transition-all`}>
      {/* Background Gradient Ambient Light (SD Almazán Corporate Blue) */}
      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${config.glowColor} rounded-full blur-3xl pointer-events-none -mr-16 -mt-16`} />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClubBranding logoUrl={clubLogoUrl} clubName={clubName} size="md" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-blue-500">
                Tu Estado de Hoy
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-0.5">
                Hola, {playerName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${config.badgeBg} font-extrabold text-xs tracking-wide shadow-sm shrink-0`}>
              <Icon className="w-4 h-4 animate-pulse" />
              <span>{config.label}</span>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition-all active:scale-95 cursor-pointer shrink-0"
                title="Ajustes y Datos del Perfil"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-sm text-foreground/90 font-medium leading-relaxed bg-accent/40 rounded-2xl p-3.5 border border-border/40">
          "{message}"
        </p>
      </div>
    </div>
  );
}
