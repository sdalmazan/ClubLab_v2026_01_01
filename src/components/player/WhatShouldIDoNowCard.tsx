"use client";

import React from "react";
import { ClipboardList, ArrowRight, Clock, ShieldAlert } from "lucide-react";

interface WhatShouldIDoNowCardProps {
  title: string;
  subtitle: string;
  estimatedSeconds: number;
  actionText: string;
  onAction: () => void;
  type?: "checkin" | "checkout" | "recommendation" | "info";
}

export function WhatShouldIDoNowCard({
  title,
  subtitle,
  estimatedSeconds,
  actionText,
  onAction,
  type = "checkin",
}: WhatShouldIDoNowCardProps) {
  const isUrgent = type === "checkin" || type === "checkout";

  return (
    <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-card to-card p-5 shadow-lg relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isUrgent ? "bg-blue-600 text-white shadow-md" : "bg-accent text-accent-foreground"}`}>
            {type === "checkin" || type === "checkout" ? (
              <ClipboardList className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">
              ¿Qué debería hacer ahora?
            </span>
            <h3 className="text-base font-bold text-foreground leading-tight mt-0.5">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-accent/50 px-2.5 py-1 rounded-full border border-border/40 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span>&lt; {estimatedSeconds}s</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3 font-normal leading-relaxed">
        {subtitle}
      </p>

      <button
        onClick={onAction}
        className="w-full mt-4 py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
      >
        <span>{actionText}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
